# 04_IMPLEMENTATION_STRATEGY

## Top-down

1. Root config: package.json + Cargo.toml + pnpm-workspace.yaml + tsconfig.base.json + oxlint.json.
2. `packages/shared-types` first (everything else imports from it).
3. `packages/sdk-js` next (consumes shared-types; lets apps/web type-check before storage lands).
4. `crates/gateway` (Rust kbridge client; consumed by apps/desktop).
5. `apps/desktop` (Tauri shell; thin wrapper around apps/web + gateway).
6. `apps/web` (SvelteKit + Hono routes; consumes shared-types + sdk-js).
7. `tools/scripts` (sync-env + parity + codegen).
8. `.github/workflows` (CI matrix; parity gate).

## Patterns

- **Components**: bits-ui primitives + Tailwind v4 utilities; never raw `<button class>` (use bits-ui Button).
- **State**: Svelte 5 runes for local; SvelteQuery for server.
- **Validation**: Zod at every boundary (request body, env, kbridge frame).
- **Errors**: AppError discriminated union everywhere; Hono HTTPException → AppError at the edge.
- **Persistence**: Drizzle ORM → SQLite (omnistorage crate in Rust backend; we read via Hono route).
- **Tests**: Vitest unit + Playwright e2e; parity test cross-validates Zod ↔ Rust.
