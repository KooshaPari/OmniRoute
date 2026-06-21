# Phenotype Org — Consolidation Mapping (Final)

## Summary

**30 repos audited.** Mapped to 4 named productized collections + 7 standalone/keep categories.

---

## Collection 1: Sidekick (Agent Micro-Utilities)

**Purpose:** Lightweight, composable agent utilities for multi-agent coordination, status tracking, and LLM routing.

**Repos:**
- `agent-user-status` — User presence/status tracking via iMessage
- `cheap-llm-mcp` — Cheap LLM routing (Minimax, Kimi, Fireworks)
- `AgentMCP` — MCP server for agent coordination
- `phenotype-ops-mcp` — Operational/infrastructure MCP server
- `thegent-dispatch` — Agent dispatching/scheduling framework

**Rationale:** All <30KB LOC, focused on agent utility. Combined into single namespace with versioned releases.

---

## Collection 2: Eidolon (Automation & Device Control)

**Purpose:** Device automation, desktop control, mobile interaction, and sandbox/virtual environments.

**Repos:**
- `kmobile` — Mobile device automation framework
- `PlayCua` — Desktop/CUA automation framework
- (Note: `KDesktopVirt`, `KVirtualStage` in AgilePlus; add to this collection)

**Rationale:** Unified automation layer for all device/environment interaction.

---

## Collection 3: Paginary (Documentation & Knowledge)

**Purpose:** Design systems, specifications, handbooks, and architectural documentation.

**Repos:**
- `phenoDesign` — Design system documentation
- `PhenoHandbook` — Handbook/procedures/guidelines
- `PhenoSpecs` — Specification documentation
- `phenoXdd` — XDD (Extensible Domain-Driven) design docs
- `phenotype-journeys` — User journey mapping documentation

**Rationale:** All doc-centric, spec-focused. Unified documentation namespace with versioned releases.

---

## Keep Standalone (Core Infrastructure)

**1. agentapi-plusplus** (422K LOC, Go/JS/TS)
   - Multi-model AI routing gateway. Core production service. Keep as independent service.

**2. hwLedger** (2.2M LOC, JS/TS/Python)
   - Hardware ledger/inventory. Substantial, specialized domain. Keep standalone.

**3. kwality** (46K LOC, Go/Rust)
   - Quality auditing/linting framework. Core infrastructure. Keep as quality tier.

**4. phench** (0 LOC, Python)
   - Benchmarking/performance testing. Core infrastructure. Keep as performance tier.

**5. portage** (191K LOC, Python)
   - Package/dependency versioning. Specialized domain. Keep standalone.

**6. rich-cli-kit** (0 LOC, Python)
   - Rich CLI toolkit. Utility library. Keep as CLI tier.

**7. TestingKit** (0 LOC, Python)
   - Testing framework/utilities. Core infrastructure. Keep as testing tier.

**8. phenotype-tooling** (3K LOC, Rust)
   - Tooling/CLI utilities. Keep or split specific tools.

**9. Tracely** (0 LOC, Rust)
   - Tracing/observability framework. Keep as observability tier.

**10. atoms.tech** (79K LOC, TypeScript/React)
   - Web properties/branding/landing pages. Web/branding tier. Keep standalone.

**11. thegent-workspace** (0 LOC, Rust)
   - Workspace management for thegent. Keep in thegent ecosystem.

---

## Archive / Research Only

**agslag-docs** — Do not consolidate; reference only (broken predecessor).
**org-github** — Archive or merge into governance docs.
**phenoSDK** — Archive planning docs; implement in appropriate repos.
**artifacts** — Archive or evaluate.
**KlipDot** — Evaluate maturity; consider research archive.

---

## Evaluation / Minor Consolidation

**phenotype-auth-ts** (860 LOC)
- Consider merging auth utilities into `agentapi-plusplus` auth subsystem.

**ResilienceKit** (3 tests)
- Evaluate for extraction into `phenotype-shared` as a shared crate.

---

## Collection Statistics

| Collection | Repos | Total LOC | Primary Purpose |
|------------|-------|-----------|-----------------|
| Sidekick | 5 | ~50K | Agent coordination & routing |
| Eidolon | 2 | ~34K | Automation & device control |
| Paginary | 5 | ~1.95M | Design system & knowledge docs |
| Keep Standalone | 11 | ~2.87M | Core infrastructure & services |
| Archive | 5 | ~1K | Research/legacy |

**Total audited:** 30 repos. **Consolidated:** 17 repos across 3 collections. **Standalone:** 11 keep + 2 archive.

---

## Next Steps

1. **Create collection registries** in `repos/collections/`:
   - `sidekick.toml` — Sidekick member versions & metadata
   - `eidolon.toml` — Eidolon member versions & metadata
   - `paginary.toml` — Paginary member versions & metadata

2. **Add collection READMEs** in each collection root (e.g., `repos/sidekick-collection/README.md`).

3. **Update dependency references** in all repos to point to collection namespaces.

4. **Archive marked repos** (move `.archive/` if not already there).

