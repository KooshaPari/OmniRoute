# Unified Event Taxonomy for Kush Ecosystem

**Date:** 2026-02-21
**Scope:** CIV simulation events + Venture autonomy events + cross-track event flows
**Status:** ACTIVE
**Owner:** Kush Ecosystem Integration Team

---

## Executive Summary

This document defines the unified event taxonomy covering both CIV (city simulation) and Venture (autonomous agent platform) systems. It establishes:

1. **CIV Event Catalog**: Simulation lifecycle, policy evaluation, economy, energy, institutions, and citizen metrics
2. **Venture Event Catalog**: Workflow orchestration, artifact compilation, treasury authorization, compliance operations
3. **Cross-Track Event Flows**: How CIV events are relayed through Venture event bus, and how Venture events trigger CIV state updates

All events conform to `EventEnvelopeV1` schema defined in `API_EVENTS_SPEC.md` and `TRACK_C_CONTROL_PLANE.md`.

---

## Event Envelope Contract (Foundation)

All events in both CIV and Venture adhere to this envelope:

```json
{
  "event_id": "string (UUID)",
  "event_type": "string (namespace.resource.action.version)",
  "workflow_id": "string (UUID, links to parent workflow)",
  "task_id": "string (UUID, links to parent task)",
  "trace_id": "string (UUID, end-to-end request tracing)",
  "policy_bundle_id": "string (version, event evaluated under this policy)",
  "payload": "object (event-specific data)",
  "created_at": "timestamp (ISO 8601)",
  "source_system": "string (civ | venture)",
  "replay_token": "string (idempotency key for deterministic replay)"
}
```

---

## Part 1: CIV Event Catalog

Events emitted from the CIV simulation system.

### 1.1 Simulation Lifecycle Events (run.*)

| Event Name | Fully Qualified | Payload Schema | Emitted By | Purpose | Version |
|---|---|---|---|---|---|
| Run Started | `civ.run.started.v1` | `{run_id, simulation_seed, tick_count_target, config_snapshot, policy_bundle_id}` | Simulation engine | Marks simulation initialization | v1 |
| Run Completed | `civ.run.completed.v1` | `{run_id, tick_count_executed, final_state_hash, event_count, duration_ms}` | Simulation engine | Marks simulation completion | v1 |
| Run Failed | `civ.run.failed.v1` | `{run_id, error_code, error_message, tick_id_when_failed, state_snapshot}` | Simulation engine | Records fatal errors during simulation | v1 |
| Tick Started | `civ.tick.started.v1` | `{run_id, tick_id, tick_sequence, phase_order}` | Core simulation loop | Marks tick initialization | v1 |
| Tick Completed | `civ.tick.completed.v1` | `{run_id, tick_id, state_hash_after, sub_events_count, duration_ms, phase_hashes}` | Core simulation loop | Marks tick completion with state verification | v1 |

**Payload Schema Details:**
- `run_id`: Unique identifier for a simulation run (immutable after creation)
- `simulation_seed`: RNG seed for reproducibility; pinned in replay
- `tick_count_target`: Expected number of ticks (from policy config)
- `final_state_hash`: SHA256(compressed_state); used for determinism verification
- `phase_order`: Array of phase names in deterministic order (e.g., `["demographics", "policy", "economy", "spatial"]`)

---

### 1.2 Policy Evaluation Events (policy.*)

| Event Name | Fully Qualified | Payload Schema | Emitted By | Purpose | Version |
|---|---|---|---|---|---|
| Policy Evaluated | `civ.policy.evaluated.v1` | `{tick_id, policy_type, policy_bundle_id, control_decision, affected_entity_count, evaluation_duration_ms}` | Policy engine (CIV-0100) | Records policy evaluation and control decision | v1 |
| Policy Applied | `civ.policy.applied.v1` | `{tick_id, policy_type, control_decision, entities_affected, ledger_updates_count, state_delta}` | Policy engine | Records actual application of policy control | v1 |
| Constraint Violation Detected | `civ.policy.constraint_violation.v1` | `{tick_id, constraint_name, entity_id, actual_value, max_value, severity_level}` | Policy engine / Verifier | Records when a constraint (CIV-0104) is violated | v1 |

**Payload Schema Details:**
- `policy_type`: One of `fiscal`, `labor_market`, `environmental`, `institutional`
- `control_decision`: The control action selected (e.g., `"subsidize_sector_X"`, `"raise_tax_rate"`)
- `evaluation_duration_ms`: Cost of running `policy.evaluate()` function (for Venture tool budgeting)
- `severity_level`: `critical` | `warning` | `info`

