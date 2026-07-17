# phenotype-registry Charter

## 1. Mission Statement

**phenotype-registry** is the central registry and discovery service for the Phenotype ecosystem—providing a unified catalog of packages, services, schemas, and APIs across all Phenotype projects. The mission is to enable discoverability, standardization, and governance by maintaining a single source of truth for ecosystem assets, their relationships, and their lifecycles.

The project exists to be the map of the Phenotype territory—enabling developers to find components, understand dependencies, track versions, and ensure that the ecosystem remains coherent and navigable as it scales.

---

## 2. Tenets (Unless You Know Better Ones)

### Tenet 1: Central Source of Truth

One registry for the ecosystem. No fragmentation. All packages, services, schemas catalogued. Consistent metadata. Single query point.

### Tenet 2. Automated Registration

Registration happens automatically. CI/CD integration. No manual uploads. Git tags trigger versions. Metadata extracted from code.

### Tenet 3. Rich Metadata

More than just names and versions. Dependencies. Capabilities. Documentation links. Ownership. Lifecycle state. Rich, queryable metadata.

### Tenet 4. Schema Registry Integration

API schemas registered and versioned. Compatibility checking. Breaking change detection. Consumer notifications. Schema evolution tracked.

### Tenet 5. Dependency Visibility

Full dependency graph. Transitive dependencies visible. Conflict detection. Impact analysis. Understand the ripple effects.

### Tenet 6. Lifecycle Management

Packages have states. Active. Deprecated. Archived. Lifecycle transitions tracked. Deprecation notices automatic. Migration guidance provided.

### Tenet 7. Governance Integration

Registry integrated with governance. Charter compliance tracked. Quality gates visible. Approval workflows supported. Audit trail maintained.

---

## 3. Scope & Boundaries

### In Scope

**Package Registry:**
- Crate registry (Rust)
- NPM registry (TypeScript/JavaScript)
- PyPI registry (Python)
- Go module proxy
- Container registry

**Service Catalog:**
- Service registration
- API endpoint catalog
- Service dependency mapping
- Health status integration

**Schema Registry:**
- OpenAPI spec registry
- Protobuf schema registry
- JSON Schema registry
- GraphQL schema registry
- Compatibility checking

**Metadata Management:**
- Ownership information
- Documentation links
- Source repository links
- Lifecycle state
- Quality metrics

**Discovery Tools:**
- Search and query API
- Dependency graph visualization
- Impact analysis
- Usage analytics

### Out of Scope

- Source code hosting (use Git)
- Build artifact storage (use artifact repositories)
- Deployment automation (use CI/CD)
- Secret storage (use secret managers)

### Boundaries

- Registry catalogs and tracks, doesn't replace package managers
- Metadata aggregation, not primary storage
- Discovery layer, not build system
- Governance integration, not enforcement

---

## 4. Target Users & Personas

### Primary Persona: Developer Drew

**Role:** Engineer looking for components
**Goals:** Find packages, understand dependencies
**Pain Points:** Can't find existing components, dependency conflicts
**Needs:** Good search, clear metadata, dependency info
**Tech Comfort:** High, comfortable with registries

### Secondary Persona: Architect Avery

**Role:** System architect planning changes
**Goals:** Understand ecosystem structure, plan migrations
**Pain Points:** Unknown dependencies, breaking change impact
**Needs:** Dependency graphs, impact analysis, lifecycle info
**Tech Comfort:** Very high, expert in system design

### Tertiary Persona: Release Engineer Rick

**Role:** Engineer managing releases
**Goals:** Track versions, manage deprecations
**Pain Points:** Version confusion, deprecated packages still used
**Needs:** Version tracking, deprecation workflow, notifications
**Tech Comfort:** High, release management expert

---

## 5. Success Criteria (Measurable)

### Coverage Metrics

- **Package Coverage:** 100% of internal packages registered
- **Service Coverage:** 100% of services catalogued
- **Schema Coverage:** 100% of APIs schemas registered
- **Metadata Completeness:** 95%+ packages have complete metadata

### Discovery Metrics

- **Search Success:** 90%+ of searches find relevant results
- **Time to Find:** Average <2 minutes to find component
- **Dependency Clarity:** 100% of dependencies visible
- **Usage Analytics:** Usage data available for all packages

### Governance Metrics

- **Compliance Tracking:** 100% of packages tracked for compliance
- **Deprecation Rate:** <5% of packages deprecated per quarter
- **Migration Success:** 80%+ of deprecated packages migrated
- **Audit Trail:** 100% of changes auditable

---

## 6. Governance Model

### Component Organization

```
phenotype-registry/
├── packages/        # Package registry
├── services/        # Service catalog
├── schemas/         # Schema registry
├── metadata/        # Metadata management
├── search/          # Search and discovery
├── api/             # Public API
└── web/             # Web interface
```

### Development Process

**New Registrations:**
- Automated via CI/CD
- Metadata validation
- Duplicate checking

**Lifecycle Changes:**
- Approval workflow
- Notification to consumers
- Audit logging

---

## 7. Charter Compliance Checklist

### For New Entries

- [ ] Metadata complete
- [ ] Ownership assigned
- [ ] Documentation linked
- [ ] Dependencies declared

### For Lifecycle Changes

- [ ] Approval workflow followed
- [ ] Users notified
- [ ] Migration guide provided
- [ ] Audit logged

---

## 8. Decision Authority Levels

### Level 1: Registry Maintainer Authority

**Scope:** Metadata updates, corrections
**Process:** Maintainer approval

### Level 2: Governance Team Authority

**Scope:** Lifecycle changes, compliance
**Process:** Governance review

### Level 3: Technical Steering Authority

**Scope:** Registry structure, API changes
**Process:** Steering approval

### Level 4: Executive Authority

**Scope:** Strategic direction
**Process:** Executive approval

---

*This charter governs phenotype-registry, the ecosystem catalog. Discovery enables reuse.*

*Last Updated: April 2026*
*Next Review: July 2026*
