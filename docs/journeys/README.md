# Deterministic journey evidence

Journey manifests bind reproducible product journeys to immutable GitHub Actions artifacts.
They do not treat a local or hand-made screenshot as evidence.

## Layout and validation

- `schema/journey.schema.json` defines the portable authoring contract.
- `manifests/*.json` records one deterministic journey per file.
- `scripts/docs/validate-journey-manifests.mjs` verifies repository and capture provenance.
- `tests/e2e/journey-evidence-landing.spec.ts` creates the current-main capture.

Run the repository validator and focused regression suite:

```sh
node scripts/docs/validate-journey-manifests.mjs
node --import tsx --test tests/unit/journey-manifest-provenance.test.ts
```

`blocked` manifests describe a precise blocker and have no capture linkage. `captured`
manifests identify an exact source commit, workflow run, hosted artifact, retention interval,
and SHA-256 digest for every declared file. The declared artifact inventory must match the
captured-file inventory exactly.

The capture runner uses a fixed viewport, reduced motion, local-only networking, no secrets,
axe analysis, keyboard-focus verification, and explicit redaction scanning. Hosted artifacts
may expire; immutable identifiers and digests remain the historical provenance record.

Related: #394.