---

### 1.3 Economy Events (economy.*)

| Event Name | Fully Qualified | Payload Schema | Emitted By | Purpose | Version |
|---|---|---|---|---|---|
| Market Cleared | `civ.economy.market_cleared.v1` | `{tick_id, market_type, supply_qty, demand_qty, equilibrium_price, clearing_efficiency}` | Market clearing engine | Records supply-demand equilibrium | v1 |
| Transfer Booked | `civ.economy.transfer_booked.v1` | `{tick_id, sender_id, receiver_id, amount, transfer_reason, ledger_account_pair}` | Double-entry ledger engine | Records debit/credit transaction | v1 |
| Account Balance Updated | `civ.economy.balance_updated.v1` | `{tick_id, account_id, balance_before, balance_after, delta_reason}` | Double-entry ledger engine | Records account balance change | v1 |
| Supply Stress | `civ.economy.supply_stress.v1` | `{tick_id, market_type, supply_shortfall, stress_multiplier, price_impact}` | Supply-demand engine (CIV-0102) | Records when supply < demand | v1 |
| Market Price Changed | `civ.economy.price_changed.v1` | `{tick_id, market_type, price_before, price_after, price_change_pct, reason}` | Market clearing engine | Records price discovery and changes | v1 |

**Payload Schema Details:**
- `market_type`: One of `labor`, `goods`, `capital`, `energy`
- `clearing_efficiency`: Float [0, 1]; 1.0 = perfect clearing, 0.5 = significant excess
- `ledger_account_pair`: `{debit_account: string, credit_account: string}` for accounting reconciliation
- `supply_shortfall`: Quantity units; used by Venture for quota model validation

---

### 1.4 Energy Accounting Events (energy.*)

| Event Name | Fully Qualified | Payload Schema | Emitted By | Purpose | Version |
|---|---|---|---|---|---|
| Energy Consumed | `civ.energy.consumed.v1` | `{tick_id, consumer_entity_id, energy_qty, source_type, consumption_reason}` | Energy ledger (CIV-0102) | Records energy consumption | v1 |
| Energy Generated | `civ.energy.generated.v1` | `{tick_id, producer_entity_id, energy_qty, source_type, capacity_utilization_pct}` | Energy ledger | Records energy production | v1 |
| Energy Stored | `civ.energy.stored.v1` | `{tick_id, storage_entity_id, energy_qty_added, storage_capacity_before, storage_capacity_after}` | Energy ledger | Records energy reserve changes | v1 |
| Supply-Demand Balance | `civ.energy.balance.v1` | `{tick_id, supply_total, demand_total, reserves_delta, conservation_check_passed}` | Energy ledger | Records energy conservation equation results | v1 |
| Renewable Variability | `civ.energy.renewable_variability.v1` | `{tick_id, renewable_source_id, expected_output, actual_output, variance_pct}` | Energy ledger | Records renewable source variability | v1 |

**Payload Schema Details:**
- `energy_qty`: Joules (CIV-0107 unit system)
- `source_type`: One of `renewable`, `fossil`, `nuclear`, `storage`
- `conservation_check_passed`: Boolean; failure indicates determinism bug
- `variance_pct`: Percentage deviation from expected; used for peak-shaving policy triggers

---

### 1.5 Citizen Lifecycle Events (citizen.*)

| Event Name | Fully Qualified | Payload Schema | Emitted By | Purpose | Version |
|---|---|---|---|---|---|
| Citizen Born | `civ.citizen.born.v1` | `{tick_id, citizen_id, parent_ids, birth_location, genetic_traits}` | Demographic engine (CIV-0103) | Records citizen birth | v1 |
| Citizen Education Updated | `civ.citizen.education_updated.v1` | `{tick_id, citizen_id, education_level_before, education_level_after, institution_id}` | Education subsystem | Records education progression | v1 |
| Citizen Career Changed | `civ.citizen.career_changed.v1` | `{tick_id, citizen_id, old_career, new_career, employer_id, salary_before, salary_after}` | Labor market engine | Records career transition | v1 |
| Citizen Retired | `civ.citizen.retired.v1` | `{tick_id, citizen_id, retirement_age, career_length_years, final_wealth}` | Labor market engine | Records retirement | v1 |
| Citizen Died | `civ.citizen.died.v1` | `{tick_id, citizen_id, death_age, death_location, estate_distributed_to}` | Demographic engine | Records death | v1 |
| Citizen Metrics Updated | `civ.citizen.metrics_updated.v1` | `{tick_id, citizen_id, age, wealth, education_level, satisfaction_score, institution_affiliation}` | Metrics engine (CIV-0103) | Time-series snapshot of citizen state | v1 |

