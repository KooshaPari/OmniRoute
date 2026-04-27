# SPEC: Phenotype Registry — Master Index

## Meta

- **ID**: phenotype-registry-001
- **Title**: Phenotype Registry System — Master Index
- **Created**: 2026-04-04
- **State**: specified
- **Version**: 1.0.0
- **Language**: Markdown

---

## Overview

The Phenotype Registry System is the unified entry point for all Phenotype registries. It serves as the master index connecting PhenoSpecs (specifications), PhenoHandbook (patterns), and HexaKit (templates) into a cohesive documentation and code generation ecosystem.

---

## ASCII Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     PHENOTYPE REGISTRY SYSTEM                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────┐    │
│  │                    REGISTRY RELATIONSHIPS                           │    │
│  │                                                                      │    │
│  │    ┌────────────────┐          ┌────────────────┐                  │    │
│  │    │   PhenoSpecs   │──────────▶│ PhenoHandbook  │                  │    │
│  │    │                │  patterns  │                │                  │    │
│  │    │ • Specs        │◀──────────│ • Patterns     │                  │    │
│  │    │ • ADRs         │ implement  │ • Guidelines   │                  │    │
│  │    │ • OpenAPI      │          │ • Checklists   │                  │    │
│  │    └───────┬────────┘          └───────┬────────┘                  │    │
│  │            │                           │                             │    │
│  │            │                           │                             │    │
│  │            ▼                           ▼                             │    │
│  │    ┌──────────────────────────────────────────┐                      │    │
│  │    │              HexaKit                     │                      │    │
│  │    │                                          │                      │    │
│  │    │  • Templates informed by specs          │                      │    │
│  │    │  • Templates follow patterns              │                      │    │
│  │    └──────────────────────────────────────────┘                      │    │
│  │                      │                                                │    │
│  │                      ▼                                                │    │
│  │    ┌──────────────────────────────────────────┐                      │    │
│  │    │         Implementation Repos             │                      │    │
│  │    │  • phenotype-auth-ts                    │                      │    │
│  │    │  • Stashly                               │                      │    │
│  │    │  • thegent                               │                      │    │
│  │    │  • ...                                   │                      │    │
│  │    └──────────────────────────────────────────┘                      │    │
│  │                                                                       │    │
│  └───────────────────────────────────────────────────────────────────────┘    │
│                                                                               │
│  FLOW:                                                                        │
│  1. PhenoSpecs → PhenoHandbook (patterns implement specs)                    │
│  2. PhenoSpecs → HexaKit (templates include spec stubs)                       │
│  3. PhenoHandbook → HexaKit (templates follow patterns)                      │
│  4. All → Implementation (code references specs/patterns via traceability)    │
│                                                                               │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Components Table

| Component | Path | Language | Responsibility | Status |
|-----------|------|----------|----------------|--------|
| **Master Index** | `README.md` | Markdown | Unified navigation hub | Active |
| **Registry Links** | This document | Markdown | Cross-registry relationships | Active |

---

## Registry Index

| Registry | URL | Purpose | Key Files |
|----------|-----|---------|-----------|
| **PhenoSpecs** | [github.com/KooshaPari/PhenoSpecs](https://github.com/KooshaPari/PhenoSpecs) | Specifications & ADRs | `specs/`, `adrs/`, `openapi/`, `registry.yaml` |
| **PhenoHandbook** | [github.com/KooshaPari/PhenoHandbook](https://github.com/KooshaPari/PhenoHandbook) | Patterns & guidelines | `patterns/`, `anti-patterns/`, `guidelines/`, `methodologies/` |
| **HexaKit** | [github.com/KooshaPari/HexaKit](https://github.com/KooshaPari/HexaKit) | Templates & scaffolding | `by-language/`, `by-project/`, `registry.yaml` |

---

## Data Models

### Registry Link
```yaml
type: RegistryLink
properties:
  source:
    registry: PhenoSpecs
    item_id: SPEC-AUTH-001
    path: specs/auth/oauth-flow/
  target:
    registry: PhenoHandbook
    item_id: PATTERN-AUTH-001
    path: patterns/auth/oauth-pkce.md
  relationship: implements  # implements | references | informs
```

### Navigation Entry
```yaml
type: NavigationEntry
properties:
  want_to: Find a spec for a feature
  go_to: PhenoSpecs/specs/
  query: "spec search <domain>"

  want_to: Learn a design pattern
  go_to: PhenoHandbook/patterns/
  query: "pattern list <domain>"

  want_to: Get a code template
  go_to: HexaKit/by-language/
  query: "hexakit create <template> <name>"
```

---

## Registry Connections

| From | To | Link Type |
|------|-----|-----------|
| Specs | Patterns | Specs reference patterns that implement them |
| Specs | Templates | Specs link to templates that scaffold them |
| Patterns | Specs | Patterns reference originating specs |
| Patterns | Templates | Templates follow pattern guidance |
| Templates | Specs | Templates include spec stubs |
| Templates | Patterns | Templates implement patterns |

---

## Quick Navigation

| I want to... | Go to... |
|--------------|----------|
| Find a spec for a feature | [PhenoSpecs/specs/](https://github.com/KooshaPari/PhenoSpecs/tree/main/specs) |
| Learn a design pattern | [PhenoHandbook/patterns/](https://github.com/KooshaPari/PhenoHandbook/tree/main/patterns) |
| See what NOT to do | [PhenoHandbook/anti-patterns/](https://github.com/KooshaPari/PhenoHandbook/tree/main/anti-patterns) |
| Get coding standards | [PhenoHandbook/guidelines/](https://github.com/KooshaPari/PhenoHandbook/tree/main/guidelines) |
| Use a methodology (TDD/BDD/DDD) | [PhenoHandbook/methodologies/](https://github.com/KooshaPari/PhenoHandbook/tree/main/methodologies) |
| Find a code template | [HexaKit/by-language/](https://github.com/KooshaPari/HexaKit/tree/main/by-language) |
| Scaffold a new project | [HexaKit/by-project/](https://github.com/KooshaPari/HexaKit/tree/main/by-project) |

---

## CI/CD Integration

All registries have:
- Automated validation on PR
- Link checking (spec → pattern → template)
- Traceability verification
- Auto-publish on merge

---

## Workspace Structure

```
phenotype-registry/
├── README.md                  # Master index (this is the main artifact)
└── (minimal by design - this is a navigation hub)
```

---

## References

1. [PhenoSpecs](https://github.com/KooshaPari/PhenoSpecs) — Specifications
2. [PhenoHandbook](https://github.com/KooshaPari/PhenoHandbook) — Patterns
3. [HexaKit](https://github.com/KooshaPari/HexaKit) — Templates
4. [AgilePlus](https://github.com/KooshaPari/AgilePlus) — Spec-driven development

---

*Generated: 2026-04-04*
