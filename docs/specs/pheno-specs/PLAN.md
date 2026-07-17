# PLAN: PhenoSpecs — Specification Registry

## Purpose

PhenoSpecs is the unified specification registry for the Phenotype ecosystem — central source of truth for specs, ADRs, and API contracts.

---

## Phases

| Phase | Duration | Key Deliverables | Resource Estimate |
|-------|----------|------------------|-------------------|
| 1: Registry Structure | 2 weeks | Repository layout, spec format, ADR format | 1 developer |
| 2: Spec Templates | 2 weeks | kitty-spec format integration, spec templates | 1 developer |
| 3: OpenAPI Contracts | 2 weeks | API specifications for core services | 1 developer |
| 4: ADR Archive | 2 weeks | Architecture decision records, MADR format | 1 developer |
| 5: Traceability | 2 weeks | spec-links CLI, code annotations | 1 developer |
| 6: CI/CD | 1 week | Validation, link checking, automated publishing | 1 developer |

---

## Phase Details

### Phase 1: Registry Structure
- Repository structure (specs/, adrs/, openapi/)
- registry.yaml format
- SPEC.md template
- ADR template

### Phase 2: Spec Templates
- kitty-spec format alignment
- spec.md structure
- frd.md (functional requirements)
- plan.md (implementation plan)
- Integration with AgilePlus

### Phase 3: OpenAPI Contracts
- User service API
- Auth service API
- Core service APIs
- Schema validation

### Phase 4: ADR Archive
- MADR format adoption
- Architecture decision records
- Decision rationale documentation
- Supersedence tracking

### Phase 5: Traceability
- spec-links CLI tool
- Code annotation formats
- FR → code traceability
- Coverage reports

### Phase 6: CI/CD
- PR validation
- Link checking
- Schema validation
- Auto-publish to site

---

## Resource Summary

| Resource | Estimate |
|----------|----------|
| **Total Duration** | 11 weeks |
| **Developers** | 1 |
| **Complexity** | Medium |
| **Priority** | High |

---

## Status

Active — registry structure established, building out specifications.

---

## Traceability

`/// @trace PHENOSPECS-PLAN-001`
