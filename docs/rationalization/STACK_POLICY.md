# Stack Policy — Language Tiers

**Status:** Active  
**Date:** 2026-06-16  
**Authority:** phenotype-registry (INDEX spine)  
**Related:** [boundary-shaping.md](./boundary-shaping.md), [DOMAIN_ROLES.md](./DOMAIN_ROLES.md), PhenoSpecs ADRs

This document is the SSOT for **which languages may appear where** in the Phenotype ecosystem. Boundaries are **domain-named**; language is a tiered implementation choice.

---

## Principles

1. **Domain-first repos** — canonical names reflect capability (`phenotype-types`, `TestingKit`, `PhenoObservability`), not primary language.
2. **Core tier by default** — new domain logic, performance-critical paths, and FFI hosts start in Core tier unless edge justification is documented.
3. **Edge tier requires justification** — any edge-language code in a domain repo must include a **REQUIRED justification field** in the repo `BOUNDARY.md` or a linked ADR in PhenoSpecs (`adrs/`).
4. **No language-bucket SDKs** — repos whose primary boundary is `phenotype-{rust,go,python,ts}-sdk` are an anti-pattern. Use domain repos plus optional bindings at the edge.

---

## Core tier

Default for new domain logic, perf-critical paths, and FFI hosts.

| Language | Role |
| --- | --- |
| **Rust** | Primary systems language; domain crates, CLI hosts, FFI export surfaces |
| **Zig** | Low-level perf, C interop, selected native components |
| **Mojo** | Numeric / ML kernel paths where Mojo toolchain is already adopted |

**Default action:** implement new shared libraries and domain SDK cores in Core tier unless a row in Edge tier applies.

---

## Edge tier

Permitted only with documented justification in ADR or `BOUNDARY.md`.

| Language | Allowed for | Justification examples |
| --- | --- | --- |
| **Go** | Microservices, process managers, gRPC/HTTP interop with existing Go fleets | “Existing sharecli deployment is Go; Rust rewrite cost > 2 sprints”; “Vendor SDK is Go-only” |
| **Python 3.14+ (uv)** | Agent bindings, ML glue, scripting, notebook workflows | “Agent runtime defers to Python until Rust agent host matures”; “PyTorch pipeline requires Python edge” |
| **Bun + TypeScript 7 preview** | UI shells, CLI edges, VitePress/docs tooling, browser-adjacent surfaces | “Dashboard is TS/React”; “CLI prototype ships on Bun before Rust CLI consolidation” |
| **C# / Java** | Enterprise interop, Unity/game engines, JVM ecosystems | “Unity client requires C#”; “Banking partner JVM SDK — rebuild cost prohibitive” |

Justification template (required fields):

```markdown
## Edge language: <lang>
- **Scope:** <paths/packages>
- **Reason:** <why Core tier is not viable now>
- **Exit criteria:** <when/how to fold into Core or drop edge>
- **ADR:** <link or N/A>
```

---

## Anti-patterns

| Anti-pattern | Preferred pattern |
| --- | --- |
| `phenotype-rust-sdk` as primary home for auth | `Authvault` (Rust core) |
| `phenotype-python-sdk-mcp` as boundary name | `McpKit` + Python bindings at edge if needed |
| `phenotype-ts-sdk-*` monolith | Domain repos + `phenoSDK` manifest for optional extras |
| Duplicating domain crates inside HexaKit | ABSORB/DECOMPOSE per [boundary-shaping.md](./boundary-shaping.md) |
| Edge language without ADR/BOUNDARY justification | Block merge until justification field present |

---

## phenoSDK (not a language bucket)

[phenoSDK](https://github.com/KooshaPari/phenoSDK) is a **dynamic extras manifest**: optional domain packages consumers opt into. It does **not** define ecosystem boundaries by language. Domain ownership remains in [DOMAIN_ROLES.md](./DOMAIN_ROLES.md).

---

## Enforcement

- New repos: stack choice recorded in repo `BOUNDARY.md` and linked from `ECOSYSTEM_MAP.md`.
- PR review: edge-tier paths flagged if justification link missing.
- Rationalization: HexaKit and legacy `phenotype-*-sdk` trees dispositioned per [boundary-shaping.md](./boundary-shaping.md).

---

## Related documents

- [DOMAIN_ROLES.md](./DOMAIN_ROLES.md) — per-domain canonical repo and allowed edge langs
- [boundary-shaping.md](./boundary-shaping.md) — DECOMPOSE / ABSORB / DYNAMIC-KEEP charter
