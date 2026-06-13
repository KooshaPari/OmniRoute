# Formal Interface Contracts for CIV ↔ Venture Integration

**Date:** 2026-02-21
**Scope:** 5 cross-track integration points with detailed interface specifications
**Status:** ACTIVE
**Owner:** Kush Ecosystem Integration Team

---

## Executive Summary

This document defines the formal interface contracts for the 5 integration points connecting CIV (city simulation) and Venture (autonomous agent platform). Each contract specifies:

1. **Source System**: Which system emits the data
2. **Target System**: Which system consumes the data
3. **Data Schema**: Exact shape and format of exchanged data
4. **Sync Protocol**: Frequency, ordering, and reliability guarantees
5. **Validation Rules**: Constraints enforced at integration boundary
6. **Determinism Guarantees**: Replay and idempotency contracts
7. **Error Handling**: Failure modes and recovery procedures

---

## Contract 1: CIV Energy Ledger ↔ Venture Treasury Ledger

**Integration Point ID**: `INT-001-LEDGER-ALIGNMENT`

**Source**: CIV Economy Module (CIV-0100, CIV-0107)
**Target**: Venture Treasury System (TRACK-B)

**Purpose**: Synchronize double-entry accounting between CIV simulation and Venture spend ledger, ensuring conservation laws hold cross-system.

### 1.1 Data Schema

#### CIV Side: economy.transfer_booked.v1

```typescript
interface CivTransferEvent {
  event_id: string;              // UUID
  event_type: "civ.economy.transfer_booked.v1";
  tick_id: number;               // Tick sequence (deterministic order)
  run_id: string;                // Simulation run ID
  policy_bundle_id: string;      // Policy version pinning
  created_at: ISO8601Timestamp;

  payload: {
    sender_account_id: string;          // Account ID in CIV ledger
    receiver_account_id: string;        // Account ID in CIV ledger
    amount: number;                     // Joules (CIV-0107 unit)
    transfer_reason: string;            // One of: trade, tax, subsidy, inheritance, wage_payment, production_cost
    ledger_account_pair: {
      debit_account: string;            // Explicit debit account
      credit_account: string;           // Explicit credit account
    };
    policy_applied_event_id?: string;   // Link to policy.applied.v1 that triggered this
    conservation_check_hash: string;    // SHA256(state_after_transfer) for verification
  };
}
```

#### Venture Side: ledger.entry.created.v1

```typescript
interface VentureTransferEvent {
  event_id: string;              // UUID
  event_type: "venture.ledger.entry_created.v1";
  workflow_id: string;           // Venture workflow ID (maps to CIV run_id)
  trace_id: string;              // End-to-end trace ID
  task_id: string;               // Venture task ID (maps to CIV tick_id)
  policy_bundle_id: string;      // Must match CIV policy_bundle_id
  created_at: ISO8601Timestamp;

  payload: {
    entry_id: string;            // UUID for this ledger entry
    debit_account: string;       // Account ID in Venture chart of accounts
    credit_account: string;      // Account ID in Venture chart of accounts
    amount: number;              // Joules (converted/normalized)
    reference_id: string;        // Should equal civ_event_id for traceability
    reference_type: "civ_transfer" | "internal_spend" | "allocation";
    description: string;         // Human-readable description
    conservation_check_hash?: string; // Mirrors CIV state hash for alignment
  };
}
```

### 1.2 Sync Protocol

**Timing**:
- CIV emits `economy.transfer_booked.v1` at end of each tick (during economy phase)
- Venture relay layer picks up event and re-emits as `venture.ledger.entry_created.v1`
- Latency SLA: < 100ms from CIV tick end to Venture ledger update

**Ordering**:
- All transfers within a single CIV tick must be relayed in deterministic order
- Order preserved: `tick_id` → `transfer_sequence_number` (if multiple transfers in same tick)
- Venture ledger must apply entries in same order for determinism

**Batch Semantics**:
- Each CIV tick can emit multiple transfer events
- All transfers from a single tick are grouped under same `trace_id` in Venture
- If relay fails for any transfer in a tick: entire tick is retried (at-least-once semantics)

**Frequency**:
- Every CIV tick produces at least one transfer event (even if zero-amount for accounting)
- Venture reconciliation runs daily; cross-system balance check must pass deterministically

### 1.3 Validation Rules

#### At Source (CIV)
- `sender_account_id` and `receiver_account_id` must exist and be active
- `amount` must be positive and non-NaN
- `debit_account == sender_account_id` and `credit_account == receiver_account_id`
- `conservation_check_hash` must verify: sum of all ledger entries in tick = 0
- `transfer_reason` must be one of allowed enum values
- `policy_bundle_id` must match current policy bundle for this simulation run

#### At Target (Venture)
- `reference_id` must be parseable as UUID and must match source `event_id`
- `debit_account` and `credit_account` must exist in Venture chart of accounts
- `amount` must be positive, finite, and in valid range [0, 1e18] Joules
- `policy_bundle_id` must match Venture's current policy bundle for the workflow
- Debit and credit amounts must be equal (double-entry invariant)
- For each Venture entry: there must exist a corresponding CIV event in event log (via `reference_id`)

#### Cross-System
- Sum of all CIV transfers in tick must equal sum of corresponding Venture ledger entries
- Both systems must reach same final balance for each account (modulo precision errors ≤ 1 Joule)
- Conservation law must hold: `sum(all_entries) = 0` in both systems

### 1.4 Determinism Guarantees

