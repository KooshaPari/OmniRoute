package proxy

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/kooshapari/omniroute-go/internal/provider/mock"
	"github.com/kooshapari/omniroute-go/internal/provider/registry"
)

func newTestServer(t *testing.T) (*httptest.Server, *mock.Provider) {
	t.Helper()
	reg := registry.NewRegistry()
	mp := mock.New(mock.Config{
		ID:              "mock",
		Models:          []string{"mock-gpt", "mock-fast", "mock-big"},
		EchoPrefix:      "echo:",
		StreamChunkSize: 3,
	})
	reg.Register(mp)
	srv := New(ServerConfig{DataDir: t.TempDir()}, reg, nil)
	srv.MarkReady()
	ts := httptest.NewServer(srv.Handler())
	t.Cleanup(ts.Close)
	return ts, mp
}

func TestHealthz(t *testing.T) {
	ts, _ := newTestServer(t)
	resp, err := http.Get(ts.URL + "/healthz")
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		t.Fatalf("status: %d", resp.StatusCode)
	}
	var body map[string]any
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		t.Fatal(err)
	}
	if body["status"] != "ok" {
		t.Fatalf("status: %v", body["status"])
	}
	if _, ok := body["version"]; !ok {
		t.Fatalf("missing version: %v", body)
	}
}

func TestReadyz(t *testing.T) {
	ts, _ := newTestServer(t)
	resp, err := http.Get(ts.URL + "/readyz")
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		t.Fatalf("status: %d", resp.StatusCode)
	}
}

func TestListModels(t *testing.T) {
	ts, _ := newTestServer(t)
	resp, err := http.Get(ts.URL + "/v1/models")
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		t.Fatalf("status: %d", resp.StatusCode)
	}
	var body struct {
		Object string             `json:"object"`
		Data   []registry.Model   `json:"data"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		t.Fatal(err)
	}
	if body.Object != "list" {
		t.Fatalf("object: %q", body.Object)
	}
	if len(body.Data) != 3 {
		t.Fatalf("expected 3 models, got %d", len(body.Data))
	}
}

func TestGetModel(t *testing.T) {
	ts, _ := newTestServer(t)
	resp, err := http.Get(ts.URL + "/v1/models/mock-fast")
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		t.Fatalf("status: %d", resp.StatusCode)
	}
}

func TestGetModelNotFound(t *testing.T) {
	ts, _ := newTestServer(t)
	resp, err := http.Get(ts.URL + "/v1/models/nope")
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != 404 {
		t.Fatalf("status: %d", resp.StatusCode)
	}
}

func TestListProviders(t *testing.T) {
	ts, _ := newTestServer(t)
	resp, err := http.Get(ts.URL + "/api/providers")
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		t.Fatalf("status: %d", resp.StatusCode)
	}
	var body struct {
		Data []map[string]string `json:"data"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		t.Fatal(err)
	}
	if len(body.Data) != 1 || body.Data[0]["id"] != "mock" {
		t.Fatalf("providers: %+v", body)
	}
}

func TestChatCompletion(t *testing.T) {
	ts, _ := newTestServer(t)
	body := `{"model":"mock-gpt","messages":[{"role":"user","content":"hello world"}]}`
	resp, err := http.Post(ts.URL+"/v1/chat/completions", "application/json", strings.NewReader(body))
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		raw, _ := io.ReadAll(resp.Body)
		t.Fatalf("status: %d body: %s", resp.StatusCode, string(raw))
	}
	var out registry.ChatResponse
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		t.Fatal(err)
	}
	if out.Object != "chat.completion" {
		t.Fatalf("object: %q", out.Object)
	}
	if len(out.Choices) != 1 {
		t.Fatalf("choices: %d", len(out.Choices))
	}
	if out.Choices[0].Message.Role != "assistant" {
		t.Fatalf("role: %q", out.Choices[0].Message.Role)
	}
	if out.Choices[0].Message.Content != "echo:hello world" {
		t.Fatalf("content: %q", out.Choices[0].Message.Content)
	}
	if out.ProviderID != "mock" {
		t.Fatalf("provider_id: %q", out.ProviderID)
	}
	if out.Usage.TotalTokens == 0 {
		t.Fatalf("usage empty: %+v", out.Usage)
	}
}

