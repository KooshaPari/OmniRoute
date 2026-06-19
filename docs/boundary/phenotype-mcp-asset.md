---
repo: phenotype-mcp-asset
role: shared-lib
parent_intent: ./McpKit.md
sibling_intents:
  - ./Agentora.md
  - ./agentmcp-hex.md
  - ./pheno-otel.md
adr_refs:
  - ADR-024
created: 2026-06-18
last_refreshed: 2026-06-18
status: active
source_of_truth: phenotype-registry/ECOSYSTEM_MAP.md
---

# Boundary — `phenotype-mcp-asset`

## In Scope

The following capabilities are owned by `phenotype-mcp-asset` and **must not**
be re-implemented in any sibling repo. The repo is the canonical home for
all MCP asset materialisation, content-addressable hashing, and stream
chunking primitives that the McpKit absorption wave extracted from the
monolithic `McpKit/McpKit/asset/` module on 2026-06-18 (commit `4c538868`).

1. **Content-addressable asset identity**
   - SHA-256 hashing of MCP asset payloads (binary and text).
   - Stable `asset://` URI generation from content digests.
   - Dedup detection across asset registries.

2. **Asset materialisation**
   - Lazy load + cache for assets referenced by MCP manifests.
   - Materialisation hooks (prefetch, warm-cache, on-demand).
   - LRU eviction with size-bounded memory budget.

3. **Streaming + chunking**
   - Chunked transfer for assets exceeding configurable size threshold
     (default 1 MiB chunk).
   - Range-request handling for partial reads.
   - Backpressure-aware stream producer exposed as async iterator.

4. **MIME + content-type negotiation**
   - Sniff content-type from header bytes + extension fallback.
   - Map `asset://` URIs to consumer-side content-type metadata.

5. **Local filesystem + memory backends**
   - Default `FsAssetStore` (content-addressed layout under `.cache/phenotype-mcp-asset/`).
   - `MemoryAssetStore` for tests and ephemeral runs.
   - Pluggable backend interface (no network-backed stores in v1).

6. **Telemetry integration with `pheno-otel`**
   - Span emission for `asset.load`, `asset.materialise`, `asset.cache.hit`,
     `asset.cache.miss`, `asset.stream`.
   - Counter emission for cache hit-rate, dedup ratio, chunk throughput.

7. **CLI surface (thin)**
   - `pm-asset hash <path>` — emit SHA-256 + `asset://` URI.
   - `pm-asset inspect <uri>` — print metadata (size, content-type, backend).
   - `pm-asset verify <uri>` — re-hash on-disk blob and compare to URI.

## Out of Scope (Owned Elsewhere)

The following are **explicitly not** owned by `phenotype-mcp-asset`.
Cross-repo callers must route to the listed owner.

- **MCP wire-protocol framing (length-prefixed JSON-RPC, frame validation,
  transport-level reconnect)** → owned by [`agentmcp-hex`](./agentmcp-hex.md).
  `phenotype-mcp-asset` deals only with payload content, never wire framing.
- **Orchestration, tool routing, capability advertisement, agent loop
  control** → owned by [`Agentora`](./Agentora.md). Asset loading is invoked
  *from* Agentora, never *driven* by it from within this repo.
- **Distributed cache, network object store (S3/GCS/Azure Blob), CDN
  integration** → deferred to a future `phenotype-mcp-asset-dist` repo.
  Current backends are local-FS and in-memory only.
- **Encryption-at-rest, KMS, signed-URL issuance** → not in scope. Asset
  payloads are trusted once on disk. Signature verification (if needed)
  belongs in the consumer repo.
- **Garbage collection for orphaned assets** → not implemented in v1.
  Operators run a manual sweep script (`pm-asset gc`, planned Q3 2026).
- **Schema validation of MCP manifest fields outside of asset references**
  → owned by `agentmcp-hex`.
- **Agent-loop telemetry aggregation, cost attribution, span fan-out
  beyond a single asset operation** → owned by `pheno-otel` directly.
  This repo only emits per-operation spans; the orchestrator composes them.
- **Distribution packaging, signing, release engineering for the asset
  CLI binary** → shared with all `shared-lib` siblings via the
  Phenotype release pipeline (see ADR-024 § "Distribution").

## Crossings (Allowed + Required Dependencies)

**Allowed inbound callers (who may depend on this repo):**
- `Agentora` (orchestrator) — invokes asset load/materialise on demand.
- `agentmcp-hex` (codec) — does *not* depend on assets at runtime, but the
  shared test harness loads fixture assets via this repo.
- Any first-party MCP server (e.g. `pheno-files`, `pheno-kb`) that exposes
  asset-bearing tools.

**Allowed outbound dependencies (this repo may import):**
- `pheno-otel` — for span/counter emission. No other telemetry path.
- Python stdlib only for crypto (`hashlib`), async I/O (`asyncio`, `aiofiles`),
  and CLI (`argparse`). Third-party deps are pinned and minimal
  (currently: `aiofiles>=23.2`, `typing-extensions>=4.10`).

**Forbidden crossings:**
- No import from `agentmcp-hex` — framing layer is upstream of this layer.
- No import from `Agentora` — would invert the dependency direction.
- No import from any repo marked `archived` in the registry
  (e.g. the original `McpKit` monorepo, retired 2026-06-18).
- No silent fallback to network fetchers. Offline-first is a hard rule
  for v1; if an asset is not in the local store, the operation fails
  fast with `AssetNotFound` rather than reaching out.

## Source of Truth

The canonical role assignment, rationale, and absorption-wave provenance
for `phenotype-mcp-asset` live in:

- `phenotype-registry/ECOSYSTEM_MAP.md` § "22 shared-lib" (row for
  `phenotype-mcp-asset`, added 2026-06-18).
- `phenotype-registry/ALIASES.md` (orphan branch
  `chore/l7-001-contract-only-orphan-2026-06-17`) — McpKit-Absorption
  wave entry pointing to commit `4c538868`.
- `phenotype-registry/worklogs/L7-003-ecosystem-reconciliation-2026-06-18.json`
  — reconciliation log confirming role + boundary for this repo.

If any of the above contradicts this file, **this file is wrong** and must
be reconciled against the registry, not the other way around.

## Review Cadence (per ADR-024)

- **Weekly refresh**: this boundary file is reviewed as part of the
  Phenotype weekly curation sweep. Out-of-scope items, allowed crossings,
  and source-of-truth pointers are diffed against the registry state.
- **On extraction / re-parenting**: any future re-extraction (e.g. spinning
  out `phenotype-mcp-asset-dist` for the network-backed backend) must
  trigger a full boundary re-write, not an additive patch.
- **On ADR change**: if ADR-024 ("Refresh Cadence for Intent + Boundary
  Files") is amended, this file's cadence section updates in the same PR.
- **Owner sign-off required**: any modification to the "In Scope" or
  "Out of Scope" lists requires approval from the `phenotype-mcp-asset`
  maintainer (currently the McpKit absorption working group) AND the
  owner of the affected sibling repo when an "Out of Scope" item moves.

## Change Log

- **2026-06-18** — Initial boundary authored post-McpKit absorption
  (commit `4c538868`). Status: `active`. Predecessor module
  `McpKit/McpKit/asset/` is now `archived`.
