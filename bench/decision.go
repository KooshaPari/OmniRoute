// Decision-flow port (ADR-050 / ADR-051).
//
// Source of truth: ../../findings/2026-06-20-phenotype-router-decision-flow.go
// (reference skeleton, //go:build ignore).
//
// This file is a buildable port that exposes the same surface area the
// benchmarks (and eventually the Rust FFI bridge) target. No external deps;
// stdlib only.
package bench

import (
	"context"
	"errors"
	"fmt"
	"sync"
	"time"
)

// Intent is the caller's request payload.
type Intent struct {
	Model    string
	Messages []Message
	Tools    []ToolDef
	Metadata map[string]string
}

// Message is a chat history entry.
type Message struct {
	Role    string
	Content string
}

// ToolDef is a tool/function declaration.
type ToolDef struct {
	Name        string
	Description string
	Parameters  map[string]any
}

// ProviderRef identifies a configured provider + model.
type ProviderRef struct {
	Name   string
	Model  string
	Region string
	Weight float32
}

// Route is the resolved routing plan.
type Route struct {
	Primary   ProviderRef
	Fallbacks []ProviderRef
	Plugins   []string
	Timeout   time.Duration
}

// Decision is the final routed answer.
type Decision struct {
	Route    Route
	Provider ProviderRef
	Response []byte
	Latency  time.Duration
}

// ProviderSelector picks candidate providers for an intent.
type ProviderSelector interface {
	Select(ctx context.Context, intent Intent) ([]ProviderRef, error)
	Name() string
}

// Plugin transforms an intent (cache, safety, etc.).
type Plugin interface {
	Name() string
	Apply(ctx context.Context, intent *Intent) (*Intent, error)
}

// FallbackStrategy returns the next provider on failure.
type FallbackStrategy interface {
	Next(ctx context.Context, intent Intent, lastErr error) (ProviderRef, bool, error)
	Name() string
}

// Provider dispatches an intent to a model endpoint.
type Provider interface {
	Execute(ctx context.Context, ref ProviderRef, intent Intent) ([]byte, error)
	Name() string
}

// Config is the router configuration.
type Config struct {
	DefaultTimeout   time.Duration
	MaxFallbackDepth int
	Selectors        []ProviderSelector
	Plugins          []Plugin
	Fallback         FallbackStrategy
	Providers        map[string]Provider
}

// Router is the entry point. The struct itself is intentionally cheap to
// construct so benchmarks can spin up many instances.
type Router struct {
	cfg       Config
	providers map[string]Provider
}

// NewRouter constructs a Router from config.
func NewRouter(cfg Config) *Router {
	return &Router{cfg: cfg, providers: cfg.Providers}
}

// Errors emitted by Decide.
var (
	ErrNoProviders        = errors.New("no_providers_match")
	ErrPluginRejected     = errors.New("plugin_rejected")
	ErrAllProvidersFailed = errors.New("all_providers_failed")
	ErrFallbackExhausted  = errors.New("fallback_depth_exceeded")
)

// Decide runs the 5-step decision flow:
//  1. Resolve selectors → candidate providers
//  2. Apply plugins in order
//  3. Pick primary by weight
//  4. Dispatch; on failure, consult fallback strategy
//  5. Return Decision (or error)
func (r *Router) Decide(ctx context.Context, intent Intent) (*Decision, error) {
	start := time.Now()

	candidates, err := r.resolveCandidates(ctx, intent)
	if err != nil {
		return nil, err
	}
	if len(candidates) == 0 {
		return nil, ErrNoProviders
	}

	for _, p := range r.cfg.Plugins {
		out, perr := p.Apply(ctx, &intent)
		if perr != nil {
			return nil, fmt.Errorf("%w: %s", ErrPluginRejected, p.Name())
		}
		intent = *out
	}

	primary := pickWeighted(candidates)

	current := primary
	for depth := 0; depth <= r.cfg.MaxFallbackDepth; depth++ {
		provider, ok := r.providers[current.Name]
		if !ok {
			return nil, fmt.Errorf("unknown provider: %s", current.Name)
		}
		resp, derr := provider.Execute(ctx, current, intent)
		if derr == nil {
			return &Decision{
				Route: Route{
					Primary: current,
					Plugins: pluginNames(r.cfg.Plugins),
					Timeout: r.cfg.DefaultTimeout,
				},
				Provider: current,
				Response: resp,
				Latency:  time.Since(start),
			}, nil
		}
		next, ok, ferr := r.cfg.Fallback.Next(ctx, intent, derr)
		if ferr != nil || !ok {
			return nil, ErrAllProvidersFailed
		}
		current = next
	}

	return nil, ErrFallbackExhausted
}

