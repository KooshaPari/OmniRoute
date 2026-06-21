---
name: Bug report
about: Report incorrect behavior or a false positive/negative in pheno-framework-lint
title: "[bug] "
labels: ["bug", "triage"]
assignees: []
---

## Summary

<!-- One-paragraph description of the bug. -->

## Reproduction

<!-- A minimal reproduction. For tier rules, the smallest possible repo
     layout that triggers the bug. -->

```text
# Example: pheno-*-lib with a domain/ dir passes the no-domain rule
pheno-foo/
├── pyproject.toml
└── src/
    └── domain/
        └── user.py
```

**Command run:**

```bash
pheno-framework-lint check --path /path/to/pheno-foo
```

**Expected output:**

```json
{ "violations": [{ "rule": "pheno-lib/no-domain", ... }] }
```

**Actual output:**

```json
<!-- paste actual JSON output here -->
```

## Environment

- `pheno-framework-lint` version: <!-- e.g. 0.1.0 -->
- Python version: <!-- e.g. 3.12.4 -->
- OS: <!-- macOS 14.4 / Ubuntu 22.04 / Windows 11 -->
- Install method: <!-- `pip install -e .[test]` / `pip install pheno-framework-lint` / source -->

## Tier of the repo being scanned

<!-- Which of the 4 substrate tiers does the repo under scan match?
     - [ ] pheno-*-lib
     - [ ] phenotype-*-sdk
     - [ ] phenotype-*-framework
     - [ ] federated-service
     - [ ] unknown -->

## Severity

<!-- How impactful is the bug?
     - [ ] Critical (incorrect PASS for a real violation)
     - [ ] High (incorrect FAIL for a clean repo)
     - [ ] Medium (cosmetic / output format / error message)
     - [ ] Low (typo / doc only) -->

## Logs

<!-- Paste the full CLI output (stdout + stderr). Wrap in ``` blocks. -->

## Additional context

<!-- Anything else that might help triage. -->
