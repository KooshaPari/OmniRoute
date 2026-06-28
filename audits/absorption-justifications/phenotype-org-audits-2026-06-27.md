# Absorption Manifest — phenotype-org-audits

<!-- hand-authored: phenotype-org-audits 2026-06-27 -->

## Source

- **Repo:** `KooshaPari/phenotype-org-audits`
- **GitHub URL:** https://github.com/KooshaPari/phenotype-org-audits
- **Archived at:** false
- **Default branch at audit time:** `main`
- **Visibility at audit time:** private
- **Stargazers:** 0 · **Open issues:** 0 · **Size:** 7240 KB
- **Primary language:** Shell · **License:** MIT
- **Description:** Org-wide audit tooling and compliance tracking — central inventory and metrics hub for the Phenotype organization.

### Languages detected

| Language | Share |
|---|---|
| Shell | 65% |
| Python | 19% |
| Go | 12% |
| Rust | 4% |

## Target

- **Receiving repo:** `KooshaPari/phenotype-infra` (https://github.com/KooshaPari/phenotype-infra)
- **Receiving path:** `docs/absorbed-from-phenotype-org-audits/`
- **Local mirror path:** `C:\Users\koosh\phenotype-org-audits` (live local clone)
- **Bundle file:** none (live repo; no bundle needed)

### Absorption-target canonical files

| Canonical role | Path |
|---|---|
| Manifest template | `bin/ABSORPTION_TEMPLATE.md` |
| Audit rubric | `registry/audit-absorption-justification/schema.json` |
| Audit grader | `registry/audit-absorption-justification/grade.sh` |
| Cluster spine doc | `docs/compute-infra-subtree.md` |
| Project-card root | `projects/` |

## Status

- [x] **AFFIRM** — repo remains active; absorption is partial / progressive.

**Confidence:** HIGH

**Gate Tooling Reference:** `bin/repo-delete-gate.sh` (and `repo-delete-gate.ps1` for Windows runners) at `phenotype-tooling/bin/`. The gate enforces a manifest-presence check before any `gh repo delete` invocation.

**Authoritative Org ADRs (Upstream Cross-Reference):**
- ADR-008 — consolidation over proliferation.
- ADR-039 — monorepo preference for SDK-layer code.
- ECO-022 — compute/infra subtree registry correction.

## Source Inventory Summary

- **Languages detected:** Shell, Python, Go, Rust
- **Total branches (remote):** 19
- **Open issues at audit time:** 0
- **Bundle reference:** NONE — repo is live, no bundle required
- **Source-tombstone posture:** `KooshaPari/phenotype-org-audits` returns 200 OK via `gh api`

| Category | Count | Notes |
|---|---|---|
| Source code languages | 4 | Shell, Python, Go, Rust |
| Remote branches | 19 | See BRANCH_INVENTORY below |
| Authoritative inventory | 165 repos | `inventory/AUTHORITATIVE_REPO_INVENTORY.md` |
| V3 scorecard metrics | 6 dimensions | `metrics/COVERAGE_V3.md` |

## Branch Inventory Summary

### BRANCH_INVENTORY

| Source branch | Last commit SHA | Merge / rebase / abandon | Notes |
|---|---|---|---|
| `main` | HEAD of `main` | retain (default branch) | active governance hub |
| `archive/2026-06-15-30-pillar-fleet` | `6e5d6b4` | retain as archive | 30-pillar fleet audit snapshot |
| `chore/gitignore-adopt-node-2026-06-11` | `f3b709c` | merge or rebase into target | gitignore hygiene |
| `chore/l5-113-merge-forge-runner-scripts-process-2026-06-19` | `95506ab` | merge or rebase into target | forge runner scripts merge |
| `chore/pin-github-actions-20260430` | `0e34cea` | merge or rebase into target | action pinning |
| `chore/workflow-hygiene-ubuntu-24` | `9d75bfe` | merge or rebase into target | ubuntu-24 runner migration |
| `chore/20260430-pin-actions-v2` | `a506beb` | merge or rebase into target | action pin v2 |
| `chore/workflow-hygiene-ubuntu-24-clean` | `ec54391` | merge or rebase into target | clean workflow hygiene |
| `main` (protected) | `4200126` | retain | protected default |
| `pr-template/bootstrap` | `880bdaf` | merge or rebase into target | PR template bootstrap |
| `wip/add_concurrency_to_CI_workflows-2026-06-17` | `7bf3c13` | triage | concurrency workflows |
| `wip/phenotype-org-audits-local-dump-20260626` | `4200126` | triage | local dump snapshot |
| `wip/phenotype-org-audits-nonff-snapshot-2026-06-17` | `7bf3c13` | triage | non-ff snapshot |
| `wip/2026-06-18-phenotype-org-audits-l7-001-propagation` | `e2ecefb` | triage | L7 pillar propagation |

- **Branches merged into target:** 0 (absorption is partial / progressive)
- **Branches still open / unresolved:** 18 — must be 0 for DELETE
- **Default branch:** `main` + 18 non-default branches

## Target Parity Summary

| Parity concept | Source | Target Evidence |
|---|---|---|
| Absorption template | (this audit's structure) | `bin/ABSORPTION_TEMPLATE.md` |
| 7-pillar rubric | (scored by grader) | `registry/audit-absorption-justification/schema.json` |
| Grader script | (scored by grader) | `registry/audit-absorption-justification/grade.sh` |
| Delete-gate tooling | (cited in P7) | `bin/repo-delete-gate.sh` |
| Cluster spine doc | (referenced in upstream cross-ref) | `docs/compute-infra-subtree.md` |
| V3 scorecard | `metrics/COVERAGE_V3.md` | `audits/phenotype-org-audits/metrics/COVERAGE_V3.md` |
| Auth. inventory | `inventory/AUTHORITATIVE_REPO_INVENTORY.md` | `audits/phenotype-org-audits/inventory/AUTHORITATIVE_REPO_INVENTORY.md` |

Parity: HIGH. The V3 scorecard is the canonical governance baseline for the 165-repo org. phenotype-org-audits serves as the authoritative audit-history tracking hub; absorption into phenotype-infra is at the governance-pattern level.

## ABSORPTION_MATRIX

| Source Item | Source Evidence | Category | Source State | Target Repo | Target Evidence | Status | Deletion Justification | Risk if Deleted | Required Action |
|---|---|---|---|---|---|---|---|---|---|
| `phenotype-org-audits/inventory/AUTHORITATIVE_REPO_INVENTORY.md` | `gh api repos/KooshaPari/phenotype-org-audits/contents/inventory/AUTHORITATIVE_REPO_INVENTORY.md` | governance-inventory | active | `KooshaPari/phenotype-infra` | `docs/absorbed-from-phenotype-org-audits/` | AFFIRM | Unique 165-repo inventory; no other source | CRITICAL; org loses canonical repo catalog | Pattern-absorb into phenotype-infra governance docs |
| `phenotype-org-audits/metrics/COVERAGE_V3.md` | `gh api repos/KooshaPari/phenotype-org-audits/contents/metrics/COVERAGE_V3.md` | governance-metrics | active | `KooshaPari/phenotype-infra` | `docs/absorbed-from-phenotype-org-audits/` | AFFIRM | Canonical V3 scorecard; 6-dimension governance baseline | HIGH; no longitudinal audit baseline | Preserve as archived snapshot |
| `phenotype-org-audits/metrics/UPLIFT_REPORT.md` | `gh api repos/KooshaPari/phenotype-org-audits/contents/metrics/UPLIFT_REPORT.md` | governance-uplift | active | `KooshaPari/phenotype-infra` | `docs/absorbed-from-phenotype-org-audits/` | AFFIRM | Post-intervention uplift tracking | MEDIUM; intervention history lost | Pattern-absorb into phenotype-infra |
| `phenotype-org-audits/audits/2026-04-24/` | `gh api repos/KooshaPari/phenotype-org-audits/contents/audits/2026-04-24` | audit-snapshot | active | `KooshaPari/phenotype-infra` | `docs/absorbed-from-phenotype-org-audits/` | AFFIRM | Historical quarterly audit snapshot | MEDIUM; longitudinal archive gap | Archive into phenotype-infra docs |
| `phenotype-org-audits/worklog.md` | `gh api repos/KooshaPari/phenotype-org-audits/contents/worklog.md` | governance-worklog | active | `KooshaPari/phenotype-infra` | `docs/absorbed-from-phenotype-org-audits/` | AFFIRM | Org-wide governance worklog | LOW; worklog can be re-created | Mirror to phenotype-infra worklog |
| `phenotype-org-audits/branches` (19) | `gh api repos/KooshaPari/phenotype-org-audits/branches` | branch-coverage | active | `KooshaPari/phenotype-infra` | `docs/absorbed-from-phenotype-org-audits/` | AFFIRM | Not yet absorbed; branch inventory enumerated | MEDIUM; WIP branches with unique CI work | see BRANCH_INVENTORY |
| `phenotype-org-audits/.github/workflows/` | `gh api repos/KooshaPari/phenotype-org-audits/actions/workflows` | ci-workflow | active | `KooshaPari/phenotype-infra` | `docs/absorbed-from-phenotype-org-audits/` | AFFIRM | Not yet absorbed | LOW | scanned, not migrated |

## Last-Resort-Exceptions

- **Rebuttal #1: "Delete phenotype-org-audits now."** Rebutted: phenotype-org-audits is the canonical org-wide audit hub with the authoritative 165-repo inventory (inventory/AUTHORITATIVE_REPO_INVENTORY.md) and V3 scorecard (metrics/COVERAGE_V3.md). Deletion would lose the longitudinal audit history, systemic-issue tracking, and governance velocity metrics unique to the Phenotype ecosystem. **However**, no code has been migrated to phenotype-infra yet. The residual gap is that the inventory must be pattern-absorbed into phenotype-infra before the repo can be archived. **Cannot absorb** without establishing a governance-docs landing path in phenotype-infra first.

- **Rebuttal #2: "phenotype-org-audits is unmaintained."** Rebutted: 19 remote branches and a `pushed_at` of 2026-06-27 indicate active development across chore branches, WIP items, and CI workflow hygiene. The repo has 54 closed/merged PRs and 8 active workflows. The residual gap is that the default branch shows governance activity but not code migration. **Cannot absorb** this rebuttal; archival-not-deletion is insufficient because the org needs the audit hub until its contents are migrated.

- **Rebuttal #3: "Merge into phenotype-infra."** Rebutted: partial pattern-absorption into `phenotype-infra` is the long-term goal, but phenotype-org-audits's governance surface (inventory, scorecard, audit snapshots) is tightly coupled to its role as the standalone org-audit hub. **Nonetheless**, the V3 scorecard and inventory are stabilization artifacts that can be mirrored. The residual gap is that the audit CI workflows (8 workflows, quarterly cron) must be consolidated into phenotype-infra's CI surface first. **Cannot absorb** the full repo until the CI consolidation is complete.

No exceptions to the AFFIRM verdict are granted.

## Restore-Command

```bash
# Live repo (active source): restore by re-cloning the upstream.
git clone --bare https://github.com/KooshaPari/phenotype-org-audits.git phenotype-org-audits.git

# Disaster-recovery posture:
gh api repos/KooshaPari/phenotype-org-audits            # confirm repo still exists (200 OK)
gh repo clone KooshaPari/phenotype-org-audits /tmp/phenotype-org-audits-migration

# SHA-256 bundle backup for archive integrity:
git -C C:\Users\koosh\phenotype-org-audits bundle create \
  /backup/phenotype-org-audits-$(date +%Y%m%d).bundle --all
sha256sum /backup/phenotype-org-audits-*.bundle > \
  /backup/phenotype-org-audits-shas.txt
```

**Restore prerequisites:** GitHub org read access for `KooshaPari/phenotype-org-audits`.
**Documented restore path:** `git clone --bare https://github.com/KooshaPari/phenotype-org-audits.git`.
**Bundle integrity:** SHA-256 checksum recorded at bundle time.

## Gate Tooling Reference

- `bin/repo-delete-gate.sh` — pre-delete gate
- `bin/repo-delete-gate.ps1` — Windows-runner twin
- `bin/repo-archive-gate.sh` — pre-archive gate
- `bin/repo-status-scan.py` — fleet-wide status scanner
- `bin/absorption-justification.py` — this orchestrator

## Authoritative Org ADRs (Upstream Cross-Reference)

- ADR-008 — consolidation over proliferation
- ADR-039 — monorepo preference for SDK-layer code
- ECO-022 — compute/infra subtree registry correction
- `docs/compute-infra-subtree.md` — cluster spine doc on origin/main
