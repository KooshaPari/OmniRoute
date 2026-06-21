package bench

import (
	"context"
	"testing"
	"time"
)

func testCtx() context.Context { return context.Background() }

// TestPercentile_NearestRank verifies the percentile helper returns a
// sample-actual value, not an interpolated estimate. Necessary so the bench
// reports aren't fuzzy at small N.
func TestPercentile_NearestRank(t *testing.T) {
	tr := NewLatencyTracker()
	for i := 1; i <= 100; i++ {
		tr.Record(time.Duration(i)*time.Millisecond, nil)
	}
	if got := tr.Percentile(50); got != 50*time.Millisecond {
		t.Fatalf("p50: got %s, want 50ms", got)
	}
	if got := tr.Percentile(95); got != 95*time.Millisecond {
		t.Fatalf("p95: got %s, want 95ms", got)
	}
	if got := tr.Percentile(99); got != 99*time.Millisecond {
		t.Fatalf("p99: got %s, want 99ms", got)
	}
	if got := tr.Percentile(100); got != 100*time.Millisecond {
		t.Fatalf("p100: got %s, want 100ms", got)
	}
}

// TestPercentile_Empty guards the empty-tracker edge case.
func TestPercentile_Empty(t *testing.T) {
	tr := NewLatencyTracker()
	if got := tr.Percentile(99); got != 0 {
		t.Fatalf("p99 of empty tracker = %s, want 0", got)
	}
}

// TestRPS_Basic sanity-checks the throughput math: N requests over W wall
// yields N/W rps. Catches wall-clock drift in the soak driver.
func TestRPS_Basic(t *testing.T) {
	tr := NewLatencyTracker()
	tr.Start()
	for i := 0; i < 1000; i++ {
		tr.Record(time.Millisecond, nil)
	}
	time.Sleep(100 * time.Millisecond)
	tr.Stop()
	rps := tr.RPS()
	if rps < 9000 || rps > 11000 {
		t.Fatalf("rps = %.0f, want ~10000 (1000 reqs / 100ms)", rps)
	}
}

// TestDefaultConfig_Builds guards the canonical scenario from setup drift.
func TestDefaultConfig_Builds(t *testing.T) {
	cfg, providers := DefaultConfig()
	if len(cfg.Selectors) != 1 {
		t.Fatalf("selectors: got %d, want 1", len(cfg.Selectors))
	}
	if len(cfg.Plugins) != 3 {
		t.Fatalf("plugins: got %d, want 3 (contentsafety + promptadapter + contextfolding)", len(cfg.Plugins))
	}
	if len(providers) != 3 {
		t.Fatalf("providers: got %d, want 3 (anthropic + openai + google)", len(providers))
	}
	r := NewRouter(cfg)
	if _, err := r.Decide(testCtx(), Intent{Model: "claude-sonnet-4.5"}); err != nil {
		t.Fatalf("Decide: %v", err)
	}
}

// TestReport_HasAllFields smoke-checks the report formatter; the bench
// scripts rely on this exact field set being present.
func TestReport_HasAllFields(t *testing.T) {
	tr := NewLatencyTracker()
	for i := 0; i < 100; i++ {
		tr.Record(time.Duration(i+1)*time.Microsecond, nil)
	}
	tr.Start()
	tr.Stop()
	r := tr.Report("smoke")
	for _, want := range []string{"n=", "p50=", "p95=", "p99=", "max="} {
		if !contains(r, want) {
			t.Fatalf("report missing %q: %s", want, r)
		}
	}
}

func contains(s, sub string) bool {
	return len(s) >= len(sub) && stringIndex(s, sub) >= 0
}

func stringIndex(s, sub string) int {
	for i := 0; i+len(sub) <= len(s); i++ {
		if s[i:i+len(sub)] == sub {
			return i
		}
	}
	return -1
}
