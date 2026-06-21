// bench_routing_e2e.go — request → decision → plugin dispatch, single-thread
// benchmark.
//
// Run with:
//
//	go test -bench=BenchmarkRoutingE2E -benchtime=1000x -benchmem ./...
//
// Equivalent to a Rust criterion benchmark: fixed-iteration micro-bench
// (`-benchtime=Nx`) is the closest analog to criterion's `--warm-up-time`
// + sample-size controlled loop. The default bench framework uses
// wall-time-based iteration counts which are noisy on shared infra; this
// task explicitly requests a 1k-iteration loop per AGENTS.md §"v13
// outlook".
//
// Stdlib only. No external deps.
package bench

import (
	"context"
	"testing"
	"time"
)

// BenchmarkRoutingE2E exercises the full Decide() pipeline (selector →
// plugins → provider) on a single goroutine with FastConfig() so upstream
// latency is ~5 ms. Reports ns/op, B/op, allocs/op.
func BenchmarkRoutingE2E(b *testing.B) {
	cfg, _ := FastConfig()
	r := NewRouter(cfg)
	intent := Intent{Model: "claude-sonnet-4.5"}

	b.ReportAllocs()
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		d, err := r.Decide(context.Background(), intent)
		if err != nil {
			b.Fatalf("Decide: %v", err)
		}
		if d.Provider.Name == "" {
			b.Fatal("empty provider name")
		}
	}
}

// BenchmarkRoutingE2E_Default runs the same flow but with the production
// latency profile (~700 ms mean upstream). Use this to measure the
// router-overhead fraction of total wall time. Compare ns/op to
// BenchmarkRoutingE2E: the delta is the overhead the router itself adds.
func BenchmarkRoutingE2E_Default(b *testing.B) {
	cfg, _ := DefaultConfig()
	r := NewRouter(cfg)
	intent := Intent{Model: "claude-sonnet-4.5"}

	b.ReportAllocs()
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		d, err := r.Decide(context.Background(), intent)
		if err != nil {
			b.Fatalf("Decide: %v", err)
		}
		if d.Provider.Name == "" {
			b.Fatal("empty provider name")
		}
	}
}

// BenchmarkPickWeighted measures the selector-output weighted-pick cost in
// isolation (no provider, no plugins). The router hot path's only O(n) scan
// over candidates; useful as a regression target for the selector matrix.
func BenchmarkPickWeighted(b *testing.B) {
	cands := []ProviderRef{
		{Name: "anthropic", Model: "claude-sonnet-4.5", Weight: 0.6},
		{Name: "openai", Model: "gpt-4o", Weight: 0.3},
		{Name: "google", Model: "gemini-2.5-pro", Weight: 0.1},
	}

	b.ReportAllocs()
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		if pickWeighted(cands).Name != "anthropic" {
			b.Fatal("unexpected pick")
		}
	}
}

// TestRoutingE2E_At1kIteration asserts the 1k-iteration shape that AGENTS.md
// §"v13 outlook" / task brief calls for. If the decision flow regresses
// (e.g. an accidental quadratic loop), this catches it before the soak
// driver runs.
func TestRoutingE2E_At1kIteration(t *testing.T) {
	cfg, _ := FastConfig()
	r := NewRouter(cfg)
	intent := Intent{Model: "claude-sonnet-4.5"}

	const iters = 1000
	tr := NewLatencyTracker()
	tr.Start()
	deadline := time.Now().Add(30 * time.Second)
	for i := 0; i < iters; i++ {
		if time.Now().After(deadline) {
			t.Fatalf("timeout at iter %d/%d", i, iters)
		}
		start := time.Now()
		d, err := r.Decide(context.Background(), intent)
		tr.Record(time.Since(start), err)
		if err != nil {
			t.Fatalf("Decide[%d]: %v", i, err)
		}
		if d.Provider.Name == "" {
			t.Fatalf("Decide[%d]: empty provider", i)
		}
	}
	tr.Stop()
	if tr.N() != iters {
		t.Fatalf("got %d iterations, want %d", tr.N(), iters)
	}
	if tr.Errs() != 0 {
		t.Fatalf("got %d errors, want 0", tr.Errs())
	}
	t.Logf("1k-iter shape OK: %s", tr.Report("routing_e2e"))
}