**Payload Schema Details:**
- `education_level`: Integer [0, 5]; maps to institution types (primary, secondary, tertiary, etc.)
- `satisfaction_score`: Float [-1, 1]; used by Venture for user activity signaling
- `genetic_traits`: Array of traits; affects career path probabilities
- `estate_distributed_to`: Array of `{heir_id, amount_joules}`

---

### 1.6 Institution Lifecycle Events (institution.*)

| Event Name | Fully Qualified | Payload Schema | Emitted By | Purpose | Version |
|---|---|---|---|---|---|
| Institution Created | `civ.institution.created.v1` | `{tick_id, institution_id, institution_type, founder_id, location, initial_population}` | Institutional engine (CIV-0103, CIV-0105) | Records institution formation | v1 |
| Institution State Changed | `civ.institution.state_changed.v1` | `{tick_id, institution_id, state_before, state_after, reason, affected_citizens_count}` | Institutional state machine | Records state transition (pending → active → dormant → dissolved) | v1 |
| Institution Merged | `civ.institution.merged.v1` | `{tick_id, merging_institution_ids, resulting_institution_id, population_transferred}` | Institutional engine | Records institution merger | v1 |
| Institution Split | `civ.institution.split.v1` | `{tick_id, source_institution_id, new_institution_ids, population_distributed}` | Institutional engine | Records institution fission | v1 |
| Institution Dissolved | `civ.institution.dissolved.v1` | `{tick_id, institution_id, citizen_relocations, asset_liquidations}` | Institutional engine | Records institution dissolution | v1 |
| Institution Metrics Updated | `civ.institution.metrics_updated.v1` | `{tick_id, institution_id, population, wealth, assets, influence_score}` | Metrics engine | Time-series snapshot of institution state | v1 |

**Payload Schema Details:**
- `institution_type`: One of `kingdom`, `city_state`, `alliance`, `corporation`, `religious_order`, `militia`
- `state_before/after`: One of `pending`, `active`, `dormant`, `dissolved`
- `reason`: String describing cause of state change (e.g., "diplomatic_treaty_expired", "bankruptcy", "armed_conquest")
- `influence_score`: Float [0, 1]; used in policy evaluation and war/diplomacy subsystems

---

### 1.7 War, Diplomacy & Conflict Events (conflict.*)

| Event Name | Fully Qualified | Payload Schema | Emitted By | Purpose | Version |
|---|---|---|---|---|---|
| War Declared | `civ.conflict.war_declared.v1` | `{tick_id, aggressor_institution_id, defender_institution_id, reason, military_strength_ratio}` | Diplomacy engine (CIV-0105) | Records declaration of war | v1 |
| Diplomatic Treaty Signed | `civ.conflict.treaty_signed.v1` | `{tick_id, party_1_id, party_2_id, treaty_type, terms, duration_ticks}` | Diplomacy engine | Records treaty formation | v1 |
| Territorial Control Changed | `civ.conflict.territorial_control_changed.v1` | `{tick_id, location_id, previous_controller_id, new_controller_id, population_affected}` | Conflict resolution engine | Records territory conquest/cession | v1 |
| Shadow Network Activated | `civ.conflict.shadow_network_activated.v1` | `{tick_id, network_id, network_type, target_institution_id, influence_direction}` | Shadow subsystem (CIV-0105) | Records covert influence operation | v1 |

**Payload Schema Details:**
- `treaty_type`: One of `military_alliance`, `trade_agreement`, `non_aggression_pact`, `vassalage`
- `military_strength_ratio`: Float; attacker_strength / defender_strength
- `network_type`: One of `spy_ring`, `merchant_guild`, `religious_sect`, `secret_society`
- `influence_direction`: One of `support`, `subvert`, `destabilize`

---

### 1.8 Social & Health Events (social.*)

