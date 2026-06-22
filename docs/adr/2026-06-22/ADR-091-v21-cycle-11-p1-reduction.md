# ADR-091: v21 Cycle 11 P1 Reduction (Scope)

- **Status**: ACCEPTED
- **Date**: 2026-06-22
- **Deciders**: orchestrator (KooshaPari)
- **Cycle**: 11 (71-pillar cycle 11, P1 reduction round 2)
- **Wave**: v21
- **Branch**: `chore/v21-cycle-11-governance-2026-06-22`
- **Refs**: `docs/adr/2026-06-22/ADR-081-v21-cycle-11-p1-reduction.md` (planning), `plans/2026-06-22-v21-71-pillar-cycle-11-p1.md` (plan)

## Context

v9 (2026-06-18) → v20 (2026-06-22) closed **47/47 P0 pillars** (100% saturated, terminal) and
deepened the P1 pillar pool. The fleet sits at **2.94/3.00 mean** with two domains below
3.00:

- **Security (SEC, L46-L55)**: 2.70 — 5 P1 gaps
- **Performance (PERF, L13-L19)**: 2.85 — 3 P1 gaps

Per **ADR-081 ranking**, cycle 11 (v21) closes the next 5 P1 pillars (L48 / L51 / L33 / L37
/ L34) with concrete implementation, not just plans. P0 is terminal; remaining leverage is
P1 reduction toward 3/3.

## Decision

Dispatch 5 parallel subagents in `orch-v21-T{1..5}-L{nn}-{slug}` mode. Each agent:

1. Reads the corresponding v15/v17/v19 finding for context
2. Implements the gate / automation in a target crate
3. Adds 1 proptest or 1 criterion bench or 1 doc-test for coverage
4. Commits + pushes + opens PR to `argis`
5. Updates the corresponding finding with closure status

| Track | Pillar | Target | Subagent | Score Δ |
|-------|--------|--------|----------|--------:|
| **T1** | L48 SBOM diff gate | pheno-port-adapter (+ 3) | orch-v21-T1-L48-sbom-diff | 2 → 3 |
| **T2** | L51 SOC2 evidence | pheno-evidence-collector (new) | orch-v21-T2-L51-soc2-evidence | 2 → 3 |
| **T3** | L33 SIGHUP hot-reload | pheno-config | orch-v21-T3-L33-sighup-reload | 2 → 3 |
| **T4** | L37 devcontainer × 3 | pheno-events / pheno-predict / pheno-secret-scan | orch-v21-T4-L37-devcontainer | 2 → 3 |
| **T5** | L34 release.yml × 5 | 5 fleet-critical crates | orch-v21-T5-L34-release-yml | 2 → 3 |

After v21: **52 of 71 pillars at 3/3** (47 P0 + 5 P1 from cycle 10 + 5 P1 from cycle 11).

## Consequences

**Positive:**
- SEC domain: 2.70 → 3.00 (L48, L51 closed)
- DX domain: 2.85 → 3.00 (L33, L37 closed)
- Release domain: 2.80 → 3.00 (L34 closed)
- Fleet mean: **2.94 → ~3.00**
- 5 subagents in parallel — load width = 5, max load 200+

**Negative:**
- Subagents may collide on shared resources (cargo lock, network)
- 5 parallel agents push load to 300+ temporarily
- New crate `pheno-evidence-collector` requires GitHub repo creation first

## Compliance

- **Device**: `device: heavy-runner` for subagent execution; orchestrator on `device: macbook` (governance slice only — no cargo)
- **Fork-guardian**: **MUST stay UP** for entire wave (currently 2h48m uptime)
- **Protected processes**: forge, ghostty, claude, zsh, login, nvim, cargo — fork-guardian whitelist
- **Worklog v2.1 schema** with `device:` field (ADR-025, ADR-030) — `worklogs/2026-06-22-v21-cycle-11-71-pillar-p1-orchestrator.json`

## Acceptance criteria

- [x] 5 P1 tracks scoped with target repos + agents
- [x] P1 ranking from ADR-081 honored
- [x] Device fit policy honored (heavy-runner for cargo)
- [x] Fork-guardian compliance noted
- [x] Cycle 11 closure probe in scope (`findings/2026-06-22-v21-cycle-11-probe.md`)
- [x] v22 plan stub referenced (`plans/2026-06-22-v22-71-pillar-cycle-12-p1.md`)

## Cross-references

- ADR-081 (v21 cycle-11 P1 reduction plan (companion — sets the ranking))
- ADR-082 (v21 cycle-11 P1 reduction (sibling cycle-11 plan))
- ADR-041 (71-pillar refresh cadence (weekly closure-probe cadence))
- ADR-024 (71-pillar audit framework (P1 pillar ranking source))
- ADR-025 (worklog schema v2.1 (worklog device: field for this wave))

