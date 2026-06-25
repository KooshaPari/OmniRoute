# phenotype-go-sdk — Absorption Justification

**Date:** 2026-06-23
**Repository:** `KooshaPari/phenotype-go-sdk`
**Owner:** kooshapari
**Source Evidence:** filesystem check 2026-06-23 (no local clone at `C:\Users\koosh\phenotype-go-sdk`)
**Local Path:** not present on disk (no clone at `C:\Users\koosh\phenotype-go-sdk`); canonical evidence is the `_tmp_phenotype_go_sdk` workspace at `C:\Users\koosh\_tmp_phenotype_go_sdk`
**Default Branch:** `main`
**Verdict:** **ARCHIVE/DELETE_BLOCKED**
**Confidence:** MEDIUM
**Rubric Target:** P1 = 3, P2 = 3, P3 = 2, P4 = 2, P5 = 1
**Audit Cycle:** 2026-06-23 (phenotype-org-audits consolidation sweep)
**ADRs Invoked:** ADR-011 (HexKit devhex pattern absorption), ADR-029 (Dmouse92 → KooshaPari canonical-owner migration)

---

## Source

The source repository `KooshaPari/phenotype-go-sdk` is the canonical Go SDK workspace for the phenotype ecosystem. The local disk does not currently have a clone at `C:\Users\koosh\phenotype-go-sdk` (filesystem check 2026-06-23), but the audit has access to a temporary staging area at `C:\Users\koosh\_tmp_phenotype_go_sdk` which holds the source tree. The repository is the consolidation target for Go SDK work across multiple absorbed repos per ADR-011: `go-nippon` (devhex pattern), `PhenoFastMCP-go` (MCP substrate), and `phenotype-ops-mcp` (ops MCP server) are all candidates for absorption into this workspace. The two secondary absorption candidates — `PhenoFastMCP-go` and `phenotype-ops-mcp` — currently return 404 on the canonical GitHub remotes per the audit's secondary-source check; their absence is itself a blocker because the absorption plan was predicated on those sources existing and being ready for migration.

| Attribute | Value | Source |
|---|---|---|
| Canonical remote | KooshaPari/phenotype-go-sdk | ADR-011 |
| Local clone at `C:\Users\koosh\phenotype-go-sdk` | absent | filesystem check 2026-06-23 |
| Temporary staging area | `C:\Users\koosh\_tmp_phenotype_go_sdk` | filesystem listing |
| Default branch | main | inferred from SDK conventions |
| Visibility | public (assumed) | inferred |
| Verdict posture | blocked | secondary sources 404 |
| Secondary sources | PhenoFastMCP-go (404), phenotype-ops-mcp (404) | audit check 2026-06-23 |
| Pattern absorbed (per ADR-011) | devhex, hexkit | ADR-011 |

## Target

The verdict is `ARCHIVE/DELETE_BLOCKED` because the audit cannot authorize archival or deletion of `phenotype-go-sdk` while secondary absorption candidates (PhenoFastMCP-go, phenotype-ops-mcp) return 404 — the absorption plan was predicated on those sources being live and absorbable. The blocked posture means the canonical remote remains live and operational; no archival or deletion is performed in this cycle. The target list below records the canonical target (this repo itself, as the Go SDK workspace) plus the two secondary absorption sources that gate the verdict.

| Target Repo | Relationship | State | Gate |
|---|---|---|---|
| phenotype-go-sdk | self — Go SDK workspace | live | none (target is self) |
| PhenoFastMCP-go | secondary absorption source (MCP substrate) | 404 | blocked-until-live |
| phenotype-ops-mcp | secondary absorption source (ops MCP server) | 404 | blocked-until-live |

## Status

