# Domain Roles — Canonical Repo Map

**Status:** Active  
**Date:** 2026-06-16  
**Authority:** phenotype-registry (INDEX spine)  
**Related:** [boundary-shaping.md](./boundary-shaping.md), [STACK_POLICY.md](./STACK_POLICY.md)

Single source of truth mapping **domain concerns** to **canonical repositories**, preferred Core language, and permitted Edge languages (with justification). Language-bucket SDK repos are not primary boundaries.

---

## Domain role table

| Domain | Canonical repo | Preferred core lang | Edge langs (justification examples) |
| --- | --- | --- | --- |
| **Scaffolding / templates** | [HexaKit](https://github.com/KooshaPari/HexaKit) | Rust (CLI + generators) | Bun/TS (VitePress docs shell); Go/Python templates as **scaffold outputs only**, not domain homes |
| **Schemas / shared types** | phenotype-types | Rust (core schemas, codegen) | Python (agent/ML bindings: “Py consumers need generated stubs until Rust-only pipeline”) |
| **Testing** | TestingKit | Rust | — |
| **Observability** (OTel, health, profiling) | PhenoObservability | Rust | — |
| **MCP** | [PhenoFastMCP](https://github.com/KooshaPari/PhenoFastMCP) (py), [PhenoFastMCP-go](https://github.com/KooshaPari/PhenoFastMCP-go), [PhenoFastMCP-rust](https://github.com/KooshaPari/PhenoFastMCP-rust), [PhenoRMCP](https://github.com/KooshaPari/PhenoRMCP) (spec SDK), [PhenoMCPServers](https://github.com/KooshaPari/PhenoMCPServers) (implementations), [substrate](https://github.com/KooshaPari/substrate) (runtime) | Rust / Go / Python per ADR-017 | Python (agent MCP host); Go (HTTP/SSE edges: MCPForge, ops-mcp) |
| **Secrets / auth** | Authvault | Rust | — |
| **HTTP / resilience** | ResilienceKit | Rust | TS (browser/client edge: “fetch wrapper in dashboard package”) |
| **Tooling crates** (diff, registry, resilience-adjacent shared) | phenotype-tooling | Rust | — |
| **Tiny cross-cutting infra** | phenoShared | Rust (dynamic-keep monorepo) | — |
| **Optional extras manifest** | phenoSDK | N/A (manifest) | TS/Python packages listed as opt-in extras — not boundary owners |
| **Code review agent** | tehgent | Rust (target) | Go (current: “interop with existing Go review service”; ADR required) |
| **Agent runtime** | thegent | Rust (target core) | Python (deferred: “agent loop + ML glue until Rust host ready”) |
| **Process manager / share CLI** | sharecli | Rust (rewrite target) | Go (edge until rewrite justified: “production deploy is Go binary today”) |

---

## Role notes

### HexaKit

Scaffolding only — templates, generators, reference hexagonal ports. Not a lib collection. See [boundary-shaping.md](./boundary-shaping.md) and HexaKit [`DISPOSITION.md`](https://github.com/KooshaPari/HexaKit/blob/main/docs/boundary/DISPOSITION.md).

### phenotype-types

Owns schema SSOT (Protobuf/OpenAPI/Rust types as declared in repo boundary). Python edge is for generated bindings and scripting consumers, not a parallel type system.

### phenoShared

**Dynamic-keep** home for crates too small for standalone repo governance (error helpers, config loaders, string/time utils). Absorb target from HexaKit disposition — not a dumping ground for domain logic.

### phenoSDK

Dynamic extras manifest linking optional packages across langs. Does **not** replace domain repos. See [STACK_POLICY.md](./STACK_POLICY.md).

### tehgent vs thegent

| Repo | Domain | Stack note |
| --- | --- | --- |
| **tehgent** | Code review workflows | Go edge today; justify in BOUNDARY/ADR |
| **thegent** | Agent runtime platform | Python edge deferred; Rust core is target |

### sharecli

Process manager CLI; Go edge permitted until a Rust rewrite is cost-justified. Record exit criteria in repo boundary doc.

---

## Adding a new domain row

1. Propose domain name and canonical repo (domain-named, not `phenotype-{lang}-sdk`).
2. Default core lang from [STACK_POLICY.md](./STACK_POLICY.md).
3. If edge lang needed, add justification column example and link ADR.
4. Update this table and `ECOSYSTEM_MAP.md` in the same PR.
5. For modules migrating out of HexaKit, align disposition with [boundary-shaping.md](./boundary-shaping.md).

---

## Related documents

- [STACK_POLICY.md](./STACK_POLICY.md) — core vs edge tiers and justification template
- [boundary-shaping.md](./boundary-shaping.md) — DECOMPOSE / ABSORB / DYNAMIC-KEEP
- [ECOSYSTEM_MAP.md](../../ECOSYSTEM_MAP.md) — fleet-wide repo graph
