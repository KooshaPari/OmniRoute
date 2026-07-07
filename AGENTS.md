# Agent contract for the omniroute-monorepo

## Hard rules

1. **NO ESLint.** Lint with `oxlint`. Format with `oxfmt`.
2. **NO turborepo/nx.** pnpm workspaces + tsc project refs + tsgo.
3. **NO dependency drift.** Lock the toolchain in `package.json` engines, `rust-toolchain.toml`, `.nvmrc`.
4. **NO Svelte 4 patterns.** Runes only (`$state`, `$derived`, `$effect`, `$props`). No `writable()`.
5. **NO `any`.** Zod schemas are the source of truth; types derive from them.
6. **NO direct DB/HTTP in components.** Components call services; services call adapters.
7. **NO backwards-compat shims.** When replacing, replace fully. (Per CLAUDE.md upstream contract.)

## Commands

```bash
# Quality gates (run all)
pnpm lint && pnpm typecheck && pnpm test && pnpm size

# Workspace-scoped work
pnpm --filter web add zod@^4
pnpm --filter desktop add @tauri-apps/api@^2
pnpm --filter @omniroute/shared-types build

# Run any single app
pnpm --filter web dev
pnpm --filter desktop dev
```

## File layout rules

- **Shared types** — `packages/shared-types/src/zod/<entity>.ts` exports a Zod schema; re-exported from `packages/shared-types/src/index.ts`.
- **Hono routes** — `apps/web/src/lib/server/hono/routes/<resource>.ts` (mounted in `hooks.server.ts`).
- **SvelteKit routes** — `apps/web/src/routes/<path>/+page.svelte` + `+page.server.ts` as needed.
- **Tauri commands** — `apps/desktop/src-tauri/src/commands/<concern>.ts` + registered in `src-tauri/src/main.rs`.
- **Tests** mirror `apps/` and `packages/` paths: `apps/web/src/lib/foo.ts` → `apps/web/tests/unit/foo.test.ts`.

## Versioning

This monorepo tracks `OmniRoute v4.0`. The legacy Next.js + Electron stack is in the parent fork and remains as opt-in fallback for v4.0-beta → v4.1.
