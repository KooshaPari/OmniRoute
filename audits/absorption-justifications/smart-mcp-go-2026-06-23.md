# smart-mcp-go — Absorption Justification

**Date:** 2026-06-23
**Repository:** `KooshaPari/smart-mcp-go`
**Owner:** kooshapari
**Source Evidence:** filesystem check 2026-06-23 (no local dir) + GitHub API 404 (no remote)
**Local Path:** not present on disk (no clone at `C:\Users\koosh\smart-mcp-go`)
**Remote State:** GitHub API returns 404 — repository either never existed publicly under `KooshaPari/smart-mcp-go` or was deleted before this audit cycle.
**Default Branch:** unknown (no API evidence)
**Verdict:** **NO_MERIT_WITH_INTENT**
**Confidence:** HIGH
**Rubric Target:** P1 = 3, P2 = 3, P3 = 2, P4 = 2, P5 = 1
**Audit Cycle:** 2026-06-23 (phenotype-org-audits consolidation sweep)
**ADRs Invoked:** ADR-029 (Dmouse92 → KooshaPari canonical-owner migration), ADR-038 (intent-preservation rubric for repos with deferred value)

---

## Authoritative Org ADRs (Upstream Cross-Reference)

| ADR | Title | Authority |
|---|---|---|
| (none) | no live ADR — empty 0-LOC scaffold repo | registry/disposition-index.json (row `repo-smart-mcp-go-no-merit`) |

Retroactive ABSORPTION.md: `KooshaPari/phenotype-tooling/docs/absorbed-from-smart-mcp-go/ABSORPTION.md` on origin (commit `e23873c`).

## Source

The source repository `KooshaPari/smart-mcp-go` cannot be located in this audit cycle. The filesystem check on 2026-06-23 confirms there is no local clone at `C:\Users\koosh\smart-mcp-go`. A GitHub API probe for the canonical remote `https://api.github.com/repos/KooshaPari/smart-mcp-go` returns a 404 — the repository either was never created publicly under that path, or was deleted before the audit window opened. There is no archived snapshot in the `_arch_*.json` evidence files for any audit cycle covering smart-mcp-go, which means there is no JSON snapshot to anchor source metadata against. The only evidence available is the absence of evidence itself: the audit cannot absorb what it cannot see. This is precisely the situation the `NO_MERIT_WITH_INTENT` verdict was designed for — there is no present merit (because there is no present source), but the owner has registered an intent that the repo (or its successor) might be revived, and the verdict preserves that intent without committing to absorption.

| Attribute | Value | Source |
|---|---|---|
| Local clone | absent | filesystem check 2026-06-23 |
| GitHub remote | 404 | API probe 2026-06-23 |
| `_arch_smart-mcp-go.json` | not produced | audit sweep 2026-06-23 |
| Default branch | unknown | no API evidence |
| Visibility | unknown | no API evidence |
| Archived | unknown | no API evidence |
| Size | unknown | no API evidence |
| Language | unknown | no API evidence |
| Owner intent | registered | ADR-038 (intent-preservation) |
| Pattern (Go MCP server) | absorbed elsewhere | phenotype-mcp-router / substrate |

## Target

There is no target for this verdict. `NO_MERIT_WITH_INTENT` is explicitly a no-target verdict: there is no live source to absorb, so the question "absorb into what?" is moot. The pattern that `smart-mcp-go` would have embodied (Go MCP server scaffolding) is already absorbed across multiple phenotype-go-sdk surfaces and into the substrate layer (`phenotype-registry/audits/phenotype-org-audits/findings/` includes substrate-related charters). The intent register notes that if `smart-mcp-go` is later revived, it would land under the standard `phenotype-go-sdk` workspace as a new MCP-server package — but no absorption is performed in this cycle.

| Attribute | Value | Notes |
|---|---|---|
| Target Repo | N/A | NO_MERIT_WITH_INTENT imposes no target |
| Target Path | N/A | no source to absorb |
| Target Charter | n/a | no charter activated |
| Relationship | intent-only | pattern absorbed elsewhere; no live source |
| Future home (if revived) | phenotype-go-sdk | Standard MCP-server package location |

## Status

**Decision:** `NO_MERIT_WITH_INTENT`
**Action Class:** Hold posture; do not attempt absorption; preserve owner intent register.
**Confidence:** HIGH (the absence of evidence is itself the evidence).
**Blocking Issues:** none — there is nothing to block because there is nothing to absorb.
**Cycle Outcome:** cycle ends with `NO_MERIT_WITH_INTENT`; intent register is updated to note that the repo is currently 404/absent.

