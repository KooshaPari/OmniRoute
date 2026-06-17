# Ecosystem Boundary-Shaping Charter

**Status:** Active  
**Date:** 2026-06-16  
**Authority:** phenotype-registry (INDEX spine)  
**Consumers:** [HexaKit `DISPOSITION.md`](https://github.com/KooshaPari/HexaKit/blob/main/docs/boundary/DISPOSITION.md), per-repo boundary assessments, rationalization PRs

This charter is the single source of truth for **how** the Phenotype ecosystem reshapes repository boundaries during rationalization. It defines three dispositions, target topology, and non-negotiable doctrine.

---

## Doctrine

### No delete-on-sight

A stub, empty, broken, unused, or incomplete module is **not** a delete candidate by default. On-paper-good boundaries still deserve an owner. Every assessed module receives:

1. A **disposition** (below)
2. A **target owner** (repo or slot)
3. A **rationale** tied to domain or scaffold role

Hard deletion is reserved for explicit legal/security remediation — not for “cleanup” during migration.

### HexaKit = scaffolding only

[HexaKit](https://github.com/KooshaPari/HexaKit) owns **project and file templates**, scaffolding generators, and reference implementations that *teach* the hexagonal scaffold (ports, XDD patterns). It is **not** a lib holder, language-bucket SDK, or long-term home for domain crates.

Domain logic, observability, auth, MCP, testing, HTTP resilience, and similar concerns belong in **domain-named repos** (see [DOMAIN_ROLES.md](./DOMAIN_ROLES.md) and [STACK_POLICY.md](./STACK_POLICY.md)).

---

## Three dispositions

| Disposition | When to use | Outcome |
| --- | --- | --- |
| **DECOMPOSE** | Module is a coherent product, platform, app, or domain SDK that should stand alone; or a monolith section that violates one-repo-one-job | Split or relocate into a **new or existing domain repo** with its own boundary and CI |
| **ABSORB** | Module clearly belongs to an **existing** domain SDK or scaffold reference set already declared in [DOMAIN_ROLES.md](./DOMAIN_ROLES.md) | Move code/docs into the canonical owner; update registry links; no duplicate boundary |
| **DYNAMIC-KEEP** | Module is scaffolding-adjacent, tiny cross-cutting infra, empty placeholder with charter-aligned future use, or governance/history that must remain addressable | Stays under declared owner (often HexaKit or `phenoShared`) with documented rationale — not deleted |

Every boundary assessment table **must** include: module path, disposition, target repo, rationale.

---

## Target topology

After disposition execution, the ecosystem converges on:

| Layer | Owner | Holds |
| --- | --- | --- |
| **Scaffolding** | HexaKit | `template-*`, `templates/`, CI/doc-sync/gh generators, infra-generic `.template.*` sources, scaffold docs |
| **Domain SDKs** | Named domain repos | McpKit, Authvault, ResilienceKit, TestingKit, PhenoObservability, phenotype-types, etc. |
| **Dynamic extras** | phenoSDK | Manifest of optional domain packages — **not** a language bucket |
| **Tiny infra monorepo** | phenoShared | Cross-cutting crates too small to justify standalone repo governance |
| **Tooling crates** | phenotype-tooling | Diff, registry, resilience-adjacent shared crates (Rust core) |
| **Apps / platforms** | Per-app repos | thegent, tehgent, sharecli, byteport, etc. — each with stack justification where edge langs apply |

Language-specific repos named `phenotype-{lang}-sdk` as the **primary** boundary are an anti-pattern. Boundaries are **domain-first**; language is a implementation choice under [STACK_POLICY.md](./STACK_POLICY.md).

---

## Decomposition map (common absorbs)

Quick reference for repeated ABSORB targets (non-exhaustive):

| Concern | Canonical owner |
| --- | --- |
| Secrets, cipher, crypto, security aggregation | Authvault |
| HTTP client core, rate-limit, resilience patterns | ResilienceKit |
| Logging, metrics, tracing, health, Sentry config | PhenoObservability |
| MCP primitives | McpKit / MCP |
| BDD, contract tests, test fixtures, test infra | TestingKit |
| Hexagonal port traits, canonical ports, XDD reference | HexaKit (scaffolding reference only) |
| Async-trait helpers, error core, config loader, string/time utils | phenoShared (dynamic-keep) |

Full domain → repo mapping: [DOMAIN_ROLES.md](./DOMAIN_ROLES.md).

---

## Assessment workflow

1. Inventory modules (cargo members, packages, top-level dirs, planning-only trees).
2. Classify each row with **DECOMPOSE**, **ABSORB**, or **DYNAMIC-KEEP**.
3. Assign target repo from [DOMAIN_ROLES.md](./DOMAIN_ROLES.md); if edge language required, cite [STACK_POLICY.md](./STACK_POLICY.md) justification in ADR or repo `BOUNDARY.md`.
4. Record in repo-local `DISPOSITION.md` (HexaKit pattern) or rationalization worklog.
5. Execute relocation in small PRs; update `ECOSYSTEM_MAP.md` and registry index links.

---

## Related documents

- [STACK_POLICY.md](./STACK_POLICY.md) — core vs edge language tiers
- [DOMAIN_ROLES.md](./DOMAIN_ROLES.md) — domain → canonical repo map
- [httpora-quadsgm-cluster.md](./httpora-quadsgm-cluster.md) — example cluster assessment (keep separate)
- HexaKit: [`docs/boundary/DISPOSITION.md`](https://github.com/KooshaPari/HexaKit/blob/main/docs/boundary/DISPOSITION.md)
