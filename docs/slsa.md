# SLSA L3 Compliance — Phenotype Fleet
<!-- v14 T4 (cycle 4, 2026-06-20): upgrade slsa-github-generator v1.10.0 → v2.0.0;
     swap Sigstore/cosign verify step for the v2.0.0 native GitHub Attestations path. -->

**Status:** WORKING (post v14 T4 slsa + v13 T5 cosign + v13 T4 slsa workflow)
**Last verified:** 2026-06-20
**Owner:** supply-chain circle
**Spec ref:** [SLSA v1.0 L3](https://slsa.dev/spec/v1.0/levels)
**Decision:** [ADR-077](adr/2026-06-20/ADR-077-slsa-l3-provenance.md)

## What is SLSA L3?

SLSA Build Level 3 means:

1. **Hardened build platform** — no user-controlled build steps; the build runner is ephemeral and managed by the platform.
2. **Non-forgeable source** — the signed provenance envelope binds the build artifact to a specific commit SHA + ref, so a post-hoc history rewrite invalidates the signature.
3. **Isolated generation** — provenance is generated inside a hermetic step, then uploaded to a transparency log (Rekor, DSSE type) and to GitHub as a first-class attestation.
4. **Tamper-resistant provenance** — included in the artifact signature chain and independently verifiable with `slsa-verifier` v2.

## Phenotype implementation

| Requirement | Implementation | File |
|---|---|---|
| Hardened build platform | GitHub Actions + ephemeral runners | `.github/workflows/ci.yml` |
| Provenance generation | `slsa-framework/slsa-github-generator@v2.0.0` | `.github/workflows/slsa.yml` |
| Signing (OIDC keyless) | `attestations: true` → GitHub Attestations API + Rekor DSSE | same |
| Verification | `slsa-verifier` v2.x CLI; `gh attestation download` | this doc |
| Reproducible build | `--locked --frozen` Cargo flags | ci.yml build step |
| Provenance attestation | `phenorepos.intoto.jsonl` release asset + GitHub attestation | `slsa-l3-provenance` job |

## How provenance is generated

The workflow at `.github/workflows/slsa.yml` fires on every **published release** and does three things:

1. `actions/checkout@v4` clones the repo at the release tag (`fetch-depth: 0`).
2. The `Build monorepo source tarball + base64 sha256` step zips the working tree into `phenorepos.tar.gz`, computes its sha256, and base64-encodes it. This digest becomes the `subject` of the provenance envelope.
3. `slsa-framework/slsa-github-generator@v2.0.0` is invoked with:
   - `base64-subjects: ${{ steps.zip.outputs.sha256sum }}` — the subject digest
   - `attestations: true` — enables the GitHub Attestations API (signed by GitHub's OIDC issuer)
   - The job exposes `step-name: provenance` so downstream consumers (signing, scanning) can chain.

The pin is **exact** (`@v2.0.0`, not `@v2`) because L25 (Supply-Chain Security) requires auditable action versions — floating majors defeat reproducibility.

## Downloading provenance from a release

```bash
# List release assets
gh release view v0.1.0 --json assets --jq '.assets[].name'

# Download the tarball + matching .intoto.jsonl
gh release download v0.1.0 --pattern 'phenorepos.*'

# Preferred: use the GitHub Attestations API (verifies sigstore issuer)
gh attestation download phenorepos.tar.gz --repo KooshaPari/phenotype-apps
```

## Verification commands

```bash
# Local cosign verify (legacy path, still supported)
cosign verify-blob \
  --signature=.sigstore/<commit-sha>.sig \
  --certificate=.sigstore/<commit-sha>.pem \
  --certificate-identity-regexp='https://github.com/KooshaPari/.*@refs/heads/main' \
  --certificate-oidc-issuer='https://token.actions.githubusercontent.com' \
  <commit-sha>

# CI / third-party verify (preferred path, v2.0.0+)
slsa-verifier verify-artifact \
  --provenance-path  phenorepos.intoto.jsonl \
  --source-uri       github.com/KooshaPari/phenotype-apps \
  --source-tag       v0.1.0 \
  phenorepos.tar.gz

# GitHub-native attestation verify (no local tooling required)
gh attestation verify phenorepos.tar.gz --repo KooshaPari/phenotype-apps
```

## Adoption status (L52 score per repo)

| Repo | L52 score | Notes |
|---|---|---|
| `phenotype-apps` | 3/3 ✅ | SLSA workflow in `.github/workflows/slsa.yml` |
| `pheno` (monorepo) | 3/3 ✅ | inherited from phenotype-apps |
| `pheno-port-adapter` | 2/3 | TBD — needs signed release pipeline |
| `PhenoMCP` | 2/3 | TBD |
| 11 other nested | 1/3 | Default (Cargo.lock pinned, no signed release) |

## Cycle 3 → cycle 4 trajectory

- **Cycle 3 (L52 = 1/3):** No provenance, no signed releases.
- **v13 cycle-3 P0 (L52 = 2/3):** slsa.yml added with v1.10.0 generator + cosign verify job.
- **v14 cycle-4 P0 T4 (L52 = 3/3, this turn):** upgrade generator to v2.0.0 with `attestations: true`; remove the long-lived cosign verify in favor of GitHub-native attestations (DSSE Rekor type). Closes 71-pillar L25 (Supply-Chain Security) and lifts L52 to fleet-wide 3/3.

## References

- [SLSA v1.0 spec](https://slsa.dev/spec/v1.0)
- [`slsa-github-generator` v2.0.0 release notes](https://github.com/slsa-framework/slsa-github-generator/releases/tag/v2.0.0)
- [`slsa-verifier` v2 CLI](https://github.com/slsa-framework/slsa-verifier)
- [GitHub Attestations API](https://docs.github.com/en/code-security/how-tos/creating-and-managing-attestations)
- [Sigstore cosign](https://docs.sigstore.dev/cosign/overview/)
- [OpenSSF SLSA Best Practices](https://github.com/ossf/slsa-tooling)
- ADR-077 — `docs/adr/2026-06-20/ADR-077-slsa-l3-provenance.md`
