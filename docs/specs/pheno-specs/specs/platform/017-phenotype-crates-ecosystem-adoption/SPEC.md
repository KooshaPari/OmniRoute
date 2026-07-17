# phenotype Crates Ecosystem Adoption

## Meta

- **ID**: 017-phenotype-crates-ecosystem-adoption
- **Title**: phenotype Crates Ecosystem Adoption — Shared Infrastructure Across Projects
- **Created**: 2026-04-04
- **State**: specified
- **Scope**: phenotype-infrakit/crates, bare-cua, heliosCLI, HexaKit, other Rust projects

## Context

The Phenotype ecosystem has 50+ foundational crates in `/repos/crates/` providing infrastructure services: logging (phenotype-logging), metrics (phenotype-metrics), config (phenotype-config-core), validation (phenotype-validation), error handling (phenotype-error-core), async traits (phenotype-async-traits), contracts (phenotype-contracts), and more.

Many projects across the repos shelf are not using these crates, instead duplicating functionality or implementing their own versions. This creates:
- Wasted effort reimplementing the same patterns
- Inconsistent APIs across projects
- Fragmented maintenance burden
- Missed opportunities for shared improvements

## Problem Statement

Projects are not leveraging phenotype crates:
- **bare-cua**: Custom config, validation, error handling
- **heliosCLI**: Custom telemetry, metrics, health checks
- **HexaKit**: Custom contracts, port traits
- **agentapi-plusplus**: Custom error types, async patterns
- **Other Rust projects**: Various duplications

## Goals

- Drive adoption of phenotype-* crates across the Rust ecosystem
- Eliminate duplication of foundational patterns
- Establish phenotype crates as the shared infrastructure layer
- Create migration guides for each target project
- Maintain backward compatibility during transitions

## Target Projects & Crate Mapping

| Project | Current Duplication | phenotype Crate | Priority |
|---------|-------------------|-----------------|----------|
| bare-cua | Config management | phenotype-config-core | High |
| bare-cua | Validation logic | phenotype-validation | High |
| bare-cua | Error types | phenotype-error-core | High |
| heliosCLI | Telemetry/OTel | phenotype-telemetry | High |
| heliosCLI | Metrics | phenotype-metrics | High |
| heliosCLI | Health checks | phenotype-health | Medium |
| HexaKit | Interface traits | phenotype-contracts | High |
| HexaKit | Port definitions | phenotype-port-traits | High |
| agentapi-plusplus | Error handling | phenotype-error-core | Medium |
| agentapi-plusplus | Async traits | phenotype-async-traits | Medium |

## phenotype Crate Inventory

### Foundation Layer
| Crate | Purpose | Dependencies | Maturity |
|-------|---------|--------------|----------|
| phenotype-core | Core types and traits | serde, chrono | Stable |
| phenotype-errors | Error handling | thiserror | Stable |
| phenotype-time | Time utilities | chrono | Stable |
| phenotype-string | String utilities | none | Stable |
| phenotype-validation | Input validation | none | Stable |
| phenotype-iter | Iterator utilities | none | Stable |
| phenotype-async-traits | Async trait patterns | tokio | Stable |
| phenotype-macros | Procedural macros | syn, quote | Stable |

### Infrastructure Layer
| Crate | Purpose | Dependencies | Maturity |
|-------|---------|--------------|----------|
| phenotype-logging | Structured logging | tracing | Stable |
| phenotype-telemetry | OpenTelemetry | opentelemetry | Beta |
| phenotype-metrics | Metrics collection | prometheus | Beta |
| phenotype-config-core | Config management | toml, serde | Stable |
| phenotype-error-core | Canonical errors | thiserror | Stable |
| phenotype-retry | Retry logic | tokio | Stable |
| phenotype-state-machine | FSM framework | none | Beta |
| phenotype-event-bus | Message bus | tokio | Beta |
| phenotype-bid | Business ID generation | ulid | Stable |
| phenotype-contract | Contract definitions | none | Beta |
| phenotype-http-client | HTTP client | reqwest | Beta |
| phenotype-bdd | BDD testing | cucumber | Beta |

