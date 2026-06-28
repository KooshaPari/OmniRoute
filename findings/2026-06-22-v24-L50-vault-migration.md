# v24 T4 — L50 Vault Migration Plan (Cycle 14, P1 Reduction Round 5)

| Field            | Value                                                                 |
|------------------|-----------------------------------------------------------------------|
| **Date**         | 2026-06-22                                                            |
| **Branch**       | `chore/v24-71-pillar-cycle-14-p1-2026-06-22`                          |
| **Pillar**       | L50 (Secrets Management)                                              |
| **Cycle**        | 14 (P1 reduction round 5)                                             |
| **Score Δ**      | 0 → 2 (per ADR-092; full 0 → 3 deferred to v25 L50-deepening)         |
| **Refs**         | ADR-077 (Vault roadmap), ADR-083 (v22 cycle 12), ADR-092 (v24 scope), ADR-046 (federation mTLS+OIDC), ADR-022 (config substrate split), ADR-042 (security cadence), ADR-015 v2.1 (worklog schema, `device:` field) |
| **Companion**    | `findings/2026-06-22-v24-L50-rotate-runbook.md`, `findings/2026-06-22-v24-L50-secret-inventory.md` |

## 1. Context & Scope

Cycle-13 probe (`findings/2026-06-21-71-pillar-cycle-13-probe.md`) scored L50 at **0/3** — the lowest of any pillar in the 71-pillar sweep. ADR-077 (vault migration roadmap) established a 4-phase, 12-week, 3-FTE plan; v24 T4 implements **PR-1 + PR-2 + PR-3** of the substrate layer (Phase 3 of ADR-077, scoped down to the **8 fleet-critical crates** below). OIDC federation wiring (ADR-077 Phase 2) and full 23-workflow migration are deferred to v25+ L50-deepening.

**8 fleet-critical crates (in-scope, v24 T4):**

| # | Crate                       | Lang  | Owner role          | Current secret sources               |
|---|-----------------------------|-------|---------------------|--------------------------------------|
| 1 | `pheno-config`              | Rust  | service settings    | env (12-factor cascade) + .env       |
| 2 | `phenotype-config-core`     | Rust  | lib cascade loader  | file (TOML/JSON/YAML) + env          |
| 3 | `Configra` (ADR-031)        | Rust  | canonical config    | file (TOML) + env                    |
| 4 | `Conft`                     | TS    | TS edge (ADR-022)   | `process.env` + dotenv               |
| 5 | `phenotype-bus`             | Rust  | IoC framework       | env (broker URL, creds)              |
| 6 | `phenotype-hub`             | Rust  | IoC framework       | env (port + TLS cert path)           |
| 7 | `pheno-mcp-router`          | Rust  | MCP substrate       | env (provider keys, OIDC issuer)     |
| 8 | `pheno-otel`                | Rust  | OTLP substrate      | env (OTLP endpoint, headers)         |

**Out of scope for v24 (deferred to v25 L50-deepening, ADR-092):**
- 23 production workflow migrations (ADR-077 Phase 3 broader scope)
- OIDC federation wiring (ADR-077 Phase 2)
- AWS Secrets Manager decommission (ADR-077 Phase 4)
- 39 non-fleet-critical crates (the remaining ~47-crate workspace minus the 8 above)
- L59 OTel collector HA (depends on this T4 completion; deferred per ADR-092)

**47-crate inventory:** the v24 L2 module-boundaries artifact (`findings/2026-06-21-v17-L2-module-boundaries.md`) enumerates all 47 workspace crates. The 8 fleet-critical crates above are the **Tier-1** subset (rated `STABLE` per ADR-048 graduation path; carry production traffic); the remaining 39 are `STAGING` / `EXPERIMENTAL` and adopt vault reads only after Tier-1 lands.

## 2. 3-PR Sequencing

Each PR is independently shippable, independently revertible, and lands on `main` only after the prior PR has soaked 48 h on staging. Per ADR-049 drift-detector: each PR regenerates `L5` C4 component diagrams (the `ConfigSource` node is added/modified per PR).

### PR-1: Vault client lib + `SecretSource` trait abstraction

