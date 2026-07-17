# phenoDesign absorption record

**Source**: `KooshaPari/phenoDesign` v1.0.1 (archived 2026-07-17)
**Target**: `KooshaPari/phenodocs` `packages/design/`
**Branch**: `absorb/phenoDesign-2026-07-17` on phenodocs
**Disposition**: fsm=absorbed, archived=true
**Discovered**: absorption candidate #7 of 10 (queue refresh 2026-07-17)

## Rationale

phenoDesign is the **canonical keycap-palette design tokens + VitePress
theme** package for the Phenotype ecosystem. phenodocs already had an
empty `packages/design/` stub (only `node_modules`) waiting for content.
The keycap-palette.css file in `phenodocs/.vitepress/theme/` was an
early snapshot — the new design package is the canonical home.

## Files transferred

| Source | Target |
|--------|--------|
| `src/index.ts` | `packages/design/src/index.ts` |
| `src/tokens.ts` | `packages/design/src/tokens.ts` |
| `src/vitepress.ts` | `packages/design/src/vitepress.ts` |
| `src/application/generator.ts` | `packages/design/src/application/generator.ts` |
| `src/application/__init__.ts` | `packages/design/src/application/__init__.ts` |
| `src/domain/types.ts` | `packages/design/src/domain/types.ts` |
| `css/keycap-palette.css` | `packages/design/css/keycap-palette.css` |
| `css/vitepress-theme.css` | `packages/design/css/vitepress-theme.css` |
| `css/components.css` | `packages/design/css/components.css` |

Plus a fresh `package.json` declaring the `@phenotype/design` workspace
package, and a `.gitignore` for build artifacts.

## Identity drift resolved

Originally npm scope `@kooshapari/design`, normalized to
`@phenotype/design` for the Phenotype org. The repo identity
`KooshaPari/phenoDesign` becomes an archive tombstone.

## Files NOT transferred

- `tests/` — phenoDesign's tests use vitest with bun. phenodocs uses
  vitest with bun too, but the tests import the package via
  `@kooshapari/design` (the old npm scope). They will be re-introduced
  in a follow-up commit after `@phenotype/design` is wired into the
  phenodocs workspace dependency graph.
- `docs/` — phenoDesign had its own VitePress docs site. phenodocs'
  own docs are the canonical surface.
- `dist/`, `node_modules/`, `bun.lock`, `package-lock.json` —
  build artifacts and lockfile for the now-archived repo.

## Verification

- `git status` shows 11 files added (10 content + 1 .gitignore)
- Package identity `@phenotype/design` preserved
- Workspace root already lists `packages/*` as workspaces

## Source repo archived

```
gh repo archive KooshaPari/phenoDesign -y
```

## Next steps

1. Update phenodocs root to import `@phenotype/design` as workspace dep
2. Migrate keycap-palette.css in `.vitepress/theme/` to re-export from
   the new design package
3. Re-introduce phenoDesign's tests under `packages/design/tests/`
4. Bump phenodocs to consume the new design package