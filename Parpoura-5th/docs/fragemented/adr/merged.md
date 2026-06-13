# Merged Fragmented Markdown

## Source: adr/ADR-001-workspace-structure.md

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


---

## Source: adr/ADR-002-headless-artifact-compiler.md

# ADR-001: Headless Artifact Compiler vs SaaS Integration

**date:** 2026-02-21
**status:** ACCEPTED
**decision:** Build headless artifact compiler (in-process IR rendering) rather than integrate third-party SaaS

---

## Context

### Problem

Venture needs to generate production artifacts (slides, documents, timelines, audio scripts, org charts) as part of autonomous agent workflows. Three options were evaluated:

1. **Headless Compiler** (in-process): IR schema → render → export pipeline, deterministic, full ownership
2. **SaaS Integration** (external): Third-party API (Canva, Figma, etc.), easier UX but less control
3. **Hybrid** (internal IR + optional SaaS export): IR first, SaaS as optional destination

### Constraints

- **Determinism**: Artifact builds must be reproducible (same input → same hash)
- **Autonomy**: No human-in-the-loop during agent execution
- **Auditability**: Full artifact lineage (IR → provenance metadata → output)
- **Multi-artifact**: Must support 5+ artifact types (slides, docs, timelines, audio, boards)
- **Compliance**: Treasury integration means spend tracking and policy enforcement per artifact

### Alternatives Considered

| Option | Pros | Cons | Decision |
|--------|------|------|----------|
| **Headless** | Deterministic, full control, no external deps, auditability, policy-native | Build complexity, design effort, schema freeze required | ✅ CHOSEN |
| **SaaS Integration** | Easy UX, pre-built designs, no render engine | Non-deterministic, vendor lock-in, slower, harder to audit | ❌ REJECTED |
| **Hybrid** | Best of both | Complexity, dual maintenance, mixed control | ⚠️ FUTURE OPTION |

---

## Decision

**Build a headless artifact compiler** as the primary artifact generation subsystem.

### What This Means

1. **IR Schema Family Frozen**: SlideSpec, DocSpec, TimelineSpec, AudioSpec, BoardSpec (v1.0) locked in ARTIFACT_COMPILER_SPEC.md
2. **Deterministic Build Pipeline**: Input schema → render engine → output file with provenance metadata
3. **No External Render SaaS**: Canva, Figma, etc. are not integrated as primary targets
4. **Native Cost Tracking**: Each artifact build emits spend events tied to TRACK_B treasury system
5. **Replay Guarantee**: Same IR + render version → identical output byte-for-byte (for archive/audit)

### Architecture

```
Artifact Request
  ↓
[IR Schema Validation]
  ↓
[Render Engine Dispatch]
  ├─ SlideSpec → PDF/PNG renderer
  ├─ DocSpec → HTML/Markdown renderer
  ├─ TimelineSpec → SVG/JSON renderer
  ├─ AudioSpec → SSML → audio encoder
  └─ BoardSpec → SVG/PNG renderer
  ↓
[Provenance Attachment] (hash, timestamp, render version, trace_id)
  ↓
[Output Export] (blob store + ledger entry)
  ↓
[Spend Event] (tied to TRACK_B)
```

### Renderer Implementations

| Artifact Type | Renderer | Output Format | Notes |
|---------------|----------|---------------|-------|
| SlideSpec | Custom (Python/Go) | PDF, PNG | Deterministic typography via embedded fonts |
| DocSpec | Markdown → HTML | HTML, Markdown | Standard Markdown rendering |
| TimelineSpec | SVG templating | SVG, PNG | Deterministic layout via constraint solver |
| AudioSpec | SSML → TTS | WAV, MP3 | Deterministic via fixed TTS provider + pitch/speed params |
| BoardSpec | Canvas rendering | SVG, PNG | Deterministic grid-based layout |

---

## Rationale

### Why Headless, Not SaaS?

