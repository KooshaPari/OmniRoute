# SOTA — io_uring for Async Disk I/O in Data Pipeline (side-32)

**Date:** 2026-06-20
**Task ID:** side-32
**Agent:** v11-sota-batch-1
**Verdict:** **Defer with a tracking spike.** io_uring is the SOTA async disk-I/O substrate on Linux 5.6+ and is the right choice for the next data-pipeline crate the fleet builds — but the fleet has no such crate today and the existing Rust async I/O story (tokio's `tokio-uring`) is the only credible Rust integration.

## What io_uring is (2026-06)

io_uring is a Linux kernel async I/O mechanism introduced in 5.6 (2020) and matured through 6.x (2026). It exposes two ring buffers (submission + completion) shared between userspace and kernel, allowing zero-syscall submission of I/O operations (read, write, fsync, accept, connect, sendmsg, recvmsg, openat, etc.) and batched completion polling. Key properties:

- **Zero-syscall fast path**: SQE entries are written into the submission ring; only when the ring is full or the user opts in does a `io_uring_enter()` syscall fire.
- **Batched polling**: a single syscall can submit and reap hundreds of operations, cutting syscall overhead 10–100x vs epoll + preadv/pwritev.
- **Buffered vs unbuffered**: supports both O_DIRECT and page-cache paths; the page-cache path now matches libaio/AIO on most workloads.
- **Kernel-side polling (SQPOLL)**: optional kernel thread that polls the SQ ring without syscall at all — best for tight latency loops, costs 1 CPU.
- **Stable ops**: read/write/readv/writev/fsync/send/recv/accept/connect/openat/stat/fadvise/madvise/close. The "linked" and "multishot" variants reduce round-trips further.

`tokio-uring` is the production-quality Rust binding (part of tokio-experimental since 2021, stabilized as `tokio::uring` in 1.40+). It exposes `tokio_uring::spawn` + `Read`/`Write`-shaped futures over io_uring file descriptors, and integrates with the rest of the tokio runtime.

## Fleet relevance (today)

The Phenotype fleet has limited sustained-disk-I/O workloads. The relevant candidates:

- **`pheno-otel`** (federated observability service) — receives OTLP batches, writes them to a WAL-style local buffer before forwarding. Today uses synchronous `tokio::fs`. Throughput is bounded by disk fsync cadence, not by submission overhead, so the io_uring win is small (maybe 10–20% at >50K spans/sec).
- **`phenotype-events`** (event bus substrate) — durable event log on top of a sled-style append-only file. Write throughput at >100K events/sec would benefit substantially.
- **`pheno-otel-wt`** (worktree for the otel substrate) — same as `pheno-otel`; not a separate consumer.
- **None of the pheno-* libs** do heavy disk I/O. They are config/errors/context/port-adapter wrappers — all in-memory.
- **`PhenotypeHandoff` / `Civis` / `Dino`** (apps, paused per ADR-023) — not load-bearing for fleet decisions.

So the realistic consumers are `pheno-otel` and `phenotype-events`. Both would benefit; neither is currently a bottleneck.

## When io_uring becomes attractive

- **Linux-only** — there is no io_uring on macOS or Windows. `tokio-uring` does not work on the developer's primary machine (per `current_working_directory`, macOS). That alone gates adoption until we have a Linux-first workload or are willing to support two code paths.
- **Write-heavy, fsync-light** workloads — io_uring's submission batching shines when the bottleneck is syscall overhead, not the disk itself. WAL-style append logs, telemetry buffering, log shippers, bulk file processors.
- **Mature kernel** — Linux 5.15+ is the practical floor (5.10 has known SQPOLL bugs); 6.1+ is the comfortable baseline. Fleet dogfood CI runs on 6.x so this is fine for production but a hazard for contributors on older systems.
- **Latency-sensitive tail** — 99p latency under 100µs for individual I/O completions is achievable with `IORING_SETUP_SQPOLL`; this matters for HFT-style or kernel-bypass-adjacent use cases we don't currently have.

## Concrete recommendations

1. **Do not adopt io_uring fleet-wide this turn.** Two consumers at most, neither a current bottleneck, and the macOS dev-machine problem is a real friction cost.
2. **Spike: `pheno-otel` WAL rewrite behind a `WAL: Port` trait** (deferred — not this turn). Define a `WAL: Send + Sync` trait with `tokio::fs` (sync tokio) and `tokio_uring` (io_uring) implementations; gate behind a Cargo feature `wal-io-uring`. Benchmark against the current `tokio::fs` path. Decision criterion: >2x throughput at >50K spans/sec sustained, with 99p tail not worse.
3. **Spike: `phenotype-events` segment writer** (deferred). The durable log writer is a natural io_uring consumer (sequential appends, no random reads in the hot path). Same trait pattern.
4. **Track the io_uring feature flags** — `IORING_SETUP_SQPOLL`, `IORING_SETUP_COOP_TASKRUN`, `IORING_SETUP_TASKRUN_FLAG` — in a fleet-side notes file as kernel versions stabilize them.
5. **Document the dev-machine problem** — contributors on macOS will not be able to run `tokio-uring` code paths locally. Either gate behind a feature flag (default-off on macOS) or run the WAL tests in CI on Linux only.

## Recommendation

**Defer with a tracking spike.** io_uring is the right substrate for the next write-heavy, Linux-only data-pipeline crate the fleet builds. The `pheno-otel` WAL and `phenotype-events` segment writer are the two realistic first consumers. Both warrant a `WAL: Port` trait spike — but not until the relevant consumer is the actual bottleneck, not before.

**Refs:** io_uring kernel docs (kernel.org/io_uring), `tokio-uring` crate docs (docs.rs/tokio-uring), Jens Axboe io_uring talks (2023–2025), ADR-014 (hexagonal ports — the trait pattern fits naturally), `findings/2026-06-19-clap-ext-verification.md` (port-trait precedent), `pheno-otel/src/wal/` (current sync WAL impl).