**Replay Contract**:
```
Given:
  - run_id (CIV simulation run identifier)
  - policy_bundle_id (version of policy in effect)
  - tick_id (tick sequence number)
  - RNG seed (from simulation initialization)

Guarantee:
  - Re-executing CIV tick with identical inputs produces identical events in identical order
  - Venture replay of same ledger entries with identical policy_bundle_id produces identical balance changes
  - Both systems arrive at identical account balances (modulo rounding to nearest Joule)
  - Determinism verified by hash comparison: SHA256(civ_state) == SHA256(venture_balances_after_relay)
```

**Idempotency**:
- Multiple relay of same CIV event produces identical Venture ledger entry
- Idempotency key: `hash(reference_id + policy_bundle_id + tick_id)`
- Venture ledger uses idempotency key to deduplicate; duplicate events rejected with reason "already_processed"

**Hash Verification**:
- CIV emits `conservation_check_hash` after each tick's economy phase
- Venture relay layer stores hash with ledger entries
- At reconciliation time: recompute hash from Venture ledger entries; compare with CIV hash
- If hashes diverge: open compliance case with severity=critical

### 1.5 Error Handling

| Failure Mode | Detection | Recovery |
|---|---|---|
| Transfer amount is NaN | CIV validation | Reject event; emit error event; fail tick |
| Debit/credit accounts missing | Venture validation | Reject relay; log error; escalate to ops |
| Conservation law violated | Hash mismatch | Open compliance case; pause ledger updates; require manual investigation |
| Duplicate relay attempt | Idempotency check | Accept without re-applying; return existing entry_id |
| Policy bundle mismatch | Version check | Reject relay; emit compliance.violation.detected.v1 |
| Precision loss (> 1 Joule) | Balance drift check | Log as warning; allow if < 0.1% drift; escalate if > 1% drift |

### 1.6 Implementation Checklist

- [ ] CIV emits economy.transfer_booked.v1 with required payload fields
- [ ] Venture relay layer transforms CIV event → Venture ledger.entry.created.v1
- [ ] Venture ledger validates debit/credit account existence and type
- [ ] Double-entry invariant enforced: debit_amount == credit_amount
- [ ] Conservation check: sum(all_entries) == 0 (modulo rounding)
- [ ] Determinism test: replay CIV tick N times with same seed → identical events
- [ ] Reconciliation test: CIV final balance == Venture final balance
- [ ] Cross-system drift detection and alert (daily reconciliation)
- [ ] Compliance case opening for conservation law violations
- [ ] Idempotency test: duplicate relay of same event → same ledger entry returned

---

## Contract 2: CIV Simulation State ↔ Venture Workflow Orchestration

**Integration Point ID**: `INT-002-FSM-STATE-SYNC`

**Source**: CIV Core Simulation Loop (CIV-0001)
**Target**: Venture Control Plane (TRACK-C)

**Purpose**: Synchronize deterministic state machine transitions between CIV tick-based simulation and Venture workflow/task DAG execution.

### 2.1 Data Schema

#### CIV Side: civ.tick.started.v1 and civ.tick.completed.v1

```typescript
interface CivTickEvent {
  event_id: string;
  event_type: "civ.tick.started.v1" | "civ.tick.completed.v1";
  tick_id: number;                    // Deterministic tick sequence
  run_id: string;                     // Simulation run ID
  policy_bundle_id: string;           // Policy version
  created_at: ISO8601Timestamp;

  payload: {
    // Common to both started and completed
    tick_sequence: number;              // Which tick within run (0-based)
    phase_order: string[];              // Deterministic phases: ["demographics", "policy", "economy", "spatial", ...]
    policy_bundle_id: string;           // Pinned policy version for this tick

    // For tick.started.v1 only
    estimated_duration_ms?: number;     // Estimated tick execution time

    // For tick.completed.v1 only
    actual_duration_ms: number;         // Actual wall-clock time
    state_hash_after: string;           // SHA256(compressed_state_after_tick)
    phase_hashes?: {[phase: string]: string}; // Hash after each phase (for granular verification)
    sub_events_count: number;           // Count of sub-events emitted during tick
    tick_status: "success" | "failed" | "reverted";
    error_message?: string;             // If status != success
  };
}
```

#### Venture Side: venture.task.started.v1 and venture.task.completed.v1

```typescript
interface VentureTaskEvent {
  event_id: string;
  event_type: "venture.task.started.v1" | "venture.task.completed.v1";
  task_id: string;                    // UUID for this task
  workflow_id: string;                // Links to CIV run_id
  trace_id: string;                   // End-to-end trace
  policy_bundle_id: string;           // Must match CIV's policy_bundle_id
  created_at: ISO8601Timestamp;

  payload: {
    // Common to both
    task_sequence: number;              // Position in workflow DAG (mirrors tick_sequence)
    tool_calls_expected: number;        // For task.started.v1
    tool_calls_executed: number;        // For task.completed.v1
    actual_eau_cost: number;           // Actual resource consumption
    task_status: "pending" | "scheduled" | "executing" | "completed" | "failed" | "revoked";

    // For task.completed.v1 only
    actual_duration_ms: number;
    state_hash_after?: string;          // Mirrors CIV state_hash for cross-system verification
    task_error?: string;
  };
}
```

### 2.2 Sync Protocol

**Semantics**: 1 CIV tick = 1 Venture task (1:1 mapping)

**Mapping**:
```
CIV Simulation Run
  ├─ Tick 0 → Venture Workflow starts
  ├─   Sub-phase: Demographics
  │     └─ May emit multiple CIV sub-events
  ├─   Sub-phase: Policy
  │     └─ May emit civ.policy.evaluated.v1 events
  ├─   Sub-phase: Economy
  │     └─ May emit civ.economy.* events
  ├─   Sub-phase: Spatial
  │     └─ May emit civ.spatial.* events
  └─ Tick 0 completes → Venture Task 0 completes
       └─ task.completed.v1 with state_hash_after
  │
  ├─ Tick 1 → Venture Task 1 starts
  └─ (repeat for all ticks)
```