- **Scope:** add `vault-rs = "0.7"` adapter in `pheno-port-adapter` (already a dep); introduce `SecretSource` trait with `FileSource`, `EnvSource`, `VaultSource` impls.
- **No callsite changes** in any consumer crate; trait is exposed but unused.
- **Files added:** `pheno-port-adapter/src/secret/{mod,source,trait,vault,env,file}.rs` (~280 LoC) + 6 unit tests + 1 proptest.
- **Coverage:** 80 % per ADR-040 lib gate.
- **CI gate:** `trufflehog` + `gitleaks` clean (baseline; no behavior change yet).
- **Reviewers:** 1 fleet stakeholder + 1 sec-eng per ADR-077 § 11.
- **Merge criteria:** 48 h green on staging; no callsite change ⇒ zero blast radius; purely additive.

### PR-2: Parallel run — env + file + vault sources

- **Scope:** each of the 8 fleet-critical crates wires the `SecretSource` trait at its existing read site via a **3-way cascade**: `VaultSource.read(key) || FileSource.read(key) || EnvSource.read(key)`. Reads are logged via `pheno-otel` (counter `vault.read.{hit,miss,error}` per ADR-012 / ADR-036B).
- **Backwards compatible:** env + file sources remain authoritative; vault is **additive**. Any `VAULT_ADDR` unset ⇒ vault path silently skipped (no error, no regression).
- **ADR-022 substrate split:** Rust crates (`pheno-config`, `Configra`, `phenotype-bus`, `phenotype-hub`, `pheno-mcp-router`, `pheno-otel`) use the Rust `vault-rs` client. The TS edge crate (`Conft`) uses `node-vault` (TS counterpart) — **no Rust↔TS shared code**; ADR-022's split is preserved.
- **Files added per crate:** 1 `secret_source.rs` (~60 LoC) + 1 `secret_source_test.rs` (4 tests) — total ~480 LoC across 8 crates.
- **OTel counter added:** `vault_read_total{crate, source, result}` per crate — feeds the L57 observability pillar + ADR-077 § 6 audit log coverage.
- **CI gate:** all 8 crate test suites green; OTel counter visible in staging dashboard.
- **Merge criteria:** 48 h staging soak with **vault hit-rate ≥ 0** (proves wiring works) **AND** zero callsite regression; trufflehog clean.

### PR-3: Cutover — vault primary, env + file fallback only on miss

- **Scope:** flip the cascade: `VaultSource.read(key) || EnvSource.read(key) || FileSource.read(key)`. Vault becomes authoritative; env/file are read only when Vault returns 404. `.env` files renamed to `.env.vault.example` with `<PLACEHOLDER>` values per ADR-077 § 8 step 6.
- **Files removed/modified per crate:** delete 1 `dotenv` include, remove 2-3 `std::env::var` calls; total ~150 LoC removed across 8 crates.
- **CI gate:** `trufflehog` clean (zero plaintext secrets in repo); gitleaks clean; vault token rotation tested via `scripts/rotate-token.sh` (new, owned by this PR).
- **Vault policy templates:** per ADR-077 Appendix A — `policy/{role}.hcl` for each of the 8 crate roles; deployed via `vault policy write` in PR-3 CI step.
- **Merge criteria:** **48 h staging soak with zero vault misses** (the only acceptable miss count is 0); if any secret requires env/file fallback, that path is added to vault and soak restarts.

## 3. Risk Register

| # | Risk                                                  | Likelihood | Impact | Mitigation                                                                                       |
|---|-------------------------------------------------------|------------|--------|--------------------------------------------------------------------------------------------------|
| R1| Vault cluster HA standby fails to take over           | Medium     | High   | ADR-077 § 7 R1 — Raft 1 leader + 2 standby; chaos day in Phase 4 verifies < 60 s failover       |
| R2| Vault token replay across CI providers                | Medium     | High   | `bound_audiences` per ADR-077 Appendix B; per-crate `wrap_ttl = 300s`                            |
| R3| Per-crate cascade misses a secret, regression         | High       | Medium | Parallel-run soak (PR-2) + 48 h staging soak (PR-3); OTel counter alarms on miss-rate > 0 in PR-3 |
| R4| trufflehog CI gate produces false positives           | Low        | Medium | `.trufflehog.yml` allow-list for `scripts/vault_smoke.sh` fixtures; pre-PR-1 baseline calibration |
| R5| 48 h staging soak slips past cycle-14 closure (2026-06-22 → 2026-07-06) | Medium | Medium | PR-3 ships on Friday 14:00 PDT (per ADR-077 cutover window); W4 critical path absorbs 1 day slip |

## 4. Rollback Plan

Each PR is independently revertible via `git revert <sha>` per ADR-077 § 3 / Appendix C step 4.