| Event Name | Fully Qualified | Payload Schema | Emitted By | Purpose | Version |
|---|---|---|---|---|---|
| Health Crisis Detected | `civ.social.health_crisis.v1` | `{tick_id, location_id, disease_type, infection_rate, mortality_rate, affected_population}` | Health subsystem (CIV-0106) | Records epidemic or plague | v1 |
| Social Unrest Escalated | `civ.social.unrest_escalated.v1` | `{tick_id, location_id, unrest_level, causes, insurgent_count}` | Insurgency subsystem (CIV-0106) | Records uprising or revolt | v1 |
| Ideology Shift | `civ.social.ideology_shift.v1` | `{tick_id, institution_id, ideology_before, ideology_after, driver}` | Ideology engine (CIV-0106) | Records ideological change | v1 |
| Cultural Event | `civ.social.cultural_event.v1` | `{tick_id, event_type, location_id, impact_on_satisfaction, influenced_population}` | Cultural subsystem | Records cultural occurrence (e.g., festival, artistic movement) | v1 |

**Payload Schema Details:**
- `unrest_level`: Integer [0, 100]; > 70 triggers insurgency events
- `ideology_before/after`: One of `monarchy`, `theocracy`, `democracy`, `autocracy`, `meritocracy`
- `driver`: String explaining cause of shift (e.g., "military_victory", "enlightenment_era", "famine")
- `event_type`: One of `festival`, `artistic_movement`, `scientific_breakthrough`, `religious_schism`

---

## Part 2: Venture Event Catalog

Events emitted from the Venture autonomy platform.

### 2.1 Workflow Orchestration Events (workflow.*)

| Event Name | Fully Qualified | Payload Schema | Emitted By | Purpose | Version |
|---|---|---|---|---|---|
| Workflow Started | `venture.workflow.started.v1` | `{workflow_id, agent_role, workspace_id, initial_task_count, policy_bundle_id}` | Workflow orchestrator (TRACK-C) | Marks workflow initialization | v1 |
| Workflow Completed | `venture.workflow.completed.v1` | `{workflow_id, status, task_count_executed, event_count, duration_ms}` | Workflow orchestrator | Marks workflow completion | v1 |
| Workflow Failed | `venture.workflow.failed.v1` | `{workflow_id, error_code, error_message, task_id_when_failed}` | Workflow orchestrator | Records fatal workflow error | v1 |
| Task Scheduled | `venture.task.scheduled.v1` | `{task_id, workflow_id, task_type, estimated_eau_cost}` | Scheduler | Marks task scheduling | v1 |
| Task Started | `venture.task.started.v1` | `{task_id, workflow_id, agent_role, tool_calls_expected}` | Task executor | Marks task execution start | v1 |
| Task Completed | `venture.task.completed.v1` | `{task_id, workflow_id, status, tool_calls_count, actual_eau_cost, duration_ms}` | Task executor | Records task completion and cost | v1 |
| Task Failed | `venture.task.failed.v1` | `{task_id, workflow_id, error_code, error_message, partial_results}` | Task executor | Records task failure | v1 |

**Payload Schema Details:**
- `agent_role`: One of `analyst`, `architect`, `engineer`, `auditor`, `orchestrator`
- `workspace_id`: Links to workspace isolation boundary
- `eau_cost`: Ecosystem Allocation Unit (EAU) consumed by task
- `task_type`: Corresponds to tool categories (code, artifact, policy, compliance, etc.)

---

### 2.2 Artifact Compilation Events (artifact.*)

| Event Name | Fully Qualified | Payload Schema | Emitted By | Purpose | Version |
|---|---|---|---|---|---|
| Artifact IR Created | `venture.artifact.ir_created.v1` | `{artifact_ir_id, ir_type, schema_version, content_hash, payload_size_bytes}` | Artifact compiler (TRACK-A) | Marks artifact IR creation | v1 |
| Artifact Build Started | `venture.artifact.build_started.v1` | `{artifact_ir_id, build_id, toolchain_version, target_surface, estimated_cost_eau}` | Build engine | Marks build initialization | v1 |
| Artifact Build Completed | `venture.artifact.build_completed.v1` | `{build_id, artifact_ir_id, status, output_hash, actual_cost_eau, duration_ms}` | Build engine | Records build completion | v1 |
| Artifact Build Failed | `venture.artifact.build_failed.v1` | `{build_id, artifact_ir_id, error_code, error_message, partial_output}` | Build engine | Records build failure | v1 |
| Artifact Provenance Attested | `venture.artifact.provenance_attested.v1` | `{artifact_id, build_id, provider, model_version, signature, timestamp}` | Provenance engine | Records signed provenance evidence | v1 |
| Artifact Cache Hit | `venture.artifact.cache_hit.v1` | `{artifact_ir_id, idempotency_key, cached_artifact_id, cache_age_ms}` | Build engine | Records deterministic cache hit | v1 |