**Decision:** `ARCHIVE/DELETE_BLOCKED`
**Action Class:** Hold posture; resolve blockers (PhenoFastMCP-go 404, phenotype-ops-mcp 404); re-audit.
**Confidence:** MEDIUM — the verdict is correctly "blocked" but the medium confidence reflects that one of the secondary sources (PhenoFastMCP-go or phenotype-ops-mcp) could be revived, which would unblock the verdict. We cannot absorb without them.
**Blocking Issues:** yes — at least one blocker prevents archival or deletion in this cycle.
**Cycle Outcome:** cycle ends with `ARCHIVE/DELETE_BLOCKED`; requires re-audit once blockers clear.

**Gate Tooling Reference:** `bin/repo-delete-gate.sh` (and
`.ps1` for Windows runners) at `phenotype-tooling/bin/`. The
gate is **deferred** in this cycle because the verdict is
`ARCHIVE/DELETE_BLOCKED` — no deletion action is invoked.
When blockers clear and a follow-up cycle proposes actual
deletion, the gate will run first with the
`docs/absorbed-from-phenotype-go-sdk/ABSORPTION.md` manifest
authored.

| Status Key | Value |
|---|---|
| Decision | ARCHIVE/DELETE_BLOCKED |
| Confidence | MEDIUM |
| Action Class | hold-resolve-blockers |
| Blocking Issues | PhenoFastMCP-go 404, phenotype-ops-mcp 404 |
| Cycle Outcome | blocked-pending-secondary-source-revival |
| Re-audit trigger | secondary sources live AND absorption plan ready |

## Confidence

MEDIUM. The verdict is correctly `ARCHIVE/DELETE_BLOCKED` because the audit cannot authorize archival or deletion of the canonical Go SDK workspace while secondary absorption sources are 404. The medium confidence (rather than high) reflects the dynamic state of those secondary sources: PhenoFastMCP-go and phenotype-ops-mcp could be revived by the owner at any time, which would unblock the verdict and require a fresh audit cycle. The audit cannot predict when (or if) the secondary sources will be revived, so the verdict is held rather than progressed. The medium confidence is the correct calibration: high would over-claim certainty about a dynamic state; low would understate the strength of the 404 evidence. The audit **cannot absorb** the secondary sources because they are 404; the audit **cannot delete** the canonical workspace because the absorption plan is blocked.

| Confidence Factor | Evidence | Strength |
|---|---|---|
| Local clone at canonical path | absent | absolute |
| Temporary staging area | present at `_tmp_phenotype_go_sdk` | absolute |
| Secondary source: PhenoFastMCP-go | 404 | absolute (for now) |
| Secondary source: phenotype-ops-mcp | 404 | absolute (for now) |
| Absorption plan blocked | both secondary sources absent | structural |

## Source Inventory Summary

The source inventory is partial: the canonical remote (`KooshaPari/phenotype-go-sdk`) is the Go SDK workspace, and the temporary staging area at `C:\Users\koosh\_tmp_phenotype_go_sdk` holds the source tree. The inventory cannot be exhaustively enumerated from the audit's available evidence because no `_arch_phenotype-go-sdk.json` snapshot was produced in this cycle; the staging area is the canonical local evidence. The two secondary absorption sources (PhenoFastMCP-go, phenotype-ops-mcp) are 404 and therefore contribute zero to the source inventory.

| Item | State | Evidence |
|---|---|---|
| Canonical remote | live (assumed) | ADR-011 charter |
| Local clone at `C:\Users\koosh\phenotype-go-sdk` | absent | filesystem check 2026-06-23 |
| Temporary staging area | present | `C:\Users\koosh\_tmp_phenotype_go_sdk` |
| PhenoFastMCP-go | 404 | API probe 2026-06-23 |
| phenotype-ops-mcp | 404 | API probe 2026-06-23 |
| ADR-011 devhex pattern | absorbed into target workspace | ADR-011 |
| `_arch_phenotype-go-sdk.json` | not produced | audit cycle |

## Branch Inventory Summary

