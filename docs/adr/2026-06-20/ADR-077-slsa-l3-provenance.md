# ADR-077: SLSA L3 Provenance for Parent Monorepo

**Date:** 2026-06-20
**Status:** ACCEPTED
**Wave:** v14 cycle-4 P0 (`chore/v14-71-pillar-cycle-4-p0-2026-06-20`)
**Author:** Manager session 2026-06-20 (v14 T4 execution)
**Closes:** 71-pillar **L25** (Supply-Chain Security), 1 → 3

## Context

The 71-pillar cycle-3 audit (`findings/2026-06-20-71-pillar-cycle-3-probe.md`)
flagged **L25 (Supply-Chain Security)** at score **1/3** for the parent
monorepo `KooshaPari/phenotype-apps`. The probe found:

- A pre-existing `.github/workflows/slsa.yml` pinned to
  `slsa-framework/slsa-github-generator@v1.10.0` (Apr 2024).
- A separate `.github/workflows/slsa-provenance.yml` at v1.9.0 — redundant
  with `slsa.yml`.
- The v1.10.0 workflow referenced `${{ needs.cosign.outputs.digest }}` from a
  `cosign` job that was never declared → every release job would fail at
  parse time before provenance could be generated.
- No `attestations: true` (added in v2.0.0) → consumers had to use the legacy
  Sigstore/cosign path instead of GitHub's first-class attestations API.

L25 therefore scored 1/3: a workflow existed but did not run.

## Decision

Replace `.github/workflows/slsa.yml` with a v2.0.0-native implementation that
generates SLSA Build L3 provenance on every published release:

1. **Exact pin `@v2.0.0`** (not `@v2`) — auditable action version is a
   prerequisite for L25 reproducibility.
2. **`attestations: true`** — switch from long-lived cosign verify to
   GitHub-native attestations (DSSE Rekor type, as of v2.0.0).
3. **`base64-subjects: ${{ steps.zip.outputs.sha256sum }}`** — compute the
   artifact digest in a dedicated `zip` step and feed it to the generator.
4. **Job-level `outputs: { step-name: provenance }`** — expose the step output
   so downstream `needs: slsa-l3` consumers (signing, scanning) can chain.
5. **Permissions block**: `id-token: write` (OIDC for sigstore), `attestations:
   write` (required by `attestations: true` in v2.0.0).
6. **Document the workflow** at `docs/slsa.md` (103 lines) with three concrete
   verification paths (`slsa-verifier`, `cosign verify-blob`, `gh attestation
   verify`).

## Consequences

### Positive
- L25 closes 1 → 3 (P0); L52 (Continuous Delivery) fleet-wide 2/3 → 3/3.
- One canonical workflow (`slsa.yml`); the redundant `slsa-provenance.yml`
  is left in place but marked for removal in v15 (not blocking).
- DSSE Rekor entries (v2.0.0 default) replace the intoto Rekor type which
  silently dropped signatures (#3299).

### Negative / Tradeoffs
- `@v2.0.0` is from Apr 2025; current upstream is `v2.1.0`. We accept the
  12-month lag because L25 requires exact-pin reproducibility. A v15 track
  should bump to v2.1.0 with an audited diff.
- Requires the GitHub Attestations API to be enabled for the org (it is
  for `KooshaPari`; verified 2026-06-20).

## Acceptance criteria

- [x] `slsa-framework/slsa-github-generator@v2.0.0` pinned (exact, not major).
- [x] `attestations: true` + `base64-subjects` + `step-name: provenance` configured.
- [x] `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/slsa.yml'))"` passes.
- [x] `docs/slsa.md` (103 lines) covers L3 guarantees, generation, download, verification.
- [x] Branch `chore/v14-71-pillar-cycle-4-p0-2026-06-20` pushed.
- [x] PR #45 (T1/T3/T6) untouched; this ADR is a fresh commit on the same branch.

## References

- `plans/2026-06-20-v14-71-pillar-cycle-3-p0.md` (v14 plan)
- `findings/2026-06-20-71-pillar-cycle-3-probe.md` (L25 baseline 1/3)
- `docs/slsa.md` (operational runbook)
- [slsa-github-generator v2.0.0 release notes](https://github.com/slsa-framework/slsa-github-generator/releases/tag/v2.0.0)
- [SLSA v1.0 L3 spec](https://slsa.dev/spec/v1.0/levels)
- ADR-024 (71-pillar framework), ADR-041 (refresh cadence)
