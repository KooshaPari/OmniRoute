# GOVERNANCE_SUMMARY.md — parpour Governance Baseline

**Date**: 2026-02-21
**Status**: ACTIVE
**Scope**: All governance rules applying to parpour project

---

## Inheritance Hierarchy

parpour governance is layered:

1. **Global kush standards** (highest precedence)
   - Location: `~/.claude/CLAUDE.md`
   - Scope: Security (no process killing), no fallbacks, library-first, agent patterns

2. **Sibling project standards** (medium precedence)
   - Location: `kush/trace/CLAUDE.md`, `kush/civ/CLAUDE.md`
   - Scope: Development philosophy, quality gates, script organization

3. **parpour-specific overrides** (lowest precedence)
   - Location: `CLAUDE.md`, `AGENTS.md`, quality-gate.yml
   - Scope: Spec-first workflow, markdown linting, traceability targets

---

## Core Rules (Non-Negotiable)

### Security

- **FORBIDDEN**: Killing agent or terminal processes (cursor-agent, thegent, bash, zsh, etc.)
- **ALLOWED**: `thegent mcp prune`, `thegent stop <session_id>` for cleanup
- See global CLAUDE.md for full security rules

### Code Quality Philosophy

- **Extend, never duplicate**: Refactor originals; no v2 files
- **Primitives first**: Build generic blocks before domain logic
- **Research before implementing**: Check existing solutions before custom code
- **Zero fallbacks**: Fail loudly; no silent compatibility shims
- **Library-first**: Use tenacity (retry), httpx (HTTP), structlog (logging), pydantic (validation)

### Specification Quality

- **Spec-first, always**: Update specs before implementation
- **Determinism-first**: All specs define deterministic contracts
- **Fail loudly**: Call out unknowns explicitly (NEXT_STEPS.md "Open Questions")
- **Modular specs**: Each spec covers one domain; cross-references are explicit
- **No duplication**: One truth per concept; link instead of copy-paste

---

## Quality Gate Targets

| Gate | Metric | Target | Tool |
|------|--------|--------|------|
| 1 | Spec completeness | 100% | spec:validate task |
| 2 | Traceability (NEXT_STEPS → specs) | 100% | spec:gaps task |
| 3 | Markdown lint errors | 0 | markdownlint-cli2 |
| 4 | Broken links | 0 | spec:index task |
| 5 | Open questions assigned | 100% | manual review |

---

## Spec Organization

### Spec Lifecycle

- **DRAFT**: Incomplete; open to changes
- **ACTIVE**: Implemented or being implemented
- **CLOSED**: Final; no edits without formal review
- **ARCHIVED**: Superseded by newer spec

### Naming Convention

| Type | Format | Examples |
|------|--------|----------|
| Core specs | `DESCRIPTION_SPEC.md` | `TECHNICAL_SPEC.md`, `TRACK_A_ARTIFACT_DETERMINISM_SPEC.md` |
| Track specs | `TRACK_X_NAME_SPEC.md` | `TRACK_C_CONTROL_PLANE.md`, `TRACK_B_TREASURY_COMPLIANCE_SPEC.md` |
| Architecture decisions | `docs/adr/ADR-[NUMBER]-[SLUG].md` | `ADR-001-workspace-structure.md` |

---

## Required Files (This Workspace)

| File | Purpose | Status |
|------|---------|--------|
| CLAUDE.md | Project governance guide | ACTIVE |
| AGENTS.md | Agent rules and workflows | ACTIVE |
| Taskfile.yml | Task runner configuration | ACTIVE |
| quality-gate.yml | Quality thresholds | ACTIVE |
| NEXT_STEPS.md | Implementation roadmap | ACTIVE |
| SPECS_INDEX.md | Master spec index | ACTIVE |
| docs/governance/GOVERNANCE_SUMMARY.md | This file | ACTIVE |
| docs/governance/QUALITY_GATES.md | Spec quality criteria | ACTIVE |
| docs/reference/WORK_STREAM.md | Active work tracking | ACTIVE |
| docs/adr/ADR-001-workspace-structure.md | Workspace design rationale | ACTIVE |

---

## Verification Commands

```bash
# Validate all specs
task spec:validate

# Index and check coverage
task spec:index

# Find untraced requirements
task spec:gaps

# Run all checks
task quality
```

---

## Escalation Path

### Spec Issues

1. **Incomplete spec**: Add to NEXT_STEPS.md "Open Questions" with owner + due date
2. **Contradictory specs**: Mark both specs as DRAFT; record decision in docs/adr/
3. **Untraced requirement**: Add task to NEXT_STEPS.md with spec reference

### Quality Gate Failures

1. Run `task quality` to see all failures
2. Fix markdown lint errors (markdownlint-cli2 errors are mechanical)
3. For spec validation errors, review QUALITY_GATES.md checklist
4. Escalate systemic issues (e.g., tool misconfiguration) to project lead

---

## Related Documents

- **Detailed quality rules**: `docs/governance/QUALITY_GATES.md`
- **Work tracking**: `docs/reference/WORK_STREAM.md`
- **Implementation roadmap**: `NEXT_STEPS.md`
- **Specification index**: `SPECS_INDEX.md`
- **Architecture decisions**: `docs/adr/`

---

## Summary

parpour is a **spec-first governance workspace** that feeds civ and venture. All work follows:

1. Update specs in parpour
2. Run `task quality` to validate
3. Implement in sibling projects (following their AGENTS.md rules)
4. Update WORK_STREAM.md when complete