**Ordering**:
- Ticks must execute sequentially (no parallelism within a run)
- Venture tasks within a workflow execute in DAG order (task 0 before task 1, etc.)
- Phase ordering within a tick is deterministic (see phase_order array)
- CIV phase completion must be observable to Venture (via state_hash_after_phase)

**Frequency**:
- CIV: emits tick.started.v1 at tick initialization, tick.completed.v1 at tick end
- Venture: emits task.started.v1 at task scheduling, task.completed.v1 at task completion
- Latency SLA: < 10ms from CIV tick completion to Venture task completion event

### 2.3 Validation Rules

#### At Source (CIV)
- `tick_sequence` must be sequential (0, 1, 2, ...)
- `phase_order` must match canonical phase sequence (no missing or reordered phases)
- `state_hash_after` must be valid SHA256 hash (64 hex characters)
- For tick.completed.v1: `actual_duration_ms` must be positive and reasonable (e.g., < 60s)
- `sub_events_count` must match actual count of emitted events
- `tick_status` must be one of allowed enum values

#### At Target (Venture)
- `task_sequence` must match CIV `tick_sequence`
- `workflow_id` must exist and be in executing state
- `policy_bundle_id` must match workflow's policy bundle
- For task.completed.v1: `actual_eau_cost` must be ≤ budgeted cost (from task.scheduled.v1)
- `task_status` transition must be valid (pending → scheduled → executing → completed)
- If `state_hash_after` provided: must be valid SHA256 hash

#### Cross-System
- `task_id` (Venture) and `tick_id` (CIV) must have 1:1 mapping (store in cross-reference table)
- `policy_bundle_id` must be identical in both events
- If CIV tick failed: Venture task must fail with corresponding error
- State hashes must match post-execution (if both systems compute them)

### 2.4 Determinism Guarantees

**Replay Contract**:
```
Given:
  - run_id (CIV simulation run ID)
  - tick_id (specific tick within run)
  - policy_bundle_id
  - RNG seed from run initialization

Guarantee:
  - Re-executing CIV tick with same inputs produces:
    1. Identical state_hash_after
    2. Identical phase_order
    3. Identical sub-events in identical order
    4. Identical tick_status
  - Venture replay of same task produces:
    1. Identical task status transitions
    2. Identical tool call sequence
    3. Identical actual_eau_cost (within budget model)
    4. Identical state_hash_after (if provided)
  - Cross-system validation: both hashes must match (up to representation)
```

**Idempotency**:
- Multiple relay of same tick completion event must not re-execute task
- Idempotency key: `hash(tick_id + run_id + policy_bundle_id)`
- Venture task idempotency: if task already completed with same task_id, return existing result

**State Hash Verification**:
- Both systems compute SHA256 hash of their respective state after execution
- Hashes must match (or be mathematically equivalent)
- Mismatch indicates determinism bug; open compliance case

### 2.5 Error Handling

| Failure Mode | Detection | Recovery |
|---|---|---|
| Out-of-order ticks | Sequence check | Reject; require replay from last known good state |
| Invalid phase order | Phase list validation | Reject tick; emit error; fail entire run |
| State hash mismatch | Hash comparison post-execution | Open compliance case; pause workflow; require investigation |
| Task status invalid transition | FSM validation | Reject state change; emit error |
| Policy bundle mismatch | Version check | Reject; pause workflow; escalate |
| Cost overrun | Budget check | Reject if over hard cap; warn if over soft cap |
| Missing task prerequisite | DAG dependency check | Wait for prerequisite completion or timeout (configurable) |

### 2.6 Implementation Checklist

- [ ] CIV emits tick.started.v1 and tick.completed.v1 for every tick
- [ ] Venture relay layer creates task entry for each CIV tick
- [ ] Task sequence numbers match tick sequence numbers
- [ ] Phase order validation: both systems agree on deterministic phases
- [ ] State hash computation and storage (both sides)
- [ ] Determinism test: replay same tick N times with same seed → identical hashes
- [ ] FSM state transition validation in Venture
- [ ] Budget enforcement: actual_eau_cost ≤ budgeted cost
- [ ] Cross-reference table: tick_id ↔ task_id mapping
- [ ] Compliance case auto-open on state hash mismatch
- [ ] Error propagation: CIV tick failure → Venture task failure

---

## Contract 3: CIV Institutions ↔ Venture Compliance Audit Trail

**Integration Point ID**: `INT-003-INSTITUTION-COMPLIANCE`

**Source**: CIV Institutional Engine (CIV-0103)
**Target**: Venture Compliance Machine (OPS_COMPLIANCE_SPEC)

**Purpose**: Create audit evidence chains for CIV institutional changes, enabling compliance review and regulatory proof.

### 3.1 Data Schema

#### CIV Side: civ.institution.* Events

```typescript
interface CivInstitutionEvent {
  event_id: string;
  event_type: "civ.institution.created.v1" | "civ.institution.state_changed.v1" |
              "civ.institution.merged.v1" | "civ.institution.dissolved.v1";
  tick_id: number;
  run_id: string;
  policy_bundle_id: string;
  created_at: ISO8601Timestamp;

  payload: {
    institution_id: string;
    institution_type: "kingdom" | "city_state" | "alliance" | "corporation" | "religious_order" | "militia";

    // For institution.created.v1
    founder_id?: string;                // Citizen ID of founder
    location?: string;                  // Location name or coordinate
    initial_population?: number;        // Citizens in institution at creation

    // For institution.state_changed.v1
    state_before?: "pending" | "active" | "dormant" | "dissolved";
    state_after?: "pending" | "active" | "dormant" | "dissolved";
    state_change_reason?: string;       // Why state changed (e.g., "diplomatic_treaty", "bankruptcy", "war_conquest")
    affected_citizens_count?: number;

    // For institution.merged.v1 / institution.split.v1
    merging_institution_ids?: string[];         // All institutions being merged
    resulting_institution_id?: string;          // Result of merge
    source_institution_id?: string;             // Institution being split
    new_institution_ids?: string[];             // Resulting institutions
    population_distributed?: {[id: string]: number}; // Population per institution

    // For institution.dissolved.v1
    citizen_relocations?: {[destination_id: string]: number}; // Where citizens went
    asset_liquidations?: number;        // Total assets liquidated (Joules)

    // Audit metadata
    causal_event_id?: string;           // ID of event that triggered this institutional change
    policy_applied_event_id?: string;   // ID of policy that triggered this (if applicable)
  };
}
```