1. **Determinism**: Critical for compliance and audit. SaaS APIs drift (UI changes, version upgrades); headless IR+renderer stays frozen.
2. **Autonomy**: No rate limits, no external approval gates, no async callback dependencies.
3. **Cost Control**: Spend is deterministic and predictable; no surprise API charges.
4. **Audit Readiness**: Full lineage (agent → IR → render → output → ledger entry); SaaS integration breaks this chain.
5. **Integration with TRACK_B**: Directly emits spend events; SaaS integration would require translation layer.

### Why Not SaaS Later?

SaaS integration remains a **future option** (see ADR-NNN-SaaS-export-targets):
- Once headless IR is stable, can export SlideSpec → Canva design (one-way)
- Canva becomes optional **destination**, not primary generation mechanism
- Users get "polish in SaaS" only if they explicitly opt in post-generation

---

## Consequences

### Positive

1. ✅ Deterministic artifact generation (Foundation for TRACK_A)
2. ✅ Native integration with spend tracking (TRACK_B treasury)
3. ✅ Full auditability from agent intent → artifact → ledger
4. ✅ No external API dependencies or rate limits
5. ✅ Schema freezing enables long-term replay guarantees
6. ✅ Simpler control plane (no async callback state)

### Negative

1. ❌ **Rendering complexity**: Must build/maintain 5 specialized renderers
2. ❌ **Design sophistication**: Headless outputs may look less polished than SaaS-native
3. ❌ **Typography lock-in**: Fonts and styling frozen at v1.0; no easy updates
4. ❌ **Learning curve**: Agents must learn IR schema (vs. native SaaS design tools)

### Mitigation

| Risk | Mitigation |
|------|-----------|
| Rendering complexity | Use established libraries (reportlab, drawsvg, etc.); build incrementally (Phase 2 only DocSpec, Phase 3 add SlideSpec, etc.) |
| Design sophistication | Accept v1 outputs as "functional not beautiful"; SaaS export option in v2 for polish |
| Typography lock-in | Freeze fonts and styles at v1.0; document constraints clearly; separate design v2 work into future ADR |
| Agent learning | Provide agent library with IR builders; auto-suggest IR fields based on context |

---

## CIV Integration Notes

### CIV → Venture Artifact Export (Integration Point 1)

This decision enables a key integration point with CIV:

**CIV simulation outputs can become Venture artifacts:**
- CIV time-series (population, economy, energy) → TimelineSpec
- CIV policy decisions → DocSpec
- CIV org hierarchy → BoardSpec
- CIV citizen journeys → combination of SlideSpec + TimelineSpec

**Alignment:**
- CIV's tick-based state → Venture's IR snapshot
- Deterministic artifact generation mirrors CIV's deterministic simulation
- Spend tracking (Venture) can model "cost of visualization" in CIV's energy accounting

### Replay Guarantee (Integration Point 5)

Headless compiler enables CIV-Venture replay:
- Same CIV tick snapshot → same IR → same artifact bytes
- Supports auditing CIV decisions: "what policy decisions led to this artifact?"

---

## Validation & Next Steps

### Validation Criteria (Before Phase 1 Starts)

- [ ] SlideSpec and DocSpec IR schemas frozen and validated against rendering constraints
- [ ] Prototype renderers confirm determinism (byte-for-byte reproducibility tested)
- [ ] Provenance metadata schema defined and integrated with TRACK_B ledger
- [ ] Cost model for rendering (compute per artifact type) defined
- [ ] Agent library for IR builders designed and approved

### Phase Milestones

1. **Phase 1** (Foundation): DocSpec renderer + IR schema validation
2. **Phase 2** (Expansion): SlideSpec + TimelineSpec renderers
3. **Phase 3** (Audio+Board): AudioSpec + BoardSpec renderers
4. **Phase 4** (Optimization): Performance, caching, incremental builds
5. **Phase 5** (SaaS Bridge): Optional export targets (future ADR)

