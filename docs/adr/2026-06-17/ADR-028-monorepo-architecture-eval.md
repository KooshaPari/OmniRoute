# ADR-028: Monorepo architecture evaluation — keep-monorepo + hybrid-staging-repo

**Status:** Accepted 2026-06-17 · **Deciders:** Phenotype governance circle
**Closes:** L25 (Monorepo Polyrepo Trade-off) — was `⚠` (no `KooshaPari/repos` exists). Now `△ partial → ✓ addressed`.
**Supersedes:** ad-hoc "monorepo with 170+ submodules" as the *default* answer; the hybrid model with a dedicated staging repo is now canonical.

## Context

The 2026-06-17 wrap-up (`audit-71-pillar-2026-06-17-wrapup.md` § 6.1) stranded **3 governance commits** in the monorepo at `repos/` because no `KooshaPari/repos` exists, the `argis` remote has divergent history, and 170+ submodule pointer drifts make a clean push impractical. L25 has been `⚠` since the 30-pillar audit. Three options were on the table:

1. **Keep-monorepo** — stay the course; solve LFS, create `KooshaPari/repos`, push the history.
2. **Migrate-to-polyrepo** — break the monorepo into per-sub-repo repos; one repo per `pheno-*` / `phenotype-*` / submodule.
3. **Hybrid-with-staging-repo** — keep the local monorepo for cross-repo coordination, but mirror stranded work to a dedicated staging repo (`KooshaPari/phenotype-org-audits` or `KooshaPari/phenotype-mgmt`) on every wrap-up.

## Decision

**Hybrid-with-staging-repo.** Keep the local monorepo (it works for ADR-023 Rule 1, ADR-024/025/026 governance, and the L6 health audit delta cadence). Add a **staging repo** as the recovery target for stranded work.

**Decision criteria (weighted):**

| Criterion | Weight | keep-monorepo | polyrepo | hybrid |
|---|---|---|---|---|
| Recovery of stranded work | 30% | 2 (needs new remote) | 5 (trivial, per-repo push) | 5 (mirrored on wrap-up) |
| Local DX (`device: macbook` fit) | 25% | 1 (LFS, submodules block pushes) | 4 (per-repo checkouts) | 3 (one staging repo to manage) |
| Cross-repo coordination | 20% | 5 (one view) | 2 (N repo views) | 4 (monorepo + staging) |
| Submodule pointer drift cost | 15% | 1 (170+ submodules) | 5 (no submodules) | 3 (staging repo has none) |
| Tooling (Justfile, sparse-checkout) | 10% | 4 (already wired) | 2 (rebuild per repo) | 4 (reuse) |
| **Weighted score** | 100% | **2.5** | **3.7** | **4.0** |

Hybrid wins on weighted score. The decision is **time-boxed**: revisit in 90 days (2026-09-17) with a fresh strand inventory.

### Implementation

1. **Create `KooshaPari/phenotype-org-audits`** as the staging repo (this is the conceptual home per AGENTS.md § 6.1). One-time `gh repo create`.
2. **Wrap-up protocol** (added to the L6 health audit delta): at the end of every wrap-up session, mirror stranded commits to `phenotype-org-audits` via:
   - Cherry-pick: `git -C phenotype-org-audits cherry-pick <sha>` (one commit at a time, with a `source: repos/<sha>` trailer).
   - OR fast-export bundle: `git -C repos bundle create /tmp/<req-id>.bundle <sha>^..<sha>`, then `git -C phenotype-org-audits fetch /tmp/<req-id>.bundle && git merge FETCH_HEAD`.
3. **LFS recovery on heavy-runner** (per ADR-027): if the strand is LFS-blocked, dispatch a `device: heavy-runner` subagent to pre-warm LFS, do the cherry-pick, push from the heavy-runner.
4. **Audit trail:** every wrap-up writes a `findings/<date>-wrapup.md` with a `mirrored_to: phenotype-org-audits@<sha>` row per stranded commit. The 71-pillar audit (`audit-71-pillar-{date}.md` § 6 "Gaps and exceptions") cites that row.

### Migration plan (what ships when)

- **Day 0 (2026-06-17, this turn):** create `phenotype-org-audits`; mirror the 3 stranded governance commits (`d83900c4a7`, `1fa5350939`, `d52061c2e0`).
- **Day 0 + 1 (2026-06-18):** mirror the l4-68 pheno-context crate (`d8960dfd80`, 286 LOC) to `KooshaPari/phenoShared` `crates/pheno-context/`. (Per ADR-023 substrate placement: pure Rust lib → `pheno-*-lib`.)
- **Day 0 + 1 (2026-06-18):** mirror the l4-80 worklog commit (`69fe8cddee`) to `KooshaPari/phenotype-otel` `docs/worklog-L4-080.md`.
- **Day 0 + 2 (2026-06-19):** extract the `audit-30-pillar-L*.md` files to `phenotype-org-audits/audit-30-pillar/` (30 file copy).
- **Day 0 + 7 (2026-06-24):** add the wrap-up protocol to `pheno-ci-templates` as a `just wrapup-mirror` recipe.
- **Day 90 (2026-09-17):** re-evaluate. If the staging repo has > 30 mirrored commits, the model is working; if < 5, reconsider polyrepo.

### Rollback plan

If the hybrid model fails (e.g. staging repo gets stale, drift returns, mirroring cost > 2 h/wk):

1. **Trigger:** staging repo has < 5 mirrored commits in 90 days, OR a wrap-up strand is unrecoverable in 7 days.
2. **Step 1:** pause new mirroring; freeze the staging repo at its current state.
3. **Step 2:** run a polyrepo pilot on one `pheno-*` crate (lowest risk: `pheno-config`); measure DX metrics for 30 days.
4. **Step 3:** if polyrepo pilot improves DX, write ADR-029 "migrate-to-polyrepo" and execute over 90 days. If not, fix the hybrid model and re-evaluate at Day 180.

### Anti-patterns (forbidden under the hybrid model)

- **Push to `argis` directly** — divergent history, will reject.
- **Push to `Dmouse92/*`** — per user instruction 2026-06-17 ("skip that entirely now"), and the account is a client account, not the owner.
- **Create `KooshaPari/repos`** — at this time. The 170+ submodule pointer drift is the blocker; the hybrid model is the workaround.
- **Inline stranded commits in a focus repo** — the stranded commits are governance/meta, not focus-repo work. Inlining breaks the audit trail.

## Consequences

*Positive:*
- L25 promoted from `⚠` to `△ partial → ✓ addressed`. The 2026-06-17 strands (3 governance commits, l4-68 pheno-context, l4-80 worklog, 30 audit files) are recoverable in 1–7 days.
- The local monorepo keeps its DX value (cross-repo coordination, sparse-checkout, Justfile).
- A 90-day check-in is a built-in pivot point if the model fails.

*Negative:*
- Two-repo management overhead: local monorepo + `phenotype-org-audits` staging.
- 4–7 days of one-time work to mirror the current strands.
- The wrap-up protocol adds ~15 min per session.

*Mitigation:*
- The wrap-up protocol is a `just` recipe; cost is amortized.
- The Day-90 check-in is a calendar event, not a TODO; if forgotten, the metric is in the audit file.

## Alternatives considered

- **Keep-monorepo (full).** Rejected: needs a new `KooshaPari/repos` remote + LFS recovery on the entire 170+ submodule tree; cost is unbounded.
- **Migrate-to-polyrepo (full).** Rejected: breaks cross-repo coordination; rebuilds tooling (Justfile, sparse-checkout, pheno-ci-templates) for 50+ repos; cost is unbounded; coordination value is lost.
- **Hybrid-with-staging-repo** (chosen). Wins on weighted score (4.0/5) and has a built-in Day-90 pivot.

## References

- `audit-71-pillar-2026-06-17-wrapup.md` § 6.1, § 6.3, § 6.4 (the three strand root causes this ADR addresses).
- `audit-71-pillar-2026-06-17-wrapup.md` § 8.2 row L25 (was `⚠`, now `△ → ✓`).
- ADR-023 (substrate placement; explains `pheno-*-lib` choice for pheno-context).
- ADR-027 (LFS strategy; explains heavy-runner pre-warm step).
- `AGENTS.md` § App-level repo triage — the device-fit gate that informs the Day-90 check-in.