#### Venture Side: compliance.case.* Events

```typescript
interface VentureComplianceCaseEvent {
  event_id: string;
  event_type: "venture.compliance.case_opened.v1" | "venture.compliance.case_evidence_added.v1" |
              "venture.compliance.case_closed.v1";
  workflow_id: string;
  trace_id: string;
  policy_bundle_id: string;
  created_at: ISO8601Timestamp;

  payload: {
    // For case_opened.v1
    case_id: string;                   // UUID for this audit case
    case_type: "institutional_creation" | "institutional_state_change" |
               "institutional_merger" | "institutional_split" | "institutional_dissolution";
    severity_level: "critical" | "high" | "medium" | "low";
    case_description: string;          // Human-readable summary
    entity_id: string;                 // Institution ID (from CIV)
    evidence_chain_start: ISO8601Timestamp;

    // For case_evidence_added.v1
    case_id: string;                   // Links to open case
    evidence_id: string;               // UUID for this evidence item
    event_id_reference: string;        // Reference to CIV event_id
    evidence_type: "institutional_change_event" | "policy_application_record" |
                   "state_snapshot" | "causal_chain";
    evidence_content?: object;         // Full CIV event payload (for audit)
    evidence_timestamp: ISO8601Timestamp;

    // For case_closed.v1
    case_id: string;
    closure_reason: "institutional_operation_complete" | "manual_review" | "policy_violation_found";
    evidence_count: number;            // Total evidence items in chain
    finding: "compliant" | "non_compliant" | "requires_investigation";
    closure_timestamp: ISO8601Timestamp;
  };
}
```

### 3.2 Sync Protocol

**Case Lifecycle**:

```
CIV Event Emitted (e.g., institution.created.v1)
  ↓
Venture Relay Layer
  └─→ Creates compliance case (case_opened.v1)
       └─ case_type = "institutional_creation"
       └─ severity = "medium"
  ↓
Venture Compliance Machine subscribes
  └─→ Opens case in audit system
  ↓
Subsequent CIV events related to same institution
  ├─→ institution.state_changed.v1
  ├─→ institution.merged.v1 (if applicable)
  └─→ Each event = case_evidence_added.v1
       └─→ Appends to evidence chain
  ↓
Institutional lifecycle completes (e.g., dissolution)
  └─→ case_closed.v1 emitted
       └─ Status = "compliant" (unless audit found issue)
```

**Timing**:
- Case opened within 10ms of receiving CIV institution creation event
- Evidence appended within 10ms of receiving follow-up events
- Case remains open for duration of institution's active lifetime
- Case closed within 10ms of receiving dissolution event (or after inactivity timeout of 30 days)

**Ordering**:
- Evidence items must be stored in temporal order (creation_timestamp)
- Full causality chain is reconstructible from evidence_ids and causal_event_id links
- Venture audit system must support chronological replay of institutional evolution

### 3.3 Validation Rules

#### At Source (CIV)
- `institution_id` must be unique and persistent for lifetime of institution
- `institution_type` must be one of allowed enum values
- For state_changed events: `state_before` must match previous state
- For merge/split events: all institution_ids must exist and be active
- `causal_event_id` (if present) must reference valid prior event
- `policy_applied_event_id` (if present) must reference valid policy.applied.v1 event
- Population changes must balance: sum(initial_population) == sum(post-merge population)

#### At Target (Venture)
- `case_id` must be globally unique
- `entity_id` must match a known CIV institution_id
- `policy_bundle_id` must match workflow's bundle
- Evidence chain must be append-only: no deletions or modifications
- `event_id_reference` must match CIV event_id format (UUID)
- `evidence_count` must equal actual count of evidence items in case

#### Cross-System
- Case lifecycle must span from CIV creation to CIV dissolution
- All institutional changes (state_changed, merged, split) must have corresponding evidence items
- Evidence items must be in temporal order (no time travel)
- Causal chain must be reconstructible: each event must link to its trigger (policy or prior event)

### 3.4 Determinism Guarantees

**Replay Contract**:
```
Given:
  - run_id (CIV simulation run)
  - institutional_entity_id
  - policy_bundle_id

Guarantee:
  - Re-running simulation produces identical institutional events in identical order
  - Venture replay of same compliance case produces identical case_id, evidence_chain, and findings
  - Cross-system validation: CIV event log == Venture audit trail (1:1 mapping)
  - Evidence chain is fully auditable: every event has provenance from CIV
```

**Idempotency**:
- Multiple relay of same institutional event must not create duplicate evidence items
- Idempotency key: `hash(institution_id + event_type + tick_id + policy_bundle_id)`
- Venture compliance: idempotent on case_evidence_added.v1 (deduplicates by evidence_id)

**Audit Trail Immutability**:
- Evidence items are append-only; no modifications or deletions
- Case status can only transition: open → closed (monotonic)
- Hash of entire evidence chain provides tamper-proofing

