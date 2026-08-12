# Contributing

This is the argismonitor v4 monorepo (formerly OmniRoute). Read `AGENTS.md` for the contract.

## TL;DR

```bash
pnpm install
cp .env.example .env
pnpm dev           # gateway + web + desktop (concurrently)
pnpm test
pnpm parity
pnpm tauri:dev     # desktop only
```

## PRs

- One concern per PR.
- Conventional commits: `feat:`, `fix:`, `chore:`, `refactor:`, `test:`, `docs:`, `perf:`.
- Run `pnpm lint && pnpm typecheck && pnpm test` before pushing.
- Add a CHANGELOG.md entry for user-visible changes.

## Stack rules

- Svelte 5 runes only.
- Zod 4.4 schemas only; types via `z.infer<typeof Schema>`.
- oxlint + oxfmt, never ESLint.
- tsgo for project-ref builds.
- Tauri 2 native APIs only.
