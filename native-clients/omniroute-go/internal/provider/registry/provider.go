// Package registry defines the Provider interface, request/response shapes,
// and a small in-memory registry used by the proxy.
package registry

import (
	"context"
	"errors"
	"net/http"
	"sync"
	"time"
)

// ChatRequest is the OpenAI-compatible chat completion request.
// The proxy accepts this shape on /v1/chat/completions and forwards
// (possibly after provider-specific transform) to the chosen upstream.
type ChatRequest struct {
	Model       string         `json:"model"`
	Messages    []ChatMessage  `json:"messages"`
	Stream      bool           `json:"stream,omitempty"`
	Temperature *float64       `json:"temperature,omitempty"`
	TopP        *float64       `json:"top_p,omitempty"`
	MaxTokens   *int           `json:"max_tokens,omitempty"`
	Stop        []string       `json:"stop,omitempty"`
	User        string         `json:"user,omitempty"`
	Tools       []Tool         `json:"tools,omitempty"`
	ToolChoice  any            `json:"tool_choice,omitempty"`
	Metadata    map[string]any `json:"metadata,omitempty"`
	// RequestID is a server-assigned correlation ID.
	RequestID string `json:"-"`
}

type ChatMessage struct {
	Role    string `json:"role"`
	Content any    `json:"content"` // string or array of content parts
	Name    string `json:"name,omitempty"`
	// Tool call fields (assistant -> tool_use)
	ToolCallID string     `json:"tool_call_id,omitempty"`
	ToolCalls  []ToolCall `json:"tool_calls,omitempty"`
}

type Tool struct {
	Type     string `json:"type"` // "function"
	Function struct {
		Name        string `json:"name"`
		Description string `json:"description,omitempty"`
		Parameters  any    `json:"parameters,omitempty"`
	} `json:"function"`
}

type ToolCall struct {
	ID       string `json:"id"`
	Type     string `json:"type"`
	Function struct {
		Name      string `json:"name"`
		Arguments string `json:"arguments"`
	} `json:"function"`
}

// Choice, Usage mirror the OpenAI non-streaming response.
type ChatResponse struct {
	ID      string   `json:"id"`
	Object  string   `json:"object"`
	Created int64    `json:"created"`
	Model   string   `json:"model"`
	Choices []Choice `json:"choices"`
	Usage   Usage    `json:"usage"`
	// ProviderID is which provider actually served (after routing/fallback).
	ProviderID string `json:"provider_id,omitempty"`
}

type Choice struct {
	Index        int         `json:"index"`
	Message      ChatMessage `json:"message"`
	FinishReason string      `json:"finish_reason"`
}

type Usage struct {
	PromptTokens     int `json:"prompt_tokens"`
	CompletionTokens int `json:"completion_tokens"`
	TotalTokens      int `json:"total_tokens"`
}

// StreamChunk is one SSE event the proxy emits. Providers emit their
// native chunk type; the provider adapter normalizes into this shape.
type StreamChunk struct {
	ID      string         `json:"id"`
	Object  string         `json:"object"`
	Created int64          `json:"created"`
	Model   string         `json:"model"`
	Choices []StreamChoice `json:"choices"`
	// Done is set on the terminal chunk so the proxy can emit the [DONE] sentinel.
	Done bool `json:"-"`
	// Error is set on mid-stream error envelopes.
	Error *APIError `json:"error,omitempty"`
	// Usage attached to final chunk if upstream provides it.
	Usage *Usage `json:"usage,omitempty"`
}

type StreamChoice struct {
	Index        int         `json:"index"`
	Delta        ChatMessage `json:"delta"`
	FinishReason string      `json:"finish_reason,omitempty"`
}

// Model is one entry on /v1/models.
type Model struct {
	ID      string `json:"id"`
	Object  string `json:"object"`
	Created int64  `json:"created"`
	OwnedBy string `json:"owned_by"`
}

// APIError is the OpenAI-shaped error envelope we emit. It MUST match the
// shape of the TS service so existing SDKs do not break.
type APIError struct {
	Message string `json:"message"`
	Type    string `json:"type"`
	Code    string `json:"code,omitempty"`
	Param   string `json:"param,omitempty"`
}

// Provider is the contract every upstream adapter implements.
// The proxy never imports a provider package directly; it only knows
// the interface and the registry.
type Provider interface {
	ID() string
	// Models returns the catalog this provider currently advertises.
	Models(ctx context.Context) ([]Model, error)
	// ChatCompletion performs a non-streaming completion.
	ChatCompletion(ctx context.Context, req ChatRequest) (ChatResponse, error)
	// ChatCompletionStream yields one chunk at a time. The provider MUST
	// close the channel on completion or error. The final chunk should
	// have Done=true OR include a non-empty finish_reason; the proxy will
	// emit [DONE] after the provider closes the channel.
	ChatCompletionStream(ctx context.Context, req ChatRequest) (<-chan StreamChunk, <-chan error)
	// Ping checks that the provider credentials are valid.
	Ping(ctx context.Context) error
}

// Registry holds providers by ID and supports hot-reload.
type Registry struct {
	mu        sync.RWMutex
	providers map[string]Provider
}

func NewRegistry() *Registry {
	return &Registry{providers: map[string]Provider{}}
}

func (r *Registry) Register(p Provider) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.providers[p.ID()] = p
}

func (r *Registry) Get(id string) (Provider, bool) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	p, ok := r.providers[id]
	return p, ok
}

func (r *Registry) List() []Provider {
	r.mu.RLock()
	defer r.mu.RUnlock()
	out := make([]Provider, 0, len(r.providers))
	for _, p := range r.providers {
		out = append(out, p)
	}
	return out
}

// AllModels is the union of provider catalogs, used for /v1/models.
func (r *Registry) AllModels(ctx context.Context) []Model {
	var out []Model
	for _, p := range r.List() {
		ms, err := p.Models(ctx)
		if err != nil {
			continue
		}
		out = append(out, ms...)
	}
	return out
}

// ErrProviderUnavailable is returned when a provider is in cooldown or not registered.
var ErrProviderUnavailable = errors.New("provider unavailable")

// Common errors
var (
	ErrNotFound      = errors.New("not found")
	ErrUnauthorized  = errors.New("unauthorized")
	ErrUpstream      = errors.New("upstream error")
	ErrCircuitOpen   = errors.New("circuit open")
	ErrContextCancel = errors.New("context cancelled")
)

// HTTPStatus maps a registry error to the OpenAI-style status code.
func HTTPStatus(err error) int {
	switch {
	case err == nil:
		return http.StatusOK
	case errors.Is(err, ErrUnauthorized):
		return http.StatusUnauthorized
	case errors.Is(err, ErrNotFound):
		return http.StatusNotFound
	case errors.Is(err, ErrCircuitOpen), errors.Is(err, ErrProviderUnavailable):
		return http.StatusServiceUnavailable
	case errors.Is(err, ErrContextCancel):
		return 499 // client closed request
	default:
		return http.StatusBadGateway
	}
}

// Sleep is a context-aware sleep helper. Use it in retry backoffs.
func Sleep(ctx context.Context, d time.Duration) bool {
	select {
	case <-ctx.Done():
		return false
	case <-time.After(d):
		return true
	}
}