**Payload Schema Details:**
- `ir_type`: One of `SlideSpec`, `DocSpec`, `TimelineSpec`, `AudioSpec`, `BoardSpec`, `CivSimulationArtifact`
- `target_surface`: One of `web`, `mobile`, `vr`, `print`, `cinema`
- `provider`: One of `openai`, `anthropic`, `veo`, `nanobanana`, `internal`
- `model_version`: Semantic version of provider model/toolchain
- `signature`: Ed25519 signature over `{artifact_id, provider, model_version, timestamp}`

---

### 2.3 Money & Treasury Events (money.*)

| Event Name | Fully Qualified | Payload Schema | Emitted By | Purpose | Version |
|---|---|---|---|---|---|
| Money Intent Created | `venture.money.intent_created.v1` | `{intent_id, workflow_id, scope_type, scope_id, cap_amount, window, ttl_ms}` | Money control (TRACK-B) | Records spend authorization request | v1 |
| Money Authorization Decided | `venture.money.authorization_decided.v1` | `{intent_id, workflow_id, decision, reason_code, policy_bundle_id}` | Authorization engine | Records spend approval/rejection | v1 |
| Ledger Entry Created | `venture.ledger.entry_created.v1` | `{entry_id, debit_account, credit_account, amount, reference_id, policy_bundle_id}` | Ledger engine (TRACK-B) | Records double-entry transaction | v1 |
| Budget Allocation Approved | `venture.budget.allocation_approved.v1` | `{workspace_id, allocation_amount, window, policy_bundle_id}` | Budget engine | Records workspace budget approval | v1 |
| Budget Exceeded | `venture.budget.exceeded.v1` | `{workspace_id, budget_limit, actual_spend, overage_amount}` | Budget engine | Records budget violation | v1 |
| Reconciliation Run | `venture.reconciliation.run.v1` | `{run_id, period, drift_amount, drift_pct, status, timestamp}` | Reconciliation engine | Records daily/weekly reconciliation | v1 |

**Payload Schema Details:**
- `scope_type`: One of `workflow`, `task`, `agent_action`, `workspace`, `global`
- `reason_code`: One of `approved`, `rejected_budget`, `rejected_policy`, `revoked`, `expired`
- `debit_account` / `credit_account`: Account IDs from chart of accounts (see DATA_MODEL_DB_SPEC)
- `drift_pct`: Reconciliation discrepancy as percentage of total ledger balance

---

### 2.4 Compliance & Audit Events (compliance.*)

| Event Name | Fully Qualified | Payload Schema | Emitted By | Purpose | Version |
|---|---|---|---|---|---|
| Compliance Case Opened | `venture.compliance.case_opened.v1` | `{case_id, case_type, severity_level, evidence_chain_start}` | Compliance machine (OPS) | Records new compliance investigation | v1 |
| Compliance Case Evidence Added | `venture.compliance.case_evidence_added.v1` | `{case_id, evidence_id, event_id_reference, evidence_type, timestamp}` | Audit trail engine | Appends evidence to case | v1 |
| Compliance Case Closed | `venture.compliance.case_closed.v1` | `{case_id, closure_reason, evidence_count, finding}` | Compliance machine | Records case resolution | v1 |
| Compliance Violation Detected | `venture.compliance.violation_detected.v1` | `{violation_id, violation_type, severity_level, affected_workflow_id, remediation_action}` | Policy verifier | Records policy/regulatory breach | v1 |
| Audit Log Entry | `venture.audit.log_entry.v1` | `{log_id, action_type, actor_id, resource_id, change_summary, timestamp}` | Audit engine | Records user/system action for audit | v1 |
| Policy Bundle Drift Detected | `venture.compliance.policy_drift.v1` | `{drift_id, expected_bundle_id, actual_bundle_id, diff_summary}` | Policy drift detector | Records unintended policy change | v1 |

**Payload Schema Details:**
- `case_type`: One of `policy_violation`, `treasury_drift`, `tool_misuse`, `compliance_breach`, `incident_investigation`
- `severity_level`: One of `critical`, `high`, `medium`, `low`
- `evidence_type`: One of `event_log`, `state_snapshot`, `signature`, `attestation`, `audit_trail`
- `remediation_action`: One of `suspend_workflow`, `revoke_authorization`, `escalate_to_human`, `auto_remediate`

---

### 2.5 Policy & Governance Events (policy.*)