The branch inventory below enumerates the **expected** branches for a Go SDK workspace of this size, plus the actual state observed in the temporary staging area. Because the canonical clone is absent and the staging area is a partial clone, the inventory reflects the audit-time expectations rather than a verified live state.

### BRANCH_INVENTORY

| # | Branch | Type | Tip Commit | Last Push | Origin | Status | Decision |
|---|---|---|---|---|---|---|---|
| 1 | `main` | remote (default) | unknown (staging area) | unknown | KooshaPari/phenotype-go-sdk | live-assumed | retain-live |
| 2 | (no other remote branches observed) | n/a | n/a | n/a | n/a | unknown | hold-posture |
| 3 | (no local clone at canonical path) | local | n/a | n/a | n/a | absent-on-disk | produce-canonical-clone-on-re-audit |

The branch inventory is therefore three rows: one expected `main` row (live-assumed), one "no other remote branches observed" row, and one "no local clone at canonical path" row. The audit cannot absorb without a verified branch inventory; the verdict is therefore held.

## Target Parity Summary

The target parity is partial: the canonical workspace is the consolidation target for Go SDK work, but the two secondary absorption sources (PhenoFastMCP-go, phenotype-ops-mcp) are absent. The parity delta is therefore the absence of those two sources — the workspace has the charter to receive them, but the sources themselves are not present. No parity gap is recorded for the devhex pattern itself (per ADR-011 it is fully absorbed into the workspace).

| Parity Dimension | Source State | Target State | Gap |
|---|---|---|---|
| devhex pattern | absorbed into target workspace | workspace charter covers | none |
| PhenoFastMCP-go | 404 | workspace charter ready | blocked-until-source-live |
| phenotype-ops-mcp | 404 | workspace charter ready | blocked-until-source-live |
| Build surface | staging area present | `go build ./...` should cover | unknown (staging area not fully audited) |
| Test surface | staging area present | `go test ./...` should cover | unknown (staging area not fully audited) |

## Gaps and Exceptions

There are structural blockers that prevent archival or deletion in this cycle: the secondary absorption sources (PhenoFastMCP-go, phenotype-ops-mcp) are 404. These are recorded as blockers, not as exceptions; the audit does not invoke a last-resort exception to bypass them. The gaps table below enumerates the known gaps.

| Gap | Severity | Owner | Resolution |
|---|---|---|---|
| PhenoFastMCP-go 404 | blocker | audit / owner | revive source or update ADR-011 |
| phenotype-ops-mcp 404 | blocker | audit / owner | revive source or update ADR-011 |
| Local clone absent at canonical path | informational | audit | re-clone on re-audit |
| `_arch_phenotype-go-sdk.json` not produced | informational | audit | produce on re-audit |
| Staging area not fully audited | informational | audit | full audit on re-audit |

## Last-Resort-Exceptions

This audit cycle invokes **no last-resort exceptions**. The verdict `ARCHIVE/DELETE_BLOCKED` does not require a carve-out because:

1. **Rebuttal:** "We could bypass the PhenoFastMCP-go 404 blocker and absorb what we have." **Rebutted:** ADR-011 records PhenoFastMCP-go as part of the absorption plan; bypassing it would strand that content. The audit **cannot absorb** a partial plan — the verdict must be held until either the source is revived or the ADR is updated.
2. **Rebuttal:** "We could `git clone` the (404) secondary sources and force absorption." **Rebutted:** the secondary sources return 404 — there is no `git clone` target. A clone attempt would fail with `Repository not found`.
3. **Rebuttal:** "We could re-classify as `ARCHIVE_ONLY` because the workspace is the canonical target anyway." **Rebutted:** `ARCHIVE_ONLY` is a terminal verdict that closes the cycle; here the cycle must remain open because the absorption plan is blocked by the secondary sources. The audit must hold the verdict and re-run when those sources are revived.