func TestChatCompletion_ProviderPrefix(t *testing.T) {
	ts, _ := newTestServer(t)
	// "mock/mock-gpt" -> provider=mock, model=mock-gpt
	body := `{"model":"mock/mock-gpt","messages":[{"role":"user","content":"hi"}]}`
	resp, err := http.Post(ts.URL+"/v1/chat/completions", "application/json", strings.NewReader(body))
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		raw, _ := io.ReadAll(resp.Body)
		t.Fatalf("status: %d body: %s", resp.StatusCode, string(raw))
	}
	var out registry.ChatResponse
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		t.Fatal(err)
	}
	if out.Model != "mock-gpt" {
		t.Fatalf("model: %q", out.Model)
	}
}

func TestChatCompletion_MissingModel(t *testing.T) {
	ts, _ := newTestServer(t)
	body := `{"messages":[{"role":"user","content":"x"}]}`
	resp, err := http.Post(ts.URL+"/v1/chat/completions", "application/json", strings.NewReader(body))
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != 400 {
		t.Fatalf("status: %d", resp.StatusCode)
	}
}

func TestChatCompletion_Stream(t *testing.T) {
	ts, _ := newTestServer(t)
	body := `{"model":"mock-gpt","messages":[{"role":"user","content":"hello world"}],"stream":true}`
	resp, err := http.Post(ts.URL+"/v1/chat/completions", "application/json", strings.NewReader(body))
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		t.Fatalf("status: %d", resp.StatusCode)
	}
	if ct := resp.Header.Get("Content-Type"); !strings.HasPrefix(ct, "text/event-stream") {
		t.Fatalf("content-type: %q", ct)
	}
	reader := bufio.NewReader(resp.Body)
	var chunks []registry.StreamChunk
	sawDone := false
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
				sawDone = true
				break
			}
			var c registry.StreamChunk
			if jerr := json.Unmarshal([]byte(payload), &c); jerr != nil {
				t.Fatalf("bad chunk: %s err=%v", payload, jerr)
			}
			chunks = append(chunks, c)
		}
		if err != nil {
			if err != io.EOF {
				t.Fatalf("read err: %v", err)
			}
			break
		}
	}
	if !sawDone {
		t.Fatal("missing [DONE] sentinel")
	}
	if len(chunks) == 0 {
		t.Fatal("no chunks")
	}
	// Reassemble
	var b strings.Builder
	for _, c := range chunks {
		for _, ch := range c.Choices {
			if s, ok := ch.Delta.Content.(string); ok {
				b.WriteString(s)
			}
		}
	}
	if b.String() != "echo:hello world" {
		t.Fatalf("stream reassembly: %q", b.String())
	}
}

func TestBearerAuth(t *testing.T) {
	reg := registry.NewRegistry()
	reg.Register(mock.New(mock.Config{ID: "mock", Models: []string{"m"}}))
	srv := New(ServerConfig{DataDir: t.TempDir(), APIKey: "secret"}, reg, nil)
	srv.MarkReady()
	ts := httptest.NewServer(srv.Handler())
	defer ts.Close()

	// No auth -> 401
	resp, err := http.Post(ts.URL+"/v1/chat/completions", "application/json", strings.NewReader(`{"model":"m","messages":[{"role":"user","content":"x"}]}`))
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != 401 {
		t.Fatalf("expected 401, got %d", resp.StatusCode)
	}

	// Correct auth -> 200
	req, _ := http.NewRequest("POST", ts.URL+"/v1/chat/completions", strings.NewReader(`{"model":"m","messages":[{"role":"user","content":"x"}]}`))
	req.Header.Set("Authorization", "Bearer secret")
	req.Header.Set("Content-Type", "application/json")
	resp, err = http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		t.Fatalf("expected 200, got %d", resp.StatusCode)
	}
}