| Event Name | Fully Qualified | Payload Schema | Emitted By | Purpose | Version |
|---|---|---|---|---|---|
| Policy Bundle Published | `venture.policy.bundle_published.v1` | `{bundle_id, version, schema_snapshot, published_at, effective_at}` | Policy engine (TRACK-C) | Records new policy bundle | v1 |
| Policy Evaluation Started | `venture.policy.evaluation_started.v1` | `{evaluation_id, bundle_id, context_snapshot, decision_pending}` | Policy evaluator | Marks policy evaluation start | v1 |
| Policy Decision Made | `venture.policy.decision_made.v1` | `{decision_id, bundle_id, decision_result, supporting_facts}` | Policy evaluator | Records policy decision | v1 |
| Policy Rollback Initiated | `venture.policy.rollback_initiated.v1` | `{rollback_id, bundle_id_being_revoked, new_bundle_id, affected_workflows}` | Policy admin | Records policy revocation and recovery | v1 |

**Payload Schema Details:**
- `schema_snapshot`: Compressed JSON schema of entire policy bundle
- `decision_result`: The control decision output (e.g., `"allow"`, `"reject_with_escalation"`, `"require_approval"`)
- `supporting_facts`: Array of facts from context that drove decision

---

### 2.6 User & Multi-Tenancy Events (user.*)

| Event Name | Fully Qualified | Payload Schema | Emitted By | Purpose | Version |
|---|---|---|---|---|---|
| User Onboarded | `venture.user.onboarded.v1` | `{user_id, role, workspace_id, capability_tier, initial_budget_eau}` | User management | Records new user creation | v1 |
| User Capability Changed | `venture.user.capability_changed.v1` | `{user_id, old_capability_tier, new_capability_tier, reason}` | Access control | Records permission/capability change | v1 |
| User Activity Signal | `venture.user.activity_signal.v1` | `{user_id, signal_type, metric_value, observation_window}` | Metrics engine | Records user behavior metrics | v1 |
| User Offboarded | `venture.user.offboarded.v1` | `{user_id, offboarding_reason, residual_budget_disposal}` | User management | Records user deactivation | v1 |

**Payload Schema Details:**
- `capability_tier`: One of `tier_0_admin`, `tier_1_advanced`, `tier_2_standard`, `tier_3_limited`
- `signal_type`: One of `task_completion_rate`, `tool_usage_distribution`, `budget_utilization`, `compliance_rate`
- `metric_value`: Float; context-dependent range
- `observation_window`: Time window over which signal was computed (e.g., "last_7_days")

---

### 2.7 Privacy & Data Protection Events (privacy.*)

| Event Name | Fully Qualified | Payload Schema | Emitted By | Purpose | Version |
|---|---|---|---|---|---|
| Privacy Request Received | `venture.privacy.request_received.v1` | `{request_id, request_type, subject_user_id, received_at}` | Privacy manager | Records data request (GDPR/CCPA) | v1 |
| Privacy Request Processed | `venture.privacy.request_processed.v1` | `{request_id, status, data_collected_bytes, completion_timestamp}` | Privacy engine | Records request fulfillment | v1 |
| Data Retention Policy Applied | `venture.privacy.retention_policy_applied.v1` | `{policy_id, affected_record_count, data_deleted_bytes, policy_version}` | Data retention engine | Records automatic data cleanup | v1 |
| PII Detected in Artifact | `venture.privacy.pii_detected.v1` | `{artifact_id, pii_type, detection_confidence, remediation_action}` | PII detector | Records sensitive data discovery | v1 |

**Payload Schema Details:**
- `request_type`: One of `right_to_access`, `right_to_deletion`, `right_to_portability`, `right_to_correction`
- `pii_type`: One of `email`, `phone`, `ssn`, `credit_card`, `api_key`, `password_hash`, `location`
- `detection_confidence`: Float [0, 1]; confidence that detected data is actually PII

---

## Part 3: Cross-Track Event Flows

Events flowing between CIV and Venture systems.

### 3.1 CIV → Venture Relay Pattern

CIV events are captured and relayed into Venture event bus for audit and compliance purposes:

```
CIV Event Emitted
  ↓
Event Relay Layer (in TRACK-C_CONTROL_PLANE)
  ├─ Translate event type: civ.* → venture.civ.* (namespace isolation)
  ├─ Wrap in EventEnvelopeV1 (add workflow_id, trace_id, policy_bundle_id)
  ├─ Compute event_id (UUID for Venture tracking)
  └─ Emit to Venture event bus
  ↓
Venture Event Bus
  ├─ Store in event log
  ├─ Trigger subscribed handlers (compliance, metrics, etc.)
  └─ Make available for replay and audit
```

