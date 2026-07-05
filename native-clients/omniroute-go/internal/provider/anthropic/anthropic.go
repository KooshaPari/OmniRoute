// Package anthropic implements the Anthropic Messages Provider interface.
// The proxy accepts OpenAI-shaped ChatRequest on /v1/chat/completions and
// normalizes to Anthropic's /v1/messages on the wire, then converts the
// response back. Streaming emits OpenAI-shaped SSE deltas.
package anthropic

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/kooshapari/omniroute-go/internal/provider/registry"
)

const defaultBase = "https://api.anthropic.com"
const apiVersion = "2023-06-01"

type Provider struct {
	id      string
	baseURL string
	apiKey  string
	http    *http.Client
}

type Config struct {
	ID         string
	BaseURL    string
	APIKey     string
	HTTPClient *http.Client
}

func New(cfg Config) (*Provider, error) {
	if cfg.ID == "" || cfg.APIKey == "" {
		return nil, errors.New("anthropic: id and api_key are required")
	}
	base := strings.TrimRight(cfg.BaseURL, "/")
	if base == "" {
		base = defaultBase
	}
	hc := cfg.HTTPClient
	if hc == nil {
		hc = &http.Client{Timeout: 60 * time.Second}
	}
	return &Provider{id: cfg.ID, baseURL: base, apiKey: cfg.APIKey, http: hc}, nil
}

func (p *Provider) ID() string { return p.id }

// Models returns a static catalog of well-known Anthropic models.
// The Anthropic API does not currently expose /v1/models, so we
// maintain the list in code and update it on each release.
func (p *Provider) Models(_ context.Context) ([]registry.Model, error) {
	now := time.Now().Unix()
	return []registry.Model{
		{ID: "claude-opus-4-7", Object: "model", Created: now, OwnedBy: p.id},
		{ID: "claude-sonnet-4-6", Object: "model", Created: now, OwnedBy: p.id},
		{ID: "claude-haiku-4-5-20251001", Object: "model", Created: now, OwnedBy: p.id},
		{ID: "claude-3-5-sonnet-latest", Object: "model", Created: now, OwnedBy: p.id},
		{ID: "claude-3-5-haiku-latest", Object: "model", Created: now, OwnedBy: p.id},
	}, nil
}

func (p *Provider) Ping(ctx context.Context) error { _, err := p.Models(ctx); return err }

// Wire shapes for the Anthropic Messages API.

type wireRequest struct {
	Model       string    `json:"model"`
	Messages    []wireMsg `json:"messages"`
	MaxTokens   int       `json:"max_tokens"`
	System      string    `json:"system,omitempty"`
	Temperature *float64  `json:"temperature,omitempty"`
	TopP        *float64  `json:"top_p,omitempty"`
	Stop        []string  `json:"stop_sequences,omitempty"`
	Stream      bool      `json:"stream,omitempty"`
}

type wireMsg struct {
	Role    string        `json:"role"`
	Content []wireContent `json:"content"`
}

type wireContent struct {
	Type   string          `json:"type"`
	Text   string          `json:"text,omitempty"`
	Source *wireImageSrc   `json:"source,omitempty"`
	Input  json.RawMessage `json:"input,omitempty"`
	Name   string          `json:"name,omitempty"`
}

type wireImageSrc struct {
	Type     string `json:"type"`
	MediaTyp string `json:"media_type"`
	Data     string `json:"data"`
}

type wireResponse struct {
	ID           string `json:"id"`
	Type         string `json:"type"`
	Role         string `json:"role"`
	Model        string `json:"model"`
	StopReason   string `json:"stop_reason"`
	StopSequence string `json:"stop_sequence"`
	Content      []struct {
		Type string `json:"type"`
		Text string `json:"text"`
	} `json:"content"`
	Usage struct {
		InputTokens  int `json:"input_tokens"`
		OutputTokens int `json:"output_tokens"`
	} `json:"usage"`
}

