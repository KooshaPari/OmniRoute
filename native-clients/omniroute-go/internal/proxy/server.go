// Package proxy is the OmniRoute OpenAI-compatible HTTP gateway.
//
// Endpoints (v1, OpenAI-shaped):
//   POST /v1/chat/completions       OpenAI-compatible chat
//   GET  /v1/models                 model catalog (union of providers)
//   GET  /v1/models/{id}            single model
//
// Health:
//   GET  /healthz                   liveness
//   GET  /readyz                    readiness
//
// Admin (OmniRoute-native):
//   GET  /api/providers             list registered providers
//   GET  /api/usage                 usage summary (stub; backed by SQLite in P6)
package proxy

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"

	"github.com/kooshapari/omniroute-go/internal/observability"
	"github.com/kooshapari/omniroute-go/internal/provider/registry"
)

// Server is the HTTP gateway.
type Server struct {
	cfg   ServerConfig
	reg   *registry.Registry
	mux   *http.ServeMux
	boot  time.Time
	ready bool
	log   *slog.Logger
}

type ServerConfig struct {
	Listen      string
	DataDir     string
	APIKey      string // optional, set to enforce bearer auth on /v1/*
	ShadowMode  bool   // when true, log requests but never serve
	ReadTimeout time.Duration
}

// New builds a Server. The registry must already have providers registered.
func New(cfg ServerConfig, reg *registry.Registry, log *slog.Logger) *Server {
	if log == nil {
		log = observability.Default()
	}
	if cfg.ReadTimeout == 0 {
		cfg.ReadTimeout = 30 * time.Second
	}
	s := &Server{
		cfg:  cfg,
		reg:  reg,
		mux:  http.NewServeMux(),
		boot: time.Now(),
		log:  log,
	}
	s.routes()
	return s
}

// Handler returns the http.Handler (useful for tests).
func (s *Server) Handler() http.Handler { return s.middleware(s.mux) }

func (s *Server) routes() {
	// Health
	s.mux.HandleFunc("GET /healthz", s.handleHealthz)
	s.mux.HandleFunc("GET /readyz", s.handleReadyz)

	// OpenAI-compatible
	s.mux.HandleFunc("POST /v1/chat/completions", s.handleChatCompletions)
	s.mux.HandleFunc("GET /v1/models", s.handleListModels)
	s.mux.HandleFunc("GET /v1/models/{id}", s.handleGetModel)

	// Admin
	s.mux.HandleFunc("GET /api/providers", s.handleListProviders)
	s.mux.HandleFunc("GET /api/usage", s.handleUsage)
	s.mux.HandleFunc("GET /api/version", s.handleVersion)
}

// MarkReady flips the ready flag. Call this after the registry is warm.
func (s *Server) MarkReady() { s.ready = true }

// Run starts the server. Blocks until ctx is cancelled or the listener fails.
func (s *Server) Run(ctx context.Context) error {
	srv := &http.Server{
		Addr:         s.cfg.Listen,
		Handler:      s.middleware(s.mux),
		ReadTimeout:  s.cfg.ReadTimeout,
		WriteTimeout: 0, // streaming
		IdleTimeout:  120 * time.Second,
	}
	errCh := make(chan error, 1)
	go func() {
		s.log.Info("listening", "addr", s.cfg.Listen, "data_dir", s.cfg.DataDir, "shadow", s.cfg.ShadowMode)
		err := srv.ListenAndServe()
		if err != nil && !errors.Is(err, http.ErrServerClosed) {
			errCh <- err
			return
		}
		errCh <- nil
	}()
	select {
	case <-ctx.Done():
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		return srv.Shutdown(shutdownCtx)
	case err := <-errCh:
		return err
	}
}

// --- middleware ---

func (s *Server) middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		reqID := r.Header.Get("X-Request-Id")
		if reqID == "" {
			reqID = "req_" + uuid.NewString()
		}
		w.Header().Set("X-Request-Id", reqID)
		w.Header().Set("X-OmniRoute-Version", Version)

		ctx := r.Context()
		ctx = observability.WithCorrelationID(ctx, reqID)
		reqLog := s.log.With("request_id", reqID, "method", r.Method, "path", r.URL.Path)
		ctx = observability.WithLogger(ctx, reqLog)
		r = r.WithContext(ctx)

		// bearer auth on /v1/* if API key is configured
		if s.cfg.APIKey != "" && strings.HasPrefix(r.URL.Path, "/v1/") {
			auth := r.Header.Get("Authorization")
			want := "Bearer " + s.cfg.APIKey
			if auth != want {
				writeError(w, http.StatusUnauthorized, registry.APIError{
					Message: "invalid or missing Authorization header",
					Type:    "invalid_request_error",
					Code:    "invalid_api_key",
				})
				reqLog.Warn("auth_failed", "path", r.URL.Path)
				return
			}
		}

		// shadow mode: log the request, then return 202 Accepted with no body
		if s.cfg.ShadowMode && strings.HasPrefix(r.URL.Path, "/v1/") {
			_, _ = io.Copy(io.Discard, r.Body)
			reqLog.Info("shadow_request", "remote", r.RemoteAddr)
			w.Header().Set("X-OmniRoute-Mode", "shadow")
			w.WriteHeader(http.StatusAccepted)
			return
		}

		rec := &recordingWriter{ResponseWriter: w, status: 200}
		next.ServeHTTP(rec, r)
		reqLog.Info("request_complete",
			"status", rec.status,
			"bytes", rec.bytes,
			"elapsed_ms", time.Since(start).Milliseconds(),
		)
	})
}