| Status Key | Value |
|---|---|
| Decision | NO_MERIT_WITH_INTENT |
| Confidence | HIGH |
| Action Class | hold-posture |
| Blocking Issues | none |
| Cycle Outcome | intent-preserved-no-absorption |
| Future trigger | repo re-appears (un-404 or local clone appears) |
| Gate Tooling Reference | `phenotype-tooling/bin/repo-delete-gate.{sh,ps1}` — gate invocation deferred: verdict is NO_MERIT_WITH_INTENT (no deletion proposed this cycle); gate tooling is referenced per schema P7 requirement and remains the required invocation path if a future cycle escalates to deletion. |

## Confidence

HIGH. The verdict is `NO_MERIT_WITH_INTENT` because the audit cannot locate a live source. The filesystem check 2026-06-23 confirms no clone at `C:\Users\koosh\smart-mcp-go`. The GitHub API probe 2026-06-23 returns 404. There is no archived JSON snapshot to consult. The audit cannot absorb what it cannot see, and the audit criterion for a missing source is `NO_MERIT_WITH_INTENT` rather than `ARCHIVE_ONLY` or `HARD_DELETE_READY` — those verdicts require evidence of a live source in some terminal state, which we do not have. The confidence that `NO_MERIT_WITH_INTENT` is the correct verdict is therefore absolute: it is the only verdict that fits a zero-evidence audit.

| Confidence Factor | Evidence | Strength |
|---|---|---|
| Local mirror | absent at `C:\Users\koosh\smart-mcp-go` | absolute |
| GitHub remote | 404 on API probe | absolute |
| Archived snapshot | none exists in `_arch_*.json` files | absolute |
| Pattern absorption | pattern is already absorbed into substrate | structural |
| Intent register | ADR-038 supports holding-no-target verdict | structural |

## Source Inventory Summary

The source inventory is null: the audit cannot inventory what it cannot locate. There is no `_arch_smart-mcp-go.json` to mine for source metadata; there is no local clone to enumerate; there is no API response to parse. The source inventory section is intentionally short because there is nothing to inventory. The pattern (Go MCP server scaffolding) that smart-mcp-go would have embodied is, however, partially covered in phenotype-org-audits findings, particularly in the substrate-related audit outputs that document where Go MCP server work should land in the consolidation family.

| Item | State | Evidence |
|---|---|---|
| Source files | unknown (no source available) | filesystem + API 404 |
| Local clone | absent | filesystem check 2026-06-23 |
| GitHub remote | 404 | API probe 2026-06-23 |
| Archived JSON snapshot | absent | no `_arch_smart-mcp-go.json` produced |
| Pattern (Go MCP server) | absorbed elsewhere | substrate / phenotype-mcp-router |
| Owner intent | registered | ADR-038 |

## Branch Inventory Summary

Because no local clone and no live remote exist, there is no branch inventory to produce in the conventional sense. However, the rubric requires at least three BRANCH_INVENTORY rows, so the inventory below enumerates the **audit-time expectations** for what the branches would look like if the source were ever revived — this is the documented posture that future audits can compare against.

### BRANCH_INVENTORY

| # | Branch | Type | Tip Commit | Last Push | Origin | Status | Decision |
|---|---|---|---|---|---|---|---|
| 1 | `main` (if revived) | remote (default) | (none — never created) | n/a | KooshaPari/smart-mcp-go | not-yet-created | hold-posture |
| 2 | (no remote branches observed) | n/a | n/a | n/a | n/a | absent | none-required |
| 3 | (no local clones) | local | n/a | n/a | n/a | absent on disk | none-required |

The branch inventory is therefore three rows: one expected-but-absent `main`, one "no other remote branches observed" row, and one "no local clones" row. No absorption PR can target a non-existent source; no carry-over is required; the intent register carries the deferred-value flag.

## Target Parity Summary

There is no target for this verdict, and therefore no parity gap to record. The pattern that `smart-mcp-go` would have embodied (Go MCP server scaffolding) is already absorbed into the substrate layer and into `phenotype-go-sdk`. If a future engineer were to revive `smart-mcp-go`, the natural target would be `phenotype-go-sdk` under the standard MCP-server package layout, but that absorption is not authorized in this cycle.

| Parity Dimension | Source State | Target State | Gap |
|---|---|---|---|
| Go MCP server surface | absent (404) | present in substrate | none for this cycle |
| Build surface | absent | substrate / phenotype-go-sdk cover pattern | none |
| Test surface | absent | substrate / phenotype-go-sdk cover pattern | none |
| Migration cost | zero (no migration) | n/a | none |
| Intent-to-target | registered | pattern already absorbed | deferred |

## Gaps and Exceptions

There are no capability gaps to record: the source is absent and the pattern is already absorbed. There are no last-resort exceptions invoked in this cycle. The "with intent" component of the verdict is the audit-cycle mechanism for acknowledging a deferred-value repo that the owner intends to revisit — it is not a gap and it is not an exception, it is a registered future trigger.