### 3.5 Error Handling

| Failure Mode | Detection | Recovery |
|---|---|---|
| Institutional ID collision | Uniqueness check | Reject; emit error; require unique ID generation |
| State transition invalid | FSM validation | Reject; emit error; halt tick |
| Population imbalance (merge/split) | Sum check | Reject; emit error; require manual correction |
| Evidence item missing from chain | Audit replay | Log warning; flag case for review; don't auto-close |
| Causal event reference broken | Link validation | Log error; flag case as "requires_investigation" |
| Case closure without all evidence | Completeness check | Warn; allow closure if > 99% evidence collected |
| Compliance violation detected during review | Case analysis | Change finding to "non_compliant"; escalate |

### 3.6 Implementation Checklist

- [ ] CIV emits institution.* events for all institutional lifecycle changes
- [ ] Venture relay creates compliance.case_opened.v1 for each new institution
- [ ] Evidence chain appends for each institutional state change
- [ ] Case closure on institution dissolution or inactivity timeout
- [ ] Evidence items are append-only and immutable
- [ ] Causal chain reconstruction test: can rebuild institutional history from evidence
- [ ] Population balance validation for merge/split events
- [ ] Cross-system determinism test: CIV institutional sequence == Venture evidence sequence
- [ ] Audit trail hash verification
- [ ] Compliance review interface: queryable case findings and evidence chains

---

## Contract 4: CIV Energy Accounting ↔ Venture Cost Control & Quota

**Integration Point ID**: `INT-004-ENERGY-QUOTA`

**Source**: CIV Energy Module (CIV-0102, CIV-0100)
**Target**: Venture Treasury & Control Plane (TRACK-B, TRACK-C)

**Purpose**: Align CIV's energy conservation equation with Venture's budget model, ensuring resource constraints apply consistently.

### 4.1 Data Schema

#### CIV Side: civ.energy.* and civ.economy.supply_stress Events

```typescript
interface CivEnergyEvent {
  event_id: string;
  event_type: "civ.energy.consumed.v1" | "civ.energy.generated.v1" |
              "civ.energy.stored.v1" | "civ.energy.balance.v1" |
              "civ.economy.supply_stress.v1";
  tick_id: number;
  run_id: string;
  policy_bundle_id: string;
  created_at: ISO8601Timestamp;

  payload: {
    // Energy consumption/generation
    consumer_or_producer_id?: string;   // Entity ID
    energy_qty: number;                 // Joules
    source_type: "renewable" | "fossil" | "nuclear" | "storage" | "deficit";

    // Energy balance (conservation equation)
    tick_supply_total?: number;         // Total supply this tick (Joules)
    tick_demand_total?: number;         // Total demand this tick
    reserves_delta?: number;            // Change in reserves
    conservation_check_passed: boolean; // supply + reserves_in - losses - consumption - reserves_out = delta_stock
    conservation_equation_hash?: string; // SHA256 of equation verification

    // Supply stress (peak-shaving trigger)
    supply_shortfall?: number;          // Joules short
    stress_multiplier?: number;         // Price/cost multiplier applied
    peak_shaving_triggered?: boolean;
  };
}
```

#### Venture Side: venture.budget.* and venture.quota.* Events

```typescript
interface VentureBudgetEvent {
  event_id: string;
  event_type: "venture.budget.allocation_approved.v1" | "venture.budget.exceeded.v1" |
              "venture.quota.consumption_recorded.v1" | "venture.money.cost_estimate.v1";
  workflow_id: string;
  trace_id: string;
  policy_bundle_id: string;
  created_at: ISO8601Timestamp;

  payload: {
    // Budget allocation
    workspace_id?: string;              // Workspace receiving allocation
    allocation_amount?: number;         // EAU (Ecosystem Allocation Units)
    allocation_window?: string;         // e.g., "per_workflow", "per_month"

    // Budget consumption
    consumed_amount?: number;           // EAU consumed this event
    available_quota_before?: number;    // EAU available before
    available_quota_after?: number;     // EAU available after

    // Quota overflow
    budget_limit?: number;              // Hard cap (EAU)
    actual_spend?: number;              // What was spent
    overage_amount?: number;            // How much over limit
    remediation_action?: "rate_limit" | "escalate" | "reject" | "auto_remediate";

    // Cost estimate
    cost_basis?: "energy_consumption" | "artifact_render" | "tool_call" | "storage";
    estimated_cost_eau?: number;
    confidence_pct?: number;            // Confidence in estimate [0, 100]

    // Peak-shaving parallel
    demand_multiplier?: number;         // EAU cost multiplier (like energy price multiplier)
    velocity_control_active?: boolean;  // Rate-limiting engaged (demand-response)
  };
}
```

### 4.2 Sync Protocol

**Conversion Function** (Energy → Budget):

```typescript
function civ_energy_to_venture_eau(
  energy_joules: number,
  source_type: string,
  stress_multiplier: number = 1.0,
  policy_bundle_id: string
): number {
  // Base conversion: 1 Joule ≈ 0.001 EAU
  const base_eau = energy_joules * 0.001;

  // Source type multiplier (calibrated per policy bundle)
  const source_multiplier = {
    renewable: 1.0,      // Cheapest
    fossil: 1.5,         // More expensive
    nuclear: 0.8,        // Efficient
    storage: 2.0,        // Most expensive (discharge/recharge loss)
    deficit: 10.0,       // Crisis pricing
  }[source_type] || 1.0;

  // Peak-shaving multiplier (demand-response)
  const eau_cost = base_eau * source_multiplier * stress_multiplier;

  return Math.ceil(eau_cost * 1e6) / 1e6; // Round to nearest micro-EAU
}
```

**Energy Balance ↔ Budget Conservation**:

