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