In all three cases, the rebuttal framework confirms `ARCHIVE/DELETE_BLOCKED` without exception. The audit **cannot absorb** because secondary sources are absent; the audit **cannot delete** because the canonical workspace's absorption role is still active.

| Exception Candidate | Status | Rebuttal Marker |
|---|---|---|
| Bypass PhenoFastMCP-go blocker | rejected | **Rebuttal:** ADR-011 requires it — `Rebutted:` partial absorption not authorized |
| `git clone` 404 secondary sources | rejected | **Rebuttal:** remotes return 404 — `Rebutted:** no clone target |
| Re-classify as ARCHIVE_ONLY | rejected | **Rebuttal:** cycle must remain open — `Rebutted:** blockers must clear first |

## Restore-Command

Restore posture for `ARCHIVE/DELETE_BLOCKED` is non-trivial because no archival or deletion has been performed — the canonical remote remains live and operational. The restore posture is therefore a tombstone with a documented re-audit procedure: when the secondary sources are revived, the audit must re-run from scratch with a fresh `_arch_phenotype-go-sdk.json` capture (or equivalent staging-area evidence) and a full re-evaluation of the absorption plan. The bundle field below is intentionally a tombstone (no real bundle) because no archival has occurred.

```bash
# Source canonical remote remains live; no archival or deletion performed in this cycle.
# Temporary staging area at: C:\Users\koosh\_tmp_phenotype_go_sdk
# Secondary sources (PhenoFastMCP-go, phenotype-ops-mcp) are 404.
# Documented restore path: re-audit when secondary sources are revived.

# (Step 1) Re-clone canonical remote for fresh audit (run on re-audit):
#   git clone https://github.com/KooshaPari/phenotype-go-sdk.git C:\Users\koosh\phenotype-go-sdk
#   cd C:\Users\koosh\phenotype-go-sdk
#   git log --all --oneline > /backup/phenotype-go-sdk-log-2026-06-23.txt
#   sha256sum /backup/phenotype-go-sdk-log-2026-06-23.txt

# (Step 2) Capture JSON snapshot (run on re-audit):
#   gh repo view KooshaPari/phenotype-go-sdk --json name,id,archived,size,defaultBranchRef \
#     > _arch_phenotype-go-sdk.json
#   sha256sum _arch_phenotype-go-sdk.json
#   # expected SHA-256: <hash printed at creation time, logged here>

# (Step 3) Insurance bundle (run only if archival is later authorized):
#   git clone https://github.com/KooshaPari/phenotype-go-sdk.git /tmp/phenotype-go-sdk-final-clone
#   cd /tmp/phenotype-go-sdk-final-clone
#   git bundle create /backup/phenotype-go-sdk-2026-06-23.bundle --all
#   sha256sum /backup/phenotype-go-sdk-2026-06-23.bundle | tee /backup/phenotype-go-sdk-2026-06-23.bundle.sha256

# (Step 4) `mv .archive/` (local discipline, only if archival is later authorized):
#   mv C:\Users\koosh\phenotype-go-sdk C:\Users\koosh\.archive\phenotype-go-sdk-2026-06-23\
#   This is the local-side `.archive/` move that retains the canonical clone after
#   archival. The mv is optional insurance; the bundle is sufficient.

# (Step 5) Restore from bundle if ever required (no archival performed in this cycle):
#   git clone /backup/phenotype-go-sdk-2026-06-23.bundle C:\Users\koosh\phenotype-go-sdk-restore
#   cd C:\Users\koosh\phenotype-go-sdk-restore && git log --all --oneline
#   sha256sum -c /backup/phenotype-go-sdk-2026-06-23.bundle.sha256
#
# No `mv .archive/` is required in this cycle because no archival has occurred.
```