### Security Layer
| Crate | Purpose | Dependencies | Maturity |
|-------|---------|--------------|----------|
| phenotype-security-aggregator | Security utilities | none | Beta |
| phenotype-compliance-scanner | Compliance checks | none | Alpha |
| phenotype-policy-engine | Policy evaluation | none | Beta |
| phenotype-mcp-core | MCP types | serde | Beta |

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    APPLICATION PROJECTS                          │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐          │
│  │bare-cua  │ │heliosCLI │ │ HexaKit  │ │ agentapi │          │
│  │          │ │          │ │          │ │-plusplus │          │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘          │
└───────┼─────────────┼─────────────┼─────────────┼──────────────┘
        │             │             │             │
        └─────────────┴──────┬──────┴─────────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
        ┌─────▼─────┐ ┌──────▼──────┐ ┌──────▼──────┐
        │ phenotype │ │ phenotype   │ │ phenotype   │
        │ -config   │ │ -telemetry  │ │ -contracts  │
        │ -core     │ │             │ │             │
        └───────────┘ └─────────────┘ └─────────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
        ┌─────▼─────┐ ┌──────▼──────┐ ┌──────▼──────┐
        │ phenotype │ │ phenotype   │ │ phenotype   │
        │ -core     │ │ -errors     │ │ -validation│
        │ (types)   │ │             │ │             │
        └───────────┘ └─────────────┘ └─────────────┘
```

## Migration Strategy

### Phase 1: Assessment
For each target project:
- Identify duplicated functionality
- Map to phenotype crate equivalents
- Assess breaking changes
- Estimate migration effort

### Phase 2: Foundation Crates First
Start with zero-dependency crates:
- phenotype-core (types)
- phenotype-error-core (errors)
- phenotype-validation (validation)
- phenotype-string (utilities)

### Phase 3: Infrastructure Crates
Add infrastructure dependencies:
- phenotype-config-core (config)
- phenotype-logging (logging)
- phenotype-telemetry (observability)
- phenotype-metrics (metrics)

### Phase 4: Advanced Crates
Add specialized crates:
- phenotype-contracts (interfaces)
- phenotype-port-traits (ports)
- phenotype-mcp-core (MCP types)

## Work Packages

| WP | Title | Owner | State | Est |
|----|-------|-------|-------|-----|
| WP1 | bare-cua migration (config, validation, errors) | TBD | planned | 5d |
| WP2 | heliosCLI migration (telemetry, metrics, health) | TBD | planned | 5d |
| WP3 | HexaKit migration (contracts, port-traits) | TBD | planned | 4d |
| WP4 | agentapi-plusplus migration (errors, async) | TBD | planned | 3d |
| WP5 | Create migration guides | TBD | planned | 3d |
| WP6 | Adoption tracking dashboard | TBD | planned | 2d |
| WP7 | Cross-project integration tests | TBD | planned | 3d |

## Acceptance Criteria

- [ ] bare-cua uses phenotype-config-core, phenotype-validation, phenotype-error-core
- [ ] heliosCLI uses phenotype-telemetry, phenotype-metrics, phenotype-health
- [ ] HexaKit uses phenotype-contracts, phenotype-port-traits
- [ ] agentapi-plusplus uses phenotype-error-core, phenotype-async-traits
- [ ] Migration guides published for all target projects
- [ ] No regression in functionality after migrations
- [ ] All projects pass tests with new dependencies

## Dependencies

- phenotype crates must be published to crates.io
- Target projects must update Cargo.toml
- CI must pass with new dependencies

## Related

- worklogs/INTEGRATION.md — Cross-project integration analysis
- worklogs/DUPLICATION.md — Duplication tracking
- crates/SPEC.md — phenotype crates ecosystem spec
- phenotype-infrakit SPEC (013) — Crate stabilization

## FR Traceability

| FR | Description | WP |
|----|-------------|----|
| FR-017-001 | bare-cua migration | WP1 |
| FR-017-002 | heliosCLI migration | WP2 |
| FR-017-003 | HexaKit migration | WP3 |
| FR-017-004 | agentapi-plusplus migration | WP4 |
| FR-017-005 | Migration guides | WP5 |
| FR-017-006 | Adoption tracking | WP6 |
