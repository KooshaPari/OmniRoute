# Merged Fragmented Markdown

## Source: governance/GOVERNANCE_SUMMARY.md

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


---

## Source: governance/QUALITY_GATES.md

# QUALITY_GATES.md — Specification Quality Criteria

**Date**: 2026-02-21
**Status**: ACTIVE
**Purpose**: Define what makes a spec "complete" and "correct"

---

## Overview

Every specification must pass five gates before being marked ACTIVE or CLOSED.

---

## Gate 1: Completeness Checklist

Every spec must include:

- [ ] **Header section** (title, date, status, owner, tags)
- [ ] **Executive summary** (1-2 sentences: what does this spec define?)
- [ ] **Scope** (what is IN scope, what is OUT of scope)
- [ ] **Key concepts** (domain terminology with definitions)
- [ ] **Data model** (tables, schemas, or conceptual structures)
- [ ] **API/Interfaces** (if applicable: request/response shapes)
- [ ] **Determinism contract** (if applicable: side effects, external calls)
- [ ] **Relationships to other specs** (explicit cross-references)
- [ ] **Open questions** (if any: linked to NEXT_STEPS.md)
- [ ] **Success criteria** (how to test/validate the spec)

**Validation command**: `task spec:validate`

**Example PASS**:
```markdown
# TECHNICAL_SPEC.md

**Date**: 2026-02-21
**Status**: ACTIVE
**Owner**: Venture Platform Team

## Executive Summary
Defines the control-plane architecture for the Venture agent platform...

## Scope
- IN: Event envelope schema, policy bundle versioning, tool allowlists
- OUT: Individual tool implementations (covered in TRACK_C_CONTROL_PLANE.md)

## Key Concepts
- **EventEnvelopeV1**: Signed container for all external effects
- **PolicyBundle**: Versioned set of policies governing agent actions
...
```

**Example FAIL**:
```markdown
# TECHNICAL_SPEC.md
(Missing header, scope, success criteria)
```

---

## Gate 2: Traceability (NEXT_STEPS.md → Specs)

Every task in NEXT_STEPS.md must reference at least one spec section.

**Validation command**: `task spec:gaps`

**Example PASS**:
```markdown
# NEXT_STEPS.md

#### 1. Venture Control-Plane Scaffolding
**Depends on:** TECHNICAL_SPEC, TRACK_C_CONTROL_PLANE, TRACK_A_ARTIFACT_DETERMINISM_SPEC

**Concrete tasks:**
1. Implement EventEnvelopeV1 (API_EVENTS_SPEC, section 2.1)
```

**Example FAIL**:
```markdown
# NEXT_STEPS.md

#### 1. Venture Control-Plane Scaffolding
Implement some stuff. (No spec reference)
```

---

## Gate 3: Markdown Lint (0 Errors)

All markdown must conform to markdownlint rules (see quality-gate.yml).

**Validation command**: `task lint:markdown`

**Common violations**:

