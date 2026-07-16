# v4 documentation application scaffold

The rewritten v4 tree does not currently contain a routed docs application: `apps/web` has no `/docs` route and uses the SvelteKit Node adapter. Legacy root Fumadocs/Next configuration still exists, but its broad source glob includes unreviewed architecture, security, framework, and operations material and is not a safe public deployment input.

This zero-dependency scaffold establishes a deterministic public-docs build without copying that material.

## Build

```sh
node apps/docs/scripts/build.mjs
node apps/docs/scripts/build.mjs --check
```

Outputs are written to `apps/docs/dist/`:

- accessible static `index.html`
- `styles.css`
- machine-readable `search-index.json`
- deterministic `build-manifest.json` with the source digest and deployment-readiness flag

## Publication gate

Every section in `content/public-boundary.json` starts with `publishable: false`. The build manifest remains `deployable: false` until reviewed, source-backed content exists. The validation workflow uploads only a preview artifact; it does not configure or deploy GitHub Pages.

A later deployment PR may add Pages only after:

1. the identity/URL decisions tracked in #322 are approved;
2. at least one user-facing section has reviewed content and provenance;
3. link, accessibility, secret, and capability-drift gates exist;
4. repository Pages settings and base-path behavior are explicitly selected.

This scaffold deliberately avoids the three decision-input files in #324 and the journey schema paths in #325.
