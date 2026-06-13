# ADR-001: Workspace Structure and Spec-First Governance

**Date**: 2026-02-21
**Status**: ACCEPTED
**Decider**: parpour Governance Board
**Stakeholders**: Venture Platform Team, CIV Sim Team, parpour Maintainers

---

## Context

The parpour project is a **specification and planning workspace** that drives implementation in two sibling projects:

1. **civ**: A Rust-based civilization simulation engine with 8 core specification artifacts
2. **venture**: An agent-orchestrated artifact generation and policy control platform with 12 specification artifacts

Both projects are complex, interdependent, and require clear coordination. Previous attempts at coordination (ad-hoc meetings, scattered spec locations) led to:

- Unclear spec ownership and update cadence
- Broken cross-references between related specs
- Implementation diverging from spec intent (implementation-first instead of spec-first)
- Lost traceability from high-level roadmap (NEXT_STEPS.md) to individual spec sections

---

## Decision

parpour will operate as a **spec-first governance workspace** with:

1. **Centralized specification location**
   - All 20 spec artifacts (venture/* and spec references) live in parpour
   - Single source of truth for architecture, contracts, and data models
   - Clear ownership and status tracking for each spec (DRAFT → ACTIVE → CLOSED)

2. **Spec-before-code workflow**
   - Before implementing in civ or venture: update spec(s) in parpour
   - Specs define contracts; implementations validate against contracts
   - No "ad-hoc" implementation; all work traces to spec section

3. **Governance enforcement via tasks and gates**
   - Task runner (Taskfile.yml) enforces quality checks: spec validation, markdown linting, traceability
   - Quality gates (quality-gate.yml) define pass/fail criteria
   - Every commit to specs must pass `task quality` before merge

4. **Work stream tracking (WORK_STREAM.md)**
   - Roadmap (NEXT_STEPS.md) defines P0/P1/P2 priorities
   - Work stream tracks ownership and completion status
   - Blockers and escalations are visible and assigned

5. **Clear agent governance (AGENTS.md)**
   - Agents (human or AI) follow spec-first discipline
   - No shortcuts or "just code it" mode
   - Architecture decisions recorded in docs/adr/ with rationale

---

## Rationale

### Why Spec-First?

- **Single source of truth**: Prevents implementation drift and cross-project conflicts
- **Determinism**: All specs define deterministic contracts (no "magic" or ambiguity)
- **Traceability**: Every implementation decision is linked to a spec section and recorded
- **Testability**: Specs define success criteria; implementations are validated against criteria
- **Coordination**: civ and venture teams both read the same spec, not different interpretations

### Why Centralize in parpour?

- **parpour is neutral**: Not part of civ or venture; no implementation bias
- **Shared reference**: Both projects can read and update specs without merge conflicts
- **Consistency**: One spec naming convention, one quality gate system, one versioning scheme
- **Handoff clarity**: Spec is the handoff artifact; implementation is downstream

### Why Governance Enforcement?

- **Consistency**: Quality gates ensure no "forgotten" specs or untraced tasks
- **Visibility**: Every task, blocker, and open question is visible and tracked
- **Accountability**: Clear ownership (task owner, decision owner) prevents ambiguity
- **Fail fast**: Spec validation catches issues before implementation begins

---

## Implementation

### Directory Structure

```
parpour/
├── CLAUDE.md                  # Project governance guide (spec-first workflow)
├── AGENTS.md                  # Agent rules and workflows
├── Taskfile.yml               # Task runner config
├── quality-gate.yml           # Quality thresholds
├── NEXT_STEPS.md              # Implementation roadmap (P0/P1/P2)
├── SPECS_INDEX.md             # Master spec index
├── venture/                   # Venture specs (12 artifacts)
│   ├── TECHNICAL_SPEC.md
│   ├── TRACK_A_ARTIFACT_DETERMINISM_SPEC.md
│   ├── TRACK_B_TREASURY_COMPLIANCE_SPEC.md
│   ├── TRACK_C_CONTROL_PLANE.md
│   ├── API_EVENTS_SPEC.md
│   ├── DATA_MODEL_DB_SPEC.md
│   ├── OPS_COMPLIANCE_SPEC.md
│   ├── USER_SPEC.md
│   ├── PRODUCT_MODEL.md
│   ├── SCHEMA_PACK.md
│   ├── ROLE_TOOL_ALLOWLIST_MATRIX.md
│   └── IMPLEMENTATION_ROADMAP.md
├── docs/
│   ├── governance/
│   │   ├── GOVERNANCE_SUMMARY.md       # Baseline rules (inherited + overrides)
│   │   └── QUALITY_GATES.md            # Spec quality criteria
│   ├── reference/
│   │   └── WORK_STREAM.md              # Work tracking (P0/P1/P2 tasks + blockers)
│   ├── adr/
│   │   └── ADR-001-workspace-structure.md  # This file
│   ├── research/
│   │   └── CONVERSATION_DUMP_YYYY-MM-DD.md (optional research notes)
│   └── guides/
│       └── (Future: EXTERNAL_AGENTS.md, AGENT_ORCHESTRATION_SNIPPET.md, etc.)
├── scripts/
│   ├── spec-validate.sh       # Validates spec completeness
│   ├── spec-index.sh          # Builds spec index, checks links
│   ├── spec-gaps.sh           # Finds untraced requirements
│   ├── venture-check.sh       # Venture spec health check
│   ├── civ-check.sh           # CIV spec health check
│   ├── quality-gate.sh        # Full quality gate system
│   └── lib/
│       └── (Shared utilities for scripts)
```

### Workflow

1. **Claim a task** from NEXT_STEPS.md
2. **Update WORK_STREAM.md**: mark as CLAIMED
3. **Edit relevant specs** (venture/*, civ/*, NEXT_STEPS.md)
4. **Run quality gates**: `task quality` or `task quality`
5. **Commit and push**
6. **Mark complete** in WORK_STREAM.md
7. **Implement in sibling projects** (civ or venture), following their governance

### Quality Gates

| Gate | Check | Command |
|------|-------|---------|
| 1 | Spec completeness | `task spec:validate` |
| 2 | Traceability (NEXT_STEPS → specs) | `task spec:gaps` |
| 3 | Markdown lint | `task lint:markdown` |
| 4 | Link validity | `task spec:index` |
| 5 | Open questions assigned | Manual review (NEXT_STEPS.md) |

---

## Consequences

### Positive

- ✓ Clear handoff between spec and implementation teams
- ✓ Deterministic, traceable contracts prevent scope creep
- ✓ Shared spec language ensures civ and venture align
- ✓ Blockers and escalations are visible and tracked
- ✓ ADR history captures "why" behind decisions

### Negative

- ✗ Requires discipline: no "quick fixes" without updating spec
- ✗ Spec-first may slow initial prototyping (mitigated by DRAFT status)
- ✗ Task runner scripts must be maintained (spec-validate.sh, etc.)

### Risks

- **Risk**: Specs diverge from implementation during feature work
  - **Mitigation**: Spec-before-code rule + quality gates enforced at commit time
  - **Owner**: parpour Maintainers

- **Risk**: Specs become stale; implementations ignore them
  - **Mitigation**: WORK_STREAM.md tracking forces explicit handoff; orphaned specs are visible
  - **Owner**: Project Lead (monthly spec health audit)

- **Risk**: Cross-project merge conflicts if both civ and venture update a shared spec
  - **Mitigation**: Shared specs (API_EVENTS_SPEC, SCHEMA_PACK) are "append-only"; avoid in-place edits
  - **Owner**: parpour Maintainers

---

## Validation Commands

```bash
# Validate spec completeness
task spec:validate

# Build spec index; check all links are valid
task spec:index

# Find requirements in NEXT_STEPS not traced to specs
task spec:gaps

# Lint all markdown
task lint:markdown

# Run all checks (strict canonical quality gate)
task quality

# Check venture spec linking
task venture:check

# Check CIV spec status
task civ:check
```

---

## Related Decisions

- **ADR-002** (future): CIV spec numbering and naming convention
- **ADR-003** (future): Venture spec release versioning strategy
- **ADR-004** (future): Cross-project dependency management

---

## Follow-Up Review Date

**2026-03-21** (4 weeks)

Check:
- Are specs being updated before implementation?
- Are quality gates catching issues?
- Are work stream items being tracked and completed?
- Are blockers being resolved on schedule?

---

## References

- CLAUDE.md (project governance)
- AGENTS.md (agent workflow rules)
- NEXT_STEPS.md (implementation roadmap)
- SPECS_INDEX.md (master spec catalog)
- Global CLAUDE.md (~/.claude/CLAUDE.md)
