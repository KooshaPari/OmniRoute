# ADR-003: Automated Validation Strategy

**Status**: Accepted  
**Date**: 2026-04-04  
**Deciders**: Phenotype Core Team  
**Technical Story**: As a maintainer, I need automated validation of cross-registry links and spec compliance so that I can ensure documentation quality without manual checking.

---

## Context and Problem Statement

With multiple registries (PhenoSpecs, PhenoHandbook, HexaKit) and cross-registry links, manual validation is:

1. **Error-prone**: Humans miss broken links
2. **Slow**: Checking all links takes time
3. **Inconsistent**: Different people check differently
4. **Reactive**: Issues found after merge

We need automated validation that runs on every PR, ensuring:
- Links are valid (not 404)
- Schemas are correct (valid YAML/JSON)
- Traceability is complete (no orphans)
- Style is consistent (markdown linting)

### Constraints

- Must run on GitHub Actions (existing CI)
- Must not significantly slow PR checks (< 2 min target)
- Must work across repositories
- Must provide clear error messages
- Must be maintainable

### Forces

| Force | Description | Weight |
|-------|-------------|--------|
| Speed | Fast feedback for developers | High |
| Accuracy | Catch real issues, avoid false positives | High |
| Cross-Repo | Validate links between registries | High |
| Maintainability | Easy to update rules | Medium |
| Cost | Free or low-cost | Medium |

---

## Considered Options

### Option 1: Centralized Validation Service

**Description**: Single service that validates all registries

**Architecture**:
```
┌─────────────────────────────────────────┐
│  Validation Service                     │
│  - Polls all repos                      │
│  - Runs checks                          │
│  - Reports results                        │
└─────────────────────────────────────────┘
```

**Pros**:
- Unified configuration
- Shared caching
- Centralized reporting

**Cons**:
- Single point of failure
- Requires hosting
- Complex cross-repo authentication
- High maintenance burden

### Option 2: Distributed Per-Repo Validation

**Description**: Each repo validates itself independently

**Architecture**:
```
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│ PhenoSpecs   │  │ PhenoHandbook│  │   HexaKit   │
│ CI Workflow  │  │ CI Workflow  │  │ CI Workflow │
└──────────────┘  └──────────────┘  └──────────────┘
```

**Pros**:
- Simple per-repo setup
- No cross-repo coordination
- Fast

**Cons**:
- Cannot validate cross-repo links
- Duplicate configuration
- Inconsistent rules

### Option 3: Hub-Triggered Validation (Selected)

**Description**: phenotype-registry CI triggers validation workflows in spokes

**Architecture**:
```
┌─────────────────────────────────────────────────────────────┐
│                   phenotype-registry                         │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  CI Workflow (on PR to phenotype-registry)          │   │
│  │  - Checkout all spokes                             │   │
│  │  - Run cross-repo link validation                  │   │
│  │  - Report aggregated results                       │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                              │
          ┌───────────────────┼───────────────────┐
          ▼                   ▼                   ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│   PhenoSpecs    │  │  PhenoHandbook  │  │    HexaKit      │
│ (local checkout)│  │ (local checkout)│  │ (local checkout)│
└─────────────────┘  └─────────────────┘  └─────────────────┘
```

**Pros**:
- Cross-repo validation possible
- Single configuration in hub
- Can aggregate results

**Cons**:
- Requires cloning multiple repos
- Slightly slower

### Option 4: Event-Driven Validation

**Description**: Webhooks trigger validation on any registry change

**Architecture**:
```
┌──────────────┐     ┌──────────────┐
│  PhenoSpecs  │────▶│   Webhook    │
└──────────────┘     │   Handler    │
                     │              │
┌──────────────┐     │  Triggers    │
│ PhenoHandbook│────▶│  Validation  │
└──────────────┘     └──────────────┘
```

**Pros**:
- Real-time validation
- Event-driven efficiency

**Cons**:
- Requires webhook infrastructure
- Complex error handling
- Harder to debug

### Option 5: Scheduled + PR Validation Hybrid (Selected)

**Description**: PR validation for immediate feedback + scheduled runs for consistency

**Architecture**:
```
┌─────────────────────────────────────────────────────────────┐
│                   PR Validation (Fast)                       │
│  - Schema validation                                          │
│  - Internal link checking                                     │
│  - Format checking                                            │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              Scheduled Validation (Thorough)                 │
│  - Cross-repo link checking                                   │
│  - Orphan detection                                           │
│  - Coverage reporting                                         │
└─────────────────────────────────────────────────────────────┘
```

**Pros**:
- Fast feedback on PRs
- Thorough checks scheduled
- Cost-effective
- Simple implementation

**Cons**:
- Cross-repo issues found after merge (mitigated by scheduled runs)

---

## Decision Outcome

**Chosen**: Option 5 (Scheduled + PR Validation Hybrid)