**Key Mapping Rules:**
1. **Namespace**: CIV events prefixed with `civ.` to distinguish from native Venture events
2. **Workflow Context**: CIV simulation run → Venture workflow_id (1:1 mapping)
3. **Tick to Task**: Each CIV tick → Venture task in orchestration DAG
4. **Policy Bundle Pinning**: CIV event's policy_bundle_id must match Venture's policy_bundle_id for that workflow
5. **Idempotency**: CIV event_id + source_system + timestamp = replay_token for deduplication

### 3.2 Specific Cross-Track Event Flows

#### Flow A: CIV Economy → Venture Ledger

```
civ.economy.transfer_booked.v1 (sender, receiver, amount, reason)
  ↓ (Relay)
venture.civ.economy.transfer_booked.v1 (wrapped)
  ↓ (Subscription)
Venture Ledger Engine
  ├─ Extract sender/receiver/amount
  ├─ Determine debit_account (sender's account) and credit_account (receiver's account)
  ├─ Emit venture.ledger.entry_created.v1 with (debit_account, credit_account, amount, reference_id=civ_event_id)
  └─ Update account balances; validate conservation law
```

**Validation Rules:**
- Both debit and credit amounts must be positive and equal
- Sum of all ledger entries must equal zero (conservation)
- Accounts must exist and be active
- Policy bundle version must match CIV's policy bundle

#### Flow B: CIV Policy Evaluation → Venture Audit Trail

```
civ.policy.evaluated.v1 (policy_type, control_decision, evaluation_duration_ms)
  ↓ (Relay)
venture.civ.policy.evaluated.v1 (wrapped)
  ↓ (Subscription)
Venture Compliance Machine
  ├─ Open or append to compliance case (case_type="entity_policy_evaluation")
  ├─ Add evidence (event_id_reference, evidence_type="policy_evaluation_record")
  ├─ Check if control_decision matches policy bundle expectations
  └─ If unexpected: emit compliance.violation_detected.v1 (severity_level="warning")
```

#### Flow C: CIV Citizen Lifecycle → Venture User Signals

```
civ.citizen.born.v1 / civ.citizen.retired.v1 / civ.citizen.died.v1 (citizen_id, ...)
  ↓ (Relay)
venture.civ.citizen.[event_name].v1 (wrapped)
  ↓ (Subscription)
Venture Metrics Engine
  ├─ Create user.activity_signal.v1 for onboarding/offboarding if applicable
  ├─ If citizen_id maps to managed user_id in Venture:
  │   └─ Update user capability tier based on life stage
  └─ Otherwise: log as observational metric (do not auto-create users)
```

**Mapping Details:**
- CIV citizen birth → Venture user onboarding signal (if opt-in)
- CIV citizen career change → Venture capability tier escalation
- CIV citizen death → Venture user offboarding signal (if opt-in)

#### Flow D: CIV Institution Changes → Venture Compliance Cases

```
civ.institution.created.v1 / civ.institution.dissolved.v1 / civ.institution.state_changed.v1
  ↓ (Relay)
venture.civ.institution.[event_name].v1 (wrapped)
  ↓ (Subscription)
Venture Compliance Machine
  ├─ Open compliance case: case_type="institutional_change"
  ├─ Add evidence chain:
  │   ├─ Event 1: institution.created.v1 (case opened)
  │   ├─ Event 2-N: state_changed.v1, merged.v1, split.v1 (evidence accumulation)
  │   └─ Event N+1: institution.dissolved.v1 (case closed)
  └─ Case queryable for audit and policy review
```

#### Flow E: CIV Energy Accounting → Venture Budget Consumption

```
civ.energy.consumed.v1 (consumer_entity_id, energy_qty, source_type)
  ↓ (Relay)
venture.civ.energy.consumed.v1 (wrapped)
  ↓ (Subscription)
Venture Budget Engine
  ├─ Map energy_qty → eau_cost_estimate using conversion function (see ENERGY_TO_BUDGET_CONTRACT)
  ├─ Deduct from workspace quota
  ├─ If quota exceeded:
  │   ├─ Emit budget.exceeded.v1
  │   └─ Trigger remediation (reduce consumption, escalate to policy review, etc.)
  └─ Log consumption signal for future capacity planning
```

**Conversion Function**:
- Base: 1 Joule (CIV-0107 unit) ≈ 0.001 EAU (empirically calibrated)
- Multiplier by source_type: renewable=1.0x, fossil=1.5x, nuclear=0.8x, storage_discharge=2.0x
- Final: `eau_cost = energy_qty * 0.001 * source_type_multiplier`