func (p *Provider) ChatCompletion(ctx context.Context, req registry.ChatRequest) (registry.ChatResponse, error) {
	wire, err := toWire(req)
	if err != nil {
		return registry.ChatResponse{}, err
	}
	body, _ := json.Marshal(wire)
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, p.baseURL+"/v1/messages", bytes.NewReader(body))
	if err != nil {
		return registry.ChatResponse{}, err
	}
	p.auth(httpReq)
	httpReq.Header.Set("Content-Type", "application/json")
	resp, err := p.http.Do(httpReq)
	if err != nil {
		return registry.ChatResponse{}, err
	}
	defer resp.Body.Close()
	if resp.StatusCode/100 != 2 {
		raw, _ := io.ReadAll(resp.Body)
		return registry.ChatResponse{}, fmt.Errorf("anthropic: %s: messages: %d: %s", p.id, resp.StatusCode, string(raw))
	}
	var w wireResponse
	if err := json.NewDecoder(resp.Body).Decode(&w); err != nil {
		return registry.ChatResponse{}, err
	}
	return fromWire(w, p.id, req.Model), nil
}

func (p *Provider) ChatCompletionStream(ctx context.Context, req registry.ChatRequest) (<-chan registry.StreamChunk, <-chan error) {
	wire, err := toWire(req)
	if err != nil {
		errCh := make(chan error, 1)
		errCh <- err
		close(errCh)
		return nil, errCh
	}
	wire.Stream = true
	body, _ := json.Marshal(wire)
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, p.baseURL+"/v1/messages", bytes.NewReader(body))
	if err != nil {
		errCh := make(chan error, 1)
		errCh <- err
		close(errCh)
		return nil, errCh
	}
	p.auth(httpReq)
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Accept", "text/event-stream")
	resp, err := p.http.Do(httpReq)
	if err != nil {
		errCh := make(chan error, 1)
		errCh <- err
		close(errCh)
		return nil, errCh
	}
	if resp.StatusCode/100 != 2 {
		raw, _ := io.ReadAll(resp.Body)
		_ = resp.Body.Close()
		errCh := make(chan error, 1)
		errCh <- fmt.Errorf("anthropic: %s: stream: %d: %s", p.id, resp.StatusCode, string(raw))
		close(errCh)
		return nil, errCh
	}
	chunkCh := make(chan registry.StreamChunk, 16)
	errCh := make(chan error, 1)
	go p.pumpSSE(ctx, resp, req.Model, chunkCh, errCh)
	return chunkCh, errCh
}

func (p *Provider) pumpSSE(ctx context.Context, resp *http.Response, model string, out chan<- registry.StreamChunk, errCh chan<- error) {
	defer close(out)
	defer resp.Body.Close()
	reader := bufio.NewReaderSize(resp.Body, 64*1024)
	id := "msg_" + fmt.Sprintf("%x", time.Now().UnixNano())
	created := time.Now().Unix()
	finish := ""
	usage := registry.Usage{}
	for {
		line, err := reader.ReadBytes('\n')
		if len(line) > 0 {
			s := strings.TrimRight(string(line), "\r\n")
			if s == "" || !strings.HasPrefix(s, "data:") {
				continue
			}
			payload := strings.TrimSpace(strings.TrimPrefix(s, "data:"))
			if payload == "[DONE]" {
				return
			}
			var ev struct {
				Type  string `json:"type"`
				Delta struct {
					Type string `json:"type"`
					Text string `json:"text"`
				} `json:"delta"`
				Message struct {
					StopReason string `json:"stop_reason"`
				} `json:"message"`
				Usage struct {
					InputTokens  int `json:"input_tokens"`
					OutputTokens int `json:"output_tokens"`
				} `json:"usage"`
			}
			if jerr := json.Unmarshal([]byte(payload), &ev); jerr != nil {
				continue
			}
			switch ev.Type {
			case "message_start":
				if ev.Usage.InputTokens > 0 || ev.Usage.OutputTokens > 0 {
					usage.PromptTokens = ev.Usage.InputTokens
					usage.CompletionTokens = ev.Usage.OutputTokens
				}
			case "content_block_delta":
				chunk := registry.StreamChunk{
					ID: id, Object: "chat.completion.chunk", Created: created, Model: model,
					Choices: []registry.StreamChoice{{
						Index: 0,
						Delta: registry.ChatMessage{Role: "assistant", Content: ev.Delta.Text},
					}},
				}
				select {
				case <-ctx.Done():
					errCh <- ctx.Err()
					return
				case out <- chunk:
				}
			case "message_delta":
				if ev.Message.StopReason != "" {
					finish = ev.Message.StopReason
				}
				if ev.Usage.OutputTokens > 0 {
					usage.CompletionTokens = ev.Usage.OutputTokens
				}
			case "message_stop":
				chunk := registry.StreamChunk{
					ID: id, Object: "chat.completion.chunk", Created: created, Model: model,
					Choices: []registry.StreamChoice{{Index: 0, FinishReason: stopReasonToFinish(finish)}},
					Usage: &usage,
					Done:  true,
				}
				select {
				case <-ctx.Done():
					errCh <- ctx.Err()
					return
				case out <- chunk:
				}
				return
			}
			continue
		}
		if err != nil {
			if !errors.Is(err, io.EOF) && ctx.Err() == nil {
				errCh <- err
			}
			return
		}
	}
}

