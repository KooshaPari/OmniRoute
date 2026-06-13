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
