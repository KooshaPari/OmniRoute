# TS7.1 Migration — Vendored typescript-go soft fork

## Why

Microsoft's TypeScript 7 split into two tracks:
- **TypeScript 6.x** — current stable, compiler API still public
- **TypeScript 7.x** — ported to Go (microsoft/typescript-go), npm package
  ships **CLI only** — `createSourceFile` / `factory` / `forEachChild` /
  `printNode` / `getPreEmitDiagnostics` are gone from the public API.

The Go rewrite (`tsgo`) tracks TS 7.1 milestone and is ~64% complete on its
[milestone-6 bug list](https://github.com/microsoft/typescript-go/milestone/6)
at time of vendoring. 9 known panics remain (checker.getTypeAtLocation,
LSP watcher, tsconfig edge cases).

## Decision: vendor microsoft/typescript-go

**Wait for Microsoft** → no ETA, indefinite blocker.

**Polyfill removed APIs** → unmaintainable fork, high cost, low value.

**Compile & use vendored typescript-go** → pragmatic:
- TS7.1 vendored as a Go binary at `vendor/typescript-go/tsgo`
- Run via `scripts/tsgo.sh` (drop-in for tsc)
- 5.8x faster typecheck (1.137s vs 6.590s on this codebase)
- Zero API change — it's just a better tsc for `--noEmit`
- Soft fork: weekly rebase via `pnpm run tsgo:build`

## Usage

```bash
# Build vendored tsgo (Go 1.23+)
pnpm run tsgo:build

# Run typecheck via vendored tsgo
pnpm run typecheck:ts7
pnpm run tsgo:check
pnpm run tsgo:check:all   # whole tsconfig.json

# Legacy tsc (TypeScript 6.0.3)
pnpm run typecheck:ts6
```

`scripts/tsgo.sh` is a thin wrapper:

```bash
#!/usr/bin/env bash
set -euo pipefail
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TSGO_BIN="${REPO_ROOT}/vendor/typescript-go/tsgo"
if [[ -x "${TSGO_BIN}" ]]; then
  exec "${TSGO_BIN}" "$@"
else
  echo "tsgo: vendored binary missing — falling back to tsc" >&2
  exec npx --no-install tsc "$@"
fi
```

## CI

`.github/workflows/typescript.yml` runs **both** lanes in parallel:
- `tsgo` — TS7.1 via vendored Go binary (32-40x potential speedup)
- `tsc` — TS6.0.3 via legacy npm (source-of-truth until tsgo milestone-6 → 100%)

Until tsgo hits 100% on its open panics, **tsc stays the gating check** and
tsgo runs in non-blocking `continue-on-error` mode.

## Rebuild cadence

```bash
# Weekly: pull latest microsoft/typescript-go main + rebuild
cd vendor/typescript-go && git pull origin main
pnpm run tsgo:build
pnpm run typecheck:ts7  # expect new panics until milestone 6 closes
```

## Migration when microsoft ships TS7 API

If/when Microsoft restores the compiler API (e.g., `@typescript/v7` scoped
package), swap `scripts/tsgo.sh` to call that instead. Zero code changes
needed — the codebase uses `tsc` only for `--noEmit`, which both APIs support.

## What's blocked

- `codeStripper.ts`, `retrieval.ts`, `qdrant.ts` (legacy facade) currently
  import `typescript@^6.0.3` directly for AST APIs.
- They do NOT use tsgo for analysis — the vendored binary is only used
  for typecheck, not for runtime AST manipulation.
- The compiler-adapter pattern from the previous proposal is still on the
  roadmap for those modules (separate effort).

## Open tracking

- GH #319 — TS7 + Bun migrations (updated with this approach)
