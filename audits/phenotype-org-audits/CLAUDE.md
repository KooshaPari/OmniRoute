# phenotype-org-audits — CLAUDE.md

## Project Overview

- **Name**: phenotype-org-audits
- **Description**: Longitudinal audit-history repository for Phenotype organization
- **Location**: `/Users/kooshapari/CodeProjects/Phenotype/repos/phenotype-org-audits`
- **Purpose**: Archive quarterly scans, systemic issues, governance velocity metrics
- **Language Stack**: Markdown (audit reports) + shell/Rust (aggregator tooling)

## Audit Cadence

- **Schedule**: Quarterly (Q1: Jan 1, Q2: Apr 1, Q3: Jul 1, Q4: Oct 1 @ 9am ET)
- **Automation**: GitHub Actions workflow (`quarterly-audit.yml`)
- **Output**: `audits/<YYYY-MM-DD>/` directory with complete snapshot
- **Retention**: 4 quarters detailed, 1+ year archived

## Directory Structure

```
audits/<YYYY-MM-DD>/
├── INDEX.md                    # Master index
├── STATUS_AT_<date>.md         # Complete repo status
├── SYSTEMIC_ISSUES.md          # Cross-org issues
├── fr_scaffolding.md           # FR → test traceability
├── governance_adoption.md      # Policy/tooling coverage
├── full_dep_matrix.md          # Dependency snapshot
└── <repo-name>.md              # Per-repo summary

tooling/
└── aggregator/                 # Symlink to phenotype-tooling aggregator

CHANGELOG.md                    # Audit release notes
```

## Work Requirements

1. **Before adding audit data**: Consult AgilePlus for systemic-issue tracking
2. **When creating new audit**: Reference findings in SYSTEMIC_ISSUES.md to AgilePlus specs
3. **Before quarterly run**: Check `.github/workflows/quarterly-audit.yml` schedule against current date
4. **Post-audit**: Update CHANGELOG.md with key findings and trends

## Quality Standards

- All audit reports use UTF-8 encoding
- Markdown follows Vale + markdownlint standards
- Per-repo summaries include: LOC, test coverage %, governance compliance %
- Systemic issues include: root cause, impact estimate, recommended action
- Dependency snapshots include: version alignment gaps, security advisories

## Integration Points

- **AgilePlus**: Systemic issues → eco-NNN specs, governance gaps → policy updates
- **Worklogs**: Cross-project duplication findings → DUPLICATION.md
- **Test scaffolding**: FR traceability → test-first mandate validation
- **Dependency waves**: Version alignment snapshots → quarterly version-bump waves

## Governance Reference

See parent-level governance:
- Phenotype org: `/Users/kooshapari/CodeProjects/Phenotype/CLAUDE.md`
- Cross-repo reuse: Section "Phenotype Org Cross-Project Reuse Protocol"
- Scripting policy: `repos/docs/governance/scripting_policy.md`