| Error | Fix |
|-------|-----|
| `MD013: Line too long (> 120 chars)` | Wrap text; code blocks OK |
| `MD041: First line in file should be top-level heading` | Start file with `# Title` |
| `MD025: Multiple top-level headings` | Use `##` for sections, not `#` |
| `MD034: Bare URLs` | Use markdown links: `[Title](URL)` |
| `MD031: Fenced code blocks should be surrounded by blank lines` | Add blank line before/after ` ``` ` |

---

## Gate 4: Link Validity (0 Broken Links)

All references to specs, sections, and files must be resolvable.

**Validation command**: `task spec:index`

**Examples**:

| Good | Bad |
|------|-----|
| `See TRACK_C_CONTROL_PLANE.md (section 2.3)` | `See the control plane spec` |
| `[Policy bundle](TECHNICAL_SPEC.md#policy-bundle)` | `[Policy bundle](TECHNICAL_SPEC.md)` |
| `Link to NEXT_STEPS.md task 1` | `Link to the roadmap somewhere` |

**Note**: Internal links use markdown anchor format: `[Text](FILE.md#anchor-id)`. Anchors are generated from heading text (lowercase, spaces → hyphens).

---

## Gate 5: Open Questions Assigned

Every unresolved question must have:

1. **Owner** (name or team)
2. **Due date** (YYYY-MM-DD)
3. **Status** (OPEN | RESOLVED | ESCALATED)

**Location**: NEXT_STEPS.md "Unresolved Open Questions" section

**Validation**: Manual review (not automated)

**Example PASS**:
```markdown
## Unresolved Open Questions

#### Q1. Artifact Determinism for Non-Deterministic Providers
**Owner:** Venture Artifact Team
**Due:** 2026-02-28
**Status:** OPEN
```

**Example FAIL**:
```markdown
## Unresolved Open Questions

#### Q1. How do we handle non-determinism?
(No owner, no due date)
```

---

## Spec-to-Implementation Traceability

When implementing a spec:

1. **Claim the task** in WORK_STREAM.md: `status: CLAIMED | owner: @you`
2. **Reference the spec section** in commit message or code comment
3. **Mark complete**: `status: COMPLETED | completed: YYYY-MM-DD`

**Format**:
```
git commit -m "Implement EventEnvelopeV1 validation

- API_EVENTS_SPEC.md, section 2.1
- Validates event_id, event_type, trace_id, workflow_id, task_id, payload, created_at
- Property tests for schema conformance

Closes: WORK_STREAM.md | venture-p0-task-1"
```

---

## Revision Workflow

### Minor Updates (typo, clarification)

1. Edit spec directly
2. Update `**Date**: YYYY-MM-DD` field
3. Run `task quality` to verify no regressions
4. Commit: `fix: [spec-name] — [brief description]`

### Major Updates (API change, redesign)

1. Change `**Status**: DRAFT`
2. Record decision rationale in `docs/adr/ADR-NNN-[slug].md`
3. Update all cross-references in dependent specs
4. Run `task quality` to verify traceability
5. Change `**Status**: ACTIVE` when ready
6. Commit: `update: [spec-name] for [reason]`

### Spec Retirement

1. Change `**Status**: ARCHIVED`
2. Add note: `Superseded by [NEW_SPEC.md] as of YYYY-MM-DD`
3. Update all cross-references to point to new spec
4. Do NOT delete file (keep for historical reference)

---

## Common Spec Pitfalls

| Pitfall | Fix |
|---------|-----|
| Spec describes implementation details | Move to docs/guides/ or code comments; spec should describe contract only |
| Circular dependencies between specs | Break cycle: make one spec depend on abstract interface defined elsewhere |
| "TBD" or "TK" sections left in | Move to NEXT_STEPS.md "Open Questions"; mark spec as DRAFT |
| Handwave requirements ("obviously", "clearly") | Define explicitly with examples; add to NEXT_STEPS.md if unclear |
| Copy-pasted text from other specs | Link instead: "See X, section Y.Z for definition" |
| No success criteria | Define how to test/validate: "Pass if X test succeeds" |

---

## Success Metrics

| Metric | Target | Validation |
|--------|--------|-----------|
| Spec completeness | 100% (all 8 gates per spec) | `task spec:validate` |
| Coverage (NEXT_STEPS → specs) | 100% (every task traced) | `task spec:gaps` |
| Markdown lint | 0 errors | `task lint:markdown` |
| Broken links | 0 | `task spec:index` |
| Open questions assigned | 100% | Manual review NEXT_STEPS.md |

---

## Quick Reference: Full Validation

```bash
# Check everything
task quality

# Outputs:
# - spec:validate failures (missing required sections)
# - spec:gaps failures (untraced requirements)
# - lint:markdown failures (style/format issues)
# - spec:index failures (broken links)
# - gate output (summary)
```

If all pass: specs are ready for implementation in sibling projects.


---
