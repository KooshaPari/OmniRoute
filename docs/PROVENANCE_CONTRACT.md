# Immutable Provenance Contract

This contract specifies the immutable metadata that accompanies every release
artifact. It is consumed by `scripts/sha-info.sh` and emitted to
`SHA.txt` in the release bundle.

## Identity fields (immutable)

| Field | Source | Example |
|---|---|---|
| `sha` | `git rev-parse HEAD` | `c2dd180f2a...` |
| `short_sha` | First 12 chars of sha | `c2dd180f2a` |
| `branch` | `git rev-parse --abbrev-ref HEAD` | `fix/stray-brace-mitm-manager` |
| `remote` | `git config --get remote.origin.url` | `git@github.com:kooshapari/omniroute.git` |
| `built_at` | UTC timestamp | `2026-07-28T12:34:56Z` |
| `node_version` | `node --version` | `v22.x` |
| `rust_version` | `rustc --version` | `rustc 1.x.x` |
| `pnpm_version` | `pnpm --version` | `9.x.x` |

## Identity fields (from `.fork-identity.json`)

| Field | Source | Example |
|---|---|---|
| `name` | `package.json#name` | `@kooshapari/omniroute` |
| `version` | `package.json#version` | `3.8.49-koosha.0` |
| `release_channel` | `package.json#releaseChannel` | `stable` |
| `fork_name` | `fork.identity.json#name` | `kooshapari/omniroute` |
| `upstream` | `fork.identity.json#upstream` | `omniroute/omniroute` |
| `fork_point` | `fork.identity.json#forkPoint` | `v3.8.43` |

## Toolchain fingerprint

| Field | Source | Example |
|---|---|---|
| `typescript` | `node_modules/typescript/package.json#version` | `6.0.3` |
| `vitest` | `node_modules/vitest/package.json#version` | `4.x` |
| `oxlint` | `node_modules/oxlint/package.json#version` | `1.x` |
| `oxfmt` | `node_modules/oxfmt/package.json#version` | `0.x` |
| `cargo` | `cargo --version` | `1.x` |
| `rustc` | `rustc --version` | `rustc 1.x` |

## Security fingerprint

| Field | Source | Example |
|---|---|---|
| `audit_baseline` | `.npm-audit-baseline.json#metadata.vulnerabilities.total` | `22` |
| `audit_production_clean` | `npm audit --omit=dev --audit-level=high` | `true` |

## Consumers

| Consumer | Reads |
|---|---|
| `scripts/sha-info.sh` | builds `SHA.txt` in release directory |
| `src/app/api/identity/route.ts` | exposes identity via `GET /api/identity` |
| `.fork-identity.json` | canonical identity SSOT |
| CI build | emits provenance as build artifact |
| Stakeholders (operators, auditors) | human-readable release identification |

## Immutability rules

1. `sha` is the git commit hash — immutable.
2. `short_sha` is derived — immutable.
3. `branch` is the branch at release time — frozen at tag.
4. `built_at` is the wall-clock at SHA.txt generation — never backdated.
5. `version` is `package.json#version` at release time — frozen at tag.
6. `fork_*` fields are derived from `.fork-identity.json` at release time — frozen at tag.
7. `*_version` fields are toolchain versions at release time — frozen at tag.

## Verification

To verify a release artifact against this contract:

```bash
git rev-parse HEAD           # → must match SHA.txt sha
cat .fork-identity.json     # → must match SHA.txt fork_*
node --version               # → must match SHA.txt node_version
npm audit --omit=dev        # → must match SHA.txt audit_production_clean
```
