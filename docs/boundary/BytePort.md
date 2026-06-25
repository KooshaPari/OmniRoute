---
repo: "BytePort"
role: product
status: active
last_boundary_review: 2026-06-23
review_cadence: 30d
in_scope:
  - Tauri 2.x desktop application (Rust + SvelteKit frontend)
  - Pure-Rust S3 presigner crate (`crates/byteport-transport/`)
  - Go 1.25 backend (`backend/`) — healthz + presign endpoints
  - Astro docs frontend (marketing site)
  - Tightly-scoped asset protocol (Tauri-side, only APPDATA scopes)
out_of_scope:
  - Multi-cloud transport abstraction (lives in `pheno-transport`)
  - MCP server (lives in `PhenoMCPServers`)
  - Native sandboxing (lives in `nanovms`)
  - The desktop shell for thegent (lives in `thegent/desktop`)
---

# Boundary — BytePort

> Boundary file for BytePort. Updated with 2026-06-23 audit data.
> Note: the registry ECOSYSTEM_MAP.md `superseded/archived` row for
> BytePort is **incorrect** — the live repo (this one) is actively
> maintained, ships 13 GitHub Actions workflows, and is the canonical
> desktop app for the Phenotype compute mesh. The registry row is
> pending a rationalization update (tracked in the open questions of
> `phenotype-infra/worklog/2026-06-23-71-pillar-scorecard.md`).

## In Scope (2026-06-23 audit)

1. **`frontend/web/src-tauri/`** — Tauri 2.x desktop binary (Rust)
   with a typed `IpcEnvelope<T>` JSON-RPC contract. Hardened
   `tauri.conf.json` (CSP, security headers, scoped asset protocol).
2. **`crates/byteport-transport/`** — pure-Rust S3 presigner (no AWS
   SDK). Exposes a `Transport` trait and `S3UploadTransport` impl that
   the Tauri app uses directly.
3. **`backend/`** — Go 1.25 HTTP backend with healthz + presign
   endpoints. The CI matrix exercises Linux + macOS + Windows.
4. **Astro docs** — marketing site at `apps/` (or similar root-level
   subdir).
5. **`tauri.conf.json`** — strict CSP, COOP/COEP/CORP, HSTS, X-Frame-
   Options, X-Content-Type-Options, Referrer-Policy, Permissions-
   Policy. Asset protocol scope is `["$APPDATA/uploads",
   "$APPDATA/cache", "$APPLOCALDATA/uploads", "$APPLOCALDATA/cache"]`
   only (not `["**"]`).

## Out of Scope

| Not here | Lives in | Reason |
| -------- | -------- | ------ |
| MCP server | `PhenoMCPServers` | MCP is a separate runtime |
| Native sandboxing | `nanovms` | Process isolation is a nanovms concern |
| thegent desktop shell | `thegent/desktop` | Each agent gets its own shell |
| Multi-cloud transport | `pheno-transport` | SOTA transport is in the SDK |

## Boundary Crossings

| Crossing | Direction | Surface | Status |
| -------- | --------- | ------- | ------ |
| Tauri IPC → backend | this→other | JSON-RPC over HTTP | green |
| Tauri → S3 presigner | internal | `byteport_transport::S3UploadTransport` | green |
| Backend → S3 | this→cloud | AWS SDK / pure HTTP | green |
| Frontend → backend | this→other | fetch | green |
| Desktop → local FS | this→system | Tauri asset protocol (scoped) | green |

## 71-Pillar Scorecard (2026-06-23)

**Score: 47/60 (78.3%)** — strong after BP-001 (removed -445 LOC of
dead code; hardened `tauri.conf.json`).

## Last Review

**Date:** 2026-06-23
**Reviewer:** forge session (Phase 1 of `plans/2026-06-22-compute-infra-dag-v1.md`)
**Worklog / finding:** `phenotype-infra/worklog/2026-06-23-71-pillar-scorecard.md`
**Decisions:**
- BP-001 (dead code removal + tauri.conf.json hardening) MERGED (commit `ceb703df`)
  - Deleted: `src/ipc.rs`, `src/network.rs`, `src/adapters/`, `src/ports/`
  - Pruned: `aws-sdk-s3`, `tokio`, `tracing`, `async-trait`, `thiserror`,
    `url`, `tauri-plugin-os`, `mockall`
  - Hardened: `tauri.conf.json` identifier + CSP + scope + headers
- Open: BP-070 (keep or delete `vendor/aws-runtime`?)

**Next review:** 2026-07-23