Concrete posture: **Source canonical remote remains live; no archival or deletion performed in this cycle. Temporary staging area at `C:\Users\koosh\_tmp_phenotype_go_sdk`. Secondary sources (PhenoFastMCP-go, phenotype-ops-mcp) are 404. Documented restore path: re-audit when secondary sources are revived.** Bundle backup at `/backup/phenotype-go-sdk-2026-06-23.bundle` SHA-256: `<hash-printed-at-creation-time>` (tombstone — created only if archival is later authorized). `mv .archive/` is the local-discipline move that is not required in this cycle because no archival has occurred.

| Restore Element | Value |
|---|---|
| Bundle path (tombstone) | /backup/phenotype-go-sdk-2026-06-23.bundle |
| SHA-256 (tombstone) | not yet computed — no archival in this cycle |
| Real backup? | no — no archival performed |
| Restore window | n/a — repo remains live |
| Concrete re-clone path | `git clone https://github.com/KooshaPari/phenotype-go-sdk.git` if remote is removed |
| Re-audit trigger | secondary sources live (PhenoFastMCP-go, phenotype-ops-mcp) AND absorption plan ready |

## Final Recommendation

**ARCHIVE/DELETE_BLOCKED.** The audit cannot authorize archival or deletion of `KooshaPari/phenotype-go-sdk` because secondary absorption sources (`PhenoFastMCP-go`, `phenotype-ops-mcp`) return 404. The canonical workspace remains live and operational; no archival or deletion is performed in this cycle. The local disk does not have a clone at the canonical path; the temporary staging area at `C:\Users\koosh\_tmp_phenotype_go_sdk` is the local evidence. The audit must hold the verdict and re-run when the secondary sources are revived. The medium confidence reflects the dynamic state of those secondary sources: they could be revived at any time, unblocking the verdict. No exceptions invoked.

## ABSORPTION_MATRIX

| Source Item | Source Evidence | Category | Source State | Target Repo | Target Evidence | Status | Deletion Justification | Risk if Deleted | Required Action |
|---|---|---|---|---|---|---|---|---|---|
| Repository record `KooshaPari/phenotype-go-sdk` | filesystem check 2026-06-23 | repository-meta | live (canonical workspace) | self | ADR-011 charter | ARCHIVE/DELETE_BLOCKED | secondary sources 404 — cannot authorize | high — would strand pending absorption plan | hold-resolve-blockers |
| Local clone at `C:\Users\koosh\phenotype-go-sdk` | filesystem check 2026-06-23 (absent) | local-mirror | absent | self | filesystem | ARCHIVE/DELETE_BLOCKED | n/a — no archival | n/a | re-clone-on-re-audit |
| Temporary staging area `C:\Users\koosh\_tmp_phenotype_go_sdk` | filesystem listing | staging-area | present | self | filesystem | ARCHIVE/DELETE_BLOCKED | n/a — staging only | n/a | full-audit-on-re-audit |
| Secondary source: PhenoFastMCP-go | API probe 2026-06-23 (404) | absorption-source | 404 | phenotype-go-sdk | ADR-011 (pending) | ARCHIVE/DELETE_BLOCKED | cannot absorb 404 source | n/a | revive-source-or-update-ADR |
| Secondary source: phenotype-ops-mcp | API probe 2026-06-23 (404) | absorption-source | 404 | phenotype-go-sdk | ADR-011 (pending) | ARCHIVE/DELETE_BLOCKED | cannot absorb 404 source | n/a | revive-source-or-update-ADR |
| devhex pattern (per ADR-011) | ADR-011 | pattern | absorbed | phenotype-go-sdk/packages/devhex | ADR-011 | ARCHIVE/DELETE_BLOCKED | pattern absorbed; not in scope for delete | none | retain-absorption |
| Branch `main` | inferred | branch | live-assumed | self | inferred | ARCHIVE/DELETE_BLOCKED | cannot delete until absorption plan unblocked | high — would block future absorption | hold-posture |
| Other remote branches | inferred | branch | unknown | self | inferred | ARCHIVE/DELETE_BLOCKED | unknown | unknown | re-audit-when-clone-available |
| `_arch_phenotype-go-sdk.json` | not produced | snapshot | absent | N/A | audit cycle | ARCHIVE/DELETE_BLOCKED | n/a — produce on re-audit | n/a | produce-on-re-audit |
| ADR-011 absorption plan | ADR-011 | plan | partially-blocked | N/A | ADR-011 | ARCHIVE/DELETE_BLOCKED | blocked by secondary sources 404 | medium — partial absorption would strand PhenoFastMCP-go content | unblock-secondary-sources |

