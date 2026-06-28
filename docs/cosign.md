# Cosign Keyless Signing — Phenotype Fleet

<!-- v14 cycle-4 P0 T5 (L25 closure). Companion to ADR-078. -->

**Status:** ACTIVE (post v14 cycle-4 P0 T5)
**Last verified:** 2026-06-20
**Owner:** supply-chain circle
**Cosign version:** v2.4.x (installed via `sigstore/cosign-installer@v3.0.5`)
**Spec ref:** [Sigstore cosign](https://docs.sigstore.dev/cosign/overview/) · [Fulcio](https://docs.sigstore.dev/fulcio/overview) · [Rekor](https://docs.sigstore.dev/rekor/overview)

## What is cosign?

`cosign` is the Sigstore project's reference signing tool. For Phenotype's
release artifacts (tarballs attached to GitHub Releases), `cosign sign-blob`
signs the SHA-256 of the tarball and emits two files next to it:

- `release.sig` — the signature
- `release.pub` — the X.509 signing certificate (with the OIDC subject SAN)

## What is "keyless" signing?

A "keyless" signature is one in which the private signing key is **never
persisted**. The signing identity is bound to an OIDC token instead of a
long-lived public/private keypair.

The flow is:

1. **OIDC token issuance.** GitHub Actions, with `id-token: write`, mints a
   short-lived OIDC token (~10 min) bound to the workflow run:
   `repo:KooshaPari/phenotype-apps:ref:refs/tags/v14.0.0:workflow:.github/workflows/supply-chain-signing.yml`
2. **Cert issuance by Fulcio.** cosign exchanges the OIDC token at Fulcio
   for an X.509 cert. The OIDC subject becomes the cert's SAN.
3. **Ephemeral ECDSA key.** cosign generates an in-memory ECDSA-P256 key,
   signs the artifact, then discards the private half.
4. **Transparency log entry in Rekor.** The cert + signature + artifact
   digest are appended to Rekor — a public, append-only log. Silent key
   compromise becomes detectable.

**No secret to rotate, no KMS to provision, no key to leak.**

## How is the GitHub OIDC token used as the signing identity?

The OIDC token's `sub` claim carries the workflow's location. cosign passes
that `sub` to Fulcio, which embeds it in the issued cert's SAN field. A
verifier checking the signature must therefore:

1. Confirm the cert chains to the Fulcio root CA.
2. Confirm the cert's SAN matches the workflow identity the verifier trusts.
3. Confirm the cert's OIDC issuer is `https://token.actions.githubusercontent.com`.

If any check fails, verification fails. The signature cannot be replayed
against a different workflow or a different repository without detection.

## Verifying a signed release

After downloading `release.tar.gz`, `release.sig`, and `release.pub` from a
GitHub Release, verify with:

```bash
cosign verify-blob \
  --signature      release.sig \
  --certificate   release.pub \
  --certificate-identity-regexp 'https://github.com/KooshaPari/.*@refs/tags/.*' \
  --certificate-oidc-issuer     'https://token.actions.githubusercontent.com' \
  release.tar.gz
```

Expected output on success:

```
Verified OK
```

The two `--certificate-*` flags pin which workflow identity is acceptable:

- `--certificate-oidc-issuer` — must be GitHub's OIDC issuer. Constant and
  not impersonable by other CI systems.
- `--certificate-identity-regexp` — restricts to workflows under
  `KooshaPari/*` that fired on a tag ref. Tighten further for a specific
  repo: `'https://github.com/KooshaPari/phenotype-apps/.*@refs/tags/v.*'`.

## How is this wired in CI?

Two independent signing mechanisms cooperate to close L25:

| Workflow | Mechanism | Purpose |
|---|---|---|
| `.github/workflows/slsa.yml` | `slsa-framework/slsa-github-generator@v2.0.0` with `attestations: true` | Produces a **GitHub-native SLSA provenance attestation** for the monorepo source tarball. Pinned at v2.0.0 exactly (per L25 supply-chain-security requirement). |
| `.github/workflows/supply-chain-signing.yml` | cosign keyless signing via GitHub OIDC | Signs the **release artifact tarball** with an ephemeral Fulcio-issued cert. Includes a `cosign verify-blob` self-check (replay-protection in CI) before publishing `release.sig` + `release.pub` to the GitHub Release and as a 90-day workflow artifact. |

The two mechanisms are independent by design: SLSA v1.0 recommends GitHub
Attestations for provenance, while cosign keyless signing is a separate
channel for the release tarball's integrity. Together they close L25:
**provenance is signed by GitHub**, **the artifact is signed by an
ephemeral OIDC key**, and **neither requires a long-lived secret**.

## Threat model — what this closes

| Threat | Mitigation |
|---|---|
| Long-lived signing key leak | No long-lived key exists. OIDC cert valid for ~10 min. |
| Signature replay against a different artifact | Each artifact has a unique SHA-256 digest; signature is over the digest. |
| Cross-repo identity theft | `--certificate-identity-regexp` pins the workflow path. A leaked signature from another repo fails verification. |
| Compromised runner tampering with release | OIDC token only binds to the specific workflow run; a different process cannot mint an equivalent token. |

**Out of scope:** build-time supply-chain attacks (covered by `cargo deny`
+ `cargo audit` + SBOM diff per ADR-022); runner compromise during the
workflow run (would require SLSA L4 / hermetic builds); long-tail revocation
(Rekor is proof-of-publication at signing time).

## References

- ADR-078 — cosign keyless signing adoption (L25 P0 closure)
- [Sigstore cosign overview](https://docs.sigstore.dev/cosign/overview/)
- [Sigstore Fulcio](https://docs.sigstore.dev/fulcio/overview)
- [GitHub OIDC for cloud workloads](https://docs.github.com/en/actions/deployment/security-hardening-your-deployments/about-security-hardening-with-openid-connect)
- `.github/workflows/supply-chain-signing.yml` — signer
- `.github/workflows/slsa.yml` — verifier
