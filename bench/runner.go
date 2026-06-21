// Shared bench helpers: percentile calculator, latency tracker, scenario
// builders, and a programmable mock provider that simulates per-route
// upstream latency without doing I/O.
//
// Stdlib only.
package bench

import (
	"context"
	"fmt"
	"math"
	"math/rand"
	"sort"
	"sync"
	"sync/atomic"
	"time"
)

// LatencySample is a single end-to-end Decide() latency observation.
type LatencySample struct {
	NS    int64
	Err   error
	Route string
}

// LatencyTracker accumulates samples in a lock-free buffer (caller is
// responsible for ordering via WaitGroup or channel close).
type LatencyTracker struct {
	mu      sync.Mutex
	samples []int64 // nanoseconds, end-to-end Decide() latency
	errs    int64
	rpsHit  int64
	start   time.Time
	stop    time.Time
}

func NewLatencyTracker() *LatencyTracker {
	return &LatencyTracker{}
}

func (t *LatencyTracker) Record(d time.Duration, err error) {
	t.mu.Lock()
	t.samples = append(t.samples, d.Nanoseconds())
	t.mu.Unlock()
	if err != nil {
		atomic.AddInt64(&t.errs, 1)
	}
}

func (t *LatencyTracker) Start() { t.start = time.Now() }
func (t *LatencyTracker) Stop()  { t.stop = time.Now() }

func (t *LatencyTracker) Errs() int64 { return atomic.LoadInt64(&t.errs) }
func (t *LatencyTracker) N() int {
	t.mu.Lock()
	defer t.mu.Unlock()
	return len(t.samples)
}
func (t *LatencyTracker) Wall() time.Duration {
	if t.stop.IsZero() {
		return time.Since(t.start)
	}
	return t.stop.Sub(t.start)
}

// Percentile returns the p-th percentile (0..100) of recorded latencies.
// Uses nearest-rank; suitable for sample sizes >= 100.
func (t *LatencyTracker) Percentile(p float64) time.Duration {
	t.mu.Lock()
	s := make([]int64, len(t.samples))
	copy(s, t.samples)
	t.mu.Unlock()
	if len(s) == 0 {
		return 0
	}
	sort.Slice(s, func(i, j int) bool { return s[i] < s[j] })
	rank := int(math.Ceil(p/100*float64(len(s)))) - 1
	if rank < 0 {
		rank = 0
	}
	if rank >= len(s) {
		rank = len(s) - 1
	}
	return time.Duration(s[rank])
}

func (t *LatencyTracker) Mean() time.Duration {
	t.mu.Lock()
	defer t.mu.Unlock()
	if len(t.samples) == 0 {
		return 0
	}
	var sum int64
	for _, v := range t.samples {
		sum += v
	}
	return time.Duration(sum / int64(len(t.samples)))
}

// RPS returns the achieved request-per-second rate over Wall().
func (t *LatencyTracker) RPS() float64 {
	w := t.Wall().Seconds()
	if w <= 0 {
		return 0
	}
	return float64(t.N()) / w
}

// Report returns a human-readable summary of the tracker.
func (t *LatencyTracker) Report(label string) string {
	t.mu.Lock()
	s := make([]int64, len(t.samples))
	copy(s, t.samples)
	t.mu.Unlock()
	sort.Slice(s, func(i, j int) bool { return s[i] < s[j] })

	p := func(pct float64) time.Duration {
		if len(s) == 0 {
			return 0
		}
		rank := int(math.Ceil(pct/100*float64(len(s)))) - 1
		if rank < 0 {
			rank = 0
		}
		if rank >= len(s) {
			rank = len(s) - 1
		}
		return time.Duration(s[rank])
	}

	return sprintf(
		"%s n=%d errs=%d wall=%s rps=%.1f mean=%s p50=%s p95=%s p99=%s max=%s",
		label, len(s), t.Errs(), t.Wall().Round(time.Millisecond),
		t.RPS(), t.Mean().Round(time.Microsecond),
		p(50).Round(time.Microsecond), p(95).Round(time.Microsecond),
		p(99).Round(time.Microsecond), p(100).Round(time.Microsecond),
	)
}

// sprintf formats the per-suite summary line. Kept as a small helper so the
// three bench mains read identically.
func sprintf(format string, args ...interface{}) string {
	return fmt.Sprintf(format, args...)
}

// errProvFail is the sentinel for closed/circuit-broken provider state.
// Used by both ProgrammableProvider (bench) and errProvider (decision_test).
var errProvFail = provFailErr("upstream 503")

type provFailErr string

func (e provFailErr) Error() string { return string(e) }

// ---------------------------------------------------------------------------
// Programmable mock provider — simulates upstream latency without I/O.
// Per-route latency profile is the standard deviation of a Gaussian; used by
// the throughput sweep to model realistic per-provider tail behaviour.
// ---------------------------------------------------------------------------

