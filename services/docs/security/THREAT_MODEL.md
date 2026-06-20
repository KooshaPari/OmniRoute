---
title: "Threat Model"
version: 0.1.0
lastUpdated: 2026-06-16
---

# Threat Model

> **Source of truth:** services (CycloneDX SBOM registry for fleet third-party services)
> **Scope:** SBOM generation, registry storage, attestation, integrity verification, supply-chain disclosure

## Assets

1. **CycloneDX SBOM files** — JSON / XML documents emitted per release for every service consumed by the Phenotype fleet. Integrity (signed + hash-pinned) is critical: a tampered SBOM could under-report vulnerable dependencies.
2. **Service registry metadata** — Catalog of service names, versions, owners, and PURL/SPDX identifiers that map SBOMs to actual deployments. If an adversary can rewrite the registry, they can route the fleet to a malicious version of a "trusted" service.
3. **CI pipeline artifacts** — Build outputs (CycloneDX tool binaries, signing keys, attestation receipts) emitted by `.github/workflows/`. If mutable by an adversary, can be used to forge SBOMs.
4. **Signing keys (cosign, sigstore, gitsign)** — Used to attest SBOMs and release provenance. Compromise of a key is a complete supply-chain break.
5. **PURL canonicalization inputs** — Package URLs that the registry normalizes for cross-indexing. If a normalization function has a parser bug, two distinct malicious packages can collide on the same PURL.

## Threats (STRIDE)

| Category | Threat | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| **Spoofing** | An adversary publishes a CycloneDX SBOM under the `KooshaPari/services` namespace that is indistinguishable from a legitimate one. | Medium | High | Sign all SBOMs with cosign using a Sigstore keyless flow (OIDC + GitHub Actions identity). Include the registry commit SHA in the SBOM provenance predicate. |
| **Tampering** | A SBOM stored in the registry is modified in-flight (cache, mirror, CDN) before being fetched by a downstream consumer. | Medium | High | All SBOMs are content-addressed by SHA-256. Registry API rejects any fetch whose hash doesn't match the registered hash. Consumers verify the hash before parsing. |
| **Repudiation** | A registry contributor publishes a SBOM and later denies doing so. | Low | Medium | All SBOM PRs are signed by the contributor's GitHub identity (gitsign). The PR commit is part of the audit trail in the GitHub UI. |
| **Information Disclosure** | SBOMs may contain PURLs that leak internal infrastructure (e.g., a `pkg:oci/registry.internal.example.com/*` for a private service). | Medium | Medium | Registry has a `redact-purls` field per service. Public-facing SBOMs use redacted PURLs (`pkg:generic/[redacted]`); private mirrors retain full PURLs. |
| **Denial of Service** | A malicious or malformed SBOM (deeply nested JSON, billion-laughs XML) causes the registry to OOM during parse. | Medium | Medium | SBOM parser enforces `max-depth=64`, `max-array-len=10000`, `max-string-len=1MB`. Parse failures return 422 + log the offending SBOM for review. |
| **Elevation of Privilege** | A consumer of the SBOM registry uses the SBOM to spawn a malicious process (e.g., via `osv-scanner --sbom=sbom.json --execute`). | Low | Critical | SBOMs are data-only artifacts. Documentation explicitly disclaims executable use. Registry CI includes a `safety-check` step that fails the build if any SBOM is referenced as an executable. |

## Residual Risk and Revision Cadence

The most material residual risk is **registry compromise followed by SBOM re-signing** — an attacker who controls the registry (or its CI signing key) can mint SBOMs that look valid. For a single-maintainer registry without hardware key (HSM/TPM) signing, the Sigstore keyless flow is the strongest available mitigation but trusts GitHub Actions identity, which is not absolute. The next highest residual is **downstream consumer trust** — if a consumer fetches a SBOM but does not verify the signed envelope, the SBOM is essentially untrusted data. This threat model should be revised quarterly (February, May, August, November) or whenever a new SBOM format (SPDX 3, CycloneDX 1.7) is adopted, or when the registry exposes a new public endpoint. The revision trigger is any PR that adds a new SBOM consumer, a new signing key, or a new public API.