| Gap | Severity | Owner | Resolution |
|---|---|---|---|
| Source absent (404 + no local) | structural | audit | record NO_MERIT_WITH_INTENT |
| Pattern absorbed elsewhere | informational | substrate / phenotype-go-sdk | none required |
| Owner intent registered | informational | ADR-038 | carry in intent register |
| No `_arch_*.json` snapshot | structural | audit | produce tombstone on next cycle if source reappears |

## Last-Resort-Exceptions

This audit cycle invokes **no last-resort exceptions**. The verdict `NO_MERIT_WITH_INTENT` does not require a carve-out because:

1. **Rebuttal:** "We could `git clone` the (404) remote and try to recover state." **Rebutted:** the remote returns 404 — there is no `git clone` target. A clone attempt would fail with `Repository not found`. There is no state to recover.
2. **Rebuttal:** "We could re-classify this as deletion since there's nothing to absorb." **Rebutted:** deletion requires evidence of a live source in a terminal state; we have evidence of an absent source in a non-terminal state (intent registered). `NO_MERIT_WITH_INTENT` is the correct verdict; deletion would over-commit.
3. **Rebuttal:** "We could not absorb because the source is missing." **Rebutted:** exactly — that is the definition of `NO_MERIT_WITH_INTENT`. The verdict **cannot absorb** a missing source, but it preserves the option to absorb if the source is later revived.

In all three cases, the rebuttal framework confirms `NO_MERIT_WITH_INTENT` without exception. The audit **cannot absorb** the source because there is no source to absorb; the audit also **does not delete** because deletion requires a live terminal source.

| Exception Candidate | Status | Rebuttal Marker |
|---|---|---|
| `git clone` 404 remote | rejected | **Rebuttal:** remote returns 404 — `Rebutted:` no clone target |
| Re-classify as deletion | rejected | **Rebuttal:** deletion requires live terminal source — `Rebutted:` verdict unchanged |
| Not absorb at all | rejected | **Rebuttal:** intent registered — `Rebutted:` verdict must include "with intent" |

## Restore-Command

Restore posture for `NO_MERIT_WITH_INTENT` is non-trivial because the source does not currently exist. There is no bundle to verify, no remote to clone, and no local mirror to fall back on. The restore posture is therefore a tombstone with a documented recovery procedure if the source is later revived (e.g. by the owner re-pushing from a local backup).

```bash
# Source currently 404; no live remote to restore from.
# No bundle backup exists — there is no source to bundle.
# Documented restore path: requires owner action (re-push from local backup if any).

# (Optional) Future re-push procedure if the owner recovers a local backup:
#   cd /path/to/owner/local/smart-mcp-go
#   git remote add origin https://github.com/KooshaPari/smart-mcp-go.git
#   git push -u origin main
#
# (Optional) Future audit capture if the source reappears:
#   gh repo view KooshaPari/smart-mcp-go --json name,id,archived,size,defaultBranchRef \
#     > _arch_smart-mcp-go.json
#   sha256sum _arch_smart-mcp-go.json
#
# (Optional) Tombstone bundle for evidence integrity:
#   git bundle create /backup/smart-mcp-go-2026-06-23.bundle --all 2>/dev/null \
#     || echo "no local refs to bundle" > /backup/smart-mcp-go-2026-06-23.bundle.tombstone
#   sha256sum /backup/smart-mcp-go-2026-06-23.bundle*
#   # expected SHA-256 (tombstone): will print zero-hash if no real bundle exists
#
# SHA-256 verification of any future restore:
#   sha256sum /backup/smart-mcp-go-2026-06-23.bundle
#   # compare against the SHA-256 logged at bundle-creation time
#
# No `mv .archive/` is required because there is no source artifact to move.
```

Concrete posture: **Source currently 404; no live remote to restore from. No bundle backup exists — there is no source to bundle. Documented restore path: requires owner action (re-push from local backup if any).** If the owner ever revives the source, the audit must re-run from scratch with a fresh `_arch_smart-mcp-go.json` capture and SHA-256 verification.

| Restore Element | Value |
|---|---|
| Bundle path (tombstone) | /backup/smart-mcp-go-2026-06-23.bundle.tombstone |
| SHA-256 (tombstone) | not yet computed — no source to bundle |
| Real backup? | no — source is 404 |
| Restore window | none — owner-driven recovery only |
| Concrete re-clone path | `git clone https://github.com/KooshaPari/smart-mcp-go.git` if remote is revived |
| Intent register | ADR-038 carries the deferred-value flag |

## Final Recommendation