func (p *Provider) auth(req *http.Request) {
	req.Header.Set("x-api-key", p.apiKey)
	req.Header.Set("anthropic-version", apiVersion)
}

func toWire(req registry.ChatRequest) (wireRequest, error) {
	maxTokens := 4096
	if req.MaxTokens != nil {
		maxTokens = *req.MaxTokens
	}
	w := wireRequest{Model: req.Model, MaxTokens: maxTokens, Temperature: req.Temperature, TopP: req.TopP, Stop: req.Stop}
	for _, m := range req.Messages {
		switch m.Role {
		case "system":
			s, err := messageToSystemString(m)
			if err != nil {
				return w, err
			}
			w.System = s
		case "user", "assistant":
			content, err := messageToWireContent(m)
			if err != nil {
				return w, err
			}
			w.Messages = append(w.Messages, wireMsg{Role: m.Role, Content: content})
		case "tool", "function":
			// tool results: map to a user message with the tool_result content type
			txt, _ := m.Content.(string)
			w.Messages = append(w.Messages, wireMsg{
				Role: "user",
				Content: []wireContent{{
					Type: "tool_result",
					// tool_use_id is conventionally passed via metadata; for v1 we ignore it.
					Text: txt,
				}},
			})
		}
	}
	return w, nil
}

func messageToSystemString(m registry.ChatMessage) (string, error) {
	switch c := m.Content.(type) {
	case string:
		return c, nil
	default:
		b, err := json.Marshal(c)
		if err != nil {
			return "", err
		}
		return string(b), nil
	}
}

func messageToWireContent(m registry.ChatMessage) ([]wireContent, error) {
	switch c := m.Content.(type) {
	case string:
		return []wireContent{{Type: "text", Text: c}}, nil
	case []any:
		var out []wireContent
		for _, p := range c {
			pm, ok := p.(map[string]any)
			if !ok {
				continue
			}
			ptype, _ := pm["type"].(string)
			switch ptype {
			case "text":
				s, _ := pm["text"].(string)
				out = append(out, wireContent{Type: "text", Text: s})
			case "image_url":
				if u, ok := pm["image_url"].(map[string]any); ok {
					if s, ok := u["url"].(string); ok && strings.HasPrefix(s, "data:") {
						// data:<mediatype>;base64,<data>
						rest := strings.TrimPrefix(s, "data:")
						parts := strings.SplitN(rest, ";", 2)
						media := parts[0]
						data := strings.TrimPrefix(rest, media+";base64,")
						out = append(out, wireContent{Type: "image", Source: &wireImageSrc{Type: "base64", MediaTyp: media, Data: data}})
					}
				}
			}
		}
		return out, nil
	default:
		b, err := json.Marshal(c)
		if err != nil {
			return nil, err
		}
		return []wireContent{{Type: "text", Text: string(b)}}, nil
	}
}

func fromWire(w wireResponse, providerID, model string) registry.ChatResponse {
	var text strings.Builder
	for _, b := range w.Content {
		if b.Type == "text" {
			text.WriteString(b.Text)
		}
	}
	return registry.ChatResponse{
		ID: w.ID, Object: "chat.completion", Created: time.Now().Unix(), Model: model,
		ProviderID: providerID,
		Choices: []registry.Choice{{
			Index: 0,
			Message: registry.ChatMessage{
				Role:    "assistant",
				Content: text.String(),
			},
			FinishReason: stopReasonToFinish(w.StopReason),
		}},
		Usage: registry.Usage{
			PromptTokens:     w.Usage.InputTokens,
			CompletionTokens: w.Usage.OutputTokens,
			TotalTokens:      w.Usage.InputTokens + w.Usage.OutputTokens,
		},
	}
}

func stopReasonToFinish(s string) string {
	switch s {
	case "end_turn", "stop_sequence":
		return "stop"
	case "max_tokens":
		return "length"
	case "tool_use":
		return "tool_calls"
	default:
		return s
	}
}

// BaseURL returns the upstream base URL the provider is configured with.
func (p *Provider) BaseURL() string { return p.baseURL }
