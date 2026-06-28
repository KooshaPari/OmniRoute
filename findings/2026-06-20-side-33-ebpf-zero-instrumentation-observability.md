# SOTA — eBPF for Zero-Instrumentation Observability (side-33)

**Date:** 2026-06-20
**Task ID:** side-33
**Agent:** v11-sota-batch-1
**Verdict:** **Adopt as substrate-spike target.** eBPF is the SOTA zero-instrumentation observability mechanism on Linux 4.19+ and is the right substrate for fleet-wide kernel-level visibility. The path is via `pheno-otel` as the consumer + `Aya` (Rust-native eBPF) as the binding.

## What eBPF is (2026-06)

eBPF (extended Berkeley Packet Filter) is a Linux kernel technology (since 4.19 stable, 5.x matured, 6.x has wide type/CO-RE/loop support) that runs sandboxed, JIT-compiled bytecode inside the kernel without modifying kernel source or loading kernel modules. Use cases:

- **Networking**: XDP/TC hooks for packet processing, load balancing, DDoS mitigation.
- **Observability**: tracepoints, kprobes, uprobes for syscall tracing, latency attribution, CPU profiling, security event capture.
- **Security**: LSM hooks, seccomp-style filters, runtime intrusion detection.
- **Storage**: bio traces, latency attribution per-I/O.

Key properties: zero source-code instrumentation (you attach to existing kernel/user functions), runtime-safe (verified by the in-kernel verifier), near-native speed (JIT-compiled), and CO-RE (Compile Once, Run Everywhere) via BTF type info so a single .o works across kernel versions.

Rust bindings:

- **Aya** (async Rust-native, no libbpf dependency, embedded-friendly, Apache-2.0/MIT) — the leading choice for new Rust code.
- **libbpf-rs** (Rust wrapper over libbpf, follows libbpf conventions) — best for codebases already using libbpf C programs.
- **redbpf** (older, deprecated — avoid).

## Fleet relevance (today)

This is the strongest candidate of all six SOTA tasks. Direct consumers in the fleet:

- **`pheno-otel`** (federated observability service, ADR-012 canonical substrate) — natural owner of eBPF data sources. A `pheno-otel-ebpf` sub-crate that exposes OTLP-shaped metrics from eBPF probes would slot in as a `pheno-tracing` extension.
- **`ObservabilityKit`** (federated service) — already cross-references `pheno-otel`. Same extension slot.
- **`pheno-otel-wt`** (worktree) — not a separate consumer; absorbs the same work.
- **`pheno-tracing`** (per ADR-012 / ADR-036B canonical) — application-level tracing. eBPF gives the kernel-level complement; together they produce a complete request-to-syscall correlation picture.
- **`phenotype-events`** — could expose event-source hooks (process exec, network connect) for security/audit pipelines.
- **Cross-cutting per ADR-026 (Factory AI Agent Readiness)** — "Observability & Ops" is one of the 9 Fleet Quality domains; eBPF scores 3/3 on L57 (continuous profiling) and L62 (zero-instrumentation traces) without writing a single line of application code.

The fleet today has no eBPF source. Everything is application-level metrics via OTLP or hand-rolled `tracing` spans. That gap is real and visible in the 71-pillar audit (L57, L62 score 1/3 today).

## When eBPF becomes attractive (it already is)

eBPF is attractive **now** because:

1. **Linux 5.10+ is universal** on any modern fleet host. CI runners are 6.x. The developer's macOS is the only "doesn't work" surface, and that can be gated.
2. **No application changes** — for syscall/network/disk visibility, you attach to kernel probes, not your code. This is the cheapest way to get the L57/L62 71-pillar pillars from 1/3 to 3/3.
3. **Aya is mature** — first-party tokio integration, async probe loading, BTF/CO-RE support, used in production at Adobe/Microsoft/Shopify.
4. **OTel eBPF receivers exist** — `opentelemetry-ebpf-receiver` (the otel-collector-contrib component) is the off-the-shelf path; a `pheno-otel` native path would be leaner but both are credible.

## Concrete recommendations

1. **Spike: `pheno-otel-ebpf` as a new sub-crate** (this is a v11-tier-1 candidate — flag for the next plan). Scope: Aya-based probes for `tcp_connect`, `tcp_sendmsg`, `tcp_recvmsg`, `sys_enter_openat`, `sys_enter_write`, `io_uring_enter`, and `cpu_clock` events. Exports OTLP metrics + traces via `pheno-otel`'s exporter pipeline. Crate size budget: <2500 LOC.
2. **Defer until fleet Linux host is identified.** `pheno-otel` production hosts are not documented in `findings/` yet; pick a Linux distro baseline (Debian 12 / Ubuntu 24.04 LTS / RHEL 9) and verify the kernel version supports the probes you need. 5.15 minimum; 6.1 preferred.
3. **Document the macOS dev-machine gap.** Developers on macOS cannot load eBPF programs. Gate the feature off by default; CI on Linux runners.
4. **Map to 71-pillar** — adoption raises L57 (continuous profiling) from 1/3 to 3/3, L62 (zero-instrumentation traces) from 1/3 to 3/3, L60 (open telemetry compatibility) from 2/3 to 3/3. This is the single highest-leverage substrate the fleet could adopt in the next quarter.
5. **Reuse OTel-Collector if simpler.** `otel-collector-contrib`'s `receiver/ebpf` is feature-complete for HTTP/gRPC/database traffic. The custom Aya path is only worth it if (a) we need a probe OTel doesn't ship, or (b) we want zero-binary-footprint ingestion.

## Recommendation

**Adopt as substrate-spike target.** eBPF is the right substrate for fleet-wide kernel-level observability; `pheno-otel-ebpf` is the right crate name. Flag this for the next plan's tier-1 tracks. The 71-pillar score lift alone (L57/L60/L62 → 3/3) justifies the work; the production value (latency attribution, anomaly detection on syscall patterns) is the durable win.

**Refs:** Aya project (aya-rs.dev), libbpf docs (github.com/libbpf/libbpf), OTel-Collector eBPF receiver (github.com/open-telemetry/opentelemetry-collector-contrib), Brendan Gregg's BPF Performance Tools (book), ADR-012 (pheno-tracing canonical), ADR-026 (Factory AI Observability), `findings/71-pillar-2026-06-17.md` (L57/L60/L62 scorecard).
