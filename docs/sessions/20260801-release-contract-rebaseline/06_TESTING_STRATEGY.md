# Testing Strategy

## Focused suite

`tests/unit/docs-sync-contract.test.ts` is concern-based and covers:

1. valid release and generated-mirror tolerance;
2. release/mirror scope isolation;
3. package/OpenAPI/changelog identity and semver drift;
4. locale presence and JSON validity;
5. manifest schema and ADR policy;
6. lexical and realpath path traversal;
7. strict CLI parsing and product selection;
8. declared-only package semantics;
9. required versus optional i18n state.

## Commands

```sh
node --import tsx --test tests/unit/docs-sync-contract.test.ts
npm run check:docs-sync
npm run check:test-discovery
npm run check:docs-all
node --check scripts/check/check-docs-sync.mjs
```

## Evidence matrix

| Gate           | Scope                | Expected                           |
| -------------- | -------------------- | ---------------------------------- |
| direct checker | all                  | exit 0 + product/version output    |
| direct checker | release              | exit 0 without locale files        |
| direct checker | mirrors              | exit 0 with all 42 locale files    |
| focused test   | contract concern     | all tests pass                     |
| discovery      | canonical `.test.ts` | test is collected                  |
| docs-all       | repository docs      | no regression attributable to lane |

## Current results

- `node --check scripts/check/check-docs-sync.mjs`: **pass**.
- Direct checker `all`, `release`, and `mirrors`: **pass** (42 locales).
- Focused contract suite: **11/11 pass**.
- Prettier check for all lane files: **pass**.
- `check:test-discovery`: **fail**, 37 pre-existing current-main drift/orphan
  findings; this canonical test is collected.
- `check:env-doc-sync`: **fail**, one unrelated missing `.env.example` variable.
- `check:docs-all`: blocked after the env-doc gate for the same baseline issue.
