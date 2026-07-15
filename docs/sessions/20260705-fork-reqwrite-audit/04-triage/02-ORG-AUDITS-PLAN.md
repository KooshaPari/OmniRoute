# phenotype-org-audits -- Spine Plan

## Decision: KEEP as the audit/inventory spine (do NOT fold into another repo)

The user wrote: "phenotype-org-audits -> one of the spine repos". Read literally
that could mean "make it a spine" or "fold it into a spine". The evidence
overwhelmingly supports the first reading.

## Why not fold

Survey of the existing spine candidates and their roles:

| Spine candidate | Role                                          | Can it absorb org-audits? |
|-----------------|-----------------------------------------------|---------------------------|
| substrate       | dispatch (3 drivers x 6 engines)              | No -- different concern   |
| AgilePlus       | control plane (cockpit)                       | No -- cockpit is per-task |
| Tracera         | trace (inferred)                               | No -- trace vs inventory  |
| pheno           | workspace umbrella                            | Possible but bloats pheno |
| phenotype-infra | infra workspace                                | No -- infra vs inventory  |
| phenotype-apps  | apps catalog (meta-portfolio)                  | No -- apps vs inventory   |

Folding org-audits into any of the above creates a new dependency that does
not exist today. org-audits is a CONSUMER of the polyrepo state, not a
PRODUCER of any runtime surface. The other spines do not need it.

## What phenotype-org-audits is, structurally

```
phenotype-org-audits/
  inventory/
    AUTHORITATIVE_REPO_INVENTORY.md    # 165-repo master registry
    github_remote_inventory.md         # GitHub API snapshot
    deleted_traces.md                  # 29 archived repos catalog
  metrics/
    COVERAGE_V3.md
    UPLIFT_REPORT.md
    SYSTEMIC_ISSUES.md
  audits/<YYYY-MM-DD>/                 # Timestamped audit snapshots
    INDEX.md
    STATUS_AT_<date>.md
    SYSTEMIC_ISSUES.md
    full_dep_matrix.md
    fr_scaffolding.md
    governance_adoption.md
    <repo-name>.md
  tooling/
    aggregator/                        # symlink to phenotype-tooling
    inventory-refresh.sh
    worklog-aggregator.sh
  CHANGELOG.md
```

It is the only repo in the polyrepo with the whole-org view. That is its
job; it cannot be replicated by any other spine without that spine also
becoming the whole-org view, which is a much bigger scope creep.

## Spine charter (to be added to README)

```
SPINE: phenotype-org-audits
ROLE: audit/inventory spine
OWNS: 165-repo master registry, quarterly audit snapshots, governance adoption
      metrics, longitudinal trend reports, cross-repo systemic-issue catalog.
DEPENDS-ON: phenotype-tooling (aggregator), git, GitHub API.
DEPENDED-ON-BY: substrate (consumes registry to build dispatch manifests),
                AgilePlus (consumes audit results for cockpit freshness),
                human operator (governance decisions).
RELEASE-CADENCE: quarterly; ad-hoc on demand.
SUCCESS-METRIC: zero stale entries; every catalogued repo has a 30-day audit
                snapshot; governance adoption increases quarter-over-quarter.
```

## Concrete actions

1. Add the spine charter block (above) to the top of phenotype-org-audits/README.md,
   above the AI-DD-META block.
2. Confirm the inventory-refresh.sh and worklog-aggregator.sh tooling still
   work (verify on a 5-repo dry run).
3. Move the existing audits/<YYYY-MM-DD>/ snapshots from a flat dir into
   audits/<YYYY>/<YYYY-MM-DD>/ so year-boundary navigation scales.
4. Add a spines/REGISTRY.md that lists all seven spines with their charter
   one-liners. This becomes the "phone book" of the polyrepo. The other spines
   should each add a similar block to their README.
5. Open an issue/PR against substrate and AgilePlus documenting the
   "consumes-registry" dependency so the dispatch and control planes can plan
   to query the registry at startup (rather than hardcoding their manifest).

## Risks

- If phenotype-tooling is itself archived or absorbed, the aggregator
  symlink breaks. Mitigate: replace the symlink with a vendored copy under
  tooling/aggregator/ (no symlink), so org-audits does not depend on
  phenotype-tooling's continued existence as a separate repo.
- 165 entries is approaching the scale where a real DB (SQLite) is easier
  than Markdown. Decision: stay on Markdown for the next 2 quarters;
  revisit if/when > 300 repos.
