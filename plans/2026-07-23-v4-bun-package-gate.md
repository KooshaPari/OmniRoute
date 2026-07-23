# v4 Bun package gate (#392)

Root `package.json` workspaces remain npm-scoped (`open-sse` only) so Contract Tests /
legacy Next CI stay stable. Restored Bun apps are **independently gated**:

| Package | Install | Build / check | Workflow |
|---|---|---|---|
| `apps/web` | `bun install --frozen-lockfile` | `bun run build` + typecheck | `desktop-electrobun.yml` (web handoff) + local/web CI paths |
| `apps/bff` | `bun install --frozen-lockfile` | `bun run test` + `bun run typecheck` | Exercised via PR unit paths in `apps/bff/**` |
| `packages/api-contracts` | via `file:` from apps | `bun run typecheck` | Pulled in by app installs |
| `desktop-electrobun` | `bun install --ignore-scripts` | `electrobun build` | `.github/workflows/desktop-electrobun.yml` |

**Decision:** do **not** fold Bun apps into the root npm workspace until Contract Tests
and pack gates are rewritten for Bun. Until then, changing `apps/*` or
`packages/api-contracts` must keep each package's frozen lockfile green under its
own package manager.

This satisfies #392 acceptance: "Root build/release either includes the restored
Bun packages or documents an independently enforced package gate."