### Validation Pipeline

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    VALIDATION PIPELINE                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  PR VALIDATION (Per Repository)                                             │
│  ══════════════════════════════                                             │
│                                                                             │
│  ┌─────────────┐   ┌─────────────┐   ┌─────────────┐   ┌─────────────┐  │
│  │  Checkout   │──▶│ Schema      │──▶│ Link Check  │──▶│ Format      │  │
│  │  Code       │   │ Validate    │   │ (Internal)  │   │ Lint        │  │
│  └─────────────┘   └─────────────┘   └─────────────┘   └─────────────┘  │
│       ~5s              ~10s              ~15s             ~10s          │
│                                                                             │
│  Total: ~40 seconds per PR                                                  │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  CROSS-REPO VALIDATION (phenotype-registry)                                 │
│  ═════════════════════════════════════════                                  │
│                                                                             │
│  ┌─────────────┐   ┌─────────────┐   ┌─────────────┐   ┌─────────────┐  │
│  │ Checkout    │──▶│ Cross-Link  │──▶│ Orphan      │──▶│ Coverage    │  │
│  │ All Spokes  │   │ Validate    │   │ Detect      │   │ Report      │  │
│  └─────────────┘   └─────────────┘   └─────────────┘   └─────────────┘  │
│       ~10s             ~30s              ~20s             ~10s           │
│                                                                             │
│  Total: ~70 seconds per run                                                 │
│                                                                             │
│  Trigger: Schedule (daily) + Manual (on-demand)                            │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Validation Checklist

| Check | Tool | Applies To | Frequency |
|-------|------|------------|-----------|
| YAML/JSON Schema | ajv, yamllint | All registries | PR |
| Markdown Lint | markdownlint | All registries | PR |
| Spell Check | cspell | All registries | PR |
| Internal Links | lychee | All registries | PR |
| Cross-Registry Links | Custom | phenotype-registry | Schedule |
| Orphan Detection | Custom | phenotype-registry | Schedule |
| Trace Coverage | Custom | phenotype-registry | Schedule |

### Positive Consequences

- Fast PR feedback (< 1 minute for per-repo checks)
- Thorough cross-repo validation (daily)
- Clear error messages with file:line references
- Low maintenance (standard tools)

### Negative Consequences

- Cross-repo issues may be found post-merge (mitigated by daily runs)
- Requires keeping validation rules in sync across repos
- Scheduled runs may fail without immediate notification

### Mitigation Strategies

| Risk | Mitigation |
|------|------------|
| Post-merge issues | Daily scheduled runs + notifications |
| Rule drift | Shared GitHub Actions composite actions |
| Silent failures | Slack/Discord notifications on failure |

---

## Implementation

### Phase 1: Per-Repo Validation (Complete)

Each registry has:
- [x] YAML/JSON schema validation
- [x] Markdown linting
- [x] Internal link checking
- [x] Spell checking

### Phase 2: phenotype-registry Validation (In Progress)

- [x] Cross-repo link validation script
- [ ] Orphan detection
- [ ] Coverage reporting
- [ ] Scheduled workflow

### Phase 3: Shared Actions (Planned)

- [ ] Composite actions for reuse
- [ ] Centralized configuration
- [ ] Template repositories

---

## Validation Tools Reference

### Schema Validation

```yaml
# .github/workflows/validate.yml
name: Validate

on:
  pull_request:
    branches: [main]

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Validate YAML
        run: |
          yamllint .
      
      - name: Validate JSON
        run: |
          for f in $(find . -name "*.json"); do
            jq empty "$f" || exit 1
          done
      
      - name: Validate Specs
        run: |
          npx ajv-cli validate -s schemas/spec.json -d specs/**/*.yaml
```

### Link Checking

```yaml
      - name: Check Links
        uses: lycheeverse/lychee-action@v1
        with:
          args: --base . --exclude-all-private .
```

### Cross-Registry Validation

```yaml
      - name: Checkout Spokes
        run: |
          git clone https://github.com/KooshaPari/PhenoSpecs.git /tmp/phenospecs
          git clone https://github.com/KooshaPari/PhenoHandbook.git /tmp/phenohandbook
          git clone https://github.com/KooshaPari/HexaKit.git /tmp/hexakit
      
      - name: Validate Cross-Links
        run: |
          python scripts/validate_cross_links.py \
            --specs /tmp/phenospecs \
            --handbook /tmp/phenohandbook \
            --hexakit /tmp/hexakit
```

---

## Links

- Parent ADR: ADR-001 (Multi-Registry Architecture)
- Related ADR: ADR-002 (Traceability-First Documentation)
- GitHub Actions: https://docs.github.com/actions
- yamllint: https://yamllint.readthedocs.io/
- lychee: https://github.com/lycheeverse/lychee

---

## Notes

### Performance Targets

| Check Type | Target Duration | Maximum Duration |
|------------|-----------------|------------------|
| Schema validation | 10s | 30s |
| Link checking | 20s | 60s |
| Cross-repo validation | 60s | 120s |
| Total PR checks | 40s | 90s |

### Error Message Format

All validation errors should follow:
```
<level>: <file>:<line>:<col>: <message>

Example:
ERROR: specs/auth/oauth.yaml:42:5: Missing required field 'status'
WARNING: README.md:10: 'teh' -> possible typo of 'the'
```

### Notification Strategy

| Event | Channel | Recipients |
|-------|---------|------------|
| PR validation failure | PR comment | Author, reviewers |
| Scheduled validation failure | Slack #phenotype-alerts | Maintainers |
| Coverage below threshold | Weekly email | Team leads |