### Related ADRs

- ADR-002: Joule-Treasury integration (spend tracking for artifacts)
- ADR-NNN: SaaS export targets (future, v2+)
- ADR-NNN: Typography v2 upgrade (future, if design debt accrues)

---

## References

- **Artifact Compiler Spec**: `ARTIFACT_COMPILER_SPEC.md`
- **Track A Determinism Spec**: `TRACK_A_ARTIFACT_DETERMINISM_SPEC.md`
- **Product Model**: `PRODUCT_MODEL.md` (artifact generation as core feature)
- **Integration Points**: `../SPECS_INDEX.md` (Integration Point 1: CIV artifact export)

---

**Decision Made By:** Venture Autonomy Platform Team
**Implementation Lead:** TBD
**Last Updated:** 2026-02-21


---

## Source: adr/ADR-003-joule-treasury-integration.md

# ADR-002: Joule-Treasury Integration & Ledger Alignment

**date:** 2026-02-21
**status:** ACCEPTED
**decision:** Align Venture treasury ledger directly with CIV-0100 joule-based economy model; use double-entry accounting and conservation invariants

---

## Context

### Problem

Venture needs a treasury system to:
- Track autonomous agent spend (API calls, artifact generation, external requests)
- Enforce spend policies (budgets, per-category limits, velocity controls)
- Maintain audit-ready ledger (deterministic event recording, replay capability)
- Support compliance machine (policy violations, escalation)

Meanwhile, CIV-0100 defines a sophisticated **joule-based double-entry accounting model** that CIV uses for economic simulation (production, consumption, transfers, conservation).

### Question

Should Venture:
1. **Align with CIV-0100** (reuse ledger model, accounting invariants, conservation equation)?
2. **Build independent system** (simplified spend ledger, tuned for treasury use cases)?
3. **Federate** (two separate ledgers, periodic reconciliation)?

### CIV-0100 Key Properties

| Property | Description |
|----------|-------------|
| **Double-entry accounting** | Every transfer: debit source, credit destination |
| **Conservation invariant** | Total supply = sum of all account balances (always true) |
| **Deterministic event recording** | market_cleared, transfer, policy_evaluated events immutable and replay-safe |
| **Market clearing** | Supply ≤ Demand → clearing_price computed; oversupply → policy intervention |
| **Account hierarchy** | Agent accounts, institution accounts, reserve account |

---

## Decision

**Align Venture treasury directly with CIV-0100 joule model:**

1. **Reuse double-entry accounting**: Venture spend ledger follows CIV's transfer structure
2. **Conservation invariant**: Venture's total spend = sum of all budget reserves (enforced)
3. **Event schema alignment**: Venture's `money.ledger_entry.v1` matches CIV's `economy.transfer.v1` shape
4. **FSM parallels**: Venture's spend authorization mirrors CIV's market clearing + policy evaluation
5. **Replay guarantee**: Both systems deterministic; audit trails interoperable

### Architecture

```
Venture Treasury Ledger (aligned with CIV-0100)

Reserve Account (read-only, mirrors org budget)
  ├─ [conservation invariant: sum(agent budgets) ≤ reserve]
  └─ Events: economy.transfer.v1 (from CIV → Venture bridge)

Agent 1 Spend Account
  ├─ Subtopic: API calls (reads/writes)
  ├─ Subtopic: Artifact generation (per type: slides, docs, audio)
  ├─ Subtopic: External requests (web, integrations)
  └─ Events: money.intent.created → money.authorized → money.spent → ledger.entry.created

Agent 2 Spend Account
  └─ [same structure as Agent 1]

Policy Enforcement Layer
  ├─ Per-agent budget cap (conservation invariant)
  ├─ Per-category limits (API, artifacts, external)
  ├─ Velocity controls (spend per hour/day)
  └─ Market clearing (if demand > supply, reduce via policy)

Audit Log (append-only, immutable)
  └─ All ledger entries + policy decisions + checksums
```

