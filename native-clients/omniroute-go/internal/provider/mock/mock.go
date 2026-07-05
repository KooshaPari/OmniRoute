// Package mock is a deterministic in-process provider used for contract
// tests and local smoke runs. It implements registry.Provider end-to-end
// without making any external network calls.
package mock

import (
	"context"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/kooshapari/omniroute-go/internal/provider/registry"
)

type Provider struct {
	id     string
	models []registry.Model
	// EchoPrefix is prepended to non-streaming responses.
	EchoPrefix string
	// StreamChunkSize controls the chunk granularity for the mock stream.
	StreamChunkSize int
	// Latency injected before each response.
	Latency time.Duration
	mu       sync.Mutex
	failNext error
}

type Config struct {
	ID              string
	Models          []string
	EchoPrefix      string
	StreamChunkSize int
	Latency         time.Duration
}

func New(cfg Config) *Provider {
	if cfg.ID == "" {
		cfg.ID = "mock"
	}
	if cfg.StreamChunkSize == 0 {
		cfg.StreamChunkSize = 4
	}
	if cfg.EchoPrefix == "" {
		cfg.EchoPrefix = "mock: "
	}
	now := time.Now().Unix()
	models := make([]registry.Model, 0, len(cfg.Models))
	for _, m := range cfg.Models {
		models = append(models, registry.Model{
			ID: m, Object: "model", Created: now, OwnedBy: cfg.ID,
		})
	}
	return &Provider{
		id:              cfg.ID,
		models:          models,
		EchoPrefix:      cfg.EchoPrefix,
		StreamChunkSize: cfg.StreamChunkSize,
		Latency:         cfg.Latency,
	}
}

func (p *Provider) ID() string { return p.id }
func (p *Provider) Models(_ context.Context) ([]registry.Model, error) { return p.models, nil }
func (p *Provider) Ping(_ context.Context) error { return nil }

func (p *Provider) maybeFail() error {
	p.mu.Lock()
	defer p.mu.Unlock()
	if p.failNext != nil {
		err := p.failNext
		p.failNext = nil
		return err
	}
	return nil
}

func (p *Provider) FailNext(err error) {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.failNext = err
}

func (p *Provider) ChatCompletion(ctx context.Context, req registry.ChatRequest) (registry.ChatResponse, error) {
	if err := p.maybeFail(); err != nil {
		return registry.ChatResponse{}, err
	}
	if p.Latency > 0 {
		select {
		case <-ctx.Done():
			return registry.ChatResponse{}, ctx.Err()
		case <-time.After(p.Latency):
		}
	}
	last := lastUserText(req)
	text := p.EchoPrefix + last
	return registry.ChatResponse{
		ID:      "chatcmpl-mock-" + req.RequestID,
		Object:  "chat.completion",
		Created: time.Now().Unix(),
		Model:   req.Model,
		Choices: []registry.Choice{{
			Index:        0,
			Message:      registry.ChatMessage{Role: "assistant", Content: text},
			FinishReason: "stop",
		}},
		Usage: registry.Usage{
			PromptTokens:     len(last),
			CompletionTokens: len(text),
			TotalTokens:      len(last) + len(text),
		},
		ProviderID: p.id,
	}, nil
}

func (p *Provider) ChatCompletionStream(ctx context.Context, req registry.ChatRequest) (<-chan registry.StreamChunk, <-chan error) {
	if err := p.maybeFail(); err != nil {
		errCh := make(chan error, 1)
		errCh <- err
		close(errCh)
		return nil, errCh
	}
	chunkCh := make(chan registry.StreamChunk, 16)
	errCh := make(chan error, 1)
	go func() {
		defer close(chunkCh)
		text := p.EchoPrefix + lastUserText(req)
		runes := []rune(text)
		id := "chatcmpl-mock-" + req.RequestID
		created := time.Now().Unix()
		for i := 0; i < len(runes); i += p.StreamChunkSize {
			end := i + p.StreamChunkSize
			if end > len(runes) {
				end = len(runes)
			}
			chunk := registry.StreamChunk{
				ID: id, Object: "chat.completion.chunk", Created: created, Model: req.Model,
				Choices: []registry.StreamChoice{{
					Index: 0,
					Delta: registry.ChatMessage{Role: "assistant", Content: string(runes[i:end])},
				}},
			}
			select {
			case <-ctx.Done():
				errCh <- ctx.Err()
				return
			case chunkCh <- chunk:
			}
		}
		final := registry.StreamChunk{
			ID: id, Object: "chat.completion.chunk", Created: created, Model: req.Model,
			Choices: []registry.StreamChoice{{Index: 0, FinishReason: "stop"}},
			Usage: &registry.Usage{
				PromptTokens:     len(lastUserText(req)),
				CompletionTokens: len(text),
				TotalTokens:      len(lastUserText(req)) + len(text),
			},
			Done: true,
		}
		select {
		case <-ctx.Done():
			errCh <- ctx.Err()
			return
		case chunkCh <- final:
		}
	}()
	return chunkCh, errCh
}

func lastUserText(req registry.ChatRequest) string {
	for i := len(req.Messages) - 1; i >= 0; i-- {
		if req.Messages[i].Role == "user" {
			return contentToString(req.Messages[i].Content)
		}
	}
	if len(req.Messages) > 0 {
		return contentToString(req.Messages[0].Content)
	}
	return ""
}

func contentToString(c any) string {
	switch v := c.(type) {
	case string:
		return v
	case []any:
		var b strings.Builder
		for _, p := range v {
			if pm, ok := p.(map[string]any); ok {
				if s, ok := pm["text"].(string); ok {
					b.WriteString(s)
				}
			}
		}
		return b.String()
	default:
		return fmt.Sprintf("%v", v)
	}
}
