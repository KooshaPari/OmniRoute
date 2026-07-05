// Package openai implements the OpenAI-compatible Provider interface.
// It speaks the wire format of api.openai.com and any third-party
// service that publishes an OpenAI-compatible /v1/chat/completions
// (Together, Groq, Fireworks, OpenRouter, vLLM, Ollama, etc).
package openai

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

const defaultBase = "https://api.openai.com"

type Provider struct {
	id      string
	baseURL string
	apiKey  string
	http    *http.Client
	models  []registry.Model
}

type Config struct {
	ID      string
	BaseURL string
	APIKey  string
	// StaticModels optionally overrides discovery for self-hosted or
	// air-gapped providers that don't expose /v1/models.
	StaticModels []registry.Model
	HTTPClient   *http.Client
}

// New returns an OpenAI-compatible provider. If baseURL is empty,
// the official api.openai.com is used.
func New(cfg Config) (*Provider, error) {
	if cfg.ID == "" {
		return nil, errors.New("openai: id is required")
	}
	if cfg.APIKey == "" {
		return nil, fmt.Errorf("openai: %s: api_key is required", cfg.ID)
	}
	base := strings.TrimRight(cfg.BaseURL, "/")
	if base == "" {
		base = defaultBase
	}
	hc := cfg.HTTPClient
	if hc == nil {
		hc = &http.Client{Timeout: 60 * time.Second}
	}
	return &Provider{
		id:      cfg.ID,
		baseURL: base,
		apiKey:  cfg.APIKey,
		http:    hc,
		models:  cfg.StaticModels,
	}, nil
}

func (p *Provider) ID() string { return p.id }

func (p *Provider) Models(ctx context.Context) ([]registry.Model, error) {
	if len(p.models) > 0 {
		return p.models, nil
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, p.baseURL+"/v1/models", nil)
	if err != nil {
		return nil, err
	}
	p.auth(req)
	resp, err := p.http.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode/100 != 2 {
		return nil, fmt.Errorf("openai: %s: /v1/models: %d", p.id, resp.StatusCode)
	}
	var body struct {
		Data []registry.Model `json:"data"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		return nil, err
	}
	for i := range body.Data {
		if body.Data[i].Object == "" {
			body.Data[i].Object = "model"
		}
		if body.Data[i].OwnedBy == "" {
			body.Data[i].OwnedBy = p.id
		}
	}
	return body.Data, nil
}

func (p *Provider) Ping(ctx context.Context) error {
	_, err := p.Models(ctx)
	return err
}

func (p *Provider) ChatCompletion(ctx context.Context, req registry.ChatRequest) (registry.ChatResponse, error) {
	body, err := json.Marshal(req)
	if err != nil {
		return registry.ChatResponse{}, err
	}
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, p.baseURL+"/v1/chat/completions", bytes.NewReader(body))
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
		return registry.ChatResponse{}, fmt.Errorf("openai: %s: chat: %d: %s", p.id, resp.StatusCode, string(raw))
	}
	var out registry.ChatResponse
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		return registry.ChatResponse{}, err
	}
	out.ProviderID = p.id
	return out, nil
}

func (p *Provider) ChatCompletionStream(ctx context.Context, req registry.ChatRequest) (<-chan registry.StreamChunk, <-chan error) {
	req.Stream = true
	body, err := json.Marshal(req)
	if err != nil {
		errCh := make(chan error, 1)
		errCh <- err
		close(errCh)
		return nil, errCh
	}
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, p.baseURL+"/v1/chat/completions", bytes.NewReader(body))
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
		errCh <- fmt.Errorf("openai: %s: stream: %d: %s", p.id, resp.StatusCode, string(raw))
		close(errCh)
		return nil, errCh
	}

	chunkCh := make(chan registry.StreamChunk, 16)
	errCh := make(chan error, 1)
	go p.pumpSSE(ctx, resp, chunkCh, errCh)
	return chunkCh, errCh
}

func (p *Provider) pumpSSE(ctx context.Context, resp *http.Response, out chan<- registry.StreamChunk, errCh chan<- error) {
	defer close(out)
	defer resp.Body.Close()
	reader := bufio.NewReaderSize(resp.Body, 64*1024)
	for {
		line, err := reader.ReadBytes('\n')
		if len(line) > 0 {
			s := strings.TrimRight(string(line), "\r\n")
			if s == "" {
				continue
			}
			if !strings.HasPrefix(s, "data:") {
				continue
			}
			payload := strings.TrimSpace(strings.TrimPrefix(s, "data:"))
			if payload == "[DONE]" {
				return
			}
			var chunk registry.StreamChunk
			if jerr := json.Unmarshal([]byte(payload), &chunk); jerr != nil {
				continue // tolerate non-JSON keepalives
			}
			if len(chunk.Choices) > 0 && chunk.Choices[0].FinishReason != "" {
				chunk.Done = true
			}
			select {
			case <-ctx.Done():
				errCh <- ctx.Err()
				return
			case out <- chunk:
			}
			if chunk.Done {
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
	req.Header.Set("Authorization", "Bearer "+p.apiKey)
}

// BaseURL returns the upstream base URL the provider is configured with.
func (p *Provider) BaseURL() string { return p.baseURL }