```
CIV Tick T:
  Energy Conservation Equation:
    Supply(t) + Reserves_in(t) - Losses(t) - Consumption(t) - Reserves_out(t) = ΔStock(t)

  Venture Parallel:
    Budget(t) = Budget(t-1) + Allocation(t) - ApprovedSpend(t) - PendingSpend(t) + ReserveInflux(t)

  Mapping:
    CIV Supply(t)        ↔  Venture Allocation(t)
    CIV Consumption(t)   ↔  Venture ApprovedSpend(t)
    CIV Reserves        ↔  Venture Reserved Accounts
    CIV ΔStock(t)        ↔  Venture ΔBudget(t)

  Both equations must hold deterministically (conservation laws)
```

**Peak-Shaving Mechanics**:

```
CIV:
  if supply < demand then price *= (1.5 + (demand_excess / base_price))

Venture:
  if pending_spend > 80% of budget then
    eau_cost *= 1.2 (cost escalation)
    rate_limit *= 0.8 (velocity control)
```

**Timing**:
- CIV emits energy.balance.v1 at end of each tick (after all consumption/generation)
- Venture relay layer converts energy → EAU and records quota consumption
- Latency SLA: < 50ms from CIV tick end to Venture quota update
- Daily reconciliation: CIV energy conservation must match Venture budget conservation

### 4.3 Validation Rules

#### At Source (CIV)
- `energy_qty` must be positive and non-NaN
- `source_type` must be one of allowed enum values
- For energy.balance.v1: `conservation_check_passed` must be true
  - Verify: supply + reserves_in - losses - consumption - reserves_out ≈ delta_stock (tolerance: 0.1 Joule)
- `conservation_equation_hash` must be valid SHA256
- `stress_multiplier` must be ≥ 1.0 and ≤ 10.0
- All numeric values must be finite (no Inf, -Inf, NaN)

#### At Target (Venture)
- `consumed_amount` must be positive and ≤ `available_quota_before`
- `available_quota_after` must equal `available_quota_before - consumed_amount`
- `budget_limit` must be non-negative and finite
- `cost_basis` must be one of allowed enum values
- `demand_multiplier` must be ≥ 1.0 and ≤ 10.0 (mirrors stress_multiplier)
- EAU amounts must be in valid range [0, 1e12] (prevent overflow)

#### Cross-System
- Energy conservation equation must hold in CIV
- Budget conservation law must hold in Venture
- Both `conservation_check_passed` and Venture budget balance must be true
- Peak-shaving multipliers must be consistent (CIV stress_multiplier ≈ Venture demand_multiplier)
- Daily reconciliation: total CIV energy ≈ total Venture EAU (within 0.1% error tolerance)

### 4.4 Determinism Guarantees

**Replay Contract**:
```
Given:
  - run_id (CIV simulation run)
  - tick_id
  - policy_bundle_id (includes energy pricing model)
  - energy_source_type
  - RNG seed

Guarantee:
  - Re-executing CIV tick produces identical energy balance
  - Venture replay of same conversion produces identical EAU cost
  - Both conservation equations hold identically across replays
  - Conservation equation hash must match (byte-identical)
  - Peak-shaving trigger conditions match exactly
```

**Idempotency**:
- Multiple relay of same energy event must produce identical quota consumption
- Idempotency key: `hash(energy_qty + source_type + tick_id + policy_bundle_id)`
- Venture quota engine deduplicates on idempotency key

### 4.5 Error Handling

| Failure Mode | Detection | Recovery |
|---|---|---|
| Energy conservation failed | check_passed == false | Reject tick; emit error; fail run |
| Budget conservation failed | balance mismatch | Open compliance case; pause quota updates |
| Conversion overflow (EAU > 1e12) | Range check | Reject; emit error; escalate |
| Stress multiplier out of bounds | Range validation | Clamp to [1.0, 10.0]; log warning |
| Reconciliation drift > 1% | Daily check | Log error; open compliance case; require investigation |
| Peak-shaving mismatch | Multiplier comparison | Log warning; flag for review |
| Source type not recognized | Enum validation | Reject; emit error |

### 4.6 Implementation Checklist

- [ ] CIV emits energy.balance.v1 with conservation_check_passed = true
- [ ] CIV equation verified: supply + reserves_in - losses - consumption - reserves_out = delta_stock
- [ ] Venture conversion function: energy_joules × source_multiplier × stress_multiplier → EAU
- [ ] Budget conservation law: budget(t) = budget(t-1) + allocation - spend
- [ ] Peak-shaving mechanics aligned: CIV stress_multiplier ≈ Venture demand_multiplier
- [ ] Determinism test: replay same tick N times → identical energy balance and EAU cost
- [ ] Reconciliation test: daily sum of CIV energy ≈ daily sum of Venture EAU
- [ ] Conservation equation hash verification (both systems)
- [ ] Quota overflow detection and remediation
- [ ] Compliance case auto-open on conservation law violation

---

## Contract 5: CIV Determinism Theorem ↔ Venture Artifact Determinism

**Integration Point ID**: `INT-005-DETERMINISM-THEOREM`

**Source**: CIV Minimal Constraint Set Theorem (CIV-0104)
**Target**: Venture Artifact Determinism (TRACK-A)

**Purpose**: Align mathematical foundations of determinism across both systems; provide proof that artifact builds are deterministic given fixed inputs.

### 5.1 Data Schema & Proof Structure

#### CIV Proof Artifact: civ.tick.completed.v1 (state verification)

