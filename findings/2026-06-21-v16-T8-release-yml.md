# v16 Wave A — T8: release.yml per crate

**Date:** 2026-06-21
**Pillar:** L34 (Release Pipeline Quality)
**Wave:** v16 cycle 6 P0

## Why

v14 added SLSA + cosign at the monorepo level. v16 promotes those patterns to **per-crate release workflows** so each substrate crate can ship independently without a monorepo-wide release.

## Release workflow template

`/Users/kooshapari/CodeProjects/Phenotype/repos/.github/workflows/release.yml`:

```yaml
name: release
on:
  push:
    tags: ['v*']

permissions:
  contents: write
  id-token: write

jobs:
  release:
    strategy:
      matrix:
        crate:
          - pheno-flags
          - pheno-errors
          - pheno-port-adapter
          - pheno-tracing
          - pheno-otel
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: dtolnay/rust-toolchain@stable
      - name: package crate
        run: |
          cd ${{ matrix.crate }}
          cargo package --allow-dirty --no-verify
      - name: upload crate
        uses: actions/upload-artifact@v4
        with:
          name: ${{ matrix.crate }}-${{ github.ref_name }}
          path: ${{ matrix.crate }}/target/package/${{ matrix.crate }}-*.crate
      - name: SLSA provenance
        uses: slsa-framework/slsa-github-generator@v1.9.0
        with:
          base64-subjects: '${{ steps.upload.outputs.artifact-ids }}'
      - name: cosign sign
        uses: sigstore/cosign-installer@v3.0.5
        with:
          cosign-release: 'v2.2.3'
      - run: |
          cosign sign-blob --yes \
            --output-signature ${{ matrix.crate }}.sig \
            --output-certificate ${{ matrix.crate }}.pem \
            target/package/${{ matrix.crate }}-*.crate
      - uses: actions/upload-artifact@v4
        with:
          name: ${{ matrix.crate }}-signatures
          path: '*.sig *.pem'
```

## Acceptance

- [ ] `.github/workflows/release.yml` exists at monorepo root
- [ ] Triggered on tag push `v*`
- [ ] Matrix builds all 5 substrate crates
- [ ] Each crate gets SLSA provenance + cosign signature
- [ ] Signatures uploaded as artifacts (no registry push from CI)

## References

- ADR-049 (predictive DRY — release pipeline per crate, not per repo)
- SLSA L3: <https://slsa.dev>
- Cosign keyless: <https://docs.sigstore.dev/cosign/keyless/>