### Ledger Entry Schema (aligned with CIV-0100)

```json
{
  "ledger_entry_id": "ledger-2026-02-21T10:30:00Z-ABC123",
  "event_id": "money.ledger_entry.created.v1",
  "trace_id": "trace-XYZ789",
  "workflow_id": "workflow-ABC123",
  "timestamp": "2026-02-21T10:30:00Z",

  "accounting_entries": [
    {
      "account": "agent/agent-1/spend-account",
      "direction": "debit",
      "amount_joules": 50,
      "category": "api_calls"
    },
    {
      "account": "reserve/central",
      "direction": "credit",
      "amount_joules": 50,
      "category": "api_calls"
    }
  ],

  "policy_bundle_id": "policy-v1.2.3",
  "authorization_result": "APPROVED",
  "spent_event_id": "money.spent.v1-XYZ",
  "comment": "10 API calls, customer search, $0.50 cost"
}
```

**Alignment with CIV-0100:**
- `accounting_entries` list mirrors CIV's `transfers` (debit/credit pairs)
- `amount_joules` is both computational unit (Venture) and economic unit (CIV)
- `policy_bundle_id` links to both Venture OPS and CIV policy evaluation
- Event shape compatible with CIV's `economy.transfer.v1` schema

---

## Rationale

### Why Align with CIV-0100?

1. **Conservation Invariant (provable correctness)**: CIV-0100's conservation equation (`sum(accounts) = reserve`) applies equally to Venture budgets; audit can verify invariant mathematically
2. **Determinism & Replay**: CIV-0100 is fully deterministic; Venture inherits replay guarantee for audit and incident investigation
3. **Policy Evaluation Parallels**: CIV's "if supply < demand → apply policy" maps to Venture's "if budget < spend request → apply policy"
4. **Interoperability**: If Venture artifacts model CIV simulation outputs (Integration Point 1), ledger alignment enables tracing spend → artifact → CIV policy decision
5. **Mathematical Foundation**: CIV-0104 (Minimal Constraint Set Theorem) provides formal foundation for both systems' constraints

### Why Not Independent Spend Ledger?

- **Duplication**: Would reinvent CIV's double-entry accounting, conservation checks, determinism
- **Integration friction**: CIV-Venture bridge becomes complex (schema translation, reconciliation)
- **Audit complexity**: Two ledgers → two audit trails → harder to trace decisions end-to-end
- **Learning**: CIV team has already solved these problems; reuse their design

### Why Not Federate?

- **Reconciliation burden**: Would require periodic cross-ledger audits (complexity)
- **Latency**: Venture spend event → CIV transfer would add async delay
- **Invariant breakage**: Conservation equation impossible if ledgers drift

---

## Consequences

### Positive

1. ✅ **Provably correct accounting**: Conservation invariant holds mathematically
2. ✅ **Unified audit trail**: Venture spend + CIV policy decisions on same ledger
3. ✅ **Deterministic replay**: Both systems can audit to same point in time
4. ✅ **Policy interoperability**: Market clearing + velocity controls work uniformly across both
5. ✅ **Reduced duplication**: Inherit CIV's tested accounting logic
6. ✅ **Foundation for CIV integration**: Spend → artifact → policy decision fully traceable

### Negative

1. ❌ **Joule unit confusion**: Some Venture users may not think in "joules"; need translation layer
2. ❌ **Schema complexity**: CIV-0100's full ledger model is more complex than needed for simple spend tracking
3. ❌ **Dependency on CIV**: Venture's core system depends on CIV's ledger correctness
4. ❌ **Migration complexity**: Any future CIV ledger redesign affects Venture

### Mitigation