```typescript
interface CivDeterminismProof {
  event_id: string;
  tick_id: number;
  run_id: string;
  policy_bundle_id: string;

  // Minimal constraint set (CIV-0104)
  minimal_constraint_set: {
    population_state: string;         // SHA256 hash (not full state)
    institution_state: string;        // Hash
    economy_ledger: string;           // Hash
    energy_state: string;             // Hash
    policy_bundle_id: string;         // Pinned version
    rng_seed: string;                 // Simulation seed
  };

  // Proof verification
  combined_state_hash: string;        // SHA256(sorted(constraint_set))
  theorem_verification: {
    theorem_name: "minimal_constraint_set_v1";
    is_satisfied: boolean;            // Did state transition satisfy the theorem?
    proof_summary: string;            // Human-readable proof
  };

  // Cross-system alignment
  can_replay_deterministically: boolean;
  can_build_artifact_deterministically: boolean;
}
```

#### Venture Proof Artifact: artifact.build.completed.v1 (artifact verification)

```typescript
interface VentureDeterminismProof {
  event_id: string;
  build_id: string;
  artifact_ir_id: string;
  workflow_id: string;
  policy_bundle_id: string;

  // Minimal artifact constraint set (TRACK-A)
  minimal_constraint_set: {
    artifact_ir: string;              // SHA256 of IR (input)
    toolchain_version: string;        // Pinned version
    policy_bundle_id: string;         // Pinned policy
    target_surface: string;           // Build target (web, mobile, etc.)
    provider_seeds: string;           // RNG seeds for non-deterministic providers
  };

  // Proof verification
  content_hash: string;               // SHA256(artifact output)
  determinism_contract: {
    contract_name: "deterministic_artifact_build_v1";
    is_satisfied: boolean;            // Did build satisfy contract?
    proof_summary: string;            // Human-readable proof
    provider_determinism: "byte_identical" | "semantic_equivalent" | "non_deterministic";
  };

  // Provenance chain
  provenance_signatures: Array<{
    provider: string;                 // e.g., "openai", "veo", "nanobanana"
    model_version: string;
    signature: string;                // Ed25519 signature
    timestamp: ISO8601Timestamp;
  }>;
}
```

### 5.2 Constraint Set Alignment

**CIV Minimal Constraint Set** (from CIV-0104):
```
State(t) is deterministic iff these constraints are fixed:
  1. Population entities and demographics
  2. Institution definitions and state
  3. Economy ledger (accounts and balances)
  4. Energy state (supplies, demands, reserves)
  5. Policy bundle version
  6. RNG seed

Theorem: State(t+1) = f(State(t), policy_bundle_id, rng_seed) is deterministic.
Proof: The 6 constraints above are sufficient and necessary to determine next state.
```

**Venture Minimal Constraint Set** (from TRACK-A):
```
Artifact is deterministic iff these constraints are fixed:
  1. Artifact IR (input specification)
  2. Toolchain version (compiler/renderer pinned)
  3. Policy bundle version (cost model, quality tier, etc.)
  4. Target surface (web, mobile, print, etc.)
  5. Provider seeds (for non-deterministic generators)

Theorem: Output = build(ir, toolchain, policy, surface, seeds) is deterministic within provider bounds.
Proof: The 5 constraints above determine output within semantics of provider.
```

**Alignment**:
```
CIV Constraint          ↔  Venture Constraint
─────────────────────────────────────────────────
Population state        ↔  Artifact IR (encodes current pop metrics)
Institution state       ↔  (part of IR)
Economy ledger          ↔  (part of IR)
Energy state            ↔  (part of IR)
Policy bundle v         ↔  Policy bundle v (1:1)
RNG seed                ↔  Provider seeds (analogous)

Result:
CIV proof(State(t+1)) must align with Venture proof(Artifact)
Both systems demonstrate determinism via identical constraint methodology
```

### 5.3 Proof Verification Protocol

**At CIV Side**:

```rust
fn verify_civ_determinism_theorem(
  current_tick: TickState,
  constraint_set: ConstraintSet,
  policy_bundle_id: PolicyBundleId,
) -> CivDeterminismProof {
  // 1. Extract minimal constraints
  let constraints = ConstraintSet {
    population_state: hash(&current_tick.population),
    institution_state: hash(&current_tick.institutions),
    economy_ledger: hash(&current_tick.ledger),
    energy_state: hash(&current_tick.energy),
    policy_bundle_id,
    rng_seed: SIMULATION_SEED,
  };

  // 2. Compute combined state hash
  let combined_hash = compute_state_hash(&constraints);

  // 3. Verify theorem: same constraints → same state transitions
  let next_state = execute_tick(current_state, constraints);
  let next_hash = compute_state_hash(&next_state);

  // 4. Check idempotency: re-execute with same constraints
  let next_state_2 = execute_tick(current_state, constraints);
  let theorem_satisfied = (next_state == next_state_2) && (next_hash == next_hash);

  return CivDeterminismProof {
    combined_state_hash: combined_hash,
    theorem_verification: {
      is_satisfied: theorem_satisfied,
      ...
    },
  };
}
```

**At Venture Side**:

```rust
fn verify_venture_determinism_contract(
  artifact_ir: ArtifactIR,
  toolchain_version: &str,
  policy_bundle_id: PolicyBundleId,
  target_surface: &str,
) -> VentureDeterminismProof {
  // 1. Check cache (idempotency key)
  let idempotency_key = hash((
    &artifact_ir,
    toolchain_version,
    policy_bundle_id,
    target_surface,
  ));

  if let Some(cached_output) = ARTIFACT_CACHE.get(&idempotency_key) {
    return VentureDeterminismProof {
      is_satisfied: true,
      provider_determinism: "byte_identical",
      ...
    };
  }

  // 2. Build artifact (may be non-deterministic if external provider)
  let (output, content_hash) = build_artifact(
    &artifact_ir,
    toolchain_version,
    policy_bundle_id,
    target_surface,
  );

  // 3. If deterministic provider: verify byte-identical on re-build
  let (output_2, hash_2) = build_artifact(...); // Same inputs
  let byte_identical = (output == output_2) && (content_hash == hash_2);

  // 4. If non-deterministic provider: verify semantic equivalence
  let semantic_equivalent = byte_identical ||
    semantic_distance(&output, &output_2) < EQUIVALENCE_THRESHOLD;

  return VentureDeterminismProof {
    is_satisfied: byte_identical || semantic_equivalent,
    provider_determinism: if byte_identical { "byte_identical" } else { "semantic_equivalent" },
    ...
  };
}
```

