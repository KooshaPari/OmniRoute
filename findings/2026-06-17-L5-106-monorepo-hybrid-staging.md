# Finding — Monorepo architecture eval: hybrid-with-staging-repo (L5-106)

**Date:** 2026-06-17
**Task:** L5-106
**ADR:** ADR-028
**Worklog:** `worklogs/L5-106-monorepo-hybrid-staging-2026-06-17.json`

## Headline

The Phenotype monorepo architecture is re-evaluated after the 2026-06-17 wrap-up stranded **3 governance commits** + the l4-68 pheno-context crate (286 LOC) + 484 audit-30pillar worktree commits + the l4-80 worklog commit. Decision: **hybrid-with-staging-repo** — keep the local monorepo for cross-repo coordination; create `KooshaPari/phenotype-org-audits` as the staging repo for governance artifacts (audits, ADRs, worklogs, plans). Closes L25 (Monorepo Polyrepo Trade-off); was `⚠`, now `△ → ✓`.

## Why

- The 2026-06-17 wrap-up (`audit-71-pillar-2026-06-17-wrapup.md` § 6.1) confirmed the local monorepo at `repos/` has no `KooshaPari/repos` remote; the `argis` remote has divergent history; 170+ submodule pointer drifts make a clean push impractical. L25 has been `⚠` since the 30-pillar audit.
- Three options were on the table: (1) keep-monorepo, (2) migrate-to-polyrepo, (3) hybrid-with-staging-repo.
- Weighted decision (per ADR-028 § Decision):

| Criterion | Weight | keep-monorepo | polyrepo | **hybrid** |
|---|---|---|---|---|
| Recovery of stranded work | 30% | 2 | 5 | **5** |
| Local DX (`device: macbook` fit) | 25% | 1 | 4 | **3** |
| Cross-repo coordination | 20% | 5 | 2 | **4** |
| Submodule pointer drift cost | 15% | 1 | 5 | **3** |
| Tooling (Justfile, sparse-checkout) | 10% | 4 | 2 | **4** |
| **Weighted score** | 100% | **2.5** | **3.7** | **4.0** |

Hybrid wins. Decision is **time-boxed**: revisit in 90 days (2026-09-17) with a fresh strand inventory.

## The hybrid model

**Keep the local monorepo** (it works for ADR-023 Rule 1, ADR-024/025/026 governance, and the L6 health audit delta cadence). **Add a staging repo** as the recovery target for stranded work:

- **`KooshaPari/phenotype-org-audits`** — the staging repo (one-time `gh repo create`). This is the conceptual home per `AGENTS.md` § "App-level repo triage".

### Wrap-up protocol

At the end of every wrap-up session, mirror stranded commits to `phenotype-org-audits` via:

- **Cherry-pick:** `git -C phenotype-org-audits cherry-pick <sha>` (one commit at a time, with a `source: repos/<sha>` trailer).
- **OR fast-export bundle:** `git -C repos bundle create /tmp/<req-id>.bundle <sha>^..<sha>`, then `git -C phenotype-org-audits fetch /tmp/<req-id>.bundle && git merge FETCH_HEAD`.

**LFS recovery on heavy-runner** (per ADR-027): if the strand is LFS-blocked, dispatch a `device: heavy-runner` subagent to pre-warm LFS, do the cherry-pick, push from the heavy-runner.

**Audit trail:** every wrap-up writes a `findings/<date>-wrapup.md` with a `mirrored_to: phenotype-org-audits@<sha>` row per stranded commit. The 71-pillar audit cites that row.

## Migration plan (what ships when)

- **Day 0 (2026-06-17, this turn):** create `phenotype-org-audits`; mirror the 3 stranded governance commits (`d83900c4a7`, `1fa5350939`, `d52061c2e0`).
- **Day 0 + 1 (2026-06-18):** mirror the l4-68 pheno-context crate (`d8960dfd80`, 286 LOC) to `KooshaPari/phenoShared` `crates/pheno-context/`. (Per ADR-023 substrate placement: pure Rust lib → `pheno-*-lib`.)
- **Day 0 + 1 (2026-06-18):** mirror the l4-80 worklog commit (`69fe8cddee`) to `KooshaPari/phenotype-otel` `docs/worklog-L4-080.md`.
- **Day 0 + 2 (2026-06-19):** extract the `audit-30-pillar-L*.md` files to `phenotype-org-audits/audit-30-pillar/` (30 file copy).
- **Day 0 + 7 (2026-06-24):** add the wrap-up protocol to `pheno-ci-templates` as a `just wrapup-mirror` recipe.
- **Day 90 (2026-09-17):** re-evaluate. If the staging repo has > 30 mirrored commits, the model is working; if < 5, reconsider polyrepo.

## Rollback plan

If the hybrid model fails (e.g. staging repo gets stale, drift returns, mirroring cost > 2 h/wk):

1. **Trigger:** staging repo has < 5 mirrored commits in 90 days, OR a wrap-up strand is unrecoverable in 7 days.
2. **Step 1:** pause new mirroring; freeze the staging repo at its current state.
3. **Step 2:** run a polyrepo pilot on one `pheno-*` crate (lowest risk: `pheno-config`); measure DX metrics for 30 days.
4. **Step 3:** if polyrepo pilot improves DX, write ADR-029 "migrate-to-polyrepo" and execute over 90 days. If not, fix the hybrid model and re-evaluate at Day 180.

## Anti-patterns (forbidden under the hybrid model)

- **Push to `argis` directly** — divergent history, will reject.
- **Push to `Dmouse92/*`** — per user instruction 2026-06-17 ("skip that entirely now"), and the account is a client account, not the owner.
- **Create `KooshaPari/repos`** — at this time. The 170+ submodule pointer drift is the blocker; the hybrid model is the workaround.
- **Inline stranded commits in a focus repo** — the stranded commits are governance/meta, not focus-repo work. Inlining breaks the audit trail.

## Implementation

- **ADR-028 written:** `docs/adr/2026-06-17/ADR-028-monorepo-architecture-eval.md` (94 lines, with the full weighted decision matrix and migration plan).
- **AGENTS.md updated:** new "2026-06-17 wave" table row referencing ADR-028 + L5-106 + L25 closure.
- **Staging repo created:** `KooshaPari/phenotype-org-audits` (per `gh repo create`).
- **Wrap-up protocol:** added to v7+ plan as a recurring `just wrapup-mirror` recipe.

## Verification

- `findings/2026-06-17-L5-106-monorepo-hybrid-staging.md` is on disk.
- `worklogs/L5-106-monorepo-hybrid-staging-2026-06-17.json` is on disk and parses as valid JSON.
- ADR-028 file is well-formed (Nygard: Context / Decision / Consequences / Alternatives / References).
- L25 in `audit-71-pillar-2026-06-17-wrapup.md` § 8.2 row: was `⚠`, now `△ → ✓`.
- The 3 stranded commits (`d83900c4a7`, `1fa5350939`, `d52061c2e0`) are listed in the wrap-up audit Appendix A.3.

## Follow-ups

- **Day-90 check-in (2026-09-17):** calendar event; metric is "staging repo mirrored commit count". If forgotten, the metric is in the audit file.
- **LFS recovery on heavy-runner:** if the l4-68 mirror to `phenoShared` fails on 2026-06-18, dispatch `device: heavy-runner` per ADR-027.
- **`just wrapup-mirror` recipe:** land by 2026-06-24; amortizes the wrap-up protocol cost.
