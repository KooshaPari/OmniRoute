# Governance Scaffold Summary — parpour

**Created**: 2026-02-21
**Scope**: Full governance scaffold for spec-first workspace
**Status**: COMPLETE

---

## Overview

parpour has been scaffolded as a **spec-first governance workspace** matching the quality standards of sibling kush projects (trace, civ, zen-mcp-server). All 20 specification artifacts (venture + CIV) are now governed by:

1. Clear governance documents (CLAUDE.md, AGENTS.md)
2. Enforced quality gates (Taskfile.yml, quality-gate.yml)
3. Work stream tracking (WORK_STREAM.md)
4. Architecture decisions (docs/adr/)
5. Automated validation scripts

---

## Files Created

### Root-Level Governance (5 files)

| File | Purpose | Status |
|------|---------|--------|
| **CLAUDE.md** | Project governance guide; spec-first workflow | COMPLETE |
| **AGENTS.md** | Agent rules and workflow governance | COMPLETE |
| **Taskfile.yml** | Task runner (spec:validate, spec:index, spec:gaps, quality) | COMPLETE |
| **quality-gate.yml** | Quality thresholds (markdown lint, spec completeness, traceability) | COMPLETE |
| **GOVERNANCE_SCAFFOLD_SUMMARY.md** | This summary document | COMPLETE |

### Documentation Structure (docs/ directory)

#### Governance (2 files)
- **docs/governance/GOVERNANCE_SUMMARY.md** — Baseline rules (inherited + overrides)
- **docs/governance/QUALITY_GATES.md** — Spec quality criteria (5 gates)

#### Reference (1 file)
- **docs/reference/WORK_STREAM.md** — Active work tracking (P0/P1/P2 tasks, blockers, open questions)

#### Architecture Decisions (1 file)
- **docs/adr/ADR-001-workspace-structure.md** — Design rationale for spec-first governance