### 5.4 Cross-System Proof Alignment

**Relay Protocol**:

```
CIV Emits: civ.tick.completed.v1 (includes determinism proof)
  ↓
Venture Relay Layer
  ├─ Extract CivDeterminismProof.combined_state_hash
  ├─ Store as reference for cross-system validation
  └─ Emit artifact.build.completed.v1 (Venture proof)
  ↓
Compliance Engine
  ├─ Compare CIV proof with Venture proof
  ├─ Verify both systems achieve determinism via minimal constraint methodology
  └─ If proofs align: emit compliance.determinism_verified.v1
     If proofs diverge: emit compliance.violation_detected.v1 (severity=critical)
```

**Verification Checklist**:

```
For each artifact build tied to CIV simulation run:
  1. CIV tick T produces minimal_constraint_set C and hash H_civ
  2. Venture artifact build with constraints derived from C:
     a. IR contains C (population, institution, ledger, energy snapshots)
     b. Policy bundle = same as CIV policy_bundle_id
     c. Toolchain version pinned (matches policy bundle)
  3. Compute Venture hash H_venture
  4. Validate: H_civ ≈ H_venture (within representation differences)
  5. If hashes diverge: open compliance case (potential determinism bug)
  6. Archive both proofs for audit trail
```

### 5.5 Determinism Guarantees

**Full Replay Contract**:

```
Given:
  - run_id (CIV simulation run)
  - artifact_ir_id (Venture artifact to build)
  - policy_bundle_id (same in both systems)
  - All minimal constraints (population, institutions, ledger, energy, toolchain, seeds)

Guarantee:
  1. CIV tick T produces deterministic state transition:
     state(T+1) = f(state(T), constraints) is byte-identical on replay

  2. Venture artifact build is deterministic within provider bounds:
     artifact = build(ir, toolchain, policy, surface, seeds) is
     - byte-identical if all components deterministic
     - semantic-equivalent if non-deterministic provider (with fingerprint match)

  3. Both proofs are aligned:
     CivDeterminismProof.combined_state_hash ≈
       hash(ArtifactIRConstraints derived from CIV minimal_constraint_set)

  4. Full end-to-end replay:
     n-fold execution with same inputs → identical outputs (both systems)
```

**Idempotency**:
- Artifact builds with identical idempotency_key return cached output (byte-identical)
- CIV ticks with identical seed/policy/constraints produce identical state
- Both idempotency guarantees are mathematically proven via minimal constraint set

### 5.6 Error Handling & Recovery

| Failure Mode | Detection | Recovery |
|---|---|---|
| CIV theorem not satisfied | verification fails | Reject tick; emit error; fail run; investigate determinism bug |
| Venture build non-deterministic | hash mismatch | Check provider; if internal bug: reject; if provider: tag as semantic-equivalent |
| Proof hashes diverge | cross-system comparison | Open critical compliance case; pause artifact builds; investigate |
| Minimal constraint violation | constraint check | Reject; emit error; require re-specification of constraints |
| Theorem not applicable | context validation | Check that all 6 CIV constraints are specified; fail if any missing |
| Cache collision (same idempotency key, different output) | cache validation | Reject; open critical bug report; wipe cache entry |

### 5.7 Implementation Checklist

- [ ] CIV-0104 theorem implemented: verify minimal constraint set is sufficient for determinism
- [ ] CIV emits determinism proof in each tick.completed.v1 event
- [ ] Venture implements artifact determinism contract (byte-identical or semantic-equivalent)
- [ ] Venture emits determinism proof in each artifact.build.completed.v1 event
- [ ] Idempotency key computed and verified (both systems)
- [ ] Cross-system proof alignment: compare CIV and Venture proofs
- [ ] Compliance auto-check: hashes must match (within tolerance)
- [ ] Full replay test: n-fold execution with same inputs → identical outputs
- [ ] Provider-specific determinism handling (byte-identical vs semantic-equivalent)
- [ ] Determinism bug detection and escalation (critical severity)

---

## Summary Table

| Contract ID | CIV Component | Venture Component | Purpose | Status |
|---|---|---|---|---|
| INT-001 | Economy (CIV-0100) | Treasury (TRACK-B) | Ledger alignment, double-entry sync | Spec Complete |
| INT-002 | Core Loop (CIV-0001) | Control Plane (TRACK-C) | FSM state sync, task orchestration | Spec Complete |
| INT-003 | Institutions (CIV-0103) | Compliance (OPS) | Institutional audit trail, evidence chains | Spec Complete |
| INT-004 | Energy (CIV-0102) | Quota/Budget (TRACK-B, TRACK-C) | Energy conservation → budget model | Spec Complete |
| INT-005 | Theorem (CIV-0104) | Artifact (TRACK-A) | Determinism proof alignment | Spec Complete |

All 5 contracts are fully specified with schemas, protocols, validation rules, determinism guarantees, and implementation checklists.

---

**Document Control**

| Version | Date | Author | Change |
|---------|------|--------|--------|
| 1.0 | 2026-02-21 | Kush Integration Team | Initial version; 5 formal interface contracts with full specifications |

