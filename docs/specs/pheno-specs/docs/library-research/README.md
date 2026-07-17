# Phenotype Registry System - Master Index

**Unified entry point for all Phenotype registries.**
## Registry Files

### Core Registries
- [PhenoSpecs Registry](https://github.com/KooshaPari/PhenoSpecs/blob/main/registry.yaml) - Specifications
- [HexaKit Registry](https://github.com/KooshaPari/HexaKit/blob/main/registry.yaml) - Templates
- [PhenoHandbook Config](https://github.com/KooshaPari/PhenoHandbook/blob/main/docs/.vitepress/config.mts) - Patterns

### 📚 Library & Research Registry
**[LIBRARY_RESEARCH_REGISTRY.md](./LIBRARY_RESEARCH_REGISTRY.md)** - Comprehensive catalog of:
- **150+ libraries** used across all repos
- **40+ research papers** and technical foundations
- **Wrap vs Handroll decisions** with rationale
- **Research bibliographies** by domain

This registry enables informed decisions about when to wrap existing libraries versus build custom solutions.
- **LIBRARY_RESEARCH_REGISTRY.md** - Libraries, dependencies & research papers

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

## Registry Relationships

```
┌─────────────────────────────────────────────────────────────┐
│                   PHENOTYPE REGISTRY SYSTEM                  │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌────────────────┐      ┌────────────────┐                │
│  │   PhenoSpecs   │      │ PhenoHandbook  │                │
│  │                │──────▶                │                │
│  │ - Specs        │      │ - Patterns     │                │
│  │ - ADRs         │      │ - Guidelines   │                │
│  │ - OpenAPI      │      │ - Checklists   │                │
│  └────────────────┘      └────────────────┘                │
│           │                       │                         │
│           │                       │                         │
│           ▼                       ▼                         │
│  ┌──────────────────────────────────────────┐              │
│  │              HexaKit                     │              │
│  │                                          │              │
│  │  - Templates informed by specs           │              │
│  │  - Templates follow patterns             │              │
│  └──────────────────────────────────────────┘              │
│                                                              │
│  ┌──────────────────────────────────────────┐              │
│  │         Implementation Repos             │              │
│  │  - phenotype-auth-ts                    │              │
│  │  - Stashly                               │              │
│  │  - thegent                               │              │
│  │  - ...                                   │              │
│  └──────────────────────────────────────────┘              │
│                                                              │
└─────────────────────────────────────────────────────────────┘

Flow:
1. PhenoSpecs → PhenoHandbook (patterns implement specs)
2. PhenoSpecs → HexaKit (templates include spec stubs)
3. PhenoHandbook → HexaKit (templates follow patterns)
4. All → Implementation (code references specs/patterns via traceability)
```

---

## Registry Details

### 1. PhenoSpecs - Specification Registry

**Purpose:** Central source of truth for design specifications

**Key Files:**
- `registry.yaml` - Index of all specs with links to implementations
- `specs/<domain>/` - Feature specifications by domain
- `adrs/` - Architecture Decision Records
- `openapi/` - API contracts

**Usage:**
```bash
# Find a spec
ls PhenoSpecs/specs/auth/

# Check registry
cat PhenoSpecs/registry.yaml | grep SPEC-AUTH-001
```

### 2. PhenoHandbook - Patterns & Guidelines Registry

**Purpose:** Living documentation for how to build software

**Key Files:**
- `patterns/<domain>/` - Design patterns
- `anti-patterns/` - Common mistakes
- `guidelines/` - Coding standards
- `methodologies/` - Development workflows
- `mkdocs.yml` - Documentation site config

**Usage:**
```bash
# Read a pattern
cat PhenoHandbook/patterns/auth/oauth-pkce.md

# Use a checklist
cat PhenoHandbook/checklists/deployment.md
```

**Published Site:** https://kooshapari.com/handbook

### 3. HexaKit - Template Registry

**Purpose:** Code templates and project scaffolding

**Key Files:**
- `registry.yaml` - Template index with metadata
- `by-language/<lang>/` - Language templates
- `by-project/<type>/` - Project templates
- `by-architecture/<pattern>/` - Architecture templates

**Usage:**
```bash
# List templates
hexakit list --category by-language

# Create from template
hexakit create go-hexagonal my-service
```

---

## Connections

Each registry links to the others:

| From | To | Link Type |
|------|-----|-----------|
| Specs | Patterns | Specs reference patterns that implement them |
| Specs | Templates | Specs link to templates that scaffold them |
| Patterns | Specs | Patterns reference originating specs |
| Patterns | Templates | Templates follow pattern guidance |
| Templates | Specs | Templates include spec stubs |
| Templates | Patterns | Templates implement patterns |

---

## CI/CD Integration

All registries have:
- Automated validation on PR
- Link checking (spec → pattern → template)
- Traceability verification
- Auto-publish on merge

---

## Contributing

1. **New Spec**: Create in PhenoSpecs, link to pattern in PhenoHandbook
2. **New Pattern**: Create in PhenoHandbook, reference related specs
3. **New Template**: Create in HexaKit, follow patterns from PhenoHandbook
4. **All PRs**: Must update this master index if adding new top-level entries

---

## Links

- [PhenoSpecs](https://github.com/KooshaPari/PhenoSpecs)
- [PhenoHandbook](https://github.com/KooshaPari/PhenoHandbook)
- [HexaKit](https://github.com/KooshaPari/HexaKit)
- [AgilePlus](https://github.com/KooshaPari/AgilePlus) - Spec-driven development
