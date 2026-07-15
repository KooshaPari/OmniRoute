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

The validator checks required safety/accessibility fields and verifies that each manifest's route and test title exist in its cited Playwright test.

## Evidence lifecycle

- **blocked:** a precise technical blocker is recorded; artifact paths are planned only.
- **captured:** CI produced the artifacts at the source commit and redaction review passed.
- **published:** reviewed artifacts are linked from public documentation.

Never commit a hand-made or local screenshot as journey evidence. A capture must use the declared viewport, reduced motion, isolated fixture/network policy, and exact source commit.

## Redaction requirements

Captures must contain no API keys, authorization headers, tokens, cookies, secrets, personal data, private hostnames, or machine-specific paths. Declared selectors are masked before capture, deny-pattern scanning runs on textual artifacts, and human review remains mandatory before publication.

## Accessibility requirements

Every journey declares its applicable checks. The capture runner must force reduced motion and record results for document title, heading order, landmarks, visible focus, accessible names, contrast, and horizontal overflow as declared.

## First smoke journey

`anonymous-home-smoke` is grounded in the existing `tests/e2e/smoke.spec.ts` root-route assertion. It is reproducible locally with the existing Playwright lifecycle, requires no credentials, and uses local-only networking.

Screenshot/trace capture remains **blocked**, honestly, because `playwright.config.ts` disables its `webServer` in CI and the repository does not yet provide a dedicated journey job that proves the v4 BFF/web preview lifecycle. The next PR may add artifact capture only after a CI run demonstrates that lifecycle without secrets or external providers.

Related: #322.
