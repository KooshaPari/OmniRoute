# ADR-002: Decision Records — omniroute-rust

**Status:** Accepted (2026-07-12)  
**Drivers:** ADR-001 (Architecture), MADR specification  
**Priority:** Foundational

## Context

The omniroute-rust codebase is a large, long-lived fork with many engineers
contributing over time. Without a disciplined record of architectural decisions,
new contributors and reviewers have no way to reconstruct *why* the code is the
way it is. This leads to repeated debates, accidental divergence from original
intent, and risk of regression when changing subsystems.

We need a lightweight, low-friction format for recording decisions that is
durable, searchable, and reviewable in PRs.

## Decision

We adopt **MADR** (Markdown Any Decision Records) v3.0 as the standard format
for all Architecture Decision Records. Records live in `docs/adr/` and are
numbered sequentially (`NNNN`).

### Format template

Every ADR must contain these sections in order:

```
# ADR-NNNN: Title — brief phrase

**Status:** {Proposed | Accepted | Deprecated | Superseded by ADR-NNNN}
**Drivers:** {comma-separated references to spec sections or other ADRs}
**Priority:** {Foundational | Important | Nice-to-have}

## Context
(2-5 paragraphs explaining the problem, forces at play, and why this decision
needs to be recorded.)

## Decision
(Clear statement of what was decided. Can include bullet lists, diagrams,
or code snippets. Should be concrete enough that a future reader can tell
whether the code matches the decision.)

## Consequences

### Positive
(Bullet list of benefits.)

### Negative
(Bullet list of trade-offs or costs.)

### Risks
(Bullet list of risks with mitigations.)

## ADR Cross-Reference
(Table of related ADRs.)
```

### Numbering

- All ADRs get a **four-digit sequential number** (0001, 0002, ..., 9999).
- Numbers are **never reused** — if an ADR is superseded, the superseding ADR
  gets a new number and the old one is marked `Superseded by ADR-NNNN`.
- The sequence is **global** across the entire omniroute repo (fork + Rust
  workspace), not per-subdirectory. This avoids collisions when upstream
  ADRs are pulled in.

### Lifecycle

| Status | Meaning |
|--------|---------|
| Proposed | Under review; not yet binding. |
| Accepted | Agreed; code should conform. |
| Deprecated | No longer recommended but still documented for history. |
| Superseded by ADR-NNNN | Replaced by a newer decision. |

### Where decisions go

Record an ADR when any of these is true:

1. A change affects the **public API** (wire format, env vars, CLI flags).
2. A change affects **cross-crate interfaces** (executor trait, router strategy
   enum, storage schema).
3. A change introduces a **new dependency** with >100 transitive deps or a
   restrictive license.
4. A change modifies the **build or release pipeline**.
5. A change alters **security properties** (auth, encryption, sandboxing).

## Consequences

### Positive

1. **PR reviewers** can check whether the implementation matches the ADR.
2. **New contributors** can read the ADR stack to understand design rationale
   without paging the original author.
3. **`git log --follow docs/adr/`** serves as an architecture changelog.

### Negative

1. **Writer burden.** Every nontrivial change requires an ADR draft. Mitigated
   by keeping ADRs short (200-500 words typical, 1000 max).
2. **Staleness risk.** ADRs can drift from reality if code changes without
   updating the ADR. Mitigated by CI check that flags ADR-referenced feature
   flags and env vars that no longer exist in code.

### Risks

1. **ADR fatigue.** If every tiny change requires an ADR, people will stop
   writing them. **Mitigation:** the "where decisions go" list above is the
   bar — if in doubt, don't write one.
2. **Bikeshedding format.** Engineers may argue about section ordering rather
   than content. **Mitigation:** the template is mandatory; linting CI
   (`adr-lint`) enforces structure.

## ADR Cross-Reference

| ADR | Relation |
|-----|----------|
| ADR-001 (Architecture) | This ADR governs how ADR-001 and all future ADRs are formatted. |
| ADR-003 (Team Conventions) | Code and git conventions are documented separately in ADR-003. |