type recordingWriter struct {
	http.ResponseWriter
	status int
	bytes  int
}

func (r *recordingWriter) WriteHeader(c int) {
	r.status = c
	r.ResponseWriter.WriteHeader(c)
}

func (r *recordingWriter) Write(b []byte) (int, error) {
	r.bytes += len(b)
	return r.ResponseWriter.Write(b)
}

// Flush forwards http.Flusher so SSE streams can flush token by token.
func (r *recordingWriter) Flush() {
	if f, ok := r.ResponseWriter.(http.Flusher); ok {
		f.Flush()
	}
}

// --- handlers ---

func (s *Server) handleHealthz(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{
		"status":     "ok",
		"uptime_s":   int64(time.Since(s.boot).Seconds()),
		"providers":  len(s.reg.List()),
		"version":    Version,
		"started_at": s.boot.UTC().Format(time.RFC3339),
	})
}

func (s *Server) handleReadyz(w http.ResponseWriter, _ *http.Request) {
	if !s.ready {
		writeError(w, http.StatusServiceUnavailable, registry.APIError{Message: "not ready", Type: "server_error"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "ready"})
}

func (s *Server) handleListProviders(w http.ResponseWriter, r *http.Request) {
	ps := s.reg.List()
	out := make([]map[string]string, 0, len(ps))
	for _, p := range ps {
		out = append(out, map[string]string{"id": p.ID()})
	}
	writeJSON(w, http.StatusOK, map[string]any{"data": out, "object": "list"})
}

func (s *Server) handleUsage(w http.ResponseWriter, _ *http.Request) {
	// Stub for P6. P6 wires SQLite-backed usage aggregation.
	writeJSON(w, http.StatusOK, map[string]any{
		"object": "usage.summary",
		"total_requests": 0,
		"total_tokens": 0,
		"by_provider": map[string]int{},
	})
}

func (s *Server) handleVersion(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{
		"version": Version,
		"commit":  Commit,
		"built":   BuiltAt,
	})
}

func (s *Server) handleListModels(w http.ResponseWriter, r *http.Request) {
	models := s.reg.AllModels(r.Context())
	writeJSON(w, http.StatusOK, map[string]any{
		"object": "list",
		"data":   models,
	})
}

func (s *Server) handleGetModel(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	for _, m := range s.reg.AllModels(r.Context()) {
		if m.ID == id {
			writeJSON(w, http.StatusOK, m)
			return
		}
	}
	writeError(w, http.StatusNotFound, registry.APIError{
		Message: fmt.Sprintf("model %q not found", id),
		Type:    "invalid_request_error",
		Code:    "model_not_found",
	})
}

func (s *Server) handleChatCompletions(w http.ResponseWriter, r *http.Request) {
	log := observability.LoggerFrom(r.Context())
	if r.Body == nil {
		writeError(w, http.StatusBadRequest, registry.APIError{Message: "missing request body", Type: "invalid_request_error"})
		return
	}
	var req registry.ChatRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, registry.APIError{Message: "invalid JSON: " + err.Error(), Type: "invalid_request_error"})
		return
	}
	if req.Model == "" {
		writeError(w, http.StatusBadRequest, registry.APIError{Message: "model is required", Type: "invalid_request_error", Code: "missing_model"})
		return
	}
	if len(req.Messages) == 0 {
		writeError(w, http.StatusBadRequest, registry.APIError{Message: "messages is required", Type: "invalid_request_error", Code: "missing_messages"})
		return
	}

	// Route by model: strip "provider/" prefix if present, otherwise
	// pick the first provider that lists the model.
	provID, modelName, ok := s.routeModel(r.Context(), req.Model)
	if !ok {
		writeError(w, http.StatusNotFound, registry.APIError{
			Message: fmt.Sprintf("no provider serves model %q", req.Model),
			Type:    "invalid_request_error",
			Code:    "model_not_found",
		})
		return
	}
	prov, ok := s.reg.Get(provID)
	if !ok {
		writeError(w, http.StatusBadGateway, registry.APIError{Message: "provider not registered", Type: "server_error"})
		return
	}
	req.Model = modelName
	req.RequestID = observability.CorrelationID(r.Context())

	if req.Stream {
		s.serveStream(w, r, prov, req, log)
		return
	}

	resp, err := prov.ChatCompletion(r.Context(), req)
	if err != nil {
		log.Error("chat_completion_failed", "provider", prov.ID(), "model", req.Model, "err", err.Error())
		writeError(w, registry.HTTPStatus(err), registry.APIError{Message: err.Error(), Type: "upstream_error"})
		return
	}
	writeJSON(w, http.StatusOK, resp)
}

