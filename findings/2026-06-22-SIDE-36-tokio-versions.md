# SIDE-36 — Tokio runtime version alignment across the pheno-* fleet

**Date:** 2026-06-22
**Task:** SIDE-36
**Scope:** every `pheno-*` crate (substrate, lib, framework) with a `Cargo.toml` in this sparse-checkout cone
**Method:** static parse of `Cargo.toml` (declared constraint) + `Cargo.lock` (resolved version) for each pheno-* crate
**Verdict:** **ALIGNED — zero mismatches.** All declared constraints are `tokio = "1"` (major-version only). All lockfiles resolve to **1.52.3** with identical SHA256 checksum.

---

## 1. Per-crate inventory

| # | Crate | Tokio declared? | Scope | Declared constraint | Resolved (lockfile) | Checksum (SHA256) |
|---|---|---|---|---|---|---|
| 1 | `pheno-events` | YES | dev-deps | `tokio = { version = "1", features = ["macros", "rt-multi-thread"] }` | **1.52.3** | `8fc7f01b389ac15039e4dc9531aa973a135d7a4135281b12d7c1bc79fd57fffe` |
| 2 | `pheno-port-adapter` | YES | main + dev | main: `"1"` `["rt-multi-thread", "macros", "sync", "time"]` · dev: `"1"` `["macros", "rt-multi-thread"]` | **1.52.3** | `8fc7f01b389ac15039e4dc9531aa973a135d7a4135281b12d7c1bc79fd57fffe` |
| 3 | `pheno-tracing` | YES | main + dev | main: `"1"` `["full"]` · dev: `"1"` `["rt", "macros", "test-util"]` | **1.52.3** | `8fc7f01b389ac15039e4dc9531aa973a135d7a4135281b12d7c1bc79fd57fffe` |
| 4 | `pheno-config` | NO (transitive) | dev-deps (via `chaos-injection`) | — | **1.52.3** | `8fc7f01b389ac15039e4dc9531aa973a135d7a4135281b12d7c1bc79fd57fffe` |
| 5 | `pheno-otel` | NO (transitive) | dev-deps (via `chaos-injection`) | — | **1.52.3** | `8fc7f01b389ac15039e4dc9531aa973a135d7a4135281b12d7c1bc79fd57fffe` |
| 6 | `pheno-context` | NO | — | — | not present | n/a |
| 7 | `pheno-errors` | NO | AGENTS.md mentions `From<tokio::io::Error>` but no Cargo.toml dep yet | — | not present | n/a |
| 8 | `pheno-flags` | NO | sync, in-memory only | — | not present | n/a |
| 9 | `pheno-cli-base` | NO | sync per `SPEC.md` ("pure synchronous, no tokio") | — | not present | n/a |
| 10 | `pheno-chaos` (workspace root + `crates/pheno-chaos` + `crates/pheno-chaos-macros`) | NO — DELIBERATE | per ADR-040 + `crates/pheno-chaos/Cargo.toml:15-18` comment ("We deliberately avoid tokio/async-std here so the substrate is runtime-agnostic") | — | not present | n/a |

## 2. Shared substrate tokio source: `chaos-injection`

`chaos-injection` (path-dep) is the L36 substrate used as a dev-dep by `pheno-config`, `pheno-events`, and `pheno-otel`. Its own tokio pinning is:

| Scope | Declared constraint |
|---|---|
| main | `tokio = { version = "1", features = ["rt", "rt-multi-thread", "macros", "time", "sync"] }` |
| dev | `tokio = { version = "1", features = ["full"] }` |

Resolved: **1.52.3**, same checksum as the rest of the fleet. **Aligned.**

## 3. Mismatch analysis

| Check | Result |
|---|---|
| Declared constraints all start with `"1"` | ✅ pass — no `0.x`, no `2.x` |
| Resolved versions all identical (1.52.3) | ✅ pass — 5/5 lockfiles agree |
| Checksums all identical | ✅ pass — single SHA256 across fleet |
| Feature flag overlap (where both crates use tokio) | ✅ pass — every declared feature is a subset of `["full"]` (`["macros", "rt-multi-thread", "sync", "time", "rt", "test-util"]`) |
| Cargo.lock mtimes within reasonable drift | ✅ pass — all locks regenerated 2026-06-21 (today) |

