# Research

## Current-main facts

- `package.json` declares `@kooshapari/omniroute` version `3.8.49-koosha.0`.
- `docs/openapi.yaml` and the newest semver `CHANGELOG.md` heading declare the
  same version.
- `open-sse` and `electron` intentionally carry independent `3.8.43` versions;
  they are not declared release artifacts for this product release.
- `config/i18n.json` declares 42 locales and `src/i18n/messages/` contains all
  42 locale JSON files.

## Governing decision

ADR-0005 (`docs/adr/0005-i18n-gitignore-strategy.md`) marks `docs/i18n/` and
translation sidecars as generated, ignored output. The release gate therefore
checks configured locale source catalogs but does not require generated docs or
`.i18n-state.json` by default.

## Prior failure avoided

The earlier checker coupled the gate to optional generated mirrors and silently
accepted undeclared package drift. The new contract records exactly which files
are authoritative and validates only those paths.
