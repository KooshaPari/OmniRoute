---
repo: "phenotype-omlx"
role: research-stack-snapshot
status: archived
last_boundary_review: 2026-07-17
review_cadence: 90d
disposition: ARCHIVE_ONLY
absorbing_repo: "KooshaPari/phenotype-registry"
target: "phenotype-registry (docs/boundary/phenotype-omlx.md)"
archived_at: 2026-07-17
archive_reason: failsafe-platform-specific-mlx-stack
in_scope:
  - "MLX/Metal perf-core research stack snapshot (informational only)"
out_of_scope:
  - "Active development under Phenotype governance"
---

# Boundary — phenotype-omlx

## Status: ARCHIVE_ONLY (failsafe)

This repo is archived. No source code migration performed. Local clone at
`repos/phenotype-omlx/` preserved per container-policy ("preserve dirty child
repositories and linked worktrees"). GitHub remote `KooshaPari/phenotype-omlx`
set to read-only via `gh repo archive KooshaPari/phenotype-omlx -y` on
2026-07-17.

## In Scope (informational only)

Source repository `KooshaPari/phenotype-omlx` (266KB source, 2.3GB on disk
incl. target/ + .venv), a fork of OMLX (`/Applications/oMLX.app`) extending
the upstream MLX research stack with:

| Tier | Path | Original purpose |
| --- | --- | --- |
| Rust perf-core | `perf-core/` (11-crate workspace) | spec-decode, concurrent-exec + CUDA variant, turbo-quant + Mojo/Zig variants, tree-attention + SPIR-V variant, fleet-proto + ZeroMQ variant, hwledger-core |
| Python | `python/omlx_research/` | Multi-backend LLM research (MLX/Metal/vLLM/TensorRT/SGLang/llama.cpp + HybridDispatch policy) + concurrent research agents (LatentMAS, TiDAR, SSD, JetSpec) |
| CLI | `cli/bin/omlx-cli`, `cli/bin/omlx-research` | Pass-through proxy + unified launcher (`repl`, `cli`, `gui`, `web`, `doctor`, `status`, `inference`, `spec-decode`, `latentmas`, `tidar`, `bench`, `fleet`) |
| Web admin | `python/omlx_research/web.py`, `gui/admin-extensions/` | Local HTTP server with research panel + REST endpoints; oMLX.app admin extension surface |
| Platform clients | `linux-client/`, `windows-client/`, macOS `/Applications/oMLX.app` | PowerShell launcher (Win) + bash launcher (Linux) + macOS desktop (upstream) |
| Bindings | `python/ffi/src/lib.rs`, `python-bindings-jni/` | pyo3 extension module `_phenotype_omlx_core` + JNI |
| Research docs | `docs/adr/`, `docs/boundary/`, `docs/intent/`, `ARCHITECTURE.md` | ADR-035A (hwledger reclassification), omlx-inference-split decision provenance |

## Out of Scope (under Phenotype governance)

| Not here | Lives in | Reason |
| -------- | -------- | ------ |
| MLX/Metal perf-cores | none (no Phenotype substrate owns MLX/Metal) | Platform-specific Apple Silicon tier has no canonical Phenotype home |
| oMLX research agents (LatentMAS/TiDAR/SSD/JetSpec) | `repos/jundot/omlx` upstream (read-only reference) | Phenotype governance boundary is upstream at jundot/omlx, not inside the polyrepo |
| Multi-platform launchers | none | Phenotype CLI/MCP surfaces exposed via `ports/` not via per-platform shells |
| AGENTS.md polyglot policy (Mojo/CUDA/Zig/Swift on perf-cores) | superseded by repo-specific AGENTS.md files (only this doc remains) | Phenotype default is Rust-first polyrepo; this policy was scoped to the now-archived fork |

## Audit decision (2026-07-17)

**Task:** Absorb `KooshaPari/phenotype-omlx` (OML phenotyping) into `phenoAI`.
**Failsafe:** `ARCHIVE_ONLY` if no clear home.

### Why failsafe engaged

phenoAI (`repos/phenoAI`) is a tightly scoped Rust workspace:

```toml
# /Users/kooshapari/CodeProjects/Phenotype/repos/phenoAI/Cargo.toml
[workspace]
members = [
    "crates/llm-router",
    "crates/mcp-server",
    "crates/pheno-embedding",
]
resolver = "3"
```

Three crates only; no MLX/Metal/perf-core tier; no roadmap entry for it in
`phenoAI/PLAN.md` (backlog is anthropic provider, local embeddings via
fastembed, streaming, telemetry — all generic LLM concerns, not MLX
perf-cores). phenoAI's `AGENTS.md` reflects Phenotype Rust-default scripting
policy.

phenotype-omlx is incompatible with this home on six axes:

1. **Workspace topology:** 11 perf-core crates + standalone Python package +
   3 platform clients. flat `cp -r perf-core/* phenoAI/crates/` would
   require lifting the Cargo.toml `[workspace]` member list as well —
   not "absorb a crate", but "absorb a workspace", which fails the
   task definition.
2. **Cargo resolver:** phenotype-omlx uses `resolver = "2"`; phenoAI uses
   `resolver = "3"`. Cargo forbids nested `[workspace]` members with a
   conflicting resolver under the host workspace's `[workspace]`
   section (same error class as kmobile failsafe, per registry row
   `repo-kmobile` 2026-07-17).
3. **No semantic home among the 3 phenoAI crates:**
   - `crates/llm-router`: trait-based provider abstraction; would need to
     add MLX-specific providers and dispatch policy — duplicates the
     upstream omlx_research HybridDispatch without substrate overlap.
   - `crates/mcp-server`: MCP protocol server; no MLX/Metal relevance.
   - `crates/pheno-embedding`: OpenAI embedding client; out of scope.
4. **AGENTS.md conflict:** phenotype-omlx's local AGENTS.md explicitly
   nulls Rust-only markers (`"Do not reintroduce 'Rust only' / 'use only
   [...]' markers anywhere in this repo"`); phenoAI's AGENTS.md points
   to the Phenotype default Rust-first policy via `repos/docs/governance/
   scripting_policy.md`. Two governing documents cannot coexist on one
   repo root.
5. **Existing G18 DROP entry** (registry row `gw-phenotype-omlx` in
   `registry/disposition-index.json`): already declared ARCHIVED with
   target `jundot/omlx`. The 2026-07-17 instruction to absorb into
   phenoAI is inconsistent with the 2026-06-18 G18 verdict.
6. **`projects/phenotype-omlx.json` legacy state:** previously said
   `disposition: DROP, absorbed_into: hwledger` — also inconsistent with
   the G18 verdict; both reflect "re-route to a different substrate",
   but neither substrate (hwledger nor phenoAI) contains an MLX tier.

### Preflight (not executed because failsafe engaged)

The task instruction Step 5 was *"`cargo check` or `python import`"* to
verify the absorption. The failsafe clause authorizes skipping this step
when no clear home exists. For completeness:

- `cargo check -p <whatever-phenoAI-crate-would-host-the-MLX-tier>`:
  cannot name a host crate; phenoAI has no MLX/perf-core tier to check
  against.
- `python -c "import omlx_research"`: would succeed in the source venv
  but does not validate any absorption since no copy is performed.

## Boundary Crossings

| Crossing | Direction | Surface | Status |
| -------- | --------- | ------- | ------ |
| Upstream OMLX | external (jundot/omlx) | git | red (read-only archival reference) |
| Polyglot policy (Mojo/CUDA/Zig/Swift) | this-repo→phenotype-default | AGENTS.md | red (superseded; only this boundary doc remains) |
| perf-core → phenoAI | one-way | none | green (no cross; not absorbed) |
| omlx_research → phenoResearchEngine | none | none | green (orthogonal concerns) |

## Last Boundary Review

**Date:** 2026-07-17
**Reviewer:** forge subagent (2026-07-17 absorption pass)
**Decisions:**
- ARCHIVE_ONLY via failsafe clause (no clear home in phenoAI).
- GitHub repo archived via `gh repo archive KooshaPari/phenotype-omlx -y`.
- Local clone preserved under `repos/phenotype-omlx/` per container policy.
- Registry `projects/phenotype-omlx.json` flipped `disposition`:
  DROP/absorbed_into=hwledger → ARCHIVE_ONLY/target=phenotype-registry.
- Registry `registry/disposition-index.json` row `gw-phenotype-omlx`
  left as-is (already ARCHIVED with target `jundot/omlx`); note appended
  describing today's re-evaluation.

**Next review:** 2026-10-17 (90d cadence — informational only; no active
maintenance expected).
