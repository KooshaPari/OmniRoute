---
title: "SBOM + Supply Chain Attestation"
slug: 06-sbom-supply-chain
version: 1.0
audience: operators, security reviewers, downstream integrators
---

# 06 — SBOM + Supply Chain Attestation

This guide explains how OmniRoute ships, signs, and verifies Software Bills of
Materials (SBOMs) for every release. It is intended for operators who deploy
OmniRoute in regulated environments and for security reviewers who need to
confirm the provenance of a build.

## TL;DR

- Every release tag (`v*`) produces a CycloneDX 1.5 SBOM at
  `dist/sbom/omniroute-<version>.cdx.json`.
- The SBOM is signed with either **cosign keyless (Sigstore OIDC)** when
  available, or an **ephemeral ECDSA P-256** key as fallback (Windows runners).
- The signature envelope is at `dist/sbom/omniroute-<version>.cdx.json.sig`.
- An **in-toto attestation** link is at
  `dist/sbom/omniroute-<version>.cdx.json.att`.
- Operators can fetch the SBOM via `GET /api/v1/sbom?version=<v>`.
- Operators can upload-and-verify a SBOM via `POST /api/v1/sbom/verify`.
- License policy: see [§ License Allowlist](#license-allowlist) below.

## 1. Why a CycloneDX SBOM?

CycloneDX is the de-facto standard for application-level SBOMs
([OWASP CycloneDX](https://cyclonedx.org/)). It is JSON-first, schema-validated,
and supported by every major scanner (Grype, Trivy, Dependency-Track,
Sonatype IQ, etc.). We target **schema version 1.5** — the current
production-grade version at the time of writing.

The generated document includes:

- **Root component** with name, version, license, VCS reference.
- **Every npm dependency** declared in `package-lock.json` (direct + transitive),
  each with a `purl` identifier, license, sha-512 integrity hash, and registry
  reference.
- **Workspace component** for `@omniroute/open-sse` (the SSE sidecar).
- **Internal manifests** under `open-sse/translator/manifests/` (when present)
  enumerated as their own components.
- **Translator source files** under `open-sse/translator/` enumerated as
  `type: file` components with sha-512 hashes (capped at 500 files to keep
  the SBOM manageable).

## 2. Generation pipeline

The pipeline runs on every `v*` tag push (or via `workflow_dispatch`):

1. **Checkout** the release at the tag.
2. **Generate** the SBOM:
   ```bash
   node scripts/sbom/generate-sbom.mjs --out dist/sbom --version "$VERSION"
   ```
3. **Sign** the SBOM:
   ```bash
   node scripts/sbom/sign-release.mjs --sbom dist/sbom/omniroute-<v>.cdx.json
   ```
   - If `cosign` is available on the runner, the workflow additionally invokes
     `cosign sign-blob` for a Sigstore keyless signature (Fulcio + Rekor).
   - Otherwise the stdlib path generates an ephemeral key, persists the
     **public key** under `dist/sbom/keys/`, and writes the signature as
     `ES256` ECDSA over the canonical SHA-512 of the SBOM.
4. **Verify** locally as defence in depth:
   ```bash
   node scripts/sbom/verify-sbom.mjs --sbom dist/sbom/omniroute-<v>.cdx.json
   ```
5. **Upload** the SBOM, signature, attestation, and (in fallback mode) the
   public key as release assets.

## 3. Signature envelope format

The signature is a JSON envelope written next to the SBOM:

```json
{
  "version": "1.0",
  "alg": "ES256",
  "digestAlg": "SHA-512",
  "digest": "<sha512-hex>",
  "value": "<base64-signature>",
  "keyId": "sha256:<first-16-bytes-of-pubkey-sha256>",
  "publicKey": "<PEM SPKI>",
  "signedAt": "2026-06-25T00:00:00.000Z",
  "signer": { "subject": "...", "issuer": "..." },
  "payloadSha512": "<sha512-hex>"
}
```

Algorithms supported by the verifier (`src/lib/security/sbomLoader.ts`):

| `alg` value           | Curve / Hash        | Source                       |
|-----------------------|---------------------|------------------------------|
| `ES256`               | P-256 / SHA-256     | stdlib fallback (this PR)    |
| `ECDSA-P256-SHA512`   | P-256 / SHA-512     | manual production key        |
| `cosign-blob`         | depends on cosign   | Sigstore keyless + Rekor    |

A verifier MUST recompute the canonical SHA-512 of the SBOM (key-sorted JSON)
and compare it against `digest` AND `payloadSha512` before trusting the
signature. The signer is identified by the `publicKey` field (or the
`COSIGN_PUBLIC_KEY` env var when running under cosign).

## 4. In-toto attestation

The `.att` file is an [in-toto Statement v0.1](https://github.com/in-toto/docs/blob/main/in-toto-spec.md)
that links the SBOM subject to its signature. This is consumable by
[in-toto-gateway](https://github.com/in-toto/in-toto-golang) and the Sigstore
policy controller.

```json
{
  "_type": "https://in-toto.io/Statement/v0.1",
  "predicateType": "https://cyclonedx.org/bom",
  "subject": [{
    "name": "omniroute-3.8.37.cdx.json",
    "digest": { "sha512": "..." }
  }],
  "predicate": { "sbom": {...}, "signer": {...} },
  "signatures": [{ "keyid": "sha256:...", "sig": "..." }]
}
```

## 5. Verifying at runtime

Two opt-in mechanisms exist for verifying the SBOM at runtime:

### 5a. Startup check (default-off)

Set the environment variable:

```bash
SBOM_VERIFY_AT_STARTUP=true omniroute start
```

The server will, on boot, call `runStartupSbomCheck()` from
`src/lib/security/sbomLoader.ts`. The check:

1. Locates the current SBOM under `dist/sbom/`.
2. Loads the matching signature envelope.
3. Recomputes the canonical SHA-512 and verifies the signature.
4. Runs the default license-compliance policy (see §6).
5. Fails the boot if either check fails.

`SBOM_VERIFY_AT_STARTUP` is **false by default** — the rationale is to avoid
adding hundreds of milliseconds of boot time in dev environments where the
SBOM isn't on disk.

### 5b. HTTP API

The two API endpoints are:

#### `GET /api/v1/sbom?version=<v>&includeBom=<bool>`

Returns the SBOM for the requested version. By default
`NODE_ENV !== 'production'` is open; in production the endpoint requires
a bearer token in `OMNIROUTE_SBOM_API_TOKEN`.

```bash
curl -sS "http://localhost:20128/api/v1/sbom?version=3.8.37" \
  -H "Authorization: Bearer $OMNIROUTE_SBOM_API_TOKEN" | jq '.summary'
```

#### `POST /api/v1/sbom/verify`

Accepts either an in-line SBOM + signature, or paths to them on disk.

```bash
curl -sS -X POST http://localhost:20128/api/v1/sbom/verify \
  -H "Authorization: Bearer $OMNIROUTE_SBOM_API_TOKEN" \
  -H "content-type: application/json" \
  -d '{
    "sbomPath": "omniroute-3.8.37.cdx.json",
    "signaturePath": "omniroute-3.8.37.cdx.json.sig",
    "allowUnknown": false
  }' | jq '.ok'
```

Returns `{ ok: boolean, integrity: {...}, compliance: {...}, summary: {...} }`.
HTTP status: `200` on full pass, `422` on signature failure, `400` on bad
request, `401` on missing token, `503` on misconfiguration in production.

## 6. License policy

Default allowlist (allowed at runtime AND at release time):

```
MIT, Apache-2.0, BSD-2-Clause, BSD-3-Clause, ISC, MPL-2.0, CC0-1.0,
Unlicense, 0BSD, MIT-0, Zlib, BlueOak-1.0.0, Python-2.0, WTFPL,
AFL-3.0, BSL-1.0, EPL-2.0, OFL-1.1, PostgreSQL, Ruby, SAX-PD,
LGPL-2.1, LGPL-3.0, Artistic-2.0, CC-BY-4.0, CC-BY-3.0, CC-BY-SA-4.0
```

Default denylist (always rejected, even if added to the runtime allowlist):

```
GPL-1.0-only, GPL-1.0-or-later,
GPL-2.0-only, GPL-2.0-or-later,
GPL-3.0-only, GPL-3.0-or-later,
AGPL-1.0, AGPL-3.0, AGPL-3.0-only, AGPL-3.0-or-later,
SSPL-1.0, Commons-Clause
```

Components with `NOASSERTION` license or no license declaration at all are
reported as `license-unknown` violations. Pass `allowUnknown: true` to the
verifier to allow them through (advisory-only; not recommended for prod).

Policy violations are reported in the `compliance.violations[]` array. Each
entry includes `bom-ref`, `name`, `version`, `rule`, and `licenses[]`.

## 7. Updating the policy

To extend the allowlist (e.g. accepting a new permissive license):

1. Add the SPDX identifier to `DEFAULT_LICENSE_ALLOWLIST` in
   `src/lib/security/sbomLoader.ts`.
2. Mirror the change in `scripts/sbom/verify-sbom.mjs` and
   `scripts/sbom/generate-sbom.mjs`.
3. Update the table in this document.
4. Add a regression test under `tests/unit/security/`.

## 8. Windows compatibility

The scripts use only `node:crypto`, `node:fs`, `node:path`, and `node:os`.
No shell-specific tools, no POSIX-only calls. The cosign fallback in the
GitHub Actions workflow explicitly handles the `cosign` missing case.

## 9. CVE / vulnerability scanning

The SBOM is intentionally compatible with Grype, Trivy, Dependency-Track, and
the OWASP Dependency-Check. Run any of them against the SBOM:

```bash
grype sbom:dist/sbom/omniroute-3.8.37.cdx.json
trivy sbom dist/sbom/omniroute-3.8.37.cdx.json
```

Results can be uploaded to the GitHub Security tab via SARIF.

## 10. Related docs

- [docs/security/SUPPLY_CHAIN.md](./SUPPLY_CHAIN.md) — pipeline-level gates
  (osv, Trivy, Scorecard).
- [docs/security/COMPLIANCE.md](./COMPLIANCE.md) — SOC2 / ISO 27001 mapping.
- [docs/security/GUARDRAILS.md](./GUARDRAILS.md) — egress policy.
