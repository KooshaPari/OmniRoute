<!-- AI-DD-META:START -->
<!-- This repository is planned, maintained, and managed by AI Agents only. -->
<!-- Slop issues are expected and intentionally present as part of an HITL-less -->
<!-- /minimized AI-DD metaproject of learning, refining, and building brute-force -->
<!-- training for both agents and the human operator. -->
![Downloads](https://img.shields.io/github/downloads/KooshaPari/PhenoSpecs/total?style=flat-square&label=downloads&color=blue)
![GitHub release](https://img.shields.io/github/v/release/KooshaPari/PhenoSpecs?style=flat-square&label=release)
![License](https://img.shields.io/github/license/KooshaPari/PhenoSpecs?style=flat-square)
![AI-Slop](https://img.shields.io/badge/AI--DD-Slop%20Expected-orange?style=flat-square)
![AI-Only-Maintained](https://img.shields.io/badge/Planned%20%26%20Maintained%20by-AI%20Agents%20Only-red?style=flat-square)
![HITL-less](https://img.shields.io/badge/HITL--less%20AI--DD-metaproject-yellow?style=flat-square)

> ⚠️ **AI-Agent-Only Repository**
>
> This repo is **planned, maintained, and managed exclusively by AI Agents**.
> Slop issues, rough edges, and AI artifacts are **expected and intentionally
> present** as part of an **HITL-less / minimized AI-DD** metaproject focused
> on learning, refining, and brute-force training both the agents and the
> human operator. Bug reports and contributions are still welcome, but please
> expect AI-generated code, comments, and documentation throughout.
<!-- AI-DD-META:END -->
> **Work state:** ACTIVE · **Progress:** `████████░░ 85%`
> Single ADR home (adrs/001-016) + spec/contract source-of-truth; registry.yaml v2.0.0 mirrors ECOSYSTEM_MAP · updated 2026-06-08

# PhenoSpecs - Specification Registry

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Legacy Tooling Gate](https://github.com/KooshaPari/PhenoSpecs/actions/workflows/legacy-tooling-gate.yml/badge.svg)](https://github.com/KooshaPari/PhenoSpecs/actions/workflows/legacy-tooling-gate.yml)
[![Specs](https://img.shields.io/badge/spec-markdown-blue.svg)](https://commonmark.org)

**Unified specification registry for the Phenotype ecosystem.**

This repository serves as the **central source of truth** for design specifications, requirements documents, ADRs, and API contracts across all Phenotype projects.

## The 4-role spec/governance spine

PhenoSpecs is the **ADRs / contracts** member of a four-repo spine. Each repo owns one role; they reference each other rather than maintaining competing copies.

| Repo | Role | Owns |
|------|------|------|
| [phenotype-registry](https://github.com/KooshaPari/phenotype-registry) | **INDEX** | Canonical ecosystem map ([ECOSYSTEM_MAP.md](https://github.com/KooshaPari/phenotype-registry/blob/main/ECOSYSTEM_MAP.md)) + dependency graph |
| **PhenoSpecs** (this repo) | **ADRs / contracts** | Architecture Decision Records (canonical home: [`adrs/`](adrs/)), API contracts, specs |
| [PhenoHandbook](https://github.com/KooshaPari/PhenoHandbook) | **CONVENTIONS** | Patterns, methodologies — how we build |
| [phenotype-org-governance](https://github.com/KooshaPari/phenotype-org-governance) | **ENFORCEMENT** | Reusable policy workflows + `deny.toml`/license baseline |

When two documents disagree, authority follows role. `registry.yaml` here is the spec↔implementation traceability index, not the ecosystem index — `ECOSYSTEM_MAP.md` is.

---

## Quick Start

```bash
# Find a spec
ls specs/auth/                    # Auth domain specs
ls specs/crypto/                  # Crypto domain specs

# Read the registry
cat registry.yaml                 # See all registered specs

# Link to implementation
spec-links check                  # Verify spec-to-code traceability
```

---

## Registry Structure

| Directory | Purpose | Contents |
|-----------|---------|----------|
| `specs/` | Domain specifications | Feature specs by domain (auth, crypto, caching, etc.) |
| `adrs/` | Architecture decisions | ADRs in MADR format |
| `openapi/` | API contracts | OpenAPI 3.1 specifications |
| `integrations/` | Integration specs | Cross-system integration specifications |
| `registry.yaml` | Index | Central registry linking all specs to implementations |

---

## Usage

### For Developers

1. **Before implementing**: Check if spec exists in `specs/<domain>/`
2. **Before deciding**: Check `adrs/` for prior architecture decisions
3. **Before integrating**: Check `openapi/` for API contracts
4. **Traceability**: Use `spec-links` to verify spec-to-code linkage

### For Spec Authors

```bash
# Create new spec
spec-new create specs/<domain>/<feature-name>

# This creates:
#   specs/<domain>/<feature-name>/
#   ├── spec.md          # Feature specification
#   ├── frd.md           # Functional requirements
#   └── plan.md          # Implementation plan
```

---

## Connection to Implementations

Specs in this registry link to actual code via:

1. **Traceability macros** in code (Rust: `#[trace_fr(...)]`, Go: `// FR: ...`)
2. **Registry entries** in `registry.yaml` mapping specs to repos
3. **catalog-info.yaml** in each repo referencing specs

---

## Registry Index

See [registry.yaml](./registry.yaml) for complete index with:
- Spec ID → File path
- Domain classification
- Implementation repo links
- Status (draft | specified | implementing | implemented)

---

## Governance

- **New specs**: Must follow [kitty-spec format](https://github.com/KooshaPari/AgilePlus/tree/main/kitty-specs)
- **Updates**: Require ADR if architectural impact
- **Deprecation**: Move to `archive/` with migration guide
- **Traceability**: All specs must link to at least one implementation

---

## Links

- [AgilePlus CLI](https://github.com/KooshaPari/AgilePlus) - Spec-driven development
- [HexaKit](https://github.com/KooshaPari/HexaKit) - Templates
- [PhenoHandbook](https://github.com/KooshaPari/PhenoHandbook) - Patterns & guidelines

## License

MIT — see [LICENSE](./LICENSE).

---

## Rich Media Stubs

<!-- RICH-MEDIA-STUB type="annotated-screenshot" subject="PhenoSpecs quickstart — first spec registered in the registry" journey="" status="TODO" -->
> **[RICH MEDIA PLACEHOLDER]** *Annotated screenshot of PhenoSpecs after registering the first product spec.*
<!-- END-RICH-MEDIA-STUB -->

<!-- RICH-MEDIA-STUB type="recording-gif" subject="ADR workflow — draft → review → decided" journey="" status="TODO" -->
> **[RICH MEDIA PLACEHOLDER]** *GIF of the ADR lifecycle from draft through to decided status.*
<!-- END-RICH-MEDIA-STUB -->

<!-- RICH-MEDIA-STUB type="recording-mp4" subject="Spec-driven development — spec → ADR → API contract flow" journey="" status="TODO" -->
> **[RICH MEDIA PLACEHOLDER]** *Video of the spec-driven development E2E flow: create spec, define ADR, export API contract.*
<!-- END-RICH-MEDIA-STUB -->

<!-- RICH-MEDIA-STUB type="annotated-screenshot" subject="PhenoSpecs architecture — unified specification registry layers" journey="" status="TODO" -->
> **[RICH MEDIA PLACEHOLDER]** *Annotated architecture diagram of the unified specification registry.*
<!-- END-RICH-MEDIA-STUB -->

> **Resolution (2026-06-08):** All four rich-media stubs above remain in `status="TODO"` by design and are not stale. They are filled by a capture / fill agent per the convention in [`RICH_MEDIA.md`](./RICH_MEDIA.md) (status transitions: `TODO` → `CAPTURED` → `PUBLISHED`). PhenoSpecs is a documentation-only registry — there is no running application UI to screenshot here, and the ADR / spec workflows are text-driven, so the assets must be captured against a PhenoSpecs-rendered docs surface. Capture is deferred until that surface is online and a capture agent can run end-to-end recordings. No code or test action is required; re-grep `status="TODO"` during the next capture pass.

## Documentation

This repository includes the following cross-cutting documents:

- [`AGENTS.md`](AGENTS.md) — operating instructions for AI agents and human contributors
- [`SPEC.md`](SPEC.md) — formal specification of behavior and contracts
- [`docs/`](docs/) — design notes, ADRs, and supporting documentation (see [`docs/index.md`](docs/index.md))