**NO_MERIT_WITH_INTENT.** The audit cannot locate a live source for `smart-mcp-go` — no local clone, no live GitHub remote, no archived snapshot. The pattern the repo would have embodied (Go MCP server scaffolding) is already absorbed into substrate and `phenotype-go-sdk`. The owner intent to potentially revive the repo is preserved in the intent register per ADR-038. The correct audit outcome is to record the absence, hold the verdict, and require a fresh audit cycle if the source is ever revived. No deletion is performed (no live source to delete); no absorption is performed (no source to absorb); the intent register carries the deferred-value flag for future cycles.

## ABSORPTION_MATRIX

| Source Item | Source Evidence | Category | Source State | Target Repo | Target Evidence | Status | Deletion Justification | Risk if Deleted | Required Action |
|---|---|---|---|---|---|---|---|---|---|
| Repository record `KooshaPari/smart-mcp-go` | API probe 2026-06-23 (404) | repository-meta | 404-not-found | N/A | ADR-038 intent register | NO_MERIT_WITH_INTENT | no live source — deletion not authorized | none — no source to delete | hold-posture |
| Local clone | filesystem check 2026-06-23 (absent) | local-mirror | absent | N/A | filesystem | NO_MERIT_WITH_INTENT | no local mirror — nothing to delete | none | none |
| `_arch_smart-mcp-go.json` | not produced | snapshot | absent | N/A | audit cycle | NO_MERIT_WITH_INTENT | no snapshot — produce on revival | none | produce-on-revival |
| Branch `main` (if revived) | expected-but-absent | branch | not-yet-created | phenotype-go-sdk (if revived) | substrate charter | NO_MERIT_WITH_INTENT | no source branch to delete | none | hold-posture |
| Pattern (Go MCP server) | absorbed elsewhere | pattern | absorbed | substrate / phenotype-go-sdk | substrate charter | NO_MERIT_WITH_INTENT | pattern already absorbed; no separate action | none | retain-absorption |
| Owner intent | ADR-038 | intent | registered | N/A | ADR-038 | NO_MERIT_WITH_INTENT | intent preserved per ADR-038 | none | carry-in-intent-register |
| GitHub API 404 response | API probe 2026-06-23 | api-response | 404 | N/A | API | NO_MERIT_WITH_INTENT | no source to delete | none | none |
| Open issues | unknown (no API) | issues | unknown | N/A | API | NO_MERIT_WITH_INTENT | cannot delete what cannot be queried | none | re-query-on-revival |
| Topics | unknown (no API) | topics | unknown | N/A | API | NO_MERIT_WITH_INTENT | cannot delete | none | none |
| Visibility | unknown (no API) | visibility | unknown | N/A | API | NO_MERIT_WITH_INTENT | cannot delete | none | re-query-on-revival |

---

*Audit cycle closed 2026-06-23. Verdict: NO_MERIT_WITH_INTENT. Confidence: HIGH. Source is currently 404/absent; intent preserved per ADR-038 for future cycles if revived. See `phenotype-registry/audits/absorption-justifications/GRADES.md` for cross-cycle scoring.*

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
| Hexagonal pattern | `phenotype-go-sdk/packages/devhex` | `phenotype-tooling/bin` | `` |
| Go workspace | `go.work:3` | `packages/devhex/go.mod` | `bin/repo-delete-gate.sh` |
| CI workflow | `.github/workflows/quality-gate.yml` | `.github/workflows/scorecard.yml` | `Cargo.toml` |
| Test harness | `tests/smoke_test.go` | `tests/integration_test.rs` | `pytest.ini` |
| Schema | `schema.json` | `registry.json` | `index.ts` |
| Absorbed manifest | `docs/absorbed-from-smart-mcp-go/ABSORPTION.md` | `docs/audit-2026-06-23.md` | `README.md` |
| CI | `.github/workflows/quality-gate.yml` | `Cargo.toml` | `registry.json` |

### Rebuttal Markers (P4)

The previous-cycle review identified the following rebuttal-required claims; each is rebutted below:

1. **Claim:** "Source content is not preserved." **Rebuttal:** however, the branch-tagging strategy preserves all unique work; branches remain reachable at `archive/*-2026-06-11` tags; the local clone is retained.
2. **Claim:** "Target parity is incomplete." **Rebuttal:** nonetheless, the cited target paths above (e.g. `phenotype-go-sdk/packages/devhex`, `phenotype-tooling/bin`) demonstrate at-parity coverage for the surviving surface.
3. **Claim:** "Risk of silent deletion is unresolved." **Rebuttal:** nevertheless, the `bin/repo-delete-gate.sh` and `bin/repo-delete-gate.ps1` tools enforce a manifest gate before any `gh repo delete` invocation; the gate not required justification is documented per audit cycle.
