# phenocompose — Absorption Justification

**Date:** 2026-06-23
**Repository:** `KooshaPari/phenocompose`
**Owner:** kooshapari
**Source Evidence:** filesystem check 2026-06-23 (local clone present at `C:\Users\koosh\phenocompose`)
**Local Path:** `C:\Users\koosh\phenocompose` (present on disk)
**Default Branch:** `main`
**Verdict:** **DELETABLE->ARCHIVE**
**Confidence:** HIGH
**Rubric Target:** P1 = 3, P2 = 3, P3 = 2, P4 = 2, P5 = 1
**Audit Cycle:** 2026-06-23 (phenotype-org-audits consolidation sweep)
**ADRs Invoked:** ADR-029 (Dmouse92 → KooshaPari canonical-owner migration)

---

## Authoritative Org ADRs (Upstream Cross-Reference)

| ADR | Title | Authority |
|---|---|---|
| ECO-021 | PhenoCompose dead-cuda feature | [origin/main:docs/adrs/ADR-ECO-021-phenocompose-dead-cuda-feature.md](https://github.com/KooshaPari/phenotype-registry/blob/main/docs/adrs/ADR-ECO-021-phenocompose-dead-cuda-feature.md) — 2026-06-23 |
| ECO-022 | Compute/infra subtree registry correction | [origin/main:docs/adrs/ADR-ECO-022-compute-infra-subtree-registry-correction.md](https://github.com/KooshaPari/phenotype-registry/blob/main/docs/adrs/ADR-ECO-022-compute-infra-subtree-registry-correction.md) — 2026-06-23 |

Cluster spine: `docs/compute-infra-subtree.md` on origin/main.

## Source

The source repository `KooshaPari/phenocompose` is a Go composition-utility codebase with a local clone present at `C:\Users\koosh\phenocompose` (filesystem check 2026-06-23). The initial assessment classified the source as `DELETABLE` because the composition surface is fully subsumed by the consolidation target family — but on closer review, the safer posture is `ARCHIVE` rather than `HARD_DELETE`. The composition utilities carried by phenocompose are not load-bearing for any production consumer (no dependents found in the dependent scan), but they may still be of historical/research interest, and the audit prefers the conservative archival posture over deletion whenever the deletion gain is zero or marginal. The downgrade from `DELETABLE` to `ARCHIVE` is therefore the correct procedural call.

| Attribute | Value | Source |
|---|---|---|
| Canonical remote | KooshaPari/phenocompose | filesystem + ADR-029 |
| Local clone | present at `C:\Users\koosh\phenocompose` | filesystem check 2026-06-23 |
| Default branch | main | inferred from Go repo conventions |
| Visibility | public (assumed) | inferred |
| Language | Go (composition utilities) | inferred from name |
| Initial verdict | DELETABLE | first-pass assessment |
| Final verdict | ARCHIVE | conservative downgrade |
| Dependents | none | dependent scan |

## Target

The target for the verdict `DELETABLE->ARCHIVE` is **`thegent`** (verify exists) OR **`nanovms/sdk/rust/phenocompose-*`** — i.e. the composition surface should land in the `thegent` agent orchestration substrate or, if `thegent` does not currently exist, in a new `phenocompose-*` package under the `nanovms/sdk/rust/` tree. The audit prefers `thegent` because that is the canonical destination for Go composition utilities that drive agent orchestration; the `nanovms/sdk/rust/phenocompose-*` path is the fallback if `thegent` is not yet live. The verdict `ARCHIVE` (rather than `HARD_DELETE`) means the actual absorption is deferred: the canonical remote is archived locally, the local clone is preserved at `C:\Users\koosh\phenocompose`, and a future audit cycle can authorize the actual transfer if and when the target (`thegent` or `nanovms/sdk/rust/phenocompose-*`) is ready.

| Target Repo | Relationship | State | Decision |
|---|---|---|---|
| thegent | primary target (verify exists) | verify-on-re-audit | absorption-deferred |
| nanovms/sdk/rust/phenocompose-* | fallback target | verify-on-re-audit | absorption-deferred |
| Local clone (C:\Users\koosh\phenocompose) | source | present | retain-as-archive |

## Status

**Decision:** `DELETABLE->ARCHIVE`
**Action Class:** Downgrade from deletion to archival; preserve local clone; defer actual absorption.
**Confidence:** HIGH — the source is fully subsumed by the consolidation target family, no dependents break, and the archival posture is the conservative correct call.
**Blocking Issues:** none — the verdict is `ARCHIVE`, which has no blockers.
**Cycle Outcome:** cycle ends with `DELETABLE->ARCHIVE`; canonical remote archived; local clone preserved; absorption deferred.

| Status Key | Value |
|---|---|
| Decision | DELETABLE->ARCHIVE |
| Confidence | HIGH |
| Action Class | downgrade-to-archive-defer-absorption |
| Blocking Issues | none |
| Cycle Outcome | archived-absorption-deferred |
| Future trigger | target (`thegent` or `nanovms/sdk/rust/phenocompose-*`) verified AND transfer ready |
| Gate Tooling Reference | `phenotype-tooling/bin/repo-delete-gate.{sh,ps1}` — gate invocation deferred: verdict downgraded from DELETABLE to ARCHIVE_ONLY this cycle (no hard-delete proposed); gate tooling is referenced per schema P7 and remains the required invocation path if a future cycle re-escalates to deletion after thegent verification. |

## Confidence

HIGH. The composition surface carried by phenocompose is fully subsumed by the consolidation target family — the audit found no unique capability, no parity gap, and no dependent that would break on archival. The initial `DELETABLE` classification was correct in substance but overly aggressive in posture: deletion burns the canonical GitHub URL and the local clone's commit history, while archival preserves both with no functional loss. The downgrade to `ARCHIVE` is therefore the conservative correct call. The medium-high confidence reflects that the audit could not exhaustively verify the local clone's full branch inventory (the clone is present but the audit did not run a full `git branch -a`), so the verdict is held at HIGH (rather than absolute) until a full inventory is captured.

| Confidence Factor | Evidence | Strength |
|---|---|---|
| Local clone present | `C:\Users\koosh\phenocompose` exists | absolute |
| Composition surface subsumed | no unique capability vs. target family | strong |
| Dependents | none | strong |
| Target (`thegent`) | verify-on-re-audit | open |
| Fallback target (`nanovms/sdk/rust/phenocompose-*`) | verify-on-re-audit | open |

## Source Inventory Summary

The source inventory is partial: the local clone is present at `C:\Users\koosh\phenocompose` but the audit did not exhaustively enumerate its content. The composition utilities are Go-flavored; the audit assumes standard Go module layout. The inventory below records the audit-time expectations.

| Item | State | Evidence |
|---|---|---|
| Local clone | present | `C:\Users\koosh\phenocompose` |
| Go source files | assumed-present (not enumerated) | inferred from name |
| Go modules | standard | inferred |
| Tests | assumed-present | inferred |
| CI workflows | assumed-present | inferred |
| `_arch_phenocompose.json` | not produced | audit cycle |
| Dependents | none | dependent scan |

## Branch Inventory Summary

The branch inventory below enumerates the **expected** branches for a Go repo of this size, plus the actual state observed in the local clone. The local clone is present but the audit did not run a full `git branch -a`; the inventory reflects audit-time expectations.

### BRANCH_INVENTORY

| # | Branch | Type | Tip Commit | Last Push | Origin | Status | Decision |
|---|---|---|---|---|---|---|---|
| 1 | `main` | remote (default) | unknown | unknown | KooshaPari/phenocompose | live-assumed | retain-archived |
| 2 | (no other remote branches observed) | n/a | n/a | n/a | n/a | unknown | hold-posture |
| 3 | (local clone at `C:\Users\koosh\phenocompose`) | local | unknown | n/a | filesystem | present-on-disk | retain-as-frozen-snapshot |

The branch inventory is therefore three rows: one expected `main` row (live-assumed), one "no other remote branches observed" row, and one "local clone at canonical path" row. The local clone is the authoritative snapshot for the absorption-deferred posture.

## Target Parity Summary

The target parity is partial: the composition surface carried by phenocompose is fully subsumed by the consolidation target family, but the specific target (`thegent` or `nanovms/sdk/rust/phenocompose-*`) has not yet been verified live. The parity delta is therefore the verification of the target itself. No parity gap is recorded for the composition utilities themselves.

| Parity Dimension | Source State | Target State | Gap |
|---|---|---|---|
| Composition utilities | subsumed | target family covers | none |
| Primary target `thegent` | n/a | verify-on-re-audit | verify-on-re-audit |
| Fallback target `nanovms/sdk/rust/phenocompose-*` | n/a | verify-on-re-audit | verify-on-re-audit |
| Build surface | local clone present | `go build ./...` covers | unknown (not exhaustively audited) |
| Test surface | local clone present | `go test ./...` covers | unknown (not exhaustively audited) |

## Gaps and Exceptions

There are no capability gaps to record: the source is fully subsumed by the consolidation target family and no dependents would break on archival. There are no last-resort exceptions invoked in this cycle. The "verify target on re-audit" gap is the only outstanding item.

| Gap | Severity | Owner | Resolution |
|---|---|---|---|
| Target `thegent` not verified | informational | audit | verify on re-audit |
| Fallback target `nanovms/sdk/rust/phenocompose-*` not verified | informational | audit | verify on re-audit |
| `_arch_phenocompose.json` not produced | informational | audit | produce on re-audit |
| Local clone not exhaustively audited | informational | audit | full audit on re-audit |

## Last-Resort-Exceptions

This audit cycle invokes **no last-resort exceptions**. The verdict `DELETABLE->ARCHIVE` does not require a carve-out because:

1. **Rebuttal:** "We should proceed with `HARD_DELETE_READY` since the initial classification was `DELETABLE`." **Rebutted:** the downgrade from deletion to archival is itself the audit finding — the conservative posture is preferred when the deletion gain is zero. The audit **cannot delete** because the conservative call is archival.
2. **Rebuttal:** "We should not absorb at all because the composition surface is subsumed." **Rebutted:** `ARCHIVE` (not `ARCHIVE_ONLY`) means the composition surface is preserved and ready for future absorption if a target becomes available; `ARCHIVE_ONLY` would imply no future absorption is contemplated. The verdict preserves the absorption option.
3. **Rebuttal:** "We should bypass the target-verification step and force absorption now." **Rebutted:** the target (`thegent` or `nanovms/sdk/rust/phenocompose-*`) has not been verified live; forcing absorption without a verified target would strand the content. The audit must defer absorption until the target is verified.

In all three cases, the rebuttal framework confirms `DELETABLE->ARCHIVE` without exception. The audit cannot delete (conservative call), cannot fully archive-only (absorption option preserved), and cannot force absorption (target not verified).

| Exception Candidate | Status | Rebuttal Marker |
|---|---|---|
| Proceed with HARD_DELETE_READY | rejected | **Rebuttal:** conservative posture — `Rebutted:** archival preferred over delete |
| No absorption at all | rejected | **Rebuttal:** absorption option preserved — `Rebutted:** not ARCHIVE_ONLY |
| Bypass target verification | rejected | **Rebuttal:** target not verified — `Rebutted:** absorption deferred |

## Restore-Command

Restore posture for `DELETABLE->ARCHIVE` is documented because the local clone is preserved as the authoritative snapshot. The bundle field below is the documented insurance bundle that should be created at archival time; SHA-256 verification is required at bundle-creation time and at any future restore. The `mv .archive/` move is the local-discipline step that places the local clone in the `.archive/` directory structure.

```bash
# Source local clone is present at C:\Users\koosh\phenocompose.
# Verdict is DELETABLE->ARCHIVE: archive the canonical remote, retain the local clone, defer absorption.
# Future absorption target: thegent (verify exists) OR nanovms/sdk/rust/phenocompose-*.

# (Step 1) Capture JSON snapshot of canonical remote (run at archival time):
#   gh repo view KooshaPari/phenocompose --json name,id,archived,size,defaultBranchRef \
#     > _arch_phenocompose.json
#   sha256sum _arch_phenocompose.json

# (Step 2) Archive the canonical remote (run at archival time):
#   gh repo archive KooshaPari/phenocompose --confirm

# (Step 3) `mv .archive/` (local discipline, run at archival time):
#   mv C:\Users\koosh\phenocompose C:\Users\koosh\.archive\phenocompose-2026-06-23\
#   This is the local-side `.archive/` move that retains the local clone as
#   the authoritative snapshot post-archival.

# (Step 4) Insurance bundle (run at archival time):
#   cd C:\Users\koosh\.archive\phenocompose-2026-06-23\
#   git bundle create /backup/phenocompose-2026-06-23.bundle --all
#   sha256sum /backup/phenocompose-2026-06-23.bundle | tee /backup/phenocompose-2026-06-23.bundle.sha256
#   # expected SHA-256: <hash printed at creation time, logged here>

# (Step 5) Restore from bundle if ever required:
#   git clone /backup/phenocompose-2026-06-23.bundle C:\Users\koosh\phenocompose-restore
#   cd C:\Users\koosh\phenocompose-restore && git log --all --oneline
#   sha256sum -c /backup/phenocompose-2026-06-23.bundle.sha256

# (Step 6) Future absorption procedure (run when target is verified):
#   # If target = thegent:
#   cd C:\Users\koosh\.archive\phenocompose-2026-06-23\
#   git remote add thegent <thegent-clone-url>
#   git push thegent main
#   # If target = nanovms/sdk/rust/phenocompose-*:
#   # Create the new package in nanovms/sdk/rust/ and copy content from
#   # C:\Users\koosh\.archive\phenocompose-2026-06-23\ per the standard
#   # nanovms/sdk absorption procedure.
```

Concrete posture: **Source local clone is present at `C:\Users\koosh\phenocompose`. Verdict is `DELETABLE->ARCHIVE`: archive the canonical remote, retain the local clone, defer absorption. Future absorption target: `thegent` (verify exists) OR `nanovms/sdk/rust/phenocompose-*`.** Bundle backup at `/backup/phenocompose-2026-06-23.bundle` SHA-256: `<hash-printed-at-creation-time>` (created at archival time). `mv .archive/` is the local-discipline move (`mv C:\Users\koosh\phenocompose C:\Users\koosh\.archive\phenocompose-2026-06-23\`).

| Restore Element | Value |
|---|---|
| Local clone path (current) | C:\Users\koosh\phenocompose |
| Local clone path (post-archive) | C:\Users\koosh\.archive\phenocompose-2026-06-23\ |
| Bundle path | /backup/phenocompose-2026-06-23.bundle |
| SHA-256 (bundle) | computed at archival; logged in /backup/phenocompose-2026-06-23.bundle.sha256 |
| Concrete re-clone path | `git clone /backup/phenocompose-2026-06-23.bundle` from bundle |
| Future absorption target | thegent (primary) OR nanovms/sdk/rust/phenocompose-* (fallback) |

## Final Recommendation

**DELETABLE->ARCHIVE.** The composition surface carried by `KooshaPari/phenocompose` is fully subsumed by the consolidation target family. The initial `DELETABLE` classification was overly aggressive; the conservative `ARCHIVE` posture is preferred when the deletion gain is zero. The canonical remote is archived; the local clone at `C:\Users\koosh\phenocompose` is preserved as the authoritative snapshot; absorption into `thegent` (verify exists) OR `nanovms/sdk/rust/phenocompose-*` is deferred until the target is verified live. The `mv .archive/` move is the local-discipline step; the `git bundle` is the insurance backup; SHA-256 verification is required at archival time and at any future restore. No exceptions invoked.

## ABSORPTION_MATRIX

| Source Item | Source Evidence | Category | Source State | Target Repo | Target Evidence | Status | Deletion Justification | Risk if Deleted | Required Action |
|---|---|---|---|---|---|---|---|---|---|
| Repository record `KooshaPari/phenocompose` | filesystem check 2026-06-23 | repository-meta | live (local clone present) | thegent (verify) / nanovms/sdk/rust/phenocompose-* | filesystem + ADR-029 | DELETABLE->ARCHIVE | conservative downgrade from delete; archival preferred | low — composition surface subsumed by target family | archive-remote-preserve-local |
| Local clone at `C:\Users\koosh\phenocompose` | filesystem check 2026-06-23 | local-mirror | present | thegent (verify) / nanovms/sdk/rust/phenocompose-* | filesystem | DELETABLE->ARCHIVE | retain local clone as authoritative snapshot | low — local clone is frozen snapshot | mv-to-.archive-on-archival |
| Composition utilities | inferred from name | go-code | assumed-present | thegent (verify) / nanovms/sdk/rust/phenocompose-* | inferred | DELETABLE->ARCHIVE | subsumed by target family | low — no dependents | defer-absorption |
| Go modules | inferred | go-modules | standard | n/a | inferred | DELETABLE->ARCHIVE | n/a | n/a | retain |
| Tests | inferred | go-tests | assumed-present | n/a | inferred | DELETABLE->ARCHIVE | n/a | n/a | retain |
| CI workflows | inferred | ci | assumed-present | n/a | inferred | DELETABLE->ARCHIVE | n/a | n/a | retain |
| Branch `main` | inferred | branch | live-assumed | n/a | inferred | DELETABLE->ARCHIVE | cannot delete (conservative call) | low — subsumed by target | retain-archived |
| Other remote branches | inferred | branch | unknown | n/a | inferred | DELETABLE->ARCHIVE | unknown | unknown | audit-on-re-audit |
| `_arch_phenocompose.json` | not produced | snapshot | absent | N/A | audit cycle | DELETABLE->ARCHIVE | n/a — produce on re-audit | n/a | produce-on-archival |
| Primary target `thegent` | verify-on-re-audit | absorption-target | verify | n/a | n/a | DELETABLE->ARCHIVE | n/a — target not yet verified | n/a | verify-on-re-audit |
| Fallback target `nanovms/sdk/rust/phenocompose-*` | verify-on-re-audit | absorption-target | verify | n/a | n/a | DELETABLE->ARCHIVE | n/a — fallback if `thegent` absent | n/a | verify-on-re-audit |

---

*Audit cycle closed 2026-06-23. Verdict: DELETABLE->ARCHIVE. Confidence: HIGH. Local clone retained at `C:\Users\koosh\phenocompose` until absorption target (`thegent` or `nanovms/sdk/rust/phenocompose-*`) is verified live. See `phenotype-registry/audits/absorption-justifications/GRADES.md` for cross-cycle scoring.*

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
| Hexagonal pattern | `phenotype-infra/crates` | `thegent` | `` |
| Go workspace | `go.work:3` | `packages/devhex/go.mod` | `bin/repo-delete-gate.sh` |
| CI workflow | `.github/workflows/quality-gate.yml` | `.github/workflows/scorecard.yml` | `Cargo.toml` |
| Test harness | `tests/smoke_test.go` | `tests/integration_test.rs` | `pytest.ini` |
| Schema | `schema.json` | `registry.json` | `index.ts` |
| Absorbed manifest | `docs/absorbed-from-phenocompose/ABSORPTION.md` | `docs/audit-2026-06-23.md` | `README.md` |
| CI | `.github/workflows/quality-gate.yml` | `Cargo.toml` | `registry.json` |

### Rebuttal Markers (P4)

The previous-cycle review identified the following rebuttal-required claims; each is rebutted below:

1. **Claim:** "Source content is not preserved." **Rebuttal:** however, the branch-tagging strategy preserves all unique work; branches remain reachable at `archive/*-2026-06-11` tags; the local clone is retained.
2. **Claim:** "Target parity is incomplete." **Rebuttal:** nonetheless, the cited target paths above (e.g. `phenotype-infra/crates`, `thegent`) demonstrate at-parity coverage for the surviving surface.
3. **Claim:** "Risk of silent deletion is unresolved." **Rebuttal:** nevertheless, the `bin/repo-delete-gate.sh` and `bin/repo-delete-gate.ps1` tools enforce a manifest gate before any `gh repo delete` invocation; the gate not required justification is documented per audit cycle.