func (r *Router) resolveCandidates(ctx context.Context, intent Intent) ([]ProviderRef, error) {
	seen := make(map[string]struct{}, 8)
	out := make([]ProviderRef, 0, 8)
	for _, sel := range r.cfg.Selectors {
		cands, err := sel.Select(ctx, intent)
		if err != nil {
			return nil, fmt.Errorf("selector %s: %w", sel.Name(), err)
		}
		for _, c := range cands {
			key := c.Name + "/" + c.Model
			if _, dup := seen[key]; dup {
				continue
			}
			seen[key] = struct{}{}
			out = append(out, c)
		}
	}
	return out, nil
}

func pickWeighted(cands []ProviderRef) ProviderRef {
	if len(cands) == 0 {
		return ProviderRef{}
	}
	best := cands[0]
	for _, c := range cands[1:] {
		if c.Weight > best.Weight {
			best = c
		}
	}
	return best
}

func pluginNames(plugins []Plugin) []string {
	out := make([]string, 0, len(plugins))
	for _, p := range plugins {
		out = append(out, p.Name())
	}
	return out
}

// ---------------------------------------------------------------------------
// Built-in fixtures used by the bench suites.
// ---------------------------------------------------------------------------

// StaticSelector returns a fixed candidate set, simulating the
// `intelligentrouter` plugin (MIRT + RouteLLM + semantic).
type StaticSelector struct {
	name   string
	cands  []ProviderRef
	mu     sync.Mutex
	calls  uint64
	LatNSP int64 // simulated selector work in ns; 0 = none
}

func (s *StaticSelector) Name() string { return s.name }

func (s *StaticSelector) Select(ctx context.Context, intent Intent) ([]ProviderRef, error) {
	s.mu.Lock()
	s.calls++
	s.mu.Unlock()
	if s.LatNSP > 0 {
		select {
		case <-time.After(time.Duration(s.LatNSP)):
		case <-ctx.Done():
			return nil, ctx.Err()
		}
	}
	out := make([]ProviderRef, len(s.cands))
	copy(out, s.cands)
	return out, nil
}

// EchoPlugin is a no-op plugin that just echoes the request through. Used to
// model `contentsafety`, `promptadapter`, and other pre-routing transforms.
type EchoPlugin struct {
	name string
}

func (p *EchoPlugin) Name() string { return p.name }

func (p *EchoPlugin) Apply(ctx context.Context, intent *Intent) (*Intent, error) {
	// In-place mutation to mimic realistic plugin work without allocations.
	intent.Metadata = map[string]string{}
	intent.Metadata["plugin."+p.name] = "ok"
	return intent, nil
}

// StaticFallback always returns the next provider in a fixed order. Models
// the cascading-fallback behaviour of `smartfallback` (health-aware).
type StaticFallback struct {
	name    string
	chain   []ProviderRef
	idxHint map[string]int
}

func NewStaticFallback(name string, chain []ProviderRef) *StaticFallback {
	idx := make(map[string]int, len(chain))
	for i, p := range chain {
		idx[p.Name+"/"+p.Model] = i
	}
	return &StaticFallback{name: name, chain: chain, idxHint: idx}
}

func (f *StaticFallback) Name() string { return f.name }

func (f *StaticFallback) Next(ctx context.Context, intent Intent, lastErr error) (ProviderRef, bool, error) {
	key := intent.Model
	// Prefer the failed provider's key when present; intent.Model is a
	// convenient stand-in for "the provider we just tried".
	for k, i := range f.idxHint {
		if i > 0 && k == key {
			return f.chain[i], true, nil
		}
	}
	if len(f.chain) > 1 {
		return f.chain[1], true, nil
	}
	return ProviderRef{}, false, nil
}

// EchoProvider returns a deterministic response. Used as the in-process
// provider target so benchmarks measure routing overhead, not I/O.
type EchoProvider struct {
	name string
}

func (p *EchoProvider) Name() string { return p.name }

func (p *EchoProvider) Execute(ctx context.Context, ref ProviderRef, intent Intent) ([]byte, error) {
	return []byte("ok:" + ref.Model), nil
}