func (s *Server) serveStream(w http.ResponseWriter, r *http.Request, prov registry.Provider, req registry.ChatRequest, log *slog.Logger) {
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("X-Accel-Buffering", "no")
	w.WriteHeader(http.StatusOK)
	flusher, _ := w.(http.Flusher)

	chunkCh, errCh := prov.ChatCompletionStream(r.Context(), req)
	if chunkCh == nil {
		// only the errCh has data; emit a single error and close
		if errCh != nil {
			err, ok := <-errCh
			if ok {
				writeStreamError(w, flusher, err)
			}
		}
		return
	}
	for {
		select {
		case <-r.Context().Done():
			return
		case err, ok := <-errCh:
			if ok && err != nil {
				writeStreamError(w, flusher, err)
			}
		case chunk, ok := <-chunkCh:
			if !ok {
				_, _ = io.WriteString(w, "data: [DONE]\n\n")
				if flusher != nil {
					flusher.Flush()
				}
				return
			}
			if chunk.Error != nil {
				writeStreamError(w, flusher, fmt.Errorf("%s: %s", chunk.Error.Type, chunk.Error.Message))
				continue
			}
			data, _ := json.Marshal(chunk)
			_, _ = io.WriteString(w, "data: ")
			_, _ = w.Write(data)
			_, _ = io.WriteString(w, "\n\n")
			if flusher != nil {
				flusher.Flush()
			}
			if chunk.Done {
				_, _ = io.WriteString(w, "data: [DONE]\n\n")
				if flusher != nil {
					flusher.Flush()
				}
				return
			}
		}
	}
}

func (s *Server) routeModel(ctx context.Context, model string) (providerID, modelName string, ok bool) {
	// "openai/gpt-4o" -> provider=openai, model=gpt-4o
	if i := strings.IndexByte(model, '/'); i > 0 {
		prefix := model[:i]
		for _, p := range s.reg.List() {
			if p.ID() == prefix {
				return prefix, model[i+1:], true
			}
		}
		// unknown prefix -> treat as literal model name on first provider
	}
	for _, p := range s.reg.List() {
		models, err := p.Models(ctx)
		if err != nil {
			continue
		}
		for _, m := range models {
			if m.ID == model {
				return p.ID(), model, true
			}
		}
	}
	// Fallback: serve from the first registered provider using the literal
	// model name. This lets the caller talk to any model the upstream serves
	// even if /v1/models hasn't been refreshed yet.
	for _, p := range s.reg.List() {
		return p.ID(), model, true
	}
	return "", "", false
}

// --- helpers ---

func writeJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(body)
}

func writeError(w http.ResponseWriter, status int, e registry.APIError) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(map[string]any{
		"error": e,
	})
}

func writeStreamError(w io.Writer, flusher http.Flusher, err error) {
	e := registry.APIError{Message: err.Error(), Type: "upstream_error"}
	data, _ := json.Marshal(map[string]any{"error": e})
	_, _ = io.WriteString(w, "data: ")
	_, _ = w.Write(data)
	_, _ = io.WriteString(w, "\n\n")
	_, _ = io.WriteString(w, "data: [DONE]\n\n")
	if flusher != nil {
		flusher.Flush()
	}
}

// --- build-time vars ---

// These are overridden via -ldflags "-X" at build time.
var (
	Version = "0.1.0-dev"
	Commit  = "none"
	BuiltAt = "unknown"
)

func init() {
	if v := os.Getenv("OMNIROUTE_VERSION"); v != "" {
		Version = v
	}
	if v := os.Getenv("OMNIROUTE_COMMIT"); v != "" {
		Commit = v
	}
	if v := os.Getenv("OMNIROUTE_BUILT_AT"); v != "" {
		BuiltAt = v
	}
}

// strconv is imported in case future versions need it for query parsing.
// Remove the import if it stays unused.
var _ = strconv.Itoa
