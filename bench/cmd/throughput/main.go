// Command throughput sweeps concurrent load from 100 RPS to 10k RPS and
// reports achieved throughput vs p50/p95/p99 latency at each step. The
// point is to find the ceiling: the RPS at which latency stops scaling
// linearly and tail percentiles explode.
//
// Usage:
//
//	go run ./cmd/throughput \
//	    -min=100 -max=10000 -steps=10 \
//	    -per-step=30s
//
// Each step runs for -per-step, then prints a one-line summary, sleeps
// -cooldown, then advances to the next RPS target. The sweep is monotone
// non-decreasing; reverse-sweep with -reverse for hysteresis checks.
package main

import (
	"context"
	"flag"
	"fmt"
	"math"
	"os"
	"os/signal"
	"runtime"
	"sort"
	"sync"
	"sync/atomic"
	"syscall"
	"time"

	bench "github.com/KooshaPari/phenotype-router/bench"
)

func main() {
	var (
		minRPS    = flag.Int("min", 100, "Starting RPS")
		maxRPS    = flag.Int("max", 10000, "Ending RPS")
		steps     = flag.Int("steps", 10, "Sweep steps (log-spaced if -log)")
		useLog    = flag.Bool("log", true, "Log-spaced steps between min and max")
		perStep   = flag.Duration("per-step", 30*time.Second, "Duration of each step")
		workers   = flag.Int("workers", 256, "Worker pool size (cap on in-flight)")
		warmup    = flag.Duration("warmup", 3*time.Second, "Per-step warm-up (discarded)")
		cooldown  = flag.Duration("cooldown", 2*time.Second, "Pause between steps")
		reverse   = flag.Bool("reverse", false, "Sweep high-to-low (hysteresis)")
		reportAll = flag.Bool("full", false, "Print full LatencyTracker report at each step")
		profile   = flag.String("profile", "fast",
			"Upstream profile: 'fast' (5ms) to find router ceiling, "+
				"'real' (800ms) to find upstream ceiling")
	)
	flag.Parse()

	if *minRPS <= 0 || *maxRPS < *minRPS || *steps < 1 {
		fmt.Fprintln(os.Stderr, "min must be > 0, max >= min, steps >= 1")
		os.Exit(2)
	}

	var router *bench.Router
	switch *profile {
	case "fast":
		cfg, _ := bench.FastConfig()
		router = bench.NewRouter(cfg)
	case "real":
		cfg, _ := bench.DefaultConfig()
		router = bench.NewRouter(cfg)
	default:
		fmt.Fprintf(os.Stderr, "unknown profile %q (want 'fast' or 'real')\n", *profile)
		os.Exit(2)
	}
	intent := bench.Intent{Model: "claude-sonnet-4.5"}

	// Build target RPS list.
	targets := make([]int, *steps)
	if *useLog {
		// Geometric spacing — gives meaningful steps across 100..10000.
		a := float64(*minRPS)
		b := float64(*maxRPS)
		for i := 0; i < *steps; i++ {
			t := float64(i) / float64(*steps-1)
			targets[i] = int(a * mathPow(b/a, t))
		}
	} else {
		step := (*maxRPS - *minRPS) / (*steps - 1)
		for i := 0; i < *steps; i++ {
			targets[i] = *minRPS + step*i
		}
	}
	if *reverse {
		sort.Sort(sort.Reverse(sort.IntSlice(targets)))
	}

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	sig := make(chan os.Signal, 1)
	signal.Notify(sig, os.Interrupt, syscall.SIGTERM)
	go func() {
		<-sig
		fmt.Fprintln(os.Stderr, "\ninterrupted — flushing...")
		cancel()
	}()

	fmt.Println("============================================================")
	fmt.Printf("throughput sweep: min=%d max=%d steps=%d per-step=%s workers=%d\n",
		*minRPS, *maxRPS, *steps, *perStep, *workers)
	fmt.Printf("%-7s  %-7s  %-7s  %-9s  %-9s  %-9s  %-9s  %-7s\n",
		"target", "actual", "errs", "p50", "p95", "p99", "max", "rss")

	for _, target := range targets {
		if ctx.Err() != nil {
			break
		}
		tracker, achieved := runStep(ctx, router, intent,
			target, *workers, *perStep, *warmup)
		if tracker.N() == 0 {
			fmt.Printf("%-7d  (no samples — workers starved?)\n", target)
			continue
		}
		var m runtime.MemStats
		runtime.ReadMemStats(&m)
		fmt.Printf("%-7d  %-7.0f  %-7d  %-9s  %-9s  %-9s  %-9s  %-7dM\n",
			target, achieved, tracker.Errs(),
			tracker.Percentile(50).Round(time.Microsecond),
			tracker.Percentile(95).Round(time.Microsecond),
			tracker.Percentile(99).Round(time.Microsecond),
			tracker.Percentile(100).Round(time.Microsecond),
			m.HeapAlloc/(1024*1024))
		if *reportAll {
			fmt.Println("  ", tracker.Report("step"))
		}
		if target != targets[len(targets)-1] {
			time.Sleep(*cooldown)
		}
	}
}

// runStep drives a single RPS target for perStep and returns the steady-state
// tracker plus the achieved RPS.
func runStep(ctx context.Context, router *bench.Router, intent bench.Intent,
	targetRPS, workers int, perStep, warmup time.Duration,
) (*bench.LatencyTracker, float64) {
	tick := time.NewTicker(time.Second / time.Duration(targetRPS))
	defer tick.Stop()
	warm := bench.NewLatencyTracker()
	tracker := bench.NewLatencyTracker()

	var inFlight int64
	var wg sync.WaitGroup
	work := make(chan struct{}, workers)

	end := time.Now().Add(perStep)
	warmEnd := time.Now().Add(warmup)
	tracker.Start()
	for time.Now().Before(end) && ctx.Err() == nil {
		select {
		case <-ctx.Done():
			end = time.Now()
		case <-tick.C:
			work <- struct{}{}
			atomic.AddInt64(&inFlight, 1)
			wg.Add(1)
			go func() {
				defer wg.Done()
				defer atomic.AddInt64(&inFlight, -1)
				defer func() { <-work }()
				start := time.Now()
				_, err := router.Decide(ctx, intent)
				took := time.Since(start)
				if time.Now().Before(warmEnd) {
					warm.Record(took, err)
				} else {
					tracker.Record(took, err)
				}
			}()
		}
	}
	wg.Wait()
	tracker.Stop()
	return tracker, tracker.RPS()
}

// mathPow is a tiny wrapper around math.Pow. Kept for readability at the
// call site.
func mathPow(a, b float64) float64 { return math.Pow(a, b) }
