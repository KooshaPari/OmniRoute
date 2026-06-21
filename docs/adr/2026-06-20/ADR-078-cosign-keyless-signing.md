# ADR-078 — Cosign Keyless Signing for Release Artifacts (L25 P0 closure)

**Date:** 2026-06-20
**Status:** ACCEPTED
**Wave:** v14 cycle-4 P0 (`chore/v14-71-pillar-cycle-4-p0-2026-06-20`)
**Decides:** parent monorepo release-signing policy

## Context

The 71-pillar audit cycle 3 (2026-06-20) scored **L25 (Supply-Chain
Security)** at **0/3** for the parent monorepo. SLSA L3 provenance
generation (v13 T4) shipped earlier this year, but the provenance is
**unsigned** — anyone with `gh release upload` access could replace a
release tarball without detection. This blocks NIST SSDF PW.4.4 and the
OpenSSF "Signed Releases" badge check (a hard gate for silver).

## Decision

The parent monorepo adopts **cosign keyless signing with GitHub OIDC** for
release artifacts, complementing the SLSA L3 GitHub Attestations already
shipped by `.github/workflows/slsa.yml`. The two mechanisms are
independent and close L25 together:

1. **`.github/workflows/slsa.yml`** (T4) — `slsa-framework/slsa-github-generator@v2.0.0`
   with `attestations: true` produces a **GitHub-native SLSA provenance
   attestation** for the monorepo source tarball. Pinned at v2.0.0 exactly
   per the L25 supply-chain-security requirement.
2. **`.github/workflows/supply-chain-signing.yml`** (T5) — triggers on
   `release: published`. Downloads `release.tar.gz` via
   `gh release download`, signs with
   `cosign sign-blob --output-signature release.sig --output-certificate release.pub`
   against the ephemeral OIDC key (Fulcio issues an X.509 cert bound to the
   workflow's `sub`), **self-verifies** the signature with `cosign verify-blob`
   (replay-protection in CI), then re-attaches `release.sig` + `release.pub`
   to the GitHub Release and persists them as a 90-day workflow artifact.
3. **`docs/cosign.md`** — documents cosign, keyless flow, the exact
   `cosign verify-blob --certificate-identity-regexp ... --certificate-oidc-issuer ...`
   command consumers must run, and how the OIDC `sub` becomes the cert's SAN.

The v14 cycle-4 architecture **separates** SLSA provenance (GitHub
Attestations, signed by GitHub) from artifact signing (cosign keyless,
signed by an ephemeral OIDC key). This is a deliberate departure from
the earlier "shared ephemeral key for both" plan: SLSA v1.0 recommends
GitHub Attestations for provenance, and keeping the channels independent
reduces the blast radius of a single-key compromise.

No long-lived signing key is generated or stored. The OIDC cert is valid
~10 minutes; replay protection is inherited from Rekor's append-only log.

## Consequences

**Positive:** L25 score 0 → 3 for the parent monorepo on cycle 5 probe;
NIST SSDF PW.4.4 + OpenSSF Signed-Releases checks both flip to PASS;
downstream SDK consumers gain an out-of-band integrity check (no shared
secret required); signature is non-replayable across repos or workflows
via `--certificate-identity-regexp`.

**Negative / Tradeoffs:** signing requires `release.tar.gz` to be uploaded
before the workflow runs (mitigated by `gh release upload --clobber`);
`id-token: write` permission is mandatory (admins who strip permissions
blocks silently break signing); Rekor outages do not block signing but
delay third-party verifiability (verifiers fall back to cert chain only).

**Carry-over to v15+:** vendor cosign signing to 5 fleet adopter repos
(`pheno`, `pheno-errors`, `pheno-flags`, `pheno-port-adapter`,
`pheno-tracing`); add a `cosign-verify` step to consumer SDK CI so PR-time
tampering is caught, not just release-time.

## Validation

| Check | Command | Result |
|-------|---------|--------|
| YAML valid | `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/supply-chain-signing.yml'))"` | PASS |
| YAML valid (slsa) | `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/slsa.yml'))"` | PASS |
| Branch pushed | `git push origin chore/v14-71-pillar-cycle-4-p0-2026-06-20` | PASS |

## Acceptance criteria

- [x] `.github/workflows/supply-chain-signing.yml` triggers on `release: published` and signs the release tarball via `cosign sign-blob --output-signature release.sig --output-certificate release.pub`
- [x] `.github/workflows/supply-chain-signing.yml` adds a `cosign verify-blob` self-check step (replay-protection in CI)
- [x] `.github/workflows/slsa.yml` uses `slsa-github-generator@v2.0.0` with `attestations: true` for SLSA L3 provenance (sibling signing mechanism, shipped by T4)
- [x] `docs/cosign.md` covers cosign, keyless flow, verify-blob recipe, OIDC identity, two-track architecture
- [x] This ADR created (`docs/adr/2026-06-20/ADR-078-cosign-keyless-signing.md`)
- [x] Branch updated and pushed; PR #45 commits untouched

## References

- `docs/cosign.md` · `docs/slsa.md` · ADR-024 (71-pillar audit framework, L25 definition)
- [Sigstore cosign](https://docs.sigstore.dev/cosign/overview/) · [Fulcio](https://docs.sigstore.dev/fulcio/overview) · [Rekor](https://docs.sigstore.dev/rekor/overview)
- NIST SSDF PW.4.4 · OpenSSF Best Practices badge "Signed Releases"