- **PR-1 rollback:** `git revert <sha>` removes the trait + vault source. No callsite change ⇒ zero consumer impact.
- **PR-2 rollback:** `git revert <sha>` removes cascade wiring. Env/file reads remain authoritative; vault path becomes inert.
- **PR-3 rollback:** the highest-risk PR. Rollback sequence:
  1. `vault token revoke -self` (kills the rotated token; force expiry of stale tokens)
  2. `git revert <sha>` on all 8 crates (atomic fleet revert)
  3. `vault policy delete <role>` per crate
  4. Restore `.env.vault.example` → `.env` from the previous commit
  5. Page on-call (SEV-2 per ADR-077 Appendix D)
  6. Re-stabilize for 14 days before any re-attempt

**Vault-side rollback:** `vault operator raft snapshot restore` from the last pre-cutover snapshot (ADR-077 § 3 Phase 3 snapshot cadence: daily, 7-year S3 retention).

## 5. trufflehog CI Gate

- **Tool:** `trufflehog filesystem --directory . --fail` (already configured per `trufflehog.yml` at repo root).
- **Workflow:** `.github/workflows/l50-vault-gate.yml` runs on every PR; **blocks merge** on any verified plaintext secret.
- **Coverage:** all 8 fleet-critical crates + the 39 deferred crates (forward-looking; baseline scans run even on out-of-scope crates).
- **Allow-list:** `scripts/vault_smoke.sh` test fixtures (deterministic fake secrets) excluded via `.trufflehog.yml` `allowlist.regexes`.
- **Post-merge verification:** nightly cron (per ADR-042 cadence) scans `main` and alerts on drift.

## 6. Validation Criteria

L50 = 2/3 achieved when ALL of the following are green on `main`:

- [ ] **Zero plaintext secrets in repo** — `trufflehog filesystem . --fail` exits 0 on every PR; nightly cron exit 0 on `main`.
- [ ] **All green tests** — 8 fleet-critical crate test suites pass; OTel counter test (`vault_read_total` exists and increments) green in 6 crates (the 2 single-file crates `pheno-context`, `pheno-flags` deferred per ADR-040 § coverage exemption note).
- [ ] **OTel migration counter** — `vault_read_total{crate, source, result}` visible in staging Grafana dashboard for all 8 crates; alert wired on `vault_read_total{result="error"} > 0` for 5 min sustained.
- [ ] **Vault token rotation** — `scripts/rotate-token.sh` runs green in CI; the runbook (`findings/2026-06-22-v24-L50-rotate-runbook.md`) covers single-service and fleet blast-radius cases; emergency kill-switch tested.
- [ ] **ADR-083 / ADR-092 cross-references** — all 3 PRs link back to ADR-083 (v22 cycle-12) and ADR-092 (v24 cycle-14); cycle-14 probe (`findings/2026-06-22-v24-cycle-14-probe.md`) shows L50 = 2/3.
- [ ] **Worklog v2.1 schema** — PRs use `device: macbook` (planning/ADR) + `device: heavy-runner` (CI + 48 h soak) per ADR-015 v2.1 + ADR-023 device-fit gate.

## 7. References

- ADR-077 (`docs/adr/2026-06-21/ADR-077-vault-migration-roadmap.md`) — Vault roadmap, 4-phase 12-week plan
- ADR-083 (`docs/adr/2026-06-22/ADR-083-v22-cycle-12-p1-reduction.md`) — v22 cycle-12 P1 reduction (predecessor wave)
- ADR-092 (`docs/adr/2026-06-22/ADR-092-v24-cycle-14-p1-reduction.md`) — v24 cycle-14 P1 reduction (scope)
- ADR-046 (`docs/adr/2026-06-18/ADR-046-federation-mtls-oidc.md`) — federation mTLS + OIDC
- ADR-022 (`docs/adr/2026-06-15/ADR-022-config-consolidation-two-crate-split.md`) — Rust core / TS edge split
- ADR-031 — Configra absorb (ADR-022 split preserved)
- ADR-042 — Security audit cadence
- ADR-048 — Substrate graduation path (4-tier gate)
- ADR-049 — App-substrate drift detector (3-pass algorithm; regenerates C4)
- `findings/2026-06-22-v24-L50-rotate-runbook.md` — vault token rotation runbook
- `findings/2026-06-22-v24-L50-secret-inventory.md` — secret inventory (8 crates × secret types)
- `plans/2026-06-22-v24-71-pillar-cycle-14-p1.md` — v24 plan
