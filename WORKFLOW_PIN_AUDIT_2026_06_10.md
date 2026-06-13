# Workflow SHA Pin Audit - 2026-06-10

Scope: focus repo `FocalPoint`.

Method:

```bash
grep -rE "^[[:space:]]*uses:[[:space:]]*[^[:space:]#]+" FocalPoint/.github/workflows
```

Classification:
- `SHA-pinned`: ref is a 40-character commit SHA.
- `TAG-ONLY`: ref is a tag or moving named ref, not a commit SHA.
- `No uses entries`: workflow file has no matching `uses:` lines.

## FocalPoint

### Summary

- Workflow files audited: 6
- `uses:` refs found: 7
- SHA-pinned refs: 4
- Tag-only refs flagged: 3

### Per-workflow refs

| Workflow | Uses ref | Classification | Notes |
| --- | --- | --- | --- |
| `cargo-audit.yml` | _none_ | No uses entries | No matching `uses:` refs |
| `cargo-deny.yml` | `actions/checkout@df4cb1c069e1874edd31b4311f1884172cec0e10` | SHA-pinned | Comment: `# v4` |
| `cargo-deny.yml` | `dtolnay/rust-toolchain@stable` | TAG-ONLY | Flag: moving named ref |
| `cargo-deny.yml` | `EmbarkStudios/cargo-deny-action@91bf2b620e09e18d6eb78b92e7861937469acedb` | SHA-pinned | Comment: `# v6` |
| `ci.yml` | _none_ | No uses entries | No matching `uses:` refs |
| `journey-gate.yml` | `actions/checkout@df4cb1c069e1874edd31b4311f1884172cec0e10` | SHA-pinned | Comment: `# v4` |
| `scorecard.yml` | `actions/checkout@df4cb1c069e1874edd31b4311f1884172cec0e10` | SHA-pinned | Comment: `# v4` |
| `scorecard.yml` | `ossf/scorecard-action@v2.4.4` | TAG-ONLY | Flag: tag ref |
| `scorecard.yml` | `github/codeql-action/upload-sarif@v3` | TAG-ONLY | Flag: tag ref |
| `trufflehog.yml` | _none_ | No uses entries | No matching `uses:` refs |

### Tag-only refs requiring SHA pinning

| Workflow | Ref |
| --- | --- |
| `cargo-deny.yml` | `dtolnay/rust-toolchain@stable` |
| `scorecard.yml` | `ossf/scorecard-action@v2.4.4` |
| `scorecard.yml` | `github/codeql-action/upload-sarif@v3` |
