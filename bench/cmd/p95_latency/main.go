// Command p95_latency drives a sustained 1k-RPS workload for a configurable
// duration (default 30 min for the fleet SOTA; the CI step shortens it)
// and reports p50/p95/p99 end-to-end latency + throughput.
//
// Usage:
//
//	go run ./cmd/p95_latency \
//	    -rps=1000 \
//	    -duration=30m \
//	    -workers=64 \
//	    -warmup=10s
//
// Equivalent in intent to `ghz` (https://ghz.sh), but stdlib-only and
// in-process — no need to install ghz in CI. The driver paces requests via
// a token bucket so the achieved rate stays within ±2 % of the target.
package main

import (
	"context"
	"flag"
	"fmt"
	"os"
	"os/signal"
	"runtime"
	"sync"
	"sync/atomic"
	"syscall"
	"time"

	bench "github.com/KooshaPari/phenotype-router/bench"
)

func main() {
	var (
		rps      = flag.Int("rps", 1000, "Target requests per second")
		duration = flag.Duration("duration", 30*time.Minute, "Soak duration")
		workers  = flag.Int("workers", 64, "Concurrent in-flight requests")
		warmup   = flag.Duration("warmup", 10*time.Second, "Warm-up window (samples discarded)")
		report   = flag.Duration("report", 30*time.Second, "Periodic summary interval")
		strict   = flag.Bool("strict", false, "Exit non-zero if p99 > 1500ms budget")
	)
	flag.Parse()

	if *rps <= 0 || *duration <= 0 || *workers <= 0 {
		fmt.Fprintln(os.Stderr, "rps, duration, workers must be > 0")
		os.Exit(2)
	}

	cfg, _ := bench.DefaultConfig()
	router := bench.NewRouter(cfg)
	intent := bench.Intent{Model: "claude-sonnet-4.5"}

	// Token-bucket pacer: emits one token every 1/rps seconds. Workers
	// consume tokens before each Decide().
	tick := time.NewTicker(time.Second / time.Duration(*rps))
	defer tick.Stop()

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	sig := make(chan os.Signal, 1)
	signal.Notify(sig, os.Interrupt, syscall.SIGTERM)
	go func() {
		<-sig
		fmt.Fprintln(os.Stderr, "\ninterrupted — flushing...")
		cancel()
	}()

	tracker := bench.NewLatencyTracker()
	warmupTracker := bench.NewLatencyTracker()
	var inFlight int64

	var wg sync.WaitGroup
	work := make(chan struct{}, *workers)

	// Periodic reporter.
	go func() {
		t := time.NewTicker(*report)
		defer t.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-t.C:
				fmt.Fprintln(os.Stderr, tracker.Report("p95-soak"))
				fmt.Fprintf(os.Stderr, "  in-flight=%d  goroutines=%d\n",
					atomic.LoadInt64(&inFlight), runtime.NumGoroutine())
			}
		}
	}()

	tracker.Start()
	endTime := time.Now().Add(*duration)
	warmupEnd := time.Now().Add(*warmup)

	for time.Now().Before(endTime) && ctx.Err() == nil {
		select {
		case <-ctx.Done():
			endTime = time.Now()
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
				if time.Now().Before(warmupEnd) {
					warmupTracker.Record(took, err)
				} else {
					tracker.Record(took, err)
				}
			}()
		}
	}
	wg.Wait()
	tracker.Stop()

	fmt.Println("============================================================")
	fmt.Printf("p95 latency soak: rps=%d duration=%s workers=%d\n",
		*rps, duration, *workers)
	fmt.Printf("warmup: n=%d wall=%s (discarded)\n",
		warmupTracker.N(), warmupTracker.Wall().Round(time.Millisecond))
	fmt.Println(tracker.Report("steady-state"))
	if tracker.Errs() > 0 {
		fmt.Fprintf(os.Stderr, "WARNING: %d errors observed (%.3f%%)\n",
			tracker.Errs(),
			float64(tracker.Errs())/float64(tracker.N())*100)
	}

	// Per docs/perf-budget.md: default timeout = 2s, target p99 = 1.5s.
	if *strict && tracker.Percentile(99) > 1500*time.Millisecond {
		fmt.Fprintf(os.Stderr, "FAIL: p99=%s exceeds budget 1.5s\n",
			tracker.Percentile(99).Round(time.Millisecond))
		os.Exit(1)
	}
}
