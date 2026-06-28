# SBOM Convention (Pillar L29, v26 T1)

This convention defines how every fleet release MUST emit and verify a CycloneDX SBOM.

## Why L29 is P1

A Software Bill of Materials is the audit trail for every artifact we ship.
Without diff verification between releases:

- A supply-chain compromise adds a malicious package → undetected
- A regression drops a critical dependency → undetected
- A license changes from MIT to GPL → undetected

`tools/sbom-diff/sbom_diff.py` catches all three.

## SBOM format (CycloneDX 1.5 JSON)

Required fields per component:

| Field | Type | Example |
|---|---|---|
| `purl` | string | `pkg:cargo/serde@1.0.0` |
| `name` | string | `serde` |
| `version` | string | `1.0.0` |
| `licenses[0].license.id` | SPDX | `MIT` |
| `type` | enum | `library`, `application`, `framework` |

## Release pipeline

Every release workflow MUST:

1. Generate SBOM at `dist/<crate>-<version>.cdx.json` using `cargo-cyclonedx` (Rust)
   or `cyclonedx-bom` (Python) or `cyclonedx-nodejs` (TypeScript).
2. Upload the SBOM as a workflow artifact (retention: 365 days).
3. Run `tools/sbom-diff/sbom_diff.py --base <previous-release>.cdx.json --target <this-release>.cdx.json`.
4. Fail the release if `--strict` mode rejects any new package, removed
   package, or downgrade.

## Release workflow template

```yaml
- name: Generate SBOM
  run: |
    cargo cyclonedx --format json --override-filename ${{ github.event.repository.name }}-${{ github.ref_name }}

- name: Diff against previous release
  run: |
    python3 tools/sbom-diff/sbom_diff.py \
      --base dist/previous.cdx.json \
      --target dist/${{ github.event.repository.name }}-${{ github.ref_name }}.cdx.json \
      --output dist/sbom-diff.json \
      --strict

- name: Upload artifacts
  uses: actions/upload-artifact@v4
  with:
    name: sbom-${{ github.run_id }}
    path: dist/
    retention-days: 365
```

## Failure policy

- **added** (new package in target): MUST be reviewed in PR. If
  unintended, fail CI. If intended, document in commit body.
- **removed** (package dropped): MUST be reviewed. If unintended, fail
  CI. If intended, document.
- **upgraded** (version bump): Allowed by default. Audit advisories
  separately (cargo audit, npm audit, pip-audit).
- **downgraded** (version rollback): Always fail CI unless explicitly
  justified (security response).
- **license_changes** (SPDX changed): MUST be reviewed. GPL/AGPL
  additions require legal sign-off.

## Adoption (week-by-week)

- **Week 1**: pilot 3 repos (pheno-tracing, PhenoCompose, OmniRoute) —
  add to release.yml, verify output
- **Week 2**: roll to all `pheno-*` substrates (16 repos)
- **Week 3**: roll to all app-level repos (40 repos)
- **Week 4**: roll to remaining 60 repos

## See also

- `tools/sbom-diff/sbom_diff.py` — diff implementation
- `.github/workflows/release-sbom-diff.yml` — release-time gate
- ADR-029 (SBOM canonical model)
- ADR-096 (supply-chain assurance)

Refs: v26 T1, 71-pillar L29, ADR-029, cycle-16 P0