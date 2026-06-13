pause all future + current wrk

> **Work state:** DORMANT · **Progress:** `███░░░░░░░ 30%`
> Spec-first planning/architecture workspace; rich spec docs but lightly maintained + not yet wired into the registry spine · updated 2026-06-02

# Parpoura

**Specification-First Planning & Architecture** — A comprehensive documentation repository for deterministic venture management and control-plane system design, following spec-driven development practices.

## Overview

Parpoura serves as the canonical planning and architecture hub for complex distributed systems and venture platforms. It emphasizes specification-first design, documented decision-making, and traceable requirements across architecture, development, and deployment phases.

**Core Mission**: Enable deterministic system design through comprehensive specs, architecture documentation, and phased delivery planning with full traceability.

## Technology Stack

- **Documentation**: Markdown, VitePress (static site generation)
- **Planning**: WBS (Work Breakdown Structure), DAG dependency graphs
- **Architecture**: Hexagonal ports & adapters, microservices patterns
- **Specification**: PRD, ADR, FR, User Journeys, PLAN docs
- **Tooling**: Task (Taskfile), npm for doc build/serve

## Key Features

- **Specification-Driven Development**: All code traces back to FRs and PRD epics
- **Architecture Decision Records**: Rationale and trade-offs for all major decisions
- **Phased Delivery Plans**: WBS with explicit DAG dependencies
- **User Journey Mapping**: End-to-end flows with acceptance criteria
- **API Contracts**: OpenAPI/GraphQL specs with implementation guides
- **Live Documentation**: VitePress docsite with searchable knowledge base
- **Roadmap Tracking**: Milestones, phases, and priority sequencing

## Repository Structure

```
parpoura/
├── docs/                      # Canonical documentation root
│   ├── wiki/                 # Architecture and domain knowledge
│   ├── development-guide/    # Engineering workflows and onboarding
│   ├── document-index/       # Generated doc inventory
│   ├── api/                  # Interface and contract specifications
│   ├── roadmap/              # Delivery sequencing and milestones
│   └── .vitepress/           # VitePress site configuration
├── TECHNICAL_SPEC.md         # Low-level design details
├── PLAN.md                   # Phased WBS with dependencies
├── FUNCTIONAL_REQUIREMENTS.md # FR-XXX-NNN specs with traceability
├── USER_JOURNEYS.md          # End-to-end user flows
├── PRD.md                    # Product requirements document
├── SPECS_INDEX.md            # Navigation index for all specs
└── Taskfile.yml              # Development tasks
```

## Quick Start

```bash
# Clone and setup
git clone https://github.com/KooshaPari/Phenotype repos/Parpoura
cd Parpoura

# Review governance
cat CLAUDE.md

# Install dependencies
npm install

# Run quality checks
task quality

# Build documentation site
cd docs && npm run docs:build

# View docs locally (opens in browser)
open docs-dist/index.html

# Regenerate doc index
cd docs && npm run docs:index
```

## Core Documentation Files

| File | Purpose | Status |
|------|---------|--------|
| **PRD.md** | Epics, user stories, acceptance criteria | Authoritative |
| **TECHNICAL_SPEC.md** | Low-level design, algorithms, data structures | Authoritative |
| **FUNCTIONAL_REQUIREMENTS.md** | FR-XXX-NNN specs with test traceability | Authoritative |
| **PLAN.md** | Phased WBS, DAG dependencies, timeline | Living document |
| **USER_JOURNEYS.md** | End-to-end flows with happy/sad paths | Living document |
| **ADR/** | Architecture Decision Records (per-decision) | Archive |

## Spec Traceability

All code and tests trace back to FRs:
- Code: `// Traces to: FR-XXX-NNN` in comments
- Tests: `@pytest.mark.requirement("FR-XXX-NNN")` or test name includes FR ID
- Docs: Cross-references to PLAN, PRD, ADR, USER_JOURNEYS

Run `task quality` to validate traceability coverage.

## Status

**Active Development** — Core documentation framework and VitePress site complete; WBS + DAG automation in progress.

- ✓ PRD, ADR, FR, User Journey templates
- ✓ VitePress docsite generation and hosting
- ✓ Spec traceability framework (FR linking)
- ✓ PLAN.md with DAG dependency tracking
- WIP: Automated DAG visualization from PLAN.md
- WIP: Spec-to-code traceability dashboard

## Related Phenotype Projects

- **AgilePlus** — Work tracking and spec management
- **Tracera** — Distributed observability platform
- **PhenoSpecs** — Shared specification library
- **PhenoAgent** — Agent orchestration framework
- **PlatformKit** — Cross-platform development toolkit

## Governance & Development

- [CLAUDE.md](./CLAUDE.md) - Development guidelines and team context
- **Taskfile.yml** - Standard development tasks (quality, build, docs:build, docs:index)
- **VitePress Config** - docs/.vitepress/config.ts for docsite customization

## License

MIT