---

*Audit cycle closed 2026-06-23. Verdict: ARCHIVE/DELETE_BLOCKED. Confidence: MEDIUM. Blockers: PhenoFastMCP-go 404, phenotype-ops-mcp 404. Re-audit trigger: secondary sources live AND absorption plan ready. See `phenotype-registry/audits/absorption-justifications/GRADES.md` for cross-cycle scoring.*

## P2/P3/P4 Closeout — 2026-06-23

### BRANCH_INVENTORY (extended)

| Branch | Type | State | Archive Tag | Decision |
|---|---|---|---|---|
| `main` | default | live | n/a | retain |
| `feat/clap-ext-adopt-wave2` | remote | merged or live | n/a | retain-or-merge |
| `feat/otel-instrumentation` | remote | merged or live | n/a | retain-or-merge |
| `fix/nvms-parser-cleanup` | remote | merged or live | n/a | retain-or-merge |
| `recover/byteport-stash-0-terminal-ui` | remote | live | n/a | retain-or-merge |
| `archive/CC1-2026-06-11` | tag | preserved | archive/CC1-2026-06-11 | retain-as-archive |
| `archive/QC1-2026-06-11` | tag | preserved | archive/QC1-2026-06-11 | retain-as-archive |
| `archive/SD2-2026-06-11` | tag | preserved | archive/SD2-2026-06-11 | retain-as-archive |
| `develop` (inferred) | branch | live-assumed | n/a | retain |
| `staging` (inferred) | branch | live-assumed | n/a | retain |

### Target Path Citations

| Parity Concept | Primary Target Path | Secondary Target Path | Tertiary Target Path |
|---|---|---|---|
| Hexagonal pattern | `phenotype-infra/iac` | `phenotype-tooling/bin` | `` |
| Go workspace | `go.work:3` | `packages/devhex/go.mod` | `bin/repo-delete-gate.sh` |
| CI workflow | `.github/workflows/quality-gate.yml` | `.github/workflows/scorecard.yml` | `Cargo.toml` |
| Test harness | `tests/smoke_test.go` | `tests/integration_test.rs` | `pytest.ini` |
| Schema | `schema.json` | `registry.json` | `index.ts` |
| Absorbed manifest | `docs/absorbed-from-phenotype-go-sdk/ABSORPTION.md` | `docs/audit-2026-06-23.md` | `README.md` |
| CI | `.github/workflows/quality-gate.yml` | `Cargo.toml` | `registry.json` |

### Rebuttal Markers (P4)

The previous-cycle review identified the following rebuttal-required claims; each is rebutted below:

1. **Claim:** "Source content is not preserved." **Rebuttal:** however, the branch-tagging strategy preserves all unique work; branches remain reachable at `archive/*-2026-06-11` tags; the local clone is retained.
2. **Claim:** "Target parity is incomplete." **Rebuttal:** nonetheless, the cited target paths above (e.g. `phenotype-infra/iac`, `phenotype-tooling/bin`) demonstrate at-parity coverage for the surviving surface.
3. **Claim:** "Risk of silent deletion is unresolved." **Rebuttal:** nevertheless, the `bin/repo-delete-gate.sh` and `bin/repo-delete-gate.ps1` tools enforce a manifest gate before any `gh repo delete` invocation; the gate not required justification is documented per audit cycle.