**No mismatches. No remediation required.**

## 4. Notes & forward-looking observations

1. **Single-version guarantee is real, not coincidental.** The four lockfiles (`pheno-events`, `pheno-port-adapter`, `pheno-tracing`, `pheno-otel`) and the `pheno-config` lockfile all carry the **same SHA256** for the `tokio` package entry. Cargo's resolver picked the highest compatible version satisfying every `"1"` constraint — 1.52.3 is current as of the lock regeneration.
2. **Loose major-version pinning (`"1"`) is intentional and safe here.** None of the pheno-* crates pin a tokio minor (`"1.52"`); they rely on `Cargo.lock` for reproducibility. This matches ADR-040 substrate quality bar.
3. **`pheno-errors` AGENTS.md mentions tokio** but no `tokio` line in `Cargo.toml`. If a future patch implements the `From<tokio::io::Error>` conversion, declare the dep as `tokio = { version = "1", default-features = false, features = ["io-util"] }` to keep feature surface minimal and stay aligned.
4. **`pheno-chaos` is intentionally tokio-free** (ADR-040: runtime-agnostic chaos substrate). The `#[chaos_test]` macro runs on `std::thread` + `libc`. Do not add a tokio dep here even if consumer code is async — that would violate the substrate's design contract.
5. **`pheno-port-adapter` is the only main-scope (non dev-only) tokio user.** It pulls in `sync` + `time` because `HexCachePort` adapters (Redis, in-memory) use `tokio::sync::Mutex` and `tokio::time::sleep`. Per `docs/architecture.md:105-106` (KD-3 / KD-4), this is the **single tokio runtime** for the cache substrate — no async-std, no smol, consistent with the v17 T6 async-runtime decision.

## 5. Verification commands (re-runnable)

```bash
# 1. Per-crate declared constraint
for c in pheno-events pheno-port-adapter pheno-tracing pheno-config pheno-otel \
         pheno-context pheno-errors pheno-flags pheno-cli-base pheno-chaos; do
  echo "=== $c ==="
  grep -n 'tokio' "$c/Cargo.toml" 2>/dev/null \
    || echo "  (no tokio in $c/Cargo.toml)"
done

# 2. Per-crate resolved version (lockfile)
for c in pheno-events pheno-port-adapter pheno-tracing pheno-config pheno-otel \
         pheno-context pheno-errors pheno-flags pheno-cli-base pheno-chaos; do
  echo "=== $c ==="
  grep -A 3 '^name = "tokio"' "$c/Cargo.lock" 2>/dev/null \
    || echo "  (no tokio in $c/Cargo.lock)"
done

# 3. Chaos-injection source
grep -n 'tokio' chaos-injection/Cargo.toml
```

## 6. Audit-trail anchors

- `pheno-events/Cargo.toml:35` — dev-dep tokio
- `pheno-port-adapter/Cargo.toml:16` — main tokio (hex-port runtime)
- `pheno-port-adapter/Cargo.toml:42` — dev-dep tokio
- `pheno-tracing/Cargo.toml:35` — main tokio `["full"]`
- `pheno-tracing/Cargo.toml:41` — dev-dep tokio `["rt", "macros", "test-util"]`
- `pheno-chaos/crates/pheno-chaos/Cargo.toml:15-18` — deliberate avoidance comment
- `pheno-cli-base/SPEC.md:53` — "pure synchronous, no tokio"
- `pheno-port-adapter/docs/architecture.md:105-106` — KD-3 single-runtime + KD-4 redis tokio-comp
- `chaos-injection/Cargo.toml:18, 26` — main + dev tokio in shared substrate

## 7. Conclusion

**SIDE-36 closes as a no-op audit pass.** All pheno-* crates that need tokio pin to the same resolved version (1.52.3) with identical SHA256. The fleet is internally consistent. No PR is required to fix alignment. Recommendation: re-run this audit on the next tokio minor bump (likely 1.53+ via `cargo update -p tokio`) to confirm the resolver still lands on a single version across all five touched lockfiles.
