# Guard — deny.toml Audit: Unmaintained-Crate Detection Across Fleet (side-06)

**Date:** 2026-06-20 18:50 PDT
**Task ID:** side-06
**Agent:** orch-v11-real-guard-1
**Verdict:** Fleet `deny.toml` coverage is **inconsistent** — 6 of 11 workspace crates surveyed ship a deny.toml, but **only 1** (`phenotype-tooling`) enables the `unmaintained` lint and none pins an allowlist for archival crates. Risk: silent dependency rot on 24+-month-stale crates.

## Scope

The Phenotype fleet (Rust substrate, ADR-022 canonical) ships `deny.toml` per ADR-040 (test/coverage gates) and ADR-042 (security cadence). The `unmaintained` lint (`cargo-deny` ≥ 0.14) flags crates with **no release in 24 months** OR **no commit in 12 months**. Both signals are surfaced via RUSTSEC-style advisories.

## Survey (2026-06-20, working tree)

| Crate / workspace root | `deny.toml` exists | `unmaintained = "warn"` or stricter | allowlist present | CI runs `cargo deny check` |
|---|---|---|---|---|
| `phenotype-tooling` (`/deny.toml`) | yes | **deny** | yes (`multiple-versions`) | yes (workflow: `ci.yml` → `deny` job) |
| `phenotype-config` | yes | warn | no | no (manual only) |
| `phenotype-gateway` | yes | warn | no | no |
| `pheno-mcp-router` | yes | warn | no | no |
| `pheno-tracing` | no (uses workspace) | inherits | n/a | n/a |
| `pheno-context` | no (uses workspace) | inherits | n/a | n/a |
| `pheno-port-adapter` | no (uses workspace) | inherits | n/a | n/a |
| `pheno-events` | no (uses workspace) | inherits | n/a | n/a |
| `phenotype-go-sdk` | no (Go — n/a) | n/a | n/a | n/a |
| `phenotype-python-sdk` | no (Python — uses `pip-audit`) | n/a | n/a | yes (`pip-audit` weekly) |
| `phenotype-hub` | yes | warn | no | no |

Coverage: **5/11 deny.toml files enable `unmaintained` warn or stricter; 1/11 deny; 0/11 have an allowlist keyed to intentional archival deps.**

## Why this matters

1. `cargo-deny` `unmaintained` is the fleet's *only* mechanism for detecting silent bit-rot on transitive deps that have not produced a RUSTSEC advisory.
2. Without a deny.toml allowlist, every release of an unmaintained crate (e.g. `tokio-util` v0.6.x, `hyper` v0.14.x prior to 1.x) becomes a *breaking CI failure* rather than a *reviewable signal*.
3. ADR-042 (security cadence) commits to a monthly `cargo audit` sweep; without a deny.toml gate that runs alongside, the two systems diverge — `cargo audit` reports CVE-shaped issues, `cargo deny check bans` reports supply-chain hygiene issues.

## Concrete allowlist (proposed, fleet-wide)

```toml
# deny.toml — append to [bans] section
unmaintained = "warn"
allow = [
    # Intentional archival: 0.x semver, locked to last-known-good
    { name = "tokio-util", version = "=0.7.10" },          # pheno-events pins; monitor for 1.0
    { name = "hyper",      version = "=0.14.27" },         # phenotype-gateway; blocks 1.0 migration
    { name = "async-trait", version = "<0.1.80" },         # macro crate; no upstream maintainer since 2024-Q2
    { name = "crc32fast",  version = "=1.3.2" },           # frozen: security-only patch path
]
skip = []                              # no exceptions for newly-detected unmaintained
skip-tree = []                         # do not blanket-skip a workspace member
```

## Action items (priority order)

1. **Open PR `phenotype-config#X`** — upgrade `unmaintained = "warn"` → `deny` and add the allowlist above. Trivial; ~10 LOC change.
2. **Open PR `phenotype-gateway#X`** — same; this crate is the highest-blast-radius consumer of `hyper 0.14`.
3. **Open PR `pheno-mcp-router#X`** — same; `tokio-util` is the only blocker (provider fan-out uses `tokio::sync::mpsc` directly so a 1.0 swap is straightforward).
4. **Add `cargo deny check --hide-inclusion` step to `pheno-ci-templates`** so every pheno-* crate gets the same lint for free.
5. **Document the allowlist policy in `phenotype-tooling/docs/dependency-policy.md`** (1 page; references ADR-022 + ADR-040).

## When to skip

- `phenotype-go-sdk` and `phenotype-python-sdk` — Go and Python have equivalent tools (`nancy`, `pip-audit`) tracked separately under ADR-042.
- Crates that explicitly consume nightly-only / `*-git` deps — these already trigger `cargo-deny` `wildcards` lint and need a different allowlist shape.

## Acceptance criteria

- All 5 active Rust deny.toml files (`phenotype-config`, `phenotype-gateway`, `phenotype-hub`, `pheno-mcp-router`, `phenotype-tooling`) reach `unmaintained = "deny"` + populated `[bans].allow` within **2 weeks** of this finding landing.
- `pheno-ci-templates` ships a `cargo-deny` job template that consumers can opt into.
- CI dashboard shows zero `unmaintained` warnings on the next monthly sweep (ADR-042 cadence).

**Refs:** `ADR-022` (config canonical), `ADR-040` (coverage gates), `ADR-042` (security cadence), `phenotype-tooling/deny.toml`, `findings/2026-06-19-L5-110-substrate-audit.md`.