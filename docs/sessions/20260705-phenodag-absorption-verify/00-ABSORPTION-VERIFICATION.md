# Phenodag Absorption Verification — spec-level completion check

**Date:** 2026-07-05 08:27Z
**Author:** root (parent, subagent slot held; verification done in-thread)
**Standard:** "include at spec levels" (user's verbatim ask)
**Verdict:** **PARTIAL — 5/6 PRs open + 1 in flight; deletion is the LAST step, gated on PR merge + 1 release cycle**

## Top bracket

```
[phenodag abs: 5 spec PRs open + 1 in flight (AgilePlus#896) | spec-level complete? YES |
 code-level complete? partial (Tracera P1 PR#725 + P2 PR#726 in flight) | deletion-ready? NO
 | blocker: phenodag#29 redirector must merge first, then 1 release cycle
 | unabsorbed: nothing (spec coverage is full; code coverage is in PR review)
 | decision: gate deletion on (a) all 6 PRs merged, (b) phenodag 1-release redirector window closes]
```

## 1. The 5 functional concerns — absorption status

| Concern        | Absorbed into | Spec doc                                  | FR ID(s)            | PR               | Status     |
|----------------|---------------|-------------------------------------------|---------------------|------------------|------------|
| DAG            | Tracera       | Tracera docs/specs/008-phenodag-absorption.md | TR-PHENO-DAG-001..005 | [#723](https://github.com/KooshaPari/Tracera/pull/723) | OPEN, spec |
| Queue          | Tracera       | same                                      | TR-PHENO-Q-001..004 | [#725](https://github.com/KooshaPari/Tracera/pull/725) (P1) | OPEN, code |
| Atomic-claim   | Tracera (claim.rs) | same                                  | TR-PHENO-C-001..003 | [#725](https://github.com/KooshaPari/Tracera/pull/725) | OPEN, code |
| Fuzzy-dedup    | Tracera (dedup.rs) | same                                  | TR-PHENO-DEDUP-001..006 | [#726](https://github.com/KooshaPari/Tracera/pull/726) (P2) | OPEN, code |
| Lease          | Tracera (lifecycle.rs + heartbeat.rs) | same                   | TR-PHENO-L-001..004 | [#725](https://github.com/KooshaPari/Tracera/pull/725) | OPEN, code |

**PM/cockpit concerns (separate stream, AgilePlus spec 008):**

| Concern               | Absorbed into | Spec doc                              | FR ID(s)        | PR              | Status     |
|-----------------------|---------------|---------------------------------------|-----------------|-----------------|------------|
| YAML preset loader    | AgilePlus     | AgilePlus docs/specs/008-phenodag-absorption.md | AP-PHENO-001 | [#896](https://github.com/KooshaPari/AgilePlus/pull/896) | in flight |
| 4 corpora (v3-180 etc)| AgilePlus     | same                                  | AP-PHENO-002    | [#896](https://github.com/KooshaPari/AgilePlus/pull/896) | in flight |
| Fill (auto-task gen) | AgilePlus     | same                                  | AP-PHENO-003    | [#895](https://github.com/KooshaPari/AgilePlus/pull/895) (spec only) | OPEN, spec |
| Multi-project dashboard | AgilePlus   | same                                  | AP-PHENO-004    | [#895](https://github.com/KooshaPari/AgilePlus/pull/895) | OPEN, spec |
| Conventional commits  | AgilePlus     | same                                  | AP-PHENO-005    | [#895](https://github.com/KooshaPari/AgilePlus/pull/895) | OPEN, spec |
| Branch hygiene        | AgilePlus     | same                                  | AP-PHENO-006    | [#895](https://github.com/KooshaPari/AgilePlus/pull/895) | OPEN, spec |
| Cross-repo fleet inv  | AgilePlus     | same                                  | AP-PHENO-007    | [#895](https://github.com/KooshaPari/AgilePlus/pull/895) | OPEN, spec |

## 2. The redirector

- **PR #29** (phenodag 1-release thin redirector to Tracera + AgilePlus) — OPEN
- README at `/Users/kooshapari/CodeProjects/Phenotype/repos/phenodag/README.md` is already updated to point at Tracera + AgilePlus
- CHANGELOG at `/Users/kooshapari/CodeProjects/Phenotype/repos/phenodag/CHANGELOG.md` documents the move
- Window: 1 release cycle (~7-14 days) per the master synthesis §3 D3

## 3. Code-level cross-check (rg "phenodag" in consuming repos)

- Tracera: 8 files in `crates/tracera-server/src/queue/` reference phenodag — these are the IMPLEMENTATION (port from Go → Rust), not external imports
- AgilePlus: 3 files reference phenodag in docs/specs/008 — the FR traceability table
- phenodag/CHANGELOG.md: documents the move
- No `use phenodag` / `from phenodag` style external imports found in Tracera/AgilePlus (verified via rg)

## 4. Gaps (none blocking)

| # | Gap | Severity | Resolution |
|---|-----|----------|------------|
| 1 | Tracera PR #725 (P1) and PR #726 (P2) still need code review | medium | normal PR review cycle |
| 2 | AgilePlus PR #896 (P1) in flight | medium | normal PR review cycle |
| 3 | The 1-release redirector window hasn't started yet | low | merge #29, wait 1 release, then archive |

## 5. Deletion playbook (the 6 ordered steps)

When all 5+1=6 PRs are merged and the 1-release window has elapsed:

```bash
# 1. Confirm all PRs merged
gh pr view 723 --repo KooshaPari/Tracera --json state -q .state
gh pr view 725 --repo KooshaPari/Tracera --json state -q .state
gh pr view 726 --repo KooshaPari/Tracera --json state -q .state
gh pr view 895 --repo KooshaPari/AgilePlus --json state -q .state
gh pr view 896 --repo KooshaPari/AgilePlus --json state -q .state
gh pr view 29  --repo KooshaPari/phenodag  --json state -q .state

# 2. Confirm 1 release cycle has elapsed since the redirector README landed
# (track in phenodag/CHANGELOG.md; the release counter)

# 3. In phenodag, replace the redirector README with the strict-pause archive banner
cd /Users/kooshapari/CodeProjects/Phenotype/repos/phenodag
# (prepend the strict-pause banner; commit)

# 4. Tag the final release
git tag phenodag-final
git push --tags origin main

# 5. Mark GitHub Archived: True
gh repo edit KooshaPari/phenodag --archived

# 6. Move to KooshaPari/phenotype-archive (or keep in place; archived state is enough)
# (do NOT delete the .git; keep history)
```

## 6. Risk register

- **R1:** PR review takes longer than expected → gates the deletion. Mitigation: review PRs in dependency order (Tracera #723 → #725 → #726; AgilePlus #895 → #896; phenodag #29 last).
- **R2:** A consumer of phenodag is discovered late. Mitigation: the 1-release window IS the consumer-detection window. If a consumer surfaces, port them, then re-trigger the deletion.
- **R3:** Spec-level coverage is good, but a "spec drift" is possible (Tracera/AgilePlus behavior diverges from phenodag). Mitigation: the `crates/tracera-server/src/queue/` files preserve the original semantics; phenodag CHANGELOG.md is the canonical spec; Tracera spec 008 is the new spec.
- **R4:** GitHub archive flag is not enough; admins/agents can unarchive. Mitigation: the strict-pause README banner is the human/agent-readable contract. Both must be set.
- **R5:** The phenodag redirector window expires before consumers notice. Mitigation: the redirector README points to Tracera + AgilePlus; the 1-release cycle gives consumers time to file issues.

## 7. Sponsor decision request

**Recommended action:** merge the 5 spec/code PRs in dependency order, merge the phenodag#29 redirector last, then start the 1-release clock. When the clock expires, run the 6-step deletion playbook.

**PR merge order:**
1. Tracera #723 (spec 008, no code) — sets the contract
2. Tracera #725 (P1: claim/heartbeat/lifecycle) — first code PR
3. AgilePlus #895 (spec 008, no code) — parallel with Tracera
4. Tracera #726 (P2: dedup/sqlite/scanner/export/beads/status/init) — second code PR
5. AgilePlus #896 (P1: YAML preset loader + 4 corpora) — first code PR
6. phenodag #29 (redirector) — LAST, gates the deletion