### 3.3 Venture → CIV Influence (Optional/Future)

Venture compliance decisions can influence CIV simulation policy:

```
venture.compliance.violation_detected.v1 (violation_type="tool_misuse")
  ↓ (Optional Feedback Loop)
CIV Policy Engine
  ├─ Reduce policy evaluation budget for next N ticks
  ├─ Adjust policy_bundle to be more conservative
  └─ Emit civ.policy.adjusted.v1 for audit
```

**Note**: This is optional and future; current design emphasizes CIV → Venture telemetry, not closed-loop control.

---

## Part 4: Event Ordering & Determinism Guarantees

### Event Ordering Within a CIV Tick

All CIV events within a single tick follow deterministic phase order:

```
Tick T:
  1. civ.tick.started.v1
  2. civ.policy.evaluated.v1 (demographic policies)
  3. civ.citizen.[born|retired|died].v1 (demographic changes)
  4. civ.policy.evaluated.v1 (economic policies)
  5. civ.economy.market_cleared.v1
  6. civ.economy.transfer_booked.v1 (multiple)
  7. civ.energy.consumed.v1 / civ.energy.generated.v1 (multiple)
  8. civ.energy.balance.v1 (conservation check)
  9. civ.policy.evaluated.v1 (spatial policies)
  10. civ.citizen.metrics_updated.v1
  11. civ.institution.metrics_updated.v1
  12. civ.tick.completed.v1
```

**Determinism Guarantee**: Given identical `tick_id`, `simulation_seed`, and `policy_bundle_id`, events 1-12 must be emitted in identical order with identical payloads.

### Event Ordering Within a Venture Workflow

Venture events are ordered by task execution order (DAG semantics):

```
Workflow W (CIV integration example):
  1. venture.workflow.started.v1
  2. venture.task.scheduled.v1 (task_type="civ_simulation")
  3. venture.task.started.v1
  4. venture.civ.tick.started.v1 (relayed from CIV)
  5. venture.civ.economy.transfer_booked.v1 (relayed)
  6. venture.ledger.entry_created.v1 (Venture-side transaction)
  7. venture.civ.tick.completed.v1 (relayed)
  8. venture.task.completed.v1
  9. venture.workflow.completed.v1
```

**Concurrency**: Tasks can execute in parallel; events from different tasks may interleave. However, events from the same task follow strict ordering.

---

## Part 5: Schema Registry & Versioning

### Event Schema Versioning

All event types follow semantic versioning:

- **Major version** (e.g., `v1` → `v2`): Breaking schema changes (required field added/removed/type changed)
- **Minor version** (e.g., `v1.1`): Backwards-compatible addition (new optional field)
- **Patch version** (e.g., `v1.0.1`): Documentation/comment updates; no schema changes

**Deprecation Policy**:
- When deprecating an event type, mark as deprecated in schema registry
- Support deprecated types for 2 policy bundle versions (N and N+1)
- After 2 versions, reject deprecated types with error message

### Payload Schema Storage

All event payload schemas are stored in `venture/SCHEMA_PACK.md` and registered in Venture's schema registry with:

```json
{
  "event_type": "civ.economy.transfer_booked.v1",
  "schema_version": 1,
  "json_schema": { /* full JSON schema */ },
  "registered_at": "2026-02-21T00:00:00Z",
  "deprecated": false,
  "references": ["CIV-0100", "TRACK_B_TREASURY_COMPLIANCE_SPEC"]
}
```

---

## Summary

| Dimension | Count | Coverage |
|-----------|-------|----------|
| CIV Event Types | 32 | Run lifecycle, policy, economy, energy, citizens, institutions, conflict, social |
| Venture Event Types | 26 | Workflows, artifacts, money, compliance, policy, users, privacy |
| **Total Event Types** | **58** | All mapped to EventEnvelopeV1 schema |
| Cross-Track Flows | 5 major patterns | CIV→Venture relay, ledger sync, audit trail, user signals, budget consumption |
| Determinism Guarantees | 100% | Both systems support full deterministic replay from event log |

All events are audit-ready, replay-safe, and traceable through both CIV and Venture systems.

---

**Document Control**

| Version | Date | Author | Change |
|---------|------|--------|--------|
| 1.0 | 2026-02-21 | Kush Integration Team | Initial version; 58 event types documented, 5 cross-track flows defined |