No shortcuts. No fallbacks. All changes are breaking changes by design.

---

## Venture-Specific Governance (Spec Layers & Integration)

Venture is an agent-orchestrated artifact generation and policy control platform. Its 12 specifications are organized in a 4-layer hierarchy and must be validated against 5 CIV integration points.

### Venture Spec Layers (Hierarchical Organization)

**Layer 1: Foundation**
- `TECHNICAL_SPEC.md` — Core architecture, control plane, runtime, security posture

**Layer 2: Core Subsystems**
- `ARTIFACT_COMPILER_SPEC.md` — Artifact IR schemas (SlideSpec, DocSpec, etc.), deterministic build pipeline
- `TRACK_A_ARTIFACT_DETERMINISM_SPEC.md` — Determinism contracts, build/replay guarantees
- `TRACK_B_TREASURY_COMPLIANCE_SPEC.md` — Money control, spend policies, event ledger, compliance
- `TRACK_C_CONTROL_PLANE.md` — FSM, event bus, tool allowlists, isolation, rollout stages
- `USER_SPEC.md` — User roles, capabilities, onboarding, multi-tenant isolation

**Layer 3: Cross-Cutting**
- `API_EVENTS_SPEC.md` — Event schema contracts, FSM transitions, strict validation
- `DATA_MODEL_DB_SPEC.md` — Artifact IR tables, ledger tables, workflow tables, audit logs
- `OPS_COMPLIANCE_SPEC.md` — Compliance machine, audit toolchain, observability, incident response
- `ROLE_TOOL_ALLOWLIST_MATRIX.md` — Per-role tool allowlists and capability matrix

**Layer 4: Product & Schema**
- `PRODUCT_MODEL.md` — Vision, users, jobs-to-be-done, success metrics
- `SCHEMA_PACK.md` — Consolidated schema family (all subsystems)
- `IMPLEMENTATION_ROADMAP.md` — Phased rollout plan and task breakdown

### CIV-Venture Integration Points (5 Critical)

Every Venture spec touching one of these 5 integration points must validate alignment with corresponding CIV spec (per `SPECS_INDEX.md`):

| Point | CIV Spec | Venture Spec | Alignment |
|-------|----------|--------------|-----------|
| **1. Economy Ledger** | CIV-0100 | TRACK_B | Double-entry accounting, market clearing, conservation invariants |
| **2. Simulation State & Workflow** | CIV-0001, CIV-0100 | TRACK_C | Tick-based state transitions, FSM, policy evaluation patterns |
| **3. Actor Lifecycle & Compliance** | CIV-0103 | USER_SPEC, OPS | Citizen lifecycle, institutional change, audit trails |
| **4. Resource Quotas & Energy** | CIV-0102, CIV-0100 | TRACK_B, TRACK_C | Conservation equation, rate limits, cost budgets |
| **5. Determinism & Constraints** | CIV-0104 | TRACK_A | Minimal constraint set theorem, artifact deterministic build contracts |

**Integration Validation Checklist** (for specs touching integration points):
- [ ] Read corresponding CIV spec and understand model
- [ ] Verify schema/FSM alignment between CIV and Venture
- [ ] Check event shapes are compatible
- [ ] Confirm determinism/replay guarantees hold across both systems
- [ ] Update SPECS_INDEX.md with new dependencies if discovered

### Venture Quality Gates (9 Layers)

| Gate | Check | Tool/Command | Pass Condition |
|------|-------|--------------|----------------|
| **1** | Markdown syntax | `task spec:validate` | No syntax errors |
| **2** | Completeness | manual | All required sections present |
| **3** | Formatting | `task spec:lint` | Passes markdownlint |
| **4** | Cross-references | `task spec:index` | All links valid, dependency DAG clean |
| **5** | Traceability | `task traceability:check` | Entry in TRACEABILITY_MATRIX.md, implementation phase defined |
| **6** | CIV integration | `task spec:check-integration` | All 5 integration points mapped to CIV specs |
| **7** | ADR review | manual | Major decisions have ADRs, status tracked |
| **8** | Versioning | manual | Breaking changes increment MINOR, deprecations documented |
| **9** | Full suite | `task quality` | All gates 1–8 pass |

### Venture Workflow: Spec Development

**Create a New Spec:**
1. Create `NEWSPEC.md` in root directory
2. Follow document standards (Header, Overview, Key Sections, References)
3. Add entry to `SPECS_INDEX.md`
4. Run `task spec:validate && task spec:lint`
5. If touching an integration point, run `task spec:check-integration`
6. Get peer review (Review agent or team)
7. Update `docs/traceability/VENTURE_TRACEABILITY_MATRIX.md`
8. Set status: DRAFT → REVIEW → CLOSED
9. Merge when `task quality` passes

**Update Existing Venture Spec:**
- **Minor** (clarification, example): Direct edit, run linting, merge
- **Major** (breaking change): Create ADR first, bump version, migrate users, merge

**Archive Conversation:**
After major spec work, write conversation dump to `docs/research/CONVERSATION_DUMP_YYYY-MM-DD.md` including: spec changes, decisions, cross-track findings, open questions.

### Venture Commands Quick Reference

```bash
# Validate specs
task spec:validate        # Check structure
task spec:lint            # Markdown linting
task spec:index           # Cross-references
task spec:check-integration  # CIV alignment

# Traceability
task traceability:check      # Implementation phases
task traceability:build-matrix  # Regenerate matrix

# Full validation
task quality              # All gates 1–9

# Documentation
task docs:list            # List all docs
task governance:setup     # Create docs/ structure
```