| Risk | Mitigation |
|------|-----------|
| Joule confusion | Wrapper layer: `joules_to_usd(amount, rate_model)` for user-facing displays |
| Schema complexity | Use only essential CIV fields; define minimal subset in SCHEMA_PACK.md |
| CIV dependency | Venture ledger schema is own entity; CIV integration is via event bridge (loose coupling) |
| Migration risk | ADR-NNN: if CIV ledger changes, plan transition via versioning + dual-write period |

---

## CIV Integration Details

### Integration Point 1: Economy Ledger (CIV-0100 ↔ TRACK_B)

This decision **directly implements** the 5th integration point:

**How it works:**

1. **CIV → Venture bridge**: Whenever CIV emits `economy.transfer.v1` event (resource production, consumption), Venture listens
2. **Event shape mapping**: CIV transfer → Venture ledger entry (same accounting structure)
3. **Conservation equation**: Venture's `sum(agent budgets) ≤ reserve` mirrors CIV's `sum(production) = sum(consumption) + changes_in_reserves`
4. **Market clearing**: Venture's "if spend request > budget → policy enforcement" mirrors CIV's "if demand > supply → market clearing"
5. **Replay compatibility**: Both ledgers deterministic; audit can run either forward (simulation) or backward (trace spending decision)

### Integration Point 5: Determinism & Constraints (CIV-0104 ↔ TRACK_A)

CIV-0104's Minimal Constraint Set Theorem provides mathematical foundation:
- Venture's conservation invariant is a **minimal constraint** (only constraint needed to ensure correctness)
- Artifact determinism (TRACK_A) + Ledger determinism (TRACK_B) together enable full system replay

---

## Implementation Plan

### Phase 1: Schema Alignment (Pre-build)

- [ ] Map CIV-0100 ledger schema → SCHEMA_PACK.md (identify minimal subset)
- [ ] Define Venture `money.ledger_entry.v1` with debit/credit structure
- [ ] Create `joules_to_usd()` conversion function for UI
- [ ] Update API_EVENTS_SPEC.md with aligned event shapes

### Phase 2: Ledger Implementation

- [ ] Implement conservation invariant check: `sum(agent budgets) ≤ reserve`
- [ ] Implement double-entry transaction creation: debit source, credit destination
- [ ] Implement policy evaluation (market clearing logic)
- [ ] Implement audit log with immutable appends + checksums

### Phase 3: CIV Bridge

- [ ] Implement event listener: CIV `economy.transfer.v1` → Venture ledger entry
- [ ] Implement event emitter: Venture `money.ledger_entry.created.v1` → CIV audit log
- [ ] Integration test: spend event from Venture → traces to CIV policy decision

### Phase 4: Audit & Validation

- [ ] Implement conservation invariant checker (nightly audit)
- [ ] Implement replay harness (audit can replay ledger entry order)
- [ ] Cross-validation: CIV reserve changes = Venture spend ledger entries

---

## Related Decisions

- **ADR-001**: Headless artifact compiler (generates artifacts that consume joules via TRACK_B)
- **ADR-NNN**: CIV-0100 v2 (if CIV ledger redesigns in future)
- **ADR-NNN**: Joule-to-USD conversion policies (how to price Venture services)

---

## References

- **CIV Economy Spec**: `../civ/docs/specs/CIV-0100-economy-v1.md`
- **CIV Constraints Theorem**: `../civ/docs/specs/CIV-0104-minimal-constraint-set-theorem.md`
- **Venture Treasury Spec**: `TRACK_B_TREASURY_COMPLIANCE_SPEC.md`
- **Venture Determinism Spec**: `TRACK_A_ARTIFACT_DETERMINISM_SPEC.md`
- **Venture Schema Pack**: `SCHEMA_PACK.md`
- **Cross-Track Integration**: `../SPECS_INDEX.md` (Integration Points 1 & 5)

---

**Decision Made By:** Venture Autonomy Platform Team
**Implementation Lead:** TBD
**Last Updated:** 2026-02-21


---
