---
name: Feature request
about: Propose a new rule, CLI subcommand, or tier for pheno-framework-lint
title: "[feat] "
labels: ["enhancement", "triage"]
assignees: []
---

## Summary

<!-- One-paragraph description of the proposed feature. -->

## Motivation

<!-- Why is this needed? What real-world situation does it unblock?
     Link to the relevant ADR (ADR-023, ADR-014, ADR-018, etc.) or pillar
     (L72, L73, L74) if applicable. -->

## Proposed Behavior

<!-- Describe the CLI surface, the rule code (e.g. `phenotype-framework/...`),
     the input that triggers it, and the expected output. -->

```bash
# Example CLI
pheno-framework-lint check --path /path/to/repo --tier phenotype-*-framework
```

```json
// Expected JSON output
{
  "rule": "phenotype-framework/new-rule",
  "severity": "warning",
  "message": "..."
}
```

## Alternatives Considered

<!-- What other approaches did you consider, and why is this one preferred? -->

## Tier(s) Affected

<!-- Which of the 4 substrate tiers does this rule apply to?
     - [ ] pheno-*-lib
     - [ ] phenotype-*-sdk
     - [ ] phenotype-*-framework
     - [ ] federated-service
     - [ ] all tiers
     - [ ] new tier (describe below) -->

## Backward Compatibility

<!-- Does this change the exit code, JSON schema, or CLI surface of an
     existing subcommand? If yes, how will existing users be migrated? -->

## Test Plan

<!-- Briefly describe the unit / smoke tests you would add. -->

## Additional context

<!-- Anything else (screenshots, links, prior art in other linters). -->
