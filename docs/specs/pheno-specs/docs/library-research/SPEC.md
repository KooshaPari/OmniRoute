# SPEC: Phenotype Registry System — Master Index

**Document ID**: phenotype-registry-001  
**Title**: Phenotype Registry System — Master Index & Architecture Specification  
**Created**: 2026-04-04  
**State**: Specified  
**Version**: 1.0.0  
**Language**: Markdown  

---

## Table of Contents

1. [Meta](#1-meta)
2. [Mission & Tenets](#2-mission--tenets)
3. [Overview](#3-overview)
4. [Architecture](#4-architecture)
5. [Registry Components](#5-registry-components)
6. [Data Models](#6-data-models)
7. [Traceability System](#7-traceability-system)
8. [API Specification](#8-api-specification)
9. [Validation & CI/CD](#9-validation--cicd)
10. [Workflows](#10-workflows)
11. [Integration Guide](#11-integration-guide)
12. [Appendices](#12-appendices)

---

## 1. Meta

### 1.1 Document Information

| Field | Value |
|-------|-------|
| **ID** | phenotype-registry-001 |
| **Title** | Phenotype Registry System — Master Index & Architecture Specification |
| **Version** | 1.0.0 |
| **Status** | Specified |
| **Created** | 2026-04-04 |
| **Last Modified** | 2026-04-04 |
| **Author** | Phenotype Core Team |
| **Reviewers** | Architecture Board |

### 1.2 Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 1.0.0 | 2026-04-04 | Initial specification | Phenotype Core Team |

### 1.3 Related Documents

| Document | Location | Purpose |
|----------|----------|---------|
| SOTA Research | `docs/SOTA.md` | Registry systems research |
| ADR-001 | `docs/adrs/ADR-001-multi-registry-architecture.md` | Architecture decision |
| ADR-002 | `docs/adrs/ADR-002-traceability-first-documentation.md` | Traceability decision |
| ADR-003 | `docs/adrs/ADR-003-automated-validation-strategy.md` | Validation decision |
| PLAN | `PLAN.md` | Implementation plan |

---

## 2. Mission & Tenets

### 2.1 Mission

**The Phenotype Registry System unifies specifications, patterns, and templates into a cohesive, traceable ecosystem that enables consistent, high-quality software development across the organization.**

We exist to:
1. **Connect knowledge**: Bridge the gap between "what to build" and "how to build it"
2. **Ensure consistency**: Provide canonical patterns and specifications
3. **Enable traceability**: Track decisions from requirements through implementation
4. **Accelerate development**: Offer ready-to-use templates and scaffolding

### 2.2 Tenets (Unless You Know Better Ones)

These tenets guide the Phenotype Registry System's development:

#### Tenet 1: Traceability

**Every artifact must be traceable.**

Specifications link to patterns. Patterns link to templates. Templates generate code that references specifications. This bidirectional traceability ensures that:
- Requirements have implementations
- Code has rationale
- Changes have impact analysis
- Audits have evidence

#### Tenet 2: GitOps-First

**Git is the source of truth.**

All registries are Git repositories. All changes flow through Git workflows. This enables:
- Version control for all artifacts
- Pull request reviews
- Automated CI/CD validation
- Immutable audit trail

#### Tenet 3: Separation of Concerns

**Each registry has a single responsibility.**

- PhenoSpecs: What to build (specifications)
- PhenoHandbook: How to build (patterns, guidelines)
- HexaKit: Scaffolding to build (templates)
- phenotype-registry: How to find it all (master index)

#### Tenet 4: Minimalist

**Do one thing well.**

Resist feature creep. Prefer composition over complexity. Each registry should be understandable in an afternoon.

#### Tenet 5: Validated

**If it can't be validated, it doesn't exist.**

All links, schemas, and relationships are automatically validated. Broken links are caught in CI. Schema violations block merges.

#### Tenet 6: Accessible

**Documentation should be discoverable and readable.**

The master index provides quick navigation. Each registry has clear organization. Content is written for humans, not computers.

---

## 3. Overview

### 3.1 Purpose

The Phenotype Registry System serves as the **unified entry point** for all Phenotype registries. It connects:

- **PhenoSpecs**: Specifications, ADRs, and API contracts
- **PhenoHandbook**: Design patterns, guidelines, and methodologies
- **HexaKit**: Code templates and project scaffolding

### 3.2 Scope

**In Scope**:
- Registry relationship documentation
- Cross-registry linking protocol
- Traceability standards
- Validation requirements
- Navigation and discovery

**Out of Scope**:
- Content of individual registries (delegated to spokes)
- Implementation repositories (separate repos)
- Runtime systems (separate projects)

### 3.3 Target Audience

| Audience | Primary Use |
|----------|-------------|
| **Developers** | Find patterns, use templates, trace specs |
| **Architects** | Define specs, review ADRs, ensure compliance |
| **Tech Leads** | Enforce standards, track adoption, plan migrations |
| **New Team Members** | Learn patterns, understand rationale, onboard |
| **Auditors** | Verify compliance, trace requirements, review decisions |

### 3.4 Problem Statement

**Current State**: Documentation is scattered across:
- Wiki pages (outdated)
- Confluence (hard to search)
- README files (inconsistent)
- Team knowledge (tribal)

**Desired State**: Unified, version-controlled, traceable documentation:
- Single entry point for all knowledge
- Bidirectional links between artifacts
- Automated validation and freshness checks
- GitOps workflows

**Gap**: No system connects specifications to patterns to templates to code with validation.

### 3.5 Success Criteria

| Metric | Target | Measurement |
|--------|--------|-------------|
| Cross-registry links | 100% valid | CI validation |
| Spec coverage | >90% of features | Traceability report |
| Navigation time | <30 seconds to find artifact | User testing |
| Link freshness | <1% broken links | Weekly scan |
| Build time | <2 minutes | CI duration |

---

## 4. Architecture

### 4.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    PHENOTYPE REGISTRY SYSTEM                                │
│                    (phenotype-registry)                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                         MASTER INDEX                                  │  │
│  │                                                                        │  │
│  │  • Registry navigation                                                 │  │
│  │  • Cross-registry link validation                                      │  │
│  │  • Relationship documentation                                        │  │
│  │  • Traceability aggregation                                            │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                    │                                        │
│              ┌─────────────────────┼─────────────────────┐                  │
│              │                     │                     │                  │
│              ▼                     ▼                     ▼                  │
│  ┌───────────────────┐  ┌───────────────────┐  ┌───────────────────┐        │
│  │   PHENOSPECS      │  │  PHENOHANDBOOK    │  │     HEXAKIT       │        │
│  │   (Spoke)         │  │    (Spoke)        │  │    (Spoke)        │        │
│  ├───────────────────┤  ├───────────────────┤  ├───────────────────┤        │
│  │ • Specifications  │  │ • Patterns        │  │ • Templates       │        │
│  │ • ADRs            │  │ • Guidelines      │  │ • Scaffolding     │        │
│  │ • OpenAPI         │  │ • Methodologies   │  │ • Generators      │        │
│  └───────────────────┘  └───────────────────┘  └───────────────────┘        │
│          │                      │                      │                   │
│          └──────────────────────┼──────────────────────┘                   │
│                               │                                          │
│                               ▼                                          │
│  ┌───────────────────────────────────────────────────────────────────┐   │
│  │                   IMPLEMENTATION REPOSITORIES                     │   │
│  │                                                                    │   │
│  │  • phenotype-auth-ts    • Stashly    • thegent                   │   │
│  │  • heliosApp            • [other repos...]                         │   │
│  │                                                                    │   │
│  │  Traceability: code ──▶ specs/patterns via commit messages       │   │
│  └───────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 4.2 Component Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      COMPONENT ARCHITECTURE                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐    │
│  │                     phenotype-registry (Hub)                         │    │
│  ├──────────────────────────────────────────────────────────────────────┤    │
│  │                                                                      │    │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────┐│    │
│  │  │   README     │  │    SPEC      │  │   ADRs       │  │   CI     ││    │
│  │  │   (Nav)      │  │   (This)     │  │   (Decisions)│  │Workflows ││    │
│  │  └──────────────┘  └──────────────┘  └──────────────┘  └──────────┘│    │
│  │                                                                      │    │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                │    │
│  │  │    SOTA      │  │  Validation  │  │   Scripts    │                │    │
│  │  │  (Research)  │  │   Scripts    │  │   (Utils)    │                │    │
│  │  └──────────────┘  └──────────────┘  └──────────────┘                │    │
│  │                                                                      │    │
│  └──────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  ┌───────────────────┐  ┌───────────────────┐  ┌───────────────────┐        │
│  │    PhenoSpecs     │  │   PhenoHandbook   │  │     HexaKit       │        │
│  ├───────────────────┤  ├───────────────────┤  ├───────────────────┤        │
│  │ specs/            │  │ patterns/          │  │ by-language/       │        │
│  │ adrs/             │  │ anti-patterns/     │  │ by-project/        │        │
│  │ openapi/          │  │ guidelines/        │  │ by-architecture/   │        │
│  │ registry.yaml     │  │ methodologies/     │  │ registry.yaml      │        │
│  └───────────────────┘  └───────────────────┘  └───────────────────┘        │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 4.3 Data Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         DATA FLOW                                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  1. SPECIFICATION FLOW (What)                                               │
│  ════════════════════════════                                               │
│                                                                              │
│  Author ──▶ PhenoSpecs ──▶ Review ──▶ Merge ──▶ Published                 │
│                │                                                            │
│                ├──▶ Links to PhenoHandbook patterns                         │
│                ├──▶ Links to HexaKit templates                             │
│                └──▶ Referenced by implementation code                      │
│                                                                              │
│  2. PATTERN FLOW (How)                                                      │
│  ═════════════════════                                                      │
│                                                                              │
│  Author ──▶ PhenoHandbook ──▶ Review ──▶ Merge ──▶ Published                │
│                   │                                                         │
│                   ├──▶ References PhenoSpecs specs                         │
│                   ├──▶ Guides HexaKit templates                            │
│                   └──▶ Referenced by implementation code                 │
│                                                                              │
│  3. TEMPLATE FLOW (Scaffolding)                                             │
│  ══════════════════════════════                                             │
│                                                                              │
│  Author ──▶ HexaKit ──▶ Review ──▶ Merge ──▶ Published                      │
│              │                                                              │
│              ├──▶ Informed by PhenoSpecs specs                             │
│              ├──▶ Follows PhenoHandbook patterns                            │
│              └──▶ Used to generate implementation code                     │
│                                                                              │
│  4. IMPLEMENTATION FLOW (Code)                                              │
│  ═════════════════════════════                                              │
│                                                                              │
│  Developer ──▶ hexakit create ──▶ Edit ──▶ Commit ──▶ PR ──▶ Merge          │
│                    │                         │                              │
│                    └──▶ Includes spec stubs  └──▶ References specs/patterns│
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 4.4 Registry Relationships

#### 4.4.1 PhenoSpecs → PhenoHandbook

**Relationship**: PhenoSpecs specifications reference PhenoHandbook patterns that implement them.

**Example**:
```yaml
# In PhenoSpecs/specs/auth/oauth.yaml
implementation:
  patterns:
    - registry: PhenoHandbook
      pattern_id: PATTERN-AUTH-OAUTH-PKCE
      path: patterns/auth/oauth-pkce.md
```

#### 4.4.2 PhenoSpecs → HexaKit

**Relationship**: PhenoSpecs specifications inform HexaKit templates.

**Example**:
```yaml
# In PhenoSpecs/specs/auth/oauth.yaml
templates:
  - registry: HexaKit
    template_id: TEMPLATE-GO-OAUTH
    path: by-language/go/templates/oauth/
```

#### 4.4.3 PhenoHandbook → PhenoSpecs

**Relationship**: PhenoHandbook patterns reference originating PhenoSpecs specs.

**Example**:
```yaml
# In PhenoHandbook/patterns/auth/oauth-pkce.md
---
specs:
  - registry: PhenoSpecs
    spec_id: SPEC-AUTH-001
    path: specs/auth/oauth.yaml
---
```

#### 4.4.4 PhenoHandbook → HexaKit

**Relationship**: HexaKit templates follow PhenoHandbook pattern guidance.

**Example**:
```yaml
# In HexaKit/by-language/go/templates/oauth/template.yaml
---
follows:
  - registry: PhenoHandbook
    pattern_id: PATTERN-AUTH-OAUTH-PKCE
    pattern_id: PATTERN-STRUCTURE-HEXAGONAL
---
```

#### 4.4.5 HexaKit → PhenoSpecs

**Relationship**: HexaKit templates include PhenoSpecs spec stubs.

**Example**:
```yaml
# In HexaKit/by-language/go/templates/oauth/template.yaml
---
implements:
  - registry: PhenoSpecs
    spec_id: SPEC-AUTH-001
---
```

#### 4.4.6 HexaKit → PhenoHandbook

**Relationship**: HexaKit templates implement PhenoHandbook patterns.

**Example**:
```yaml
# In HexaKit/by-language/go/templates/oauth/template.yaml
---
implements:
  - registry: PhenoHandbook
    pattern_id: PATTERN-AUTH-OAUTH-PKCE
---
```

### 4.5 Bidirectional Link Requirements

All cross-registry links MUST be bidirectional. If A links to B, B MUST link to A.

**Validation Rule**:
```
FOR EACH link IN registry_a.links:
  target = registry_b.get(link.target_id)
  IF target.links NOT CONTAINS reverse_link:
    ERROR: "Broken bidirectional link: {link} has no reverse in {registry_b}"
```

---

## 5. Registry Components

### 5.1 PhenoSpecs (Specifications)

**Purpose**: Central source of truth for design specifications

**URL**: https://github.com/KooshaPari/PhenoSpecs

#### 5.1.1 Structure

```
PhenoSpecs/
├── README.md              # Introduction and navigation
├── registry.yaml          # Machine-readable index
├── specs/                 # Feature specifications
│   ├── auth/
│   │   ├── oauth.yaml
│   │   └── sso.yaml
│   ├── api/
│   │   ├── rest.yaml
│   │   └── graphql.yaml
│   └── [domain]/
├── adrs/                  # Architecture Decision Records
│   ├── 001-adr-format.md
│   └── [nnn]-[title].md
└── openapi/               # API contracts
    ├── auth-api.yaml
    └── [api]-api.yaml
```

#### 5.1.2 Key Files

| File | Purpose | Format |
|------|---------|--------|
| `registry.yaml` | Index of all specs with metadata | YAML |
| `specs/<domain>/<spec>.yaml` | Individual specifications | YAML |
| `adrs/<nnn>-<title>.md` | Architecture decisions | Markdown |
| `openapi/<api>.yaml` | API contracts | OpenAPI |

#### 5.1.3 Registry Format

```yaml
# registry.yaml
version: "1.0.0"
registries:
  - name: PhenoSpecs
    url: https://github.com/KooshaPari/PhenoSpecs
    specs:
      - id: SPEC-AUTH-001
        title: OAuth2 Authorization Code Flow
        path: specs/auth/oauth.yaml
        status: specified
        links:
          patterns:
            - registry: PhenoHandbook
              id: PATTERN-AUTH-OAUTH-PKCE
          templates:
            - registry: HexaKit
              id: TEMPLATE-GO-OAUTH
```

### 5.2 PhenoHandbook (Patterns)

**Purpose**: Living documentation for how to build software

**URL**: https://github.com/KooshaPari/PhenoHandbook

#### 5.2.1 Structure

```
PhenoHandbook/
├── README.md              # Introduction
├── mkdocs.yml             # Documentation site config
├── patterns/              # Design patterns
│   ├── auth/
│   │   ├── oauth-pkce.md
│   │   └── jwt-validation.md
│   └── [domain]/
├── anti-patterns/         # Common mistakes
│   └── [domain]/
├── guidelines/            # Coding standards
│   ├── typescript.md
│   └── rust.md
├── methodologies/         # Development workflows
│   ├── tdd.md
│   └── ddd.md
└── checklists/            # Review checklists
    └── deployment.md
```

#### 5.2.2 Key Files

| File | Purpose | Format |
|------|---------|--------|
| `patterns/<domain>/<pattern>.md` | Design patterns | Markdown |
| `anti-patterns/<domain>/<anti-pattern>.md` | Anti-patterns | Markdown |
| `guidelines/<language>.md` | Language-specific guidelines | Markdown |
| `methodologies/<method>.md` | Development methodologies | Markdown |

#### 5.2.3 Pattern Format

```markdown
---
id: PATTERN-AUTH-OAUTH-PKCE
title: OAuth2 with PKCE
domain: auth
status: proven
specs:
  - registry: PhenoSpecs
    id: SPEC-AUTH-001
templates:
  - registry: HexaKit
    id: TEMPLATE-GO-OAUTH
---

# OAuth2 with PKCE

## Problem
...

## Solution
...

## Implementation
...
```

### 5.3 HexaKit (Templates)

**Purpose**: Code templates and project scaffolding

**URL**: https://github.com/KooshaPari/HexaKit

#### 5.3.1 Structure

```
HexaKit/
├── README.md              # Introduction
├── registry.yaml          # Template index
├── by-language/           # Language templates
│   ├── go/
│   │   └── templates/
│   │       └── oauth/
│   ├── typescript/
│   └── [language]/
├── by-project/          # Project templates
│   ├── cli/
│   ├── service/
│   └── [type]/
└── by-architecture/     # Architecture templates
    ├── hexagonal/
    └── clean/
```

#### 5.3.2 Key Files

| File | Purpose | Format |
|------|---------|--------|
| `registry.yaml` | Template index | YAML |
| `by-language/<lang>/templates/<name>/` | Language templates | Varies |
| `by-project/<type>/` | Project templates | Varies |
| `by-architecture/<pattern>/` | Architecture templates | Varies |

#### 5.3.3 Template Format

```yaml
# by-language/go/templates/oauth/template.yaml
id: TEMPLATE-GO-OAUTH
name: Go OAuth2 Service
language: go
category: service
specs:
  - registry: PhenoSpecs
    id: SPEC-AUTH-001
patterns:
  - registry: PhenoHandbook
    id: PATTERN-AUTH-OAUTH-PKCE
  - registry: PhenoHandbook
    id: PATTERN-STRUCTURE-HEXAGONAL
files:
  - src/main.go
  - src/auth/
  - README.md
```

### 5.4 phenotype-registry (Master Index)

**Purpose**: Unified navigation and cross-registry coordination

**URL**: https://github.com/KooshaPari/phenotype-registry

#### 5.4.1 Structure

```
phenotype-registry/
├── README.md              # Master index (primary artifact)
├── SPEC.md                # This specification
├── PLAN.md                # Implementation plan
├── docs/
│   ├── SOTA.md            # State of the art research
│   └── adrs/
│       ├── ADR-001-multi-registry-architecture.md
│       ├── ADR-002-traceability-first-documentation.md
│       └── ADR-003-automated-validation-strategy.md
├── .github/
│   └── workflows/
│       └── validate.yml   # Cross-registry validation
└── scripts/
    └── validate_links.py  # Link validation script
```

#### 5.4.2 Key Files

| File | Purpose | Format |
|------|---------|--------|
| `README.md` | Master index and navigation hub | Markdown |
| `SPEC.md` | Detailed specification | Markdown |
| `PLAN.md` | Implementation plan | Markdown |
| `docs/SOTA.md` | Research document | Markdown |
| `docs/adrs/*.md` | Architecture decisions | Markdown |

---

## 6. Data Models

### 6.1 Core Entity Types

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         ENTITY RELATIONSHIPS                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────┐       ┌──────────────┐       ┌──────────────┐           │
│  │    Spec      │◀─────▶│   Pattern    │◀─────▶│  Template    │           │
│  │              │       │              │       │              │           │
│  │ • id         │       │ • id         │       │ • id         │           │
│  │ • title      │       │ • title      │       │ • name       │           │
│  │ • status     │       │ • status     │       │ • language   │           │
│  │ • domain     │       │ • domain     │       │ • category   │           │
│  │ • links      │       │ • links      │       │ • links      │           │
│  └──────────────┘       └──────────────┘       └──────────────┘           │
│         │                      │                      │                    │
│         └──────────────────────┼──────────────────────┘                    │
│                                │                                          │
│                                ▼                                          │
│                      ┌──────────────────┐                                 │
│                      │ Implementation   │                                 │
│                      │                  │                                 │
│                      │ • repo           │                                 │
│                      │ • file           │                                 │
│                      │ • trace_id       │                                 │
│                      └──────────────────┘                                 │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 6.2 Spec Entity

```yaml
type: Spec
version: "1.0.0"

properties:
  id:
    type: string
    pattern: "^SPEC-[A-Z]+-[0-9]+$"
    example: "SPEC-AUTH-001"
    description: "Unique identifier"
    
  title:
    type: string
    minLength: 5
    maxLength: 100
    description: "Human-readable title"
    
  description:
    type: string
    maxLength: 500
    description: "Brief description"
    
  status:
    type: string
    enum: [draft, specified, implementing, implemented, deprecated]
    description: "Lifecycle status"
    
  domain:
    type: string
    pattern: "^[a-z-]+$"
    example: "auth"
    description: "Functional domain"
    
  created:
    type: string
    format: date
    description: "Creation date"
    
  modified:
    type: string
    format: date
    description: "Last modification date"
    
  author:
    type: string
    description: "Primary author"
    
  links:
    type: object
    properties:
      patterns:
        type: array
        items:
          $ref: "#/definitions/CrossRegistryLink"
      templates:
        type: array
        items:
          $ref: "#/definitions/CrossRegistryLink"
      adrs:
        type: array
        items:
          $ref: "#/definitions/InternalLink"
          
  requirements:
    type: array
    items:
      type: object
      properties:
        id:
          type: string
        description:
          type: string
        priority:
          type: string
          enum: [P0, P1, P2, P3]
          
  acceptance_criteria:
    type: array
    items:
      type: string
```

### 6.3 Pattern Entity

```yaml
type: Pattern
version: "1.0.0"

properties:
  id:
    type: string
    pattern: "^PATTERN-[A-Z]+-[A-Z-]+$"
    example: "PATTERN-AUTH-OAUTH-PKCE"
    description: "Unique identifier"
    
  title:
    type: string
    minLength: 5
    maxLength: 100
    description: "Human-readable title"
    
  description:
    type: string
    maxLength: 500
    description: "Brief description"
    
  status:
    type: string
    enum: [experimental, proven, deprecated, retired]
    description: "Maturity status"
    
  domain:
    type: string
    pattern: "^[a-z-]+$"
    example: "auth"
    description: "Functional domain"
    
  type:
    type: string
    enum: [design, architectural, coding, testing, deployment]
    description: "Pattern category"
    
  specs:
    type: array
    items:
      $ref: "#/definitions/CrossRegistryLink"
    description: "Specifications this pattern implements"
    
  related_patterns:
    type: array
    items:
      $ref: "#/definitions/InternalLink"
    description: "Related patterns in same registry"
    
  anti_patterns:
    type: array
    items:
      $ref: "#/definitions/InternalLink"
    description: "Related anti-patterns"
    
  templates:
    type: array
    items:
      $ref: "#/definitions/CrossRegistryLink"
    description: "Templates following this pattern"
    
  implementation_examples:
    type: array
    items:
      type: object
      properties:
        repo:
          type: string
        path:
          type: string
        description:
          type: string
```

### 6.4 Template Entity

```yaml
type: Template
version: "1.0.0"

properties:
  id:
    type: string
    pattern: "^TEMPLATE-[A-Z]+-[A-Z-]+$"
    example: "TEMPLATE-GO-OAUTH"
    description: "Unique identifier"
    
  name:
    type: string
    minLength: 3
    maxLength: 50
    description: "Human-readable name"
    
  description:
    type: string
    maxLength: 500
    description: "Brief description"
    
  language:
    type: string
    enum: [go, typescript, rust, python, "*"]
    description: "Target programming language"
    
  category:
    type: string
    enum: [service, cli, library, app, infrastructure]
    description: "Template category"
    
  status:
    type: string
    enum: [experimental, stable, deprecated]
    description: "Template maturity"
    
  specs:
    type: array
    items:
      $ref: "#/definitions/CrossRegistryLink"
    description: "Specifications this template implements"
    
  patterns:
    type: array
    items:
      $ref: "#/definitions/CrossRegistryLink"
    description: "Patterns this template follows"
    
  files:
    type: array
    items:
      type: string
    description: "Files included in template"
    
  variables:
    type: array
    items:
      type: object
      properties:
        name:
          type: string
        description:
          type: string
        default:
          type: string
        required:
          type: boolean
```

### 6.5 Cross-Registry Link Entity

```yaml
type: CrossRegistryLink
version: "1.0.0"

description: |
  A bidirectional link between entities in different registries.
  The reverse link MUST exist in the target registry.

properties:
  registry:
    type: string
    enum: [PhenoSpecs, PhenoHandbook, HexaKit]
    description: "Target registry name"
    
  id:
    type: string
    description: "Entity ID in target registry"
    
  path:
    type: string
    description: "Relative path to entity in target registry"
    
  relationship:
    type: string
    enum: [implements, references, informs, generated_from, follows]
    description: "Nature of relationship"
    
  required: [registry, id, relationship]
```

### 6.6 Internal Link Entity

```yaml
type: InternalLink
version: "1.0.0"

description: |
  A link to another entity within the same registry.

properties:
  id:
    type: string
    description: "Entity ID within this registry"
    
  path:
    type: string
    description: "Relative path to entity"
    
  relationship:
    type: string
    enum: [related, supersedes, depends_on, alternative_to]
    description: "Nature of relationship"
    
  required: [id, relationship]
```

### 6.7 Registry Link Entity

```yaml
type: RegistryLink
version: "1.0.0"

description: |
  High-level link between registries (used in phenotype-registry master index).

properties:
  source:
    type: object
    properties:
      registry:
        type: string
        description: "Source registry name"
      item_id:
        type: string
        description: "Item ID in source registry"
      path:
        type: string
        description: "Path in source registry"
        
  target:
    type: object
    properties:
      registry:
        type: string
        description: "Target registry name"
      item_id:
        type: string
        description: "Item ID in target registry"
      path:
        type: string
        description: "Path in target registry"
        
  relationship:
    type: string
    enum: [implements, references, informs, generated_from, follows, guides]
    description: "Relationship from source to target"
    
  required: [source, target, relationship]
```

### 6.8 Navigation Entry Entity

```yaml
type: NavigationEntry
version: "1.0.0"

description: |
  A quick navigation entry for the master index.

properties:
  want_to:
    type: string
    description: "User intent (starts with 'I want to...')"
    example: "Find a spec for a feature"
    
  go_to:
    type: string
    description: "Registry path to navigate to"
    example: "PhenoSpecs/specs/"
    
  query:
    type: string
    description: "Example query or command"
    example: "spec search auth"
    
  required: [want_to, go_to]
```

### 6.9 JSON Schema Definitions

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "definitions": {
    "Spec": {
      "type": "object",
      "required": ["id", "title", "status", "domain"],
      "properties": {
        "id": {
          "type": "string",
          "pattern": "^SPEC-[A-Z]+-[0-9]+$"
        },
        "title": {
          "type": "string",
          "minLength": 5,
          "maxLength": 100
        },
        "status": {
          "type": "string",
          "enum": ["draft", "specified", "implementing", "implemented", "deprecated"]
        },
        "domain": {
          "type": "string",
          "pattern": "^[a-z-]+$"
        }
      }
    },
    "Pattern": {
      "type": "object",
      "required": ["id", "title", "status", "domain"],
      "properties": {
        "id": {
          "type": "string",
          "pattern": "^PATTERN-[A-Z]+-[A-Z-]+$"
        },
        "title": {
          "type": "string",
          "minLength": 5,
          "maxLength": 100
        },
        "status": {
          "type": "string",
          "enum": ["experimental", "proven", "deprecated", "retired"]
        }
      }
    },
    "Template": {
      "type": "object",
      "required": ["id", "name", "language", "category"],
      "properties": {
        "id": {
          "type": "string",
          "pattern": "^TEMPLATE-[A-Z]+-[A-Z-]+$"
        },
        "name": {
          "type": "string",
          "minLength": 3,
          "maxLength": 50
        },
        "language": {
          "type": "string"
        },
        "category": {
          "type": "string",
          "enum": ["service", "cli", "library", "app", "infrastructure"]
        }
      }
    },
    "CrossRegistryLink": {
      "type": "object",
      "required": ["registry", "id", "relationship"],
      "properties": {
        "registry": {
          "type": "string"
        },
        "id": {
          "type": "string"
        },
        "relationship": {
          "type": "string"
        }
      }
    }
  }
}
```

---

## 7. Traceability System

### 7.1 Traceability Levels

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      TRACEABILITY LEVELS                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  LEVEL 1: REGISTRY-REGISTRY (Coarse)                                       │
│  ─────────────────────────────────────                                      │
│  PhenoSpecs ──▶ PhenoHandbook ──▶ HexaKit                                  │
│                                                                              │
│  • Bidirectional links in YAML frontmatter                                  │
│  • Validated by phenotype-registry CI                                       │
│  • Weekly orphan detection                                                  │
│                                                                              │
│  LEVEL 2: COMMIT-REGISTRY (Medium)                                         │
│  ─────────────────────────────────                                        │
│  Commit ──▶ Spec/Pattern/Template                                          │
│                                                                              │
│  • Conventional commit messages                                             │
│  • PR validation via commit linting                                         │
│  • Git log serves as audit trail                                            │
│                                                                              │
│  LEVEL 3: CODE-REGISTRY (Fine)                                             │
│  ───────────────────────────────                                            │
│  Source Code ──▶ Spec/Pattern                                              │
│                                                                              │
│  • @trace comments in code                                                  │
│  • Optional, for critical components                                        │
│  • Harvested by trace analysis tool                                         │
│                                                                              │
│  LEVEL 4: RUNTIME-REGISTRY (Dynamic)                                     │
│  ───────────────────────────────────                                        │
│  Running System ──▶ Spec/Pattern (Future)                                  │
│                                                                              │
│  • Service mesh annotations                                                 │
│  • Observability correlation                                                │
│  • Compliance dashboards                                                    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 7.2 Trace Comment Syntax

Trace comments are language-agnostic annotations embedded in source code.

#### 7.2.1 Supported Formats

| Language | Syntax | Example |
|----------|--------|---------|
| **Python** | `# @trace SPEC-XXX` | `# @trace SPEC-AUTH-001` |
| **JavaScript/TypeScript** | `// @trace SPEC-XXX` | `// @trace SPEC-AUTH-001` |
| **Go** | `// @trace SPEC-XXX` | `// @trace SPEC-AUTH-001` |
| **Rust** | `// @trace SPEC-XXX` | `// @trace SPEC-AUTH-001` |
| **YAML** | `# @trace: SPEC-XXX` | `# @trace: SPEC-AUTH-001` |
| **Markdown** | `<!-- @trace SPEC-XXX -->` | `<!-- @trace SPEC-AUTH-001 -->` |

#### 7.2.2 Comment Types

```yaml
# @trace SPEC-XXX
# Indicates this code implements the specified spec

# @implements PATTERN-XXX  
# Indicates this code follows the specified pattern

# @from TEMPLATE-XXX
# Indicates this code was generated from the specified template

# @see ADR-XXX
# References a related architecture decision

# @related SPEC-XXX
# Indicates related but not implementing
```

### 7.3 Commit Message Format

Based on Conventional Commits with traceability extensions.

```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

#### 7.3.1 Types with Traceability

| Type | Meaning | Trace Requirement |
|------|---------|-------------------|
| `spec` | Spec-related change | MUST reference spec |
| `pattern` | Pattern-related | SHOULD reference pattern |
| `feat` | New feature | SHOULD reference spec |
| `fix` | Bug fix | SHOULD reference spec if exists |
| `adr` | Architecture decision | MUST reference ADR |
| `docs` | Documentation | MAY reference related spec |
| `refactor` | Code change | MAY reference spec |

#### 7.3.2 Trace Keywords in Body/Footer

```
spec(AUTH): implement OAuth2 authorization

Implements SPEC-AUTH-001 OAuth2 Authorization Code Flow.
Follows PATTERN-AUTH-OAUTH-PKCE for PKCE extension.

@trace SPEC-AUTH-001
@implements PATTERN-AUTH-OAUTH-PKCE
@closes SPEC-AUTH-001
```

#### 7.3.3 Multi-Trace Example

```
spec(API): implement rate limiting and auth

Implements:
- SPEC-API-001 Rate Limiting
- SPEC-AUTH-001 OAuth2 Flow

Follows:
- PATTERN-API-RATE-LIMIT
- PATTERN-AUTH-OAUTH-PKCE

@trace SPEC-API-001
@trace SPEC-AUTH-001
@implements PATTERN-API-RATE-LIMIT
@implements PATTERN-AUTH-OAUTH-PKCE
```

### 7.4 Traceability Validation

#### 7.4.1 Validation Rules

| Rule | Severity | Description |
|------|----------|-------------|
| R001 | ERROR | All cross-registry links must be bidirectional |
| R002 | ERROR | Spec IDs must follow naming convention |
| R003 | WARNING | Commits with `spec` type must reference a spec |
| R004 | WARNING | `@trace` comments must reference valid spec |
| R005 | INFO | All specs should have at least one implementation |
| R006 | WARNING | Patterns should have at least one template |

#### 7.4.2 Orphan Detection

An orphan is an entity with no incoming or outgoing links.

```python
def detect_orphans(registry):
    orphans = []
    for entity in registry.entities:
        if not entity.links and not entity.referenced_by:
            orphans.append(entity)
    return orphans
```

#### 7.4.3 Coverage Report

```
Traceability Coverage Report
═══════════════════════════════════════════════════════════

Specs: 45 total
  - With patterns: 38 (84%)
  - With templates: 29 (64%)
  - With implementations: 32 (71%)
  - Orphaned: 3 (SPEC-DATA-002, SPEC-LOG-005, SPEC-CACHE-001)

Patterns: 62 total
  - From specs: 52 (84%)
  - With templates: 41 (66%)
  - With implementations: 48 (77%)

Templates: 18 total
  - From specs: 15 (83%)
  - From patterns: 17 (94%)

Recommendations:
  1. Link SPEC-DATA-002 to a pattern
  2. Create template for SPEC-LOG-005
  3. Verify SPEC-CACHE-001 is still needed
```

---

## 8. API Specification

### 8.1 Registry Query API

The phenotype-registry provides a read-only query API for discovering and navigating registries.

#### 8.1.1 Base URL

```
https://raw.githubusercontent.com/KooshaPari/phenotype-registry/main/
```

#### 8.1.2 Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/registry-index.json` | GET | Master index of all registries |
| `/links.json` | GET | All cross-registry links |
| `/navigation.json` | GET | Quick navigation entries |

#### 8.1.3 Registry Index Response

```json
{
  "version": "1.0.0",
  "last_updated": "2026-04-04T12:00:00Z",
  "registries": [
    {
      "name": "PhenoSpecs",
      "url": "https://github.com/KooshaPari/PhenoSpecs",
      "description": "Specifications and ADRs",
      "stats": {
        "specs": 45,
        "adrs": 12,
        "openapi": 8
      }
    },
    {
      "name": "PhenoHandbook",
      "url": "https://github.com/KooshaPari/PhenoHandbook",
      "description": "Patterns and guidelines",
      "stats": {
        "patterns": 62,
        "anti_patterns": 15,
        "guidelines": 8
      }
    },
    {
      "name": "HexaKit",
      "url": "https://github.com/KooshaPari/HexaKit",
      "description": "Templates and scaffolding",
      "stats": {
        "templates": 18
      }
    }
  ]
}
```

#### 8.1.4 Links Response

```json
{
  "version": "1.0.0",
  "links": [
    {
      "source": {
        "registry": "PhenoSpecs",
        "id": "SPEC-AUTH-001",
        "path": "specs/auth/oauth.yaml"
      },
      "target": {
        "registry": "PhenoHandbook",
        "id": "PATTERN-AUTH-OAUTH-PKCE",
        "path": "patterns/auth/oauth-pkce.md"
      },
      "relationship": "implements"
    }
  ]
}
```

### 8.2 Registry Webhook API (Future)

For real-time updates, registries MAY support webhooks.

#### 8.2.1 Webhook Events

| Event | Description |
|-------|-------------|
| `spec.created` | New specification added |
| `spec.updated` | Specification modified |
| `spec.deprecated` | Specification deprecated |
| `link.created` | New cross-registry link |
| `link.broken` | Link validation failed |

#### 8.2.2 Webhook Payload

```json
{
  "event": "spec.created",
  "timestamp": "2026-04-04T12:00:00Z",
  "registry": "PhenoSpecs",
  "data": {
    "id": "SPEC-NEW-001",
    "title": "New Feature Spec",
    "url": "https://github.com/KooshaPari/PhenoSpecs/blob/main/specs/new.yaml"
  }
}
```

### 8.3 Search API (Future)

Full-text search across all registries.

#### 8.3.1 Search Endpoint

```
GET /search?q=<query>&registry=<registry>&type=<type>
```

#### 8.3.2 Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `q` | string | Search query |
| `registry` | string | Filter by registry (optional) |
| `type` | string | Filter by type: spec, pattern, template (optional) |

#### 8.3.3 Response

```json
{
  "query": "oauth",
  "total": 12,
  "results": [
    {
      "type": "spec",
      "registry": "PhenoSpecs",
      "id": "SPEC-AUTH-001",
      "title": "OAuth2 Authorization Code Flow",
      "excerpt": "...OAuth2 implementation using the authorization code flow...",
      "url": "https://github.com/KooshaPari/PhenoSpecs/blob/main/specs/auth/oauth.yaml"
    }
  ]
}
```

---

## 9. Validation & CI/CD

### 9.1 Validation Pipeline

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    VALIDATION PIPELINE                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  PER-REGISTRY VALIDATION (On PR)                                           │
│  ═════════════════════════════════                                          │
│                                                                              │
│  ┌─────────────┐   ┌─────────────┐   ┌─────────────┐   ┌─────────────┐     │
│  │  Checkout   │──▶│   Schema    │──▶│   Link      │──▶│   Format    │     │
│  │    Code     │   │  Validate   │   │   Check     │   │    Lint     │     │
│  └─────────────┘   └─────────────┘   └─────────────┘   └─────────────┘     │
│       ~5s              ~10s              ~15s             ~10s              │
│                                                                              │
│  Target: < 40 seconds                                                       │
│                                                                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  CROSS-REGISTRY VALIDATION (phenotype-registry)                            │
│  ══════════════════════════════════════════════                            │
│                                                                              │
│  ┌─────────────┐   ┌─────────────┐   ┌─────────────┐   ┌─────────────┐     │
│  │  Checkout   │──▶│   Cross     │──▶│   Orphan    │──▶│  Coverage   │     │
│  │  All Spokes │   │ Link Check  │   │   Detect    │   │   Report    │     │
│  └─────────────┘   └─────────────┘   └─────────────┘   └─────────────┘     │
│       ~10s             ~30s              ~20s             ~10s              │
│                                                                              │
│  Target: < 90 seconds                                                       │
│                                                                              │
│  Trigger:                                                                   │
│    • Daily scheduled run (02:00 UTC)                                        │
│    • Manual trigger (on-demand)                                             │
│    • PR to phenotype-registry (any spoke change)                            │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 9.2 GitHub Actions Workflows

#### 9.2.1 Per-Registry Workflow

```yaml
# .github/workflows/validate.yml (in each spoke)
name: Validate

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm install -g ajv-cli yamllint markdownlint-cli

      - name: Validate YAML
        run: yamllint .

      - name: Validate JSON
        run: |
          for f in $(find . -name "*.json"); do
            jq empty "$f" || exit 1
          done

      - name: Validate Specs
        run: |
          npx ajv-cli validate \
            -s schemas/spec.json \
            -d specs/**/*.yaml

      - name: Check Links
        uses: lycheeverse/lychee-action@v1
        with:
          args: --base . .

      - name: Lint Markdown
        run: markdownlint "**/*.md"

      - name: Spell Check
        uses: streetsidesoftware/cspell-action@v5
```

#### 9.2.2 phenotype-registry Workflow

```yaml
# .github/workflows/cross-validate.yml (in phenotype-registry)
name: Cross-Registry Validation

on:
  schedule:
    - cron: '0 2 * * *'  # Daily at 02:00 UTC
  workflow_dispatch:
  pull_request:
    branches: [main]

jobs:
  cross-validate:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout phenotype-registry
        uses: actions/checkout@v4

      - name: Checkout PhenoSpecs
        uses: actions/checkout@v4
        with:
          repository: KooshaPari/PhenoSpecs
          path: phenospecs

      - name: Checkout PhenoHandbook
        uses: actions/checkout@v4
        with:
          repository: KooshaPari/PhenoHandbook
          path: phenohandbook

      - name: Checkout HexaKit
        uses: actions/checkout@v4
        with:
          repository: KooshaPari/HexaKit
          path: hexakit

      - name: Setup Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.12'

      - name: Install dependencies
        run: |
          pip install pyyaml jsonschema requests

      - name: Validate Cross-Registry Links
        run: |
          python scripts/validate_cross_links.py \
            --specs phenospecs \
            --handbook phenohandbook \
            --hexakit hexakit

      - name: Detect Orphans
        run: |
          python scripts/detect_orphans.py \
            --specs phenospecs \
            --handbook phenohandbook \
            --hexakit hexakit

      - name: Generate Coverage Report
        run: |
          python scripts/coverage_report.py \
            --specs phenospecs \
            --handbook phenohandbook \
            --hexakit hexakit \
            --output coverage-report.md

      - name: Upload Coverage Report
        uses: actions/upload-artifact@v4
        with:
          name: coverage-report
          path: coverage-report.md

      - name: Comment PR
        if: github.event_name == 'pull_request'
        uses: actions/github-script@v7
        with:
          script: |
            const fs = require('fs');
            const report = fs.readFileSync('coverage-report.md', 'utf8');
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: report
            });
```

### 9.3 Validation Scripts

#### 9.3.1 Cross-Link Validator

```python
#!/usr/bin/env python3
"""Validate cross-registry links."""

import yaml
import argparse
from pathlib import Path
from typing import List, Dict, Tuple

class CrossLinkValidator:
    def __init__(self, specs_path: str, handbook_path: str, hexakit_path: str):
        self.specs_path = Path(specs_path)
        self.handbook_path = Path(handbook_path)
        self.hexakit_path = Path(hexakit_path)
        self.errors = []
        self.warnings = []

    def load_registry(self, path: Path) -> Dict:
        """Load registry.yaml from a registry."""
        registry_file = path / "registry.yaml"
        if not registry_file.exists():
            return {}
        with open(registry_file) as f:
            return yaml.safe_load(f)

    def validate_bidirectional_links(self) -> Tuple[int, int]:
        """Validate that all cross-registry links are bidirectional."""
        # Load all registries
        specs = self.load_registry(self.specs_path)
        handbook = self.load_registry(self.handbook_path)
        hexakit = self.load_registry(self.hexakit_path)

        registries = {
            "PhenoSpecs": specs,
            "PhenoHandbook": handbook,
            "HexaKit": hexakit
        }

        # Validate links from each registry
        for source_name, source_registry in registries.items():
            for spec in source_registry.get("specs", []):
                for link in spec.get("links", {}).get("patterns", []):
                    target_name = link.get("registry")
                    target_id = link.get("id")

                    # Check if reverse link exists
                    target_registry = registries.get(target_name, {})
                    reverse_found = False

                    for target_spec in target_registry.get("patterns", []):
                        if target_spec.get("id") == target_id:
                            # Check if target links back
                            for rev_link in target_spec.get("specs", []):
                                if (rev_link.get("registry") == source_name and
                                    rev_link.get("id") == spec.get("id")):
                                    reverse_found = True
                                    break

                    if not reverse_found:
                        self.errors.append(
                            f"Broken bidirectional link: {source_name}:{spec['id']} "
                            f"-> {target_name}:{target_id} (no reverse link)"
                        )

        return len(self.errors), len(self.warnings)

    def report(self) -> str:
        """Generate validation report."""
        lines = ["Cross-Registry Link Validation Report", "=" * 50]

        if self.errors:
            lines.append(f"\nERRORS ({len(self.errors)}):")
            for error in self.errors:
                lines.append(f"  ❌ {error}")

        if self.warnings:
            lines.append(f"\nWARNINGS ({len(self.warnings)}):")
            for warning in self.warnings:
                lines.append(f"  ⚠️  {warning}")

        if not self.errors and not self.warnings:
            lines.append("\n✅ All cross-registry links are valid!")

        return "\n".join(lines)

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--specs", required=True)
    parser.add_argument("--handbook", required=True)
    parser.add_argument("--hexakit", required=True)
    args = parser.parse_args()

    validator = CrossLinkValidator(args.specs, args.handbook, args.hexakit)
    errors, warnings = validator.validate_bidirectional_links()
    print(validator.report())

    exit(1 if errors > 0 else 0)
```

#### 9.3.2 Orphan Detector

```python
#!/usr/bin/env python3
"""Detect orphaned entities in registries."""

import yaml
import argparse
from pathlib import Path
from collections import defaultdict

class OrphanDetector:
    def __init__(self, specs_path: str, handbook_path: str, hexakit_path: str):
        self.specs_path = Path(specs_path)
        self.handbook_path = Path(handbook_path)
        self.hexakit_path = Path(hexakit_path)
        self.orphans = defaultdict(list)
        self.links = defaultdict(list)

    def load_registry(self, path: Path, name: str) -> list:
        """Load entities from a registry."""
        registry_file = path / "registry.yaml"
        if not registry_file.exists():
            return []
        with open(registry_file) as f:
            data = yaml.safe_load(f)
            return data.get("specs", []) if name == "PhenoSpecs" else \
                   data.get("patterns", []) if name == "PhenoHandbook" else \
                   data.get("templates", [])

    def build_link_graph(self):
        """Build graph of all links."""
        # Load all entities
        specs = self.load_registry(self.specs_path, "PhenoSpecs")
        patterns = self.load_registry(self.handbook_path, "PhenoHandbook")
        templates = self.load_registry(self.hexakit_path, "HexaKit")

        # Index by ID
        self.entities = {}
        for spec in specs:
            self.entities[("PhenoSpecs", spec["id"])] = spec
        for pattern in patterns:
            self.entities[("PhenoHandbook", pattern["id"])] = pattern
        for template in templates:
            self.entities[("HexaKit", template["id"])] = template

        # Build link graph
        for (registry, entity_id), entity in self.entities.items():
            links = []

            # Collect links based on entity type
            if registry == "PhenoSpecs":
                links.extend(entity.get("links", {}).get("patterns", []))
                links.extend(entity.get("links", {}).get("templates", []))
            elif registry == "PhenoHandbook":
                links.extend(entity.get("specs", []))
                links.extend(entity.get("templates", []))
            elif registry == "HexaKit":
                links.extend(entity.get("specs", []))
                links.extend(entity.get("patterns", []))

            for link in links:
                target = (link.get("registry"), link.get("id"))
                self.links[(registry, entity_id)].append(target)
                # Track incoming links
                self.links[target]  # Ensure key exists

    def detect_orphans(self):
        """Find entities with no links (in or out)."""
        for (registry, entity_id), entity in self.entities.items():
            outgoing = len(self.links.get((registry, entity_id), []))
            incoming = sum(
                1 for links in self.links.values()
                if (registry, entity_id) in links
            )

            if outgoing == 0 and incoming == 0:
                self.orphans[registry].append(entity_id)

    def report(self) -> str:
        """Generate orphan report."""
        lines = ["Orphan Detection Report", "=" * 50]

        total = sum(len(v) for v in self.orphans.values())
        lines.append(f"\nTotal orphans: {total}")

        for registry, orphans in self.orphans.items():
            if orphans:
                lines.append(f"\n{registry}: {len(orphans)}")
                for orphan in orphans:
                    lines.append(f"  - {orphan}")

        if total == 0:
            lines.append("\n✅ No orphans detected!")

        return "\n".join(lines)

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--specs", required=True)
    parser.add_argument("--handbook", required=True)
    parser.add_argument("--hexakit", required=True)
    args = parser.parse_args()

    detector = OrphanDetector(args.specs, args.handbook, args.hexakit)
    detector.build_link_graph()
    detector.detect_orphans()
    print(detector.report())

    exit(1 if detector.orphans else 0)
```

---

## 10. Workflows

### 10.1 Adding a New Specification

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    NEW SPECIFICATION WORKFLOW                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  1. CREATE SPEC IN PHENOSPECS                                              │
│     ───────────────────────────                                              │
│     • Create branch: feat/SPEC-XXX-<title>                                   │
│     • Write spec in specs/<domain>/<name>.yaml                               │
│     • Add entry to registry.yaml                                             │
│     • Open PR to PhenoSpecs                                                  │
│                                                                              │
│  2. CREATE PATTERN (IF NEW DOMAIN)                                         │
│     ──────────────────────────────                                           │
│     • Create corresponding pattern in PhenoHandbook                         │
│     • Link pattern to spec                                                  │
│     • Open PR to PhenoHandbook                                              │
│                                                                              │
│  3. CREATE/UPDATE TEMPLATE (IF APPLICABLE)                                   │
│     ────────────────────────────────────                                     │
│     • Update or create template in HexaKit                                  │
│     • Link template to spec and pattern                                     │
│     • Open PR to HexaKit                                                     │
│                                                                              │
│  4. UPDATE MASTER INDEX                                                      │
│     ─────────────────────                                                    │
│     • Update phenotype-registry links                                        │
│     • Verify cross-registry validation passes                                │
│     • Open PR to phenotype-registry                                          │
│                                                                              │
│  5. MERGE SEQUENCE                                                           │
│     ────────────────                                                         │
│     • Merge PhenoSpecs PR (after review)                                     │
│     • Merge PhenoHandbook PR (after review)                                  │
│     • Merge HexaKit PR (after review)                                        │
│     • Merge phenotype-registry PR (validation passes)                          │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 10.2 Adding a New Pattern

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    NEW PATTERN WORKFLOW                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  1. CHECK FOR EXISTING SPEC                                                │
│     ─────────────────────────                                              │
│     • Does a spec exist for this domain?                                    │
│     • If no: Create spec first (see 10.1)                                   │
│     • If yes: Continue                                                        │
│                                                                              │
│  2. CREATE PATTERN IN PHENOHANDBOOK                                          │
│     ────────────────────────────────                                         │
│     • Create branch: feat/PATTERN-XXX-<title>                                │
│     • Write pattern in patterns/<domain>/<name>.md                          │
│     • Reference originating spec in frontmatter                              │
│     • Open PR to PhenoHandbook                                               │
│                                                                              │
│  3. UPDATE SPEC (BIDIRECTIONAL LINK)                                         │
│     ─────────────────────────────────                                        │
│     • Update PhenoSpecs spec to reference pattern                            │
│     • Open PR to PhenoSpecs                                                  │
│                                                                              │
│  4. UPDATE MASTER INDEX                                                      │
│     ─────────────────────                                                    │
│     • Verify link validation in phenotype-registry                           │
│     • Document pattern in navigation if significant                          │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 10.3 Implementing a Specification

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    IMPLEMENTATION WORKFLOW                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  1. DISCOVER SPEC                                                            │
│     ─────────────                                                            │
│     • Find spec in PhenoSpecs                                                │
│     • Read related patterns in PhenoHandbook                                  │
│     • Use template from HexaKit if available                                  │
│                                                                              │
│  2. SCAFFOLD PROJECT                                                         │
│     ────────────────                                                         │
│     • hexakit create <template> <project-name>                                │
│     • Or create manually following patterns                                   │
│                                                                              │
│  3. IMPLEMENT WITH TRACEABILITY                                              │
│     ────────────────────────────                                             │
│     • Add @trace comments for critical code                                  │
│     • Use conventional commits referencing spec                               │
│     • Example: spec(XXX): implement feature                                   │
│                                                                              │
│  4. UPDATE SPEC STATUS                                                       │
│     ──────────────────                                                       │
│     • PR to PhenoSpecs to update status: implementing → implemented           │
│     • Add implementation link to spec                                          │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 10.4 Deprecating an Artifact

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    DEPRECATION WORKFLOW                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  1. MARK AS DEPRECATED                                                       │
│     ──────────────────                                                       │
│     • Update status field to "deprecated"                                     │
│     • Add deprecation notice with reason                                     │
│     • Suggest replacement if applicable                                       │
│                                                                              │
│  2. UPDATE LINKS                                                             │
│     ──────────────                                                           │
│     • Find all references to deprecated artifact                              │
│     • Update or remove links                                                  │
│     • Ensure bidirectional links updated                                      │
│                                                                              │
│  3. NOTIFY CONSUMERS                                                         │
│     ────────────────                                                         │
│     • Check implementation repos for usage                                     │
│     • Create migration issues in affected repos                              │
│     • Announce in relevant channels                                           │
│                                                                              │
│  4. GRACE PERIOD (30 days)                                                   │
│     ──────────────────────                                                   │
│     • Artifact remains accessible                                             │
│     • Warnings in validation                                                  │
│     • Migration period for consumers                                          │
│                                                                              │
│  5. ARCHIVE (OPTIONAL)                                                       │
│     ─────────────────                                                        │
│     • After grace period, consider archiving                                   │
│     • Move to archive/ directory                                              │
│     • Remove from active registry.yaml                                        │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 11. Integration Guide

### 11.1 For Developers

#### 11.1.1 Finding Resources

**I want to find a specification:**
```bash
# Browse PhenoSpecs
cd PhenoSpecs
ls specs/

# Search for auth specs
grep -r "oauth" specs/

# Check registry.yaml
cat registry.yaml | grep SPEC-AUTH
```

**I want to learn a pattern:**
```bash
# Browse PhenoHandbook
cd PhenoHandbook
ls patterns/

# Read a pattern
cat patterns/auth/oauth-pkce.md
```

**I want to use a template:**
```bash
# List templates
hexakit list

# Create from template
hexakit create go-service my-service
cd my-service
```

#### 11.1.2 Adding Traceability

**In commit messages:**
```
spec(AUTH): implement OAuth2 flow

Implements SPEC-AUTH-001 OAuth2 Authorization Code Flow
following PATTERN-AUTH-OAUTH-PKCE.

@trace SPEC-AUTH-001
@implements PATTERN-AUTH-OAUTH-PKCE
```

**In code comments:**
```python
# @trace SPEC-AUTH-001
# @implements PATTERN-AUTH-OAUTH-PKCE
def get_authorization_url():
    """Get OAuth2 authorization URL with PKCE."""
    pass
```

### 11.2 For Architects

#### 11.2.1 Creating Specifications

**Step 1: Define the spec structure:**
```yaml
# specs/new-domain/feature.yaml
id: SPEC-NEW-001
title: Feature Specification
domain: new-domain
status: draft
author: architect@example.com
description: |
  Brief description of the feature.

requirements:
  - id: R1
    description: Requirement one
    priority: P0
  - id: R2
    description: Requirement two
    priority: P1

acceptance_criteria:
  - Criterion one
  - Criterion two

links:
  patterns: []
  templates: []
```

**Step 2: Register the spec:**
```yaml
# Update registry.yaml
specs:
  - id: SPEC-NEW-001
    title: Feature Specification
    path: specs/new-domain/feature.yaml
    status: draft
```

**Step 3: Create related pattern:**
```markdown
---
id: PATTERN-NEW-FEATURE
title: Feature Pattern
domain: new-domain
status: experimental
specs:
  - registry: PhenoSpecs
    id: SPEC-NEW-001
---

# Feature Pattern

## Problem
...

## Solution
...
```

#### 11.2.2 Reviewing Changes

**Checklist for spec review:**
- [ ] ID follows naming convention (SPEC-DOMAIN-NNN)
- [ ] Status is appropriate
- [ ] Requirements are clear and testable
- [ ] Acceptance criteria are specific
- [ ] Links to patterns are valid
- [ ] Bidirectional links exist

### 11.3 For Tech Leads

#### 11.3.1 Enforcing Standards

**Enable CI validation:**
```yaml
# .github/workflows/phenotype-check.yml
name: Phenotype Compliance

on:
  pull_request:
    branches: [main]

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Check traceability
        run: |
          # Extract @trace comments
          grep -r "@trace" src/ > traces.txt || true

          # Validate against PhenoSpecs
          python scripts/validate_traces.py traces.txt

      - name: Check conventional commits
        uses: wagoid/commitlint-github-action@v5
```

**Add pre-commit hooks:**
```yaml
# .pre-commit-config.yaml
repos:
  - repo: local
    hooks:
      - id: trace-check
        name: Check traceability
        entry: scripts/check_traces.sh
        language: script
        files: '\.(py|js|ts|go|rs)$'
```

#### 11.3.2 Monitoring Adoption

**Track spec coverage:**
```bash
# Generate coverage report
python scripts/coverage_report.py \
  --repo ./ \
  --specs ../PhenoSpecs \
  --output coverage.md
```

**Weekly review:**
- Review coverage report
- Identify orphaned specs
- Track new pattern adoption
- Plan migration campaigns

### 11.4 For Tooling Authors

#### 11.4.1 Registry API Client

```python
# phenotype_registry/client.py
import requests
import yaml
from pathlib import Path

class PhenotypeRegistryClient:
    BASE_URL = "https://raw.githubusercontent.com/KooshaPari/phenotype-registry/main"

    def __init__(self):
        self._index = None
        self._links = None

    def get_index(self) -> dict:
        """Get registry index."""
        if self._index is None:
            response = requests.get(f"{self.BASE_URL}/registry-index.json")
            self._index = response.json()
        return self._index

    def get_links(self) -> dict:
        """Get cross-registry links."""
        if self._links is None:
            response = requests.get(f"{self.BASE_URL}/links.json")
            self._links = response.json()
        return self._links

    def find_spec(self, spec_id: str) -> dict:
        """Find a specification by ID."""
        index = self.get_index()
        for registry in index["registries"]:
            if registry["name"] == "PhenoSpecs":
                for spec in registry.get("specs", []):
                    if spec["id"] == spec_id:
                        return spec
        return None

    def find_pattern_for_spec(self, spec_id: str) -> list:
        """Find patterns implementing a spec."""
        links = self.get_links()
        patterns = []
        for link in links["links"]:
            if (link["source"]["id"] == spec_id and
                link["target"]["registry"] == "PhenoHandbook"):
                patterns.append(link["target"])
        return patterns
```

#### 11.4.2 IDE Extension (Concept)

```typescript
// VS Code extension concept
// src/extension.ts

import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
    // Hover provider for @trace comments
    vscode.languages.registerHoverProvider('*', {
        provideHover(document, position) {
            const line = document.lineAt(position.line).text;
            const match = line.match(/@trace\s+(SPEC-[A-Z]+-[0-9]+)/);

            if (match) {
                const specId = match[1];
                return fetchSpecDetails(specId).then(details => {
                    return new vscode.Hover([
                        `**${details.title}**`,
                        `Status: ${details.status}`,
                        `[View Spec](${details.url})`
                    ].join('\n\n'));
                });
            }
        }
    });

    // Code lens for specs without implementation
    vscode.languages.registerCodeLensProvider('*', {
        provideCodeLenses(document) {
            // Find specs referenced but not implemented
            // ...
        }
    });
}
```

---

## 12. Appendices

### Appendix A: Naming Conventions

#### A.1 Spec IDs

Format: `SPEC-<DOMAIN>-<NNN>`

| Component | Format | Example |
|-----------|--------|---------|
| Prefix | SPEC | SPEC |
| Domain | UPPERCASE | AUTH, API, DATA |
| Number | 3 digits | 001, 042, 123 |

Examples:
- `SPEC-AUTH-001` - Authentication spec #1
- `SPEC-API-042` - API spec #42
- `SPEC-DATA-003` - Data layer spec #3

#### A.2 Pattern IDs

Format: `PATTERN-<DOMAIN>-<NAME>`

| Component | Format | Example |
|-----------|--------|---------|
| Prefix | PATTERN | PATTERN |
| Domain | UPPERCASE | AUTH, API, STRUCTURE |
| Name | UPPERCASE-WITH-DASHES | OAUTH-PKCE, RATE-LIMIT |

Examples:
- `PATTERN-AUTH-OAUTH-PKCE` - OAuth PKCE pattern
- `PATTERN-API-RATE-LIMIT` - API rate limiting pattern
- `PATTERN-STRUCTURE-HEXAGONAL` - Hexagonal architecture pattern

#### A.3 Template IDs

Format: `TEMPLATE-<LANGUAGE>-<NAME>`

| Component | Format | Example |
|-----------|--------|---------|
| Prefix | TEMPLATE | TEMPLATE |
| Language | UPPERCASE | GO, TS, RUST |
| Name | UPPERCASE-WITH-DASHES | SERVICE, CLI, OAUTH |

Examples:
- `TEMPLATE-GO-SERVICE` - Go service template
- `TEMPLATE-TS-REACT` - TypeScript React template
- `TEMPLATE-RUST-CLI` - Rust CLI template

### Appendix B: Status Definitions

#### B.1 Spec Status

| Status | Meaning | Can Implement? |
|--------|---------|----------------|
| `draft` | Early stage, subject to change | No |
| `specified` | Ready for implementation | Yes |
| `implementing` | Implementation in progress | Yes |
| `implemented` | Complete, tested | Yes |
| `deprecated` | No longer recommended | No |

#### B.2 Pattern Status

| Status | Meaning | Can Use? |
|--------|---------|----------|
| `experimental` | New, unproven | Caution |
| `proven` | Tested in production | Yes |
| `deprecated` | Superseded | No |
| `retired` | Removed | No |

#### B.3 Template Status

| Status | Meaning | Can Use? |
|--------|---------|----------|
| `experimental` | New, may change | Caution |
| `stable` | Ready for use | Yes |
| `deprecated` | No longer maintained | No |

### Appendix C: Glossary

| Term | Definition |
|------|------------|
| **ADR** | Architecture Decision Record - documents significant decisions |
| **Artifact** | Any documented entity (spec, pattern, template) |
| **Cross-registry link** | Bidirectional link between registries |
| **Domain** | Functional area (auth, api, data, etc.) |
| **HexaKit** | Template and scaffolding registry |
| **Orphan** | Entity with no incoming or outgoing links |
| **Pattern** | Reusable solution to a common problem |
| **PhenoHandbook** | Patterns and guidelines registry |
| **PhenoSpecs** | Specifications and ADRs registry |
| **phenotype-registry** | Master index and coordination hub |
| **Registry** | Storage system for artifacts of a type |
| **Spec** | Specification defining requirements or behavior |
| **Template** | Code scaffolding for projects/components |
| **Traceability** | Ability to follow relationships between artifacts |
| **Trace comment** | Source code annotation linking to registry |

### Appendix D: File Templates

#### D.1 Spec Template

```yaml
# Template for new specifications
# Save as: specs/<domain>/<name>.yaml

id: SPEC-DOMAIN-NNN
title: Brief Title
domain: domain-name
status: draft
author: your@email.com
created: YYYY-MM-DD
modified: YYYY-MM-DD

description: |
  One-paragraph description of what this spec defines.

motivation: |
  Why is this spec needed? What problem does it solve?

requirements:
  - id: R1
    description: First requirement
    priority: P0
    acceptance: |
      How to verify this requirement

  - id: R2
    description: Second requirement
    priority: P1

acceptance_criteria:
  - Criterion one
  - Criterion two

links:
  patterns:
    - registry: PhenoHandbook
      id: PATTERN-DOMAIN-NAME
      relationship: implements
  templates:
    - registry: HexaKit
      id: TEMPLATE-LANG-NAME
      relationship: informed_by

---
# Additional markdown content
## Notes
...

## References
...
```

#### D.2 Pattern Template

```markdown
---
id: PATTERN-DOMAIN-NAME
title: Pattern Title
domain: domain-name
status: experimental
type: design  # design, architectural, coding, testing, deployment

specs:
  - registry: PhenoSpecs
    id: SPEC-DOMAIN-NNN
    relationship: implements

templates:
  - registry: HexaKit
    id: TEMPLATE-LANG-NAME
    relationship: guides

related_patterns:
  - id: PATTERN-OTHER-NAME
    relationship: related

anti_patterns:
  - id: ANTI-PATTERN-NAME
    relationship: alternative_to
---

# Pattern Title

## Problem

What problem does this pattern solve?

## Context

When is this pattern applicable?

## Solution

How does the pattern solve the problem?

## Implementation

### Code Example

```language
// Example code
```

## Consequences

### Benefits
- Benefit one
- Benefit two

### Trade-offs
- Trade-off one
- Trade-off two

## Related Patterns
- [Pattern Name](link)

## References
- [Source](url)
```

#### D.3 Template Config Template

```yaml
# Template for new code templates
# Save as: by-language/<lang>/templates/<name>/template.yaml

id: TEMPLATE-LANG-NAME
name: Human-Readable Name
language: go  # go, typescript, rust, python, etc.
category: service  # service, cli, library, app, infrastructure
description: |
  Brief description of what this template creates.

status: experimental  # experimental, stable, deprecated

specs:
  - registry: PhenoSpecs
    id: SPEC-DOMAIN-NNN
    relationship: implements

patterns:
  - registry: PhenoHandbook
    id: PATTERN-DOMAIN-NAME
    relationship: follows

files:
  - README.md
  - src/main.go
  - src/config/
  - tests/

variables:
  - name: project_name
    description: Name of the project
    required: true
    default: my-project

  - name: include_tests
    description: Include test files
    required: false
    default: "true"

hooks:
  pre_generate:
    - echo "Generating {{ project_name }}..."
  post_generate:
    - cd {{ project_name }} && git init
```

### Appendix E: Error Codes

| Code | Severity | Meaning | Resolution |
|------|----------|---------|------------|
| E001 | ERROR | Broken bidirectional link | Add reverse link |
| E002 | ERROR | Invalid spec ID format | Fix ID to match pattern |
| E003 | ERROR | Schema validation failed | Fix YAML/JSON schema |
| E004 | ERROR | Duplicate ID | Rename to unique ID |
| W001 | WARNING | Spec has no patterns | Create pattern or mark experimental |
| W002 | WARNING | Pattern has no templates | Create template or document why |
| W003 | WARNING | Orphaned entity | Add links or archive |
| W004 | WARNING | Missing trace in commit | Add spec reference |
| I001 | INFO | Coverage below target | Prioritize coverage work |

### Appendix F: Changelog

| Date | Version | Changes |
|------|---------|---------|
| 2026-04-04 | 1.0.0 | Initial specification |

---

*Document ID: phenotype-registry-001*  
*Version: 1.0.0*  
*Generated: 2026-04-04*
