package bench

import (
	"context"
	"testing"
	"time"
)

// TestPickWeighted_ChoosesHighestWeight verifies the linear-scan weighted
// picker (the production path; a heap is overkill for ≤8 candidates).
func TestPickWeighted_ChoosesHighestWeight(t *testing.T) {
	cands := []ProviderRef{
		{Name: "a", Model: "m1", Weight: 0.2},
		{Name: "b", Model: "m2", Weight: 0.9},
		{Name: "c", Model: "m3", Weight: 0.5},
	}
	best := pickWeighted(cands)
	if best.Name != "b" {
		t.Fatalf("pickWeighted: got %s, want b", best.Name)
	}
}

// TestPickWeighted_Empty guards the empty-candidate edge case.
func TestPickWeighted_Empty(t *testing.T) {
	if got := pickWeighted(nil); got != (ProviderRef{}) {
		t.Fatalf("pickWeighted(nil) = %+v, want zero", got)
	}
}

// TestDecide_EndToEnd exercises the 5-step flow with 1 selector, 1 plugin,
// 1 provider. The happy path is the dominant production shape.
func TestDecide_EndToEnd(t *testing.T) {
	prov := &EchoProvider{name: "anthropic"}
	cfg := Config{
		DefaultTimeout:   50 * time.Millisecond,
		MaxFallbackDepth: 0,
		Selectors: []ProviderSelector{
			&StaticSelector{
				name: "intelligentrouter",
				cands: []ProviderRef{
					{Name: "anthropic", Model: "claude-sonnet-4.5", Weight: 1.0},
				},
			},
		},
		Plugins: []Plugin{&EchoPlugin{name: "contentsafety"}},
		Fallback: NewStaticFallback("smartfallback", []ProviderRef{
			{Name: "anthropic", Model: "claude-sonnet-4.5"},
		}),
		Providers: map[string]Provider{"anthropic": prov},
	}
	r := NewRouter(cfg)
	d, err := r.Decide(context.Background(), Intent{Model: "claude-sonnet-4.5"})
	if err != nil {
		t.Fatalf("Decide: %v", err)
	}
	if d.Provider.Name != "anthropic" {
		t.Fatalf("provider: got %s, want anthropic", d.Provider.Name)
	}
	if string(d.Response) != "ok:claude-sonnet-4.5" {
		t.Fatalf("response: got %q", d.Response)
	}
	if len(d.Route.Plugins) != 1 || d.Route.Plugins[0] != "contentsafety" {
		t.Fatalf("plugin trace: got %v", d.Route.Plugins)
	}
}

// TestDecide_NoProviders returns ErrNoProviders when every selector emits
// nothing — the most common cold-start failure.
func TestDecide_NoProviders(t *testing.T) {
	r := NewRouter(Config{
		Selectors: []ProviderSelector{&StaticSelector{name: "empty", cands: nil}},
	})
	_, err := r.Decide(context.Background(), Intent{Model: "x"})
	if err != ErrNoProviders {
		t.Fatalf("got %v, want ErrNoProviders", err)
	}
}

// TestDecide_PluginRejected returns ErrPluginRejected when a plugin returns
// an error (e.g. contentsafety blocks the prompt).
func TestDecide_PluginRejected(t *testing.T) {
	cfg := Config{
		Selectors: []ProviderSelector{
			&StaticSelector{name: "s", cands: []ProviderRef{{Name: "p", Model: "m", Weight: 1}}},
		},
		Plugins: []Plugin{&errorPlugin{name: "safety", err: errPluginBlock}},
		Providers: map[string]Provider{
			"p": &EchoProvider{name: "p"},
		},
	}
	r := NewRouter(cfg)
	_, err := r.Decide(context.Background(), Intent{Model: "m"})
	if err == nil {
		t.Fatal("expected error, got nil")
	}
}

type errorPlugin struct {
	name string
	err  error
}

func (p *errorPlugin) Name() string { return p.name }
func (p *errorPlugin) Apply(ctx context.Context, intent *Intent) (*Intent, error) {
	return nil, p.err
}

var errPluginBlock = pluginBlockErr("contentsafety: blocked")

type pluginBlockErr string

func (e pluginBlockErr) Error() string { return string(e) }

// TestDecide_AllProvidersFailed exercises the fallback exhaustion path.
func TestDecide_AllProvidersFailed(t *testing.T) {
	cfg := Config{
		MaxFallbackDepth: 0,
		Selectors: []ProviderSelector{
			&StaticSelector{name: "s", cands: []ProviderRef{{Name: "p", Model: "m", Weight: 1}}},
		},
		Fallback: NewStaticFallback("fb", []ProviderRef{{Name: "p", Model: "m"}}),
		Providers: map[string]Provider{
			"p": &errProvider{name: "p"},
		},
	}
	r := NewRouter(cfg)
	_, err := r.Decide(context.Background(), Intent{Model: "m"})
	if err != ErrAllProvidersFailed {
		t.Fatalf("got %v, want ErrAllProvidersFailed", err)
	}
}

type errProvider struct{ name string }

func (p *errProvider) Name() string { return p.name }
func (p *errProvider) Execute(ctx context.Context, ref ProviderRef, intent Intent) ([]byte, error) {
	return nil, errProvFail
}

// (errProvFail + provFailErr live in runner.go so ProgrammableProvider can
// share the sentinel.)