#### Directory Structure (created, empty for user content)
- **docs/research/** — For research notes and conversation dumps
- **docs/guides/** — For implementation guides and orchestration patterns

### Scripts (7 files)

| Script | Purpose | Status |
|--------|---------|--------|
| **scripts/spec-validate.sh** | Validate spec completeness (required sections) | COMPLETE |
| **scripts/spec-index.sh** | Index specs and check link validity | COMPLETE |
| **scripts/spec-gaps.sh** | Find untraced requirements | COMPLETE |
| **scripts/venture-check.sh** | Verify venture spec health | COMPLETE |
| **scripts/civ-check.sh** | Verify CIV spec references | COMPLETE |
| **scripts/quality-gate.sh** | Run full 9-gate quality system | COMPLETE |
| **scripts/lib/common.sh** | Shared logging and utility functions | COMPLETE |

---

## Key Features

### 1. Spec-First Workflow

**Enforced by CLAUDE.md and AGENTS.md:**

```
Update specs in parpour
  ↓
Run task quality to validate
  ↓
Implement in sibling projects (civ, venture)
  ↓
Update WORK_STREAM.md when complete
```

### 2. Quality Gates (5 Automated Checks)

| Gate | Check | Command |
|------|-------|---------|
| 1 | Spec completeness | `task spec:validate` |
| 2 | Link validity | `task spec:index` |
| 3 | Traceability (NEXT_STEPS → specs) | `task spec:gaps` |
| 4 | Venture spec health | `task venture:check` |
| 5 | CIV spec status | `task civ:check` |

**Full validation:**
```bash
task quality      # Strict full checks (spec validation + all 5 gates + markdown lint)
```

### 3. Work Stream Tracking

**docs/reference/WORK_STREAM.md** tracks:
- P0 foundation tasks (Week 1) — 3 tasks
- P1 integration tasks (Week 2) — 2 tasks
- P2 polish tasks (Week 3+) — 1 task
- Spec validation tasks (ongoing) — 3 tasks
- Blockers and escalations
- 8 open questions (Q1–Q8) with due dates and owners

### 4. Governance Inheritance

**Layers (highest to lowest precedence):**

1. **Global kush standards** (~/.claude/CLAUDE.md)
   - Security (no process killing)
   - No fallbacks or legacy compatibility
   - Library-first, agent orchestration patterns

2. **Sibling project standards** (trace/CLAUDE.md, civ/CLAUDE.md)
   - Development philosophy (extend, primitives-first, research-before-implementing)
   - Quality gates and script organization

3. **parpour overrides** (CLAUDE.md, AGENTS.md, quality-gate.yml)
   - Spec-first workflow (new requirement)
   - Markdown linting (new requirement)
   - Traceability targets (spec-specific)

---

## Quick Start Commands

```bash
# Validate all specs
task spec:validate

# Build spec index; check links
task spec:index

# Find untraced requirements
task spec:gaps

# Run all checks
task quality

# Check venture spec health
task venture:check

# Check CIV spec status
task civ:check

# List active work items
task work:list

# Claim a work item
task work:claim -- venture-p0-task-1
```

---

## Next Steps for Users

1. **Read CLAUDE.md** — Understand spec-first workflow and governance rules
2. **Review AGENTS.md** — Learn agent workflow rules (claim, implement, complete)
3. **Check WORK_STREAM.md** — Find unclaimed P0 tasks
4. **Run `task quality`** — Validate current spec state
5. **Claim a task** — Update WORK_STREAM.md with your name
6. **Implement** — Update specs, then implement in sibling projects
7. **Mark complete** — Update WORK_STREAM.md when done

---

## File Locations (Absolute Paths)

```
/Users/kooshapari/temp-PRODVERCEL/485/kush/parpour/
├── CLAUDE.md
├── AGENTS.md
├── Taskfile.yml
├── quality-gate.yml
├── GOVERNANCE_SCAFFOLD_SUMMARY.md
├── docs/
│   ├── governance/
│   │   ├── GOVERNANCE_SUMMARY.md
│   │   └── QUALITY_GATES.md
│   ├── reference/
│   │   └── WORK_STREAM.md
│   ├── adr/
│   │   └── ADR-001-workspace-structure.md
│   ├── research/
│   ├── guides/
│   └── traceability/
├── scripts/
│   ├── spec-validate.sh
│   ├── spec-index.sh
│   ├── spec-gaps.sh
│   ├── venture-check.sh
│   ├── civ-check.sh
│   ├── quality-gate.sh
│   └── lib/
│       └── common.sh
├── venture/               (12 spec artifacts)
├── NEXT_STEPS.md         (existing; not modified)
└── SPECS_INDEX.md        (existing; not modified)
```

---

## Verification Checklist

- [x] CLAUDE.md created (spec-first governance guide)
- [x] AGENTS.md created (agent workflow rules)
- [x] Taskfile.yml created (task runner with all quality tasks)
- [x] quality-gate.yml created (5-gate quality system)
- [x] docs/governance/GOVERNANCE_SUMMARY.md created
- [x] docs/governance/QUALITY_GATES.md created
- [x] docs/reference/WORK_STREAM.md created
- [x] docs/adr/ADR-001-workspace-structure.md created
- [x] scripts/spec-validate.sh created
- [x] scripts/spec-index.sh created
- [x] scripts/spec-gaps.sh created
- [x] scripts/venture-check.sh created
- [x] scripts/civ-check.sh created
- [x] scripts/quality-gate.sh created
- [x] scripts/lib/common.sh created
- [x] docs directory structure created (research, guides, adr, governance, reference)

---

## Standards Compliance

**parpour now conforms to:**

- ✓ Global kush project standards (security, library-first, no fallbacks)
- ✓ Sibling project patterns (trace script organization, civ quality gates)
- ✓ Spec-driven workflow (CLAUDE.md, AGENTS.md, NEXT_STEPS.md integration)
- ✓ Quality enforcement (automated gates, traceability tracking)
- ✓ Governance documentation (ADR, GOVERNANCE_SUMMARY, QUALITY_GATES)

---

## Summary

**parpour is now a fully-governed spec-first workspace** that feeds civ and venture projects. All work follows:

1. **Update specs** in parpour (venture/*.md, CIV specs)
2. **Run quality checks** (task quality)
3. **Implement in sibling projects** (following their AGENTS.md rules)
4. **Track completion** in WORK_STREAM.md
5. **Commit with traceability** (spec references in messages)

No shortcuts. No fallbacks. All changes are breaking changes by design.

---

## Support

For questions about governance:
- See CLAUDE.md (project rules)
- See AGENTS.md (workflow rules)
- See docs/governance/GOVERNANCE_SUMMARY.md (baseline + overrides)
- See docs/governance/QUALITY_GATES.md (spec quality criteria)

For questions about decisions:
- See docs/adr/ADR-001-workspace-structure.md (rationale + consequences)

For tracking work:
- See docs/reference/WORK_STREAM.md (active tasks, blockers, escalations)
