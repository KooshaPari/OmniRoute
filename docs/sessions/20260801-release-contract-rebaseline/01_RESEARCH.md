# Research

## Current-main facts

- `package.json` declares `omniroute` version `3.8.38`.
- `docs/openapi.yaml` declares `3.8.38`. CHANGELOG retains the completed
  `3.8.45` release as its newest historical section while containing the
  manifest version `3.8.38` exactly once.
- Known subpackages carry independent `3.8.38` versions; they are not declared
  release artifacts for this product release.
- `config/i18n.json` declares 43 locales and `src/i18n/messages/` contains all
  43 locale JSON files.

## Governing decision

ADR-0005 (`docs/adr/0005-i18n-gitignore-strategy.md`) marks `docs/i18n/` and
translation sidecars as generated, ignored output. The release gate therefore
checks configured locale source catalogs but does not require generated docs or
`.i18n-state.json` by default.

## Prior failure avoided

The earlier checker coupled the gate to optional generated mirrors and silently
accepted undeclared package drift. The new contract records exactly which files
are authoritative and validates only those paths.
