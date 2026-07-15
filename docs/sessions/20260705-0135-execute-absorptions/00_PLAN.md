# Parent Plan -- 2026-07-05 08:00Z -- execute-absorptions (rev 3)

**Mode:** Manager + 2 parallel sub-agents (slot ceiling 4, holding 1)
**Prior revs:** rev 1 (4-lane w/ omni-foundation, declined), rev 2 (3-lane omni-foundation + archiver + spec-008)

## Top bracket

```
[repos wip | Authvault/AtomsBot/GDK/KaskMan GitHub-archived ✓ | KaskMan vendor scripts ✓ |
 phenodag thinned to redirector (ed43744) ✓ | 5 PRs OPEN (3 mergeable, 2 conflicting) |
 Tracera spec-008 P1+P2 impl ready (claim/heartbeat/lifecycle/dedup/sqlite/scanner/export/beads/status/init) |
 AgilePlus spec-008 spec+cockpit PR CONFLICTING | phenodag#29 redirector CONFLICTING |
 spine charters PENDING | inventory/deleted_traces PENDING |
 2 sub-agents launching: L1 archiver-spine | L2 PR-merger (5 PRs)]
```

## Sponsorship note

User override of "sponsor gate" in rev 2: "do it all" applied to the 5 OPEN PRs.
Sponsorship authorization to land the 5 PRs without a separate review window
came in 2026-07-05 07:55Z ("lets do it all", "do it all", "do it all").
OmniRoute work is explicitly deferred per "5 yes skip omni till after 6".

## State from prior revs (carry-forward, verified)

- Authvault: GitHub-archived ✓ (gh api isArchived=true)
- AtomsBot: GitHub-archived ✓
- GDK: GitHub-archived ✓
- KaskMan: GitHub-archived ✓, local banner landed ✓, vendor scripts preserved (78db641f) ✓
- phenodag: thinned to redirector (ed43744) ✓
- Tracera spec-008: spec + P1 + P2 implementation in local main (69cf9a04c, e35c60a86) — needs PR landing

## PR table (verified via `gh pr list` at 2026-07-05 07:58Z)

| # | Repo | PR | Title | State | Action |
|---|------|-----|-------|-------|--------|
| A | Tracera | #723 | spec: spec 008 (Tracera) | OPEN MERGEABLE | land first (lowest risk) |
| B | Tracera | #725 | feat(spec-008-P1): port phenodag atomic claim + heartbeat + lifecycle | OPEN MERGEABLE | land second (depends on A) |
| C | Tracera | #726 | feat(spec-008-P2): port phenodag dedup + sqlite + scanner + export + beads + status + init | OPEN MERGEABLE | land third (depends on B) |
| D | AgilePlus | #895 | spec: absorb phenodag PM/cockpit concerns (presets, dashboard, commits) into AgilePlus spec 008 | OPEN CONFLICTING | resolve + land (stale main; rebase onto current main) |
| E | phenodag | #29 | docs: thin redirector -- phenodag absorbed into Tracera + AgilePlus | OPEN CONFLICTING | resolve + land last (docs only) |

## Lanes (this rev, parallel)

| # | Lane              | Agent role  | Deliverable                                                                                          | Slot |
|---|-------------------|-------------|------------------------------------------------------------------------------------------------------|------|
| L1 | archiver-spine    | docs-coder  | KaskMan verify; phenotype-org-audits spine charter + REGISTRY.md + symlink fix; phenotype-apps spine charter + INDEX.md commit + catalog.toml + Nth prune; inventory/deleted_traces/SYSTEMIC_ISSUES/UPLIFT_REPORT updates | 1 |
| L2 | PR-merger         | rust-coder  | land Tracera#723, #725, #726; resolve + land AgilePlus#895; resolve + land phenodag#29; all PRs closed and merged to main | 2 |
| L3 | root-manager      | parent (me) | coordinate, verify, commit, push, finalize phenodag 1-release retirement timeline, final cockpit      | root |

Slot 4: held in reserve for any spec-008 AgilePlus code port (AP-PHENO-001..005
Rust implementation) that the sponsor wants in-scope. If the user signals
"do AP-PHENO code too", spawn a 3rd agent on it. Otherwise, defer to next
turn and document the gap in 05_KNOWN_ISSUES.

## Out of scope this turn

- OmniRoute full 6-phase / 24-week rewrite (sponsor-deferred)
- BytePort implementation (separate owner per "you do not own byteport")
- Frontends (separate owner)
- spec-008 AgilePlus Rust port (AP-PHENO-001..005) — deferred, see slot 4
- 95-file uncommitted WIP in AgilePlus on `spec/008-phenodag-absorption` branch
  (PR-merger will inspect; if it conflicts with the merge of #895, do NOT
  discard — flag for sponsor)

## Risks

- R-1: AgilePlus#895 conflict on 6-file/577-add PR; rebase cost ~30-60 min
- R-2: phenodag#29 conflict on CHANGELOG.md only; docs-only rebase trivial
- R-3: Tracera#725 introduces new SQLite migration (0006); check SQL on review
- R-4: phenotype-apps has staged changes (ARCHIVE.md, INDEX.md, .gitignore,
       AtomsBot-2nd/README.md) from prior session; L1 should inspect and
       continue, NOT discard
- R-5: AgilePlus has 95 files uncommitted; L2 must NOT touch them, only
       rebase/merge the PR cleanly

## Verification

- gh pr list --state merged on Tracera shows #723, #725, #726 ✓
- gh pr list --state merged on AgilePlus shows #895 ✓
- gh pr list --state merged on phenodag shows #29 ✓
- gh pr list --state open on all 3 repos: 0 spec-008-related PRs remain
- rg "phenodag" polyrepo: only docs/sessions, phenotype-org-audits, phenodag
  itself, Tracera spec-008, AgilePlus spec-008, BytePort absorption spec
- cargo check / cargo test in Tracera spec-008 queue/ submodules
- cargo check in AgilePlus after #895 merge
- go build in phenodag after #29 merge
- git tag authvault-final (already done in prior rev)
