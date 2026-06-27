# v20-T3 L36 Chaos Depth — Fault Injection Harness (DEFERRED)

**Track:** T3 (Cycle 10 P1 reduction, L36)
**Status:** ⏸ DEFERRED — blocked on `pheno-mcp-router` local clone
**Target Repo:** `KooshaPari/pheno-mcp-router` (no local clone at `repos/pheno-mcp-router/`)
**Author:** KooshaPari, 2026-06-21
**ADR:** ADR-083 (cycle 10 P1 reduction)

---

## Goal

Lift L36 (chaos depth) from P1 to saturated by adding a **fault-injection harness** that exercises:

1. **Process kills** — SIGKILL the federated service mid-request, verify retry logic
2. **Network partitions** — drop all traffic to backend, verify timeout + circuit breaker
3. **Disk full** — fill /tmp to 0 bytes, verify write-failure handling
4. **Memory pressure** — malloc until OOM, verify graceful degradation
5. **Clock skew** — set system clock ±5min, verify TLS rejection
6. **DNS failures** — point /etc/hosts to 0.0.0.0, verify fail-fast
7. **Partial response** — backend returns half a JSON document, verify parse-error
8. **Slow loris** — backend sends 1 byte/sec, verify request timeout

Each scenario runs in CI as a separate `chaos-N` job, executes in 60s, and reports PASS/FAIL with diff against expected behavior.

## Why Deferred

The fault-injection harness requires:
- Live `pheno-mcp-router` repo (no local clone — git submodule pointer drift, see STATUS.md)
- Docker or k8s isolation (subagent dispatch would collide with v19 OIDC rollout)
- ~3 hours of focused work to implement + test

Recommended: when the `pheno-mcp-router` repo is cloned + OIDC v19 ships, spawn `orch-v20-T3-L36-fault-injection` subagent with this finding as input.

## Scaffold (when ready)

```toml
# Cargo.toml [dev-dependencies]
chaos-mesh = "0.1"   # or use toxiproxy-rs for network
nix = "0.27"         # for process kill / clock skew
tempfile = "3.10"
```

```rust
// tests/chaos/fault_injection.rs
#[test] fn sigkill_during_request() { /* spawn 10 requests, kill server at t=5s */ }
#[test] fn network_partition() { /* iptables drop, verify 503 */ }
#[test] fn disk_full() { /* fill /tmp, verify write-fail */ }
// ... 6 more
```

## Acceptance

- 8 chaos tests in `tests/chaos/`
- CI matrix runs each in a fresh container
- All 8 PASS within 60s each
- Documented runbook in `docs/chaos/fault-injection-howto.md`

## ETA

When unblocked: **2 weeks** (1 week impl, 1 week CI hardening)
