# PROPOSAL: spine charter block for phenotype-org-audits/README.md

Source: 02-ORG-AUDITS-PLAN.md (polyrepo root)
Author: parent agent audit, 2026-07-05
Status: PROPOSED -- parent will apply per controlled step

## Where it goes

Insert immediately AFTER the AI-DD-META block at the top of
`phenotype-org-audits/README.md`, BEFORE any other content.

## Exact text to insert

```markdown
---

## SPINE: phenotype-org-audits

**ROLE:** audit/inventory spine
**OWNS:**

- 165-repo master registry (`inventory/AUTHORITATIVE_REPO_INVENTORY.md`)
- Quarterly audit snapshots (`audits/<YYYY>/<YYYY-MM-DD>/`)
- Governance adoption metrics (`metrics/COVERAGE_V3.md`,
  `metrics/UPLIFT_REPORT.md`, `metrics/SYSTEMIC_ISSUES.md`)
- Cross-repo systemic-issue catalog
- GitHub remote inventory (`inventory/github_remote_inventory.md`)
- Deleted-traces catalog (`inventory/deleted_traces.md`)
  **DEPENDS-ON:**
- `phenotype-tooling` (aggregator; symlink to be vendored per
  risk R-1 in 02-ORG-AUDITS-PLAN.md)
- git, GitHub API (read-only)
- Local checkout of every catalogued repo (for audit snapshots)
  **DEPENDED-ON-BY:**
- substrate (consumes registry to build dispatch manifests)
- AgilePlus (consumes audit results for cockpit freshness)
- Human operator (governance decisions, portfolio strategy)
  **RELEASE-CADENCE:** quarterly; ad-hoc on demand
  **SUCCESS-METRIC:**
- Zero stale entries (every catalogued repo touched within 30 days)
- Every catalogued repo has a 30-day audit snapshot
- Governance adoption increases quarter-over-quarter (visible in
  `metrics/UPLIFT_REPORT.md`)

## How to read this repo

1. Start at `inventory/AUTHORITATIVE_REPO_INVENTORY.md` for the
   whole-org view.
2. Jump to the latest `audits/<YYYY>/<YYYY-MM-DD>/INDEX.md` for
   the current quarter's findings.
3. Use `metrics/SYSTEMIC_ISSUES.md` for the cross-repo patterns
   (not single-repo findings).
4. `inventory/deleted_traces.md` lists every repo that was
   archived or absorbed and the rationale; this is the audit
   trail for portfolio decisions.

## Spines registry

`spines/REGISTRY.md` (to be created) is the phone book of all
seven polyrepo spines with their charter one-liners. Every spine
contributes a one-liner here.

---
```

## Verification

After insertion:

```
grep -c 'SPINE: phenotype-org-audits' phenotype-org-audits/README.md
# expect: 1
```

## Push

Commit inside phenotype-org-audits:

```
cd phenotype-org-audits
git add README.md
git commit -m "chore: add spine charter (phenotype-org-audits, 2026-07-05)"
git push origin main
```

## Open follow-up

- Vendoring `tooling/aggregator/` (replacing the symlink) is a
  separate, larger PR. Defer until sponsor confirms; current
  symlink works for read-only audit use.
- `spines/REGISTRY.md` does not yet exist. The other six spines
  each need to contribute their charter one-liner; this is a
  cross-repo PR and is best done as a separate "polyrepo-spines-
  v1" coordinated PR.
