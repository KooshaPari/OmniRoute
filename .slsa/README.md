# SLSA L3 Provenance

Provenance attestation is generated for every release using `slsa-github-generator` at L3 level (hardened runner, non-forgeable source).

## What's in `.slsa/provenance.intoto.jsonl`

- `buildType`: https://slsa.dev/container-building/v0.1 or https://github.com/slsa-framework/slsa-github-generator
- `builder`: github actions runner
- `invocation`: git ref + workflow run-id
- `materials`: git commit SHA + dependency lockfile

## Verify

```bash
slsa-verifier verify-artifact --provenance-path .slsa/provenance.intoto.jsonl <artifact>
```