func TestShadowMode(t *testing.T) {
	reg := registry.NewRegistry()
	reg.Register(mock.New(mock.Config{ID: "mock", Models: []string{"m"}}))
	srv := New(ServerConfig{DataDir: t.TempDir(), ShadowMode: true}, reg, nil)
	srv.MarkReady()
	ts := httptest.NewServer(srv.Handler())
	defer ts.Close()

	resp, err := http.Post(ts.URL+"/v1/chat/completions", "application/json", strings.NewReader(`{"model":"m","messages":[{"role":"user","content":"x"}]}`))
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusAccepted {
		t.Fatalf("expected 202, got %d", resp.StatusCode)
	}
	if mode := resp.Header.Get("X-OmniRoute-Mode"); mode != "shadow" {
		t.Fatalf("X-OmniRoute-Mode: %q", mode)
	}
}

func TestProviderError(t *testing.T) {
	ts, mp := newTestServer(t)
	mp.FailNext(registry.ErrUpstream)
	body := `{"model":"mock-gpt","messages":[{"role":"user","content":"x"}]}`
	resp, err := http.Post(ts.URL+"/v1/chat/completions", "application/json", strings.NewReader(body))
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusBadGateway {
		t.Fatalf("status: %d", resp.StatusCode)
	}
	raw, _ := io.ReadAll(resp.Body)
	if !bytes.Contains(raw, []byte(`"error"`)) {
		t.Fatalf("missing error envelope: %s", string(raw))
	}
}

func TestNoProvider(t *testing.T) {
	reg := registry.NewRegistry()
	srv := New(ServerConfig{DataDir: t.TempDir()}, reg, nil)
	srv.MarkReady()
	ts := httptest.NewServer(srv.Handler())
	defer ts.Close()
	body := `{"model":"m","messages":[{"role":"user","content":"x"}]}`
	resp, err := http.Post(ts.URL+"/v1/chat/completions", "application/json", strings.NewReader(body))
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != 404 {
		t.Fatalf("status: %d", resp.StatusCode)
	}
}

func TestVersionEndpoint(t *testing.T) {
	ts, _ := newTestServer(t)
	resp, err := http.Get(ts.URL + "/api/version")
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		t.Fatalf("status: %d", resp.StatusCode)
	}
}

func TestUsageEndpoint(t *testing.T) {
	ts, _ := newTestServer(t)
	resp, err := http.Get(ts.URL + "/api/usage")
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		t.Fatalf("status: %d", resp.StatusCode)
	}
}

func TestReadinessBeforeMark(t *testing.T) {
	reg := registry.NewRegistry()
	srv := New(ServerConfig{DataDir: t.TempDir()}, reg, nil)
	ts := httptest.NewServer(srv.Handler())
	defer ts.Close()
	resp, err := http.Get(ts.URL + "/readyz")
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != 503 {
		t.Fatalf("expected 503 before MarkReady, got %d", resp.StatusCode)
	}
}

// Smoke: send 50 chat-completion requests in a row to ensure no goroutine leaks.
func TestSmoke50(t *testing.T) {
	ts, _ := newTestServer(t)
	for i := 0; i < 50; i++ {
		body := `{"model":"mock-fast","messages":[{"role":"user","content":"hi"}]}`
		ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
		req, _ := http.NewRequestWithContext(ctx, "POST", ts.URL+"/v1/chat/completions", strings.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		resp, err := http.DefaultClient.Do(req)
		cancel()
		if err != nil {
			t.Fatalf("iter %d: %v", i, err)
		}
		_, _ = io.Copy(io.Discard, resp.Body)
		resp.Body.Close()
		if resp.StatusCode != 200 {
			t.Fatalf("iter %d: status %d", i, resp.StatusCode)
		}
	}
}