// ProgrammableProvider is a Provider that returns after a configurable
// delay. Used by every bench suite to model the upstream call. It performs
// no I/O; the delay is a runtime.Sleep, not a network round-trip.
type ProgrammableProvider struct {
	mu     sync.Mutex
	name   string
	mean   time.Duration // mean upstream latency
	stdev  time.Duration // stddev
	minNs  int64         // floor
	maxNs  int64         // ceiling
	rng    *rand.Rand
	closed atomic.Bool
}

func NewProgrammableProvider(name string, mean, stdev time.Duration) *ProgrammableProvider {
	return &ProgrammableProvider{
		name:  name,
		mean:  mean,
		stdev: stdev,
		minNs: int64(mean / time.Duration(4)),
		maxNs: int64(mean * 4),
		rng:   rand.New(rand.NewSource(time.Now().UnixNano())),
	}
}

func (p *ProgrammableProvider) Name() string { return p.name }

func (p *ProgrammableProvider) Execute(ctx context.Context, ref ProviderRef, intent Intent) ([]byte, error) {
	if p.closed.Load() {
		return nil, errProvFail
	}
	// Sample latency. Mean +/- stdev, clamped to [min, max].
	jitter := time.Duration(p.rng.NormFloat64()) * p.stdev
	d := p.mean + jitter
	ns := int64(d)
	if ns < p.minNs {
		ns = p.minNs
	}
	if ns > p.maxNs {
		ns = p.maxNs
	}
	if ns <= 0 {
		ns = int64(p.mean)
	}
	select {
	case <-time.After(time.Duration(ns)):
		return []byte("ok:" + ref.Model), nil
	case <-ctx.Done():
		return nil, ctx.Err()
	}
}

// ---------------------------------------------------------------------------
// Scenario builders — keep bench files focused on the metric, not setup.
// ---------------------------------------------------------------------------

// DefaultConfig returns the canonical decision-layer config used by all
// three bench suites: 1 selector, 3 plugins (contentsafety, promptadapter,
// contextfolding — the L3.6 mandatory pre-routing chain per ADR-050), 1
// health-aware fallback, 3 providers (anthropic, openai, google) with
// per-route latency profiles representative of the 2026 fleet baseline.
func DefaultConfig() (Config, map[string]Provider) {
	providers := map[string]Provider{
		"anthropic": NewProgrammableProvider("anthropic", 800*time.Millisecond, 40*time.Millisecond),
		"openai":    NewProgrammableProvider("openai", 600*time.Millisecond, 50*time.Millisecond),
		"google":    NewProgrammableProvider("google", 700*time.Millisecond, 60*time.Millisecond),
	}
	cands := []ProviderRef{
		{Name: "anthropic", Model: "claude-sonnet-4.5", Region: "us-east-1", Weight: 0.6},
		{Name: "openai", Model: "gpt-4o", Region: "us-east-1", Weight: 0.3},
		{Name: "google", Model: "gemini-2.5-pro", Region: "us-central-1", Weight: 0.1},
	}
	cfg := Config{
		DefaultTimeout:   2 * time.Second,
		MaxFallbackDepth: 2,
		Selectors: []ProviderSelector{
			&StaticSelector{name: "intelligentrouter", cands: cands},
		},
		Plugins: []Plugin{
			&EchoPlugin{name: "contentsafety"},
			&EchoPlugin{name: "promptadapter"},
			&EchoPlugin{name: "contextfolding"},
		},
		Fallback: NewStaticFallback("smartfallback", cands),
	}
	cfg.Providers = providers
	return cfg, providers
}

// FastConfig is the same shape as DefaultConfig but with ~10x faster upstream
// (5 ms mean). Used by the e2e micro-benchmark so the loop is dominated by
// router logic, not upstream simulation.
func FastConfig() (Config, map[string]Provider) {
	providers := map[string]Provider{
		"anthropic": NewProgrammableProvider("anthropic", 5*time.Millisecond, 1*time.Millisecond),
		"openai":    NewProgrammableProvider("openai", 4*time.Millisecond, 1*time.Millisecond),
		"google":    NewProgrammableProvider("google", 6*time.Millisecond, 1*time.Millisecond),
	}
	cands := []ProviderRef{
		{Name: "anthropic", Model: "claude-sonnet-4.5", Weight: 0.6},
		{Name: "openai", Model: "gpt-4o", Weight: 0.3},
		{Name: "google", Model: "gemini-2.5-pro", Weight: 0.1},
	}
	cfg := Config{
		DefaultTimeout:   2 * time.Second,
		MaxFallbackDepth: 2,
		Selectors: []ProviderSelector{
			&StaticSelector{name: "intelligentrouter", cands: cands},
		},
		Plugins: []Plugin{
			&EchoPlugin{name: "contentsafety"},
			&EchoPlugin{name: "promptadapter"},
			&EchoPlugin{name: "contextfolding"},
		},
		Fallback: NewStaticFallback("smartfallback", cands),
	}
	cfg.Providers = providers
	return cfg, providers
}
