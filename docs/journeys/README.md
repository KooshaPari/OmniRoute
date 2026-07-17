# Deterministic journey evidence

This directory introduces a validated contract for product-journey evidence. It does not claim that screenshots exist when CI cannot reproduce them.

## Layout

- `schema/journey.schema.json` — portable JSON Schema for authoring/tooling.
- `manifests/*.json` — one deterministic journey per file.
- `scripts/docs/validate-journey-manifests.mjs` — dependency-free repository/provenance validation.

## Validation

```sh
node scripts/docs/validate-journey-manifests.mjs
```

The validator checks required safety/accessibility fields, verifies that each manifest's route and test title exist in its cited Playwright test, and enforces immutable captured-evidence linkage. Captured and published entries must identify the exact source commit, workflow run, hosted artifact, retention timestamps, and SHA-256 digest for every declared journey-evidence file; that captured-file inventory must exactly match the manifest's planned journey-evidence inventory. A workflow artifact may also contain operational logs that are outside this journey-evidence inventory.

## Evidence lifecycle

- **blocked:** a precise technical blocker is recorded; artifact paths are planned only.
- **captured:** CI produced the artifacts at the linked source commit and redaction review passed; immutable workflow/artifact IDs and file digests are recorded.
- **published:** reviewed artifacts are linked from public documentation.

Never commit a hand-made or local screenshot as journey evidence. A capture must use the declared viewport, reduced motion, isolated fixture/network policy, and exact source commit.

Hosted CI artifacts expire at the recorded `expiresAt` time (14 days for the first smoke journey). Expiry does not invalidate the historical captured record: source/run/artifact identifiers, exact inventory, and digests remain provenance, but the manifest does not promise that an expired artifact remains downloadable.

## Redaction requirements

Captures must contain no API keys, authorization headers, tokens, cookies, secrets, personal data, private hostnames, or machine-specific paths. Declared selectors are masked before capture, deny-pattern scanning runs on textual artifacts, and human review remains mandatory before publication.

## Accessibility requirements

Every journey declares its applicable checks. The capture runner must force reduced motion and record results for document title, heading order, landmarks, visible focus, accessible names, contrast, and horizontal overflow as declared.

## First smoke journey

`anonymous-home-smoke` is grounded in `tests/e2e/journey-evidence-smoke.spec.ts`. Workflow run `29548404979` captured the exact `Welcome to argismonitor v4` heading, accessibility report, screenshot, and trace from source commit `038506cfcacd9cfa892a1da625a4f8558cd169e3`, without credentials and with local-only networking. The manifest records artifact `8394891335` and each file digest so later consumers can detect substitution or incomplete evidence.

Related: #344, #361, #362.
