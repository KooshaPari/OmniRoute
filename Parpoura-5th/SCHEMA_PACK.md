# Venture Core Schema Pack

## EventEnvelope v1 (Full JSON Schema)

**Version:** v1
**Status:** stable
**Last Updated:** 2026-02-21

### Specification

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "https://venture.autonomy/schemas/v1/event-envelope.json",
  "title": "Event Envelope v1",
  "description": "Immutable event record envelope for all state changes in Venture platform.",
  "type": "object",
  "required": [
    "event_id",
    "event_type",
    "workflow_id",
    "policy_version",
    "trace_id",
    "payload",
    "created_at",
    "schema_version"
  ],
  "properties": {
    "event_id": {
      "type": "string",
      "format": "uuid",
      "description": "Globally unique event identifier."
    },
    "event_type": {
      "type": "string",
      "pattern": "^[a-z]+\\.[a-z_]+$",
      "description": "Event topic in dot notation (e.g., 'treasury.intent_created', 'agent.action_executed').",
      "examples": [
        "treasury.intent_created",
        "treasury.authorized",
        "treasury.executed",
        "agent.action_started",
        "agent.action_completed",
        "compliance.case_opened",
        "policy.rule_evaluated"
      ]
    },
    "workflow_id": {
      "type": "string",
      "format": "uuid",
      "description": "UUID of the workflow this event belongs to. REQUIRED: every event must link to a workflow."
    },
    "policy_version": {
      "type": "string",
      "pattern": "^\\d+\\.\\d+(\\.\\d+)?$",
      "description": "Policy bundle version active when event was created (e.g., '1.0', '1.0.1'). Immutable snapshot.",
      "examples": ["1.0", "1.0.1", "2.0"]
    },
    "trace_id": {
      "type": "string",
      "pattern": "^[a-z0-9-]{20,}$",
      "description": "Distributed trace ID for request correlation across services. REQUIRED: enables tracing.",
      "examples": ["550e8400-e29b-41d4-a716"]
    },
    "schema_version": {
      "type": "string",
      "enum": ["v1"],
      "description": "Schema version of this envelope. Unknown versions are rejected at ingest."
    },
    "payload": {
      "type": "object",
      "description": "Event-specific payload. Schema varies by event_type. Must include at minimum: type-specific required fields.",
      "additionalProperties": true
    },
    "created_at": {
      "type": "string",
      "format": "date-time",
      "description": "ISO-8601 timestamp when event was created (UTC). Must be within ±5 min of current time.",
      "examples": ["2026-02-21T10:30:45.123456Z"]
    },
    "source_service": {
      "type": "string",
      "enum": [
        "policy-engine",
        "treasury-api",
        "agent-runtime",
        "artifact-compiler",
        "compliance-engine",
        "venture-orchestrator",
        "control-plane-api"
      ],
      "description": "Optional: which service emitted this event."
    },
    "correlation_id": {
      "type": "string",
      "format": "uuid",
      "description": "Optional: correlate related events (e.g., all events from a single API call)."
    }
  },
  "additionalProperties": false,
  "examples": [
    {
      "event_id": "550e8400-e29b-41d4-a716-446655440000",
      "event_type": "treasury.intent_created",
      "workflow_id": "550e8400-e29b-41d4-a716-446655440001",
      "policy_version": "1.0",
      "trace_id": "550e8400-e29b-41d4-a716",
      "schema_version": "v1",
      "payload": {
        "intent_id": "550e8400-e29b-41d4-a716-446655440002",
        "amount_cents": 100000,
        "currency": "USD",
        "purpose": "vendor_payout",
        "ttl_seconds": 3600
      },
      "created_at": "2026-02-21T10:30:45.123456Z",
      "source_service": "treasury-api",
      "correlation_id": "550e8400-e29b-41d4-a716-446655440003"
    }
  ]
}
```

### Validation Rules

1. **Reject unknown schema_version**: If `schema_version` not in `["v1"]`, reject.
2. **Reject missing workflow_id**: Every event MUST have `workflow_id`.
3. **Reject missing trace_id**: Every event MUST have `trace_id`.
4. **Timestamp validation**: `created_at` must be within ±5 minutes of current UTC time.
5. **Event type format**: `event_type` must match `^[a-z]+\.[a-z_]+$`.
6. **Payload schema**: Payload validated against event-type-specific schema.

---

## TaskEnvelope v1 (Full JSON Schema)

**Version:** v1
**Status:** stable
**Last Updated:** 2026-02-21

### Specification

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "https://venture.autonomy/schemas/v1/task-envelope.json",
  "title": "Task Envelope v1",
  "description": "Work unit sent to agent runtime for execution.",
  "type": "object",
  "required": [
    "task_id",
    "workflow_id",
    "agent_role",
    "task_type",
    "input",
    "created_at",
    "schema_version",
    "policy_version"
  ],
  "properties": {
    "task_id": {
      "type": "string",
      "format": "uuid",
      "description": "Globally unique task identifier."
    },
    "workflow_id": {
      "type": "string",
      "format": "uuid",
      "description": "UUID of the workflow this task belongs to."
    },
    "agent_role": {
      "type": "string",
      "enum": [
        "analyst",
        "executor",
        "business_strategist",
        "executive",
        "researcher"
      ],
      "description": "Role of the agent executing this task. Determines tool allowlist."
    },
    "task_type": {
      "type": "string",
      "enum": [
        "analyze",
        "execute_tool",
        "approve",
        "approve_spend",
        "research",
        "reconcile",
        "validate",
        "report"
      ],
      "description": "Type of work to perform."
    },
    "input": {
      "type": "object",
      "description": "Task input parameters. Schema varies by task_type.",
      "additionalProperties": true
    },
    "schema_version": {
      "type": "string",
      "enum": ["v1"],
      "description": "Schema version of this envelope."
    },
    "policy_version": {
      "type": "string",
      "pattern": "^\\d+\\.\\d+(\\.\\d+)?$",
      "description": "Policy bundle version to apply when executing this task."
    },
    "trace_id": {
      "type": "string",
      "description": "Distributed trace ID for correlation."
    },
    "timeout_seconds": {
      "type": "integer",
      "minimum": 10,
      "maximum": 3600,
      "description": "Optional: maximum execution time (default: 300s).",
      "default": 300
    },
    "retry_count": {
      "type": "integer",
      "minimum": 0,
      "maximum": 5,
      "description": "Optional: number of retries on failure (default: 3).",
      "default": 3
    },
    "created_at": {
      "type": "string",
      "format": "date-time",
      "description": "ISO-8601 timestamp when task was created."
    },
    "parent_task_id": {
      "type": ["string", "null"],
      "format": "uuid",
      "description": "Optional: task ID of parent task (for nested workflows)."
    },
    "metadata": {
      "type": "object",
      "description": "Optional: arbitrary metadata (user_id, request_id, etc).",
      "additionalProperties": true
    }
  },
  "additionalProperties": false,
  "examples": [
    {
      "task_id": "550e8400-e29b-41d4-a716-446655440000",
      "workflow_id": "550e8400-e29b-41d4-a716-446655440001",
      "agent_role": "executor",
      "task_type": "execute_tool",
      "input": {
        "tool": "web_search",
        "params": {
          "query": "python asyncio best practices",
          "max_results": 5
        }
      },
      "schema_version": "v1",
      "policy_version": "1.0",
      "trace_id": "550e8400-e29b-41d4-a716",
      "timeout_seconds": 300,
      "retry_count": 3,
      "created_at": "2026-02-21T10:30:45.123456Z"
    }
  ]
}
```

---

## PolicyBundle v1 (Full JSON Schema)

**Version:** v1
**Status:** stable
**Last Updated:** 2026-02-21

### Specification

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "https://venture.autonomy/schemas/v1/policy-bundle.json",
  "title": "Policy Bundle v1",
  "description": "Immutable set of governance rules governing agent actions and spend.",
  "type": "object",
  "required": [
    "id",
    "version",
    "content_hash",
    "roles",
    "rules",
    "created_at"
  ],
  "properties": {
    "id": {
      "type": "string",
      "format": "uuid",
      "description": "Unique policy bundle identifier."
    },
    "version": {
      "type": "string",
      "pattern": "^\\d+\\.\\d+(\\.\\d+)?$",
      "description": "Policy version (semantic versioning)."
    },
    "content_hash": {
      "type": "string",
      "pattern": "^[a-f0-9]{64}$",
      "description": "SHA-256 hash of bundle content. Used to detect tampering."
    },
    "status": {
      "type": "string",
      "enum": ["draft", "active", "deprecated"],
      "description": "Policy status. Only 'active' policies are enforced.",
      "default": "draft"
    },
    "roles": {
      "type": "object",
      "description": "Role definitions with tool allowlists and spend ceilings.",
      "additionalProperties": {
        "type": "object",
        "required": ["tools", "daily_budget_cents"],
        "properties": {
          "tools": {
            "type": "array",
            "items": {
              "type": "string",
              "pattern": "^[a-z_]+$"
            },
            "description": "List of allowed tools for this role (default-deny).",
            "examples": [
              ["web_search", "read_file", "call_api"],
              ["approve_spend", "create_workflow"]
            ]
          },
          "daily_budget_cents": {
            "type": "integer",
            "minimum": 0,
            "description": "Daily spend ceiling in cents."
          },
          "description": {
            "type": "string",
            "description": "Optional: human-readable description."
          }
        }
      },
      "examples": {
        "executor": {
          "tools": ["web_search", "read_file", "call_api"],
          "daily_budget_cents": 100000,
          "description": "General execution agent"
        },
        "executive": {
          "tools": ["approve_spend", "create_workflow", "escalate"],
          "daily_budget_cents": 10000000,
          "description": "Policy approval and escalation"
        }
      }
    },
    "rules": {
      "type": "array",
      "description": "Conditional policy rules evaluated at runtime.",
      "items": {
        "type": "object",
        "required": ["id", "name", "condition", "action"],
        "properties": {
          "id": {
            "type": "string",
            "pattern": "^rule-[a-z0-9-]+$"
          },
          "name": {
            "type": "string",
            "description": "Human-readable rule name."
          },
          "condition": {
            "type": "string",
            "description": "Condition to evaluate (DSL: amount > 50000, role == 'executor', etc)."
          },
          "action": {
            "type": "string",
            "enum": [
              "allow",
              "deny",
              "require_approval",
              "require_executive_approval",
              "flag_compliance",
              "block_and_alert"
            ]
          },
          "severity": {
            "type": "string",
            "enum": ["info", "warning", "critical"],
            "default": "info"
          }
        }
      },
      "examples": [
        {
          "id": "rule-large-spend",
          "name": "Large Spend Requires Approval",
          "condition": "amount_cents > 50000",
          "action": "require_executive_approval",
          "severity": "critical"
        },
        {
          "id": "rule-tool-injection",
          "name": "Block Tool Injection Attempts",
          "condition": "tool not in allowlist",
          "action": "block_and_alert",
          "severity": "critical"
        }
      ]
    },
    "created_at": {
      "type": "string",
      "format": "date-time",
      "description": "When policy bundle was created."
    },
    "metadata": {
      "type": "object",
      "description": "Optional: policy metadata (author, review_date, etc).",
      "additionalProperties": true
    }
  },
  "additionalProperties": false
}
```

---

## SpendAuthorization v1 (Full JSON Schema)

**Version:** v1
**Status:** stable
**Last Updated:** 2026-02-21

### Specification

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "https://venture.autonomy/schemas/v1/spend-authorization.json",
  "title": "Spend Authorization v1",
  "description": "Decision to authorize (or deny) a specific spend request.",
  "type": "object",
  "required": [
    "id",
    "money_intent_id",
    "workflow_id",
    "decision",
    "created_at"
  ],
  "properties": {
    "id": {
      "type": "string",
      "format": "uuid",
      "description": "Unique authorization record ID."
    },
    "money_intent_id": {
      "type": "string",
      "format": "uuid",
      "description": "References the money_intent being authorized."
    },
    "workflow_id": {
      "type": "string",
      "format": "uuid",
      "description": "Workflow ID for audit trail."
    },
    "decision": {
      "type": "string",
      "enum": ["pending", "approved", "denied", "expired"],
      "description": "Authorization decision state."
    },
    "reason_code": {
      "type": "string",
      "enum": [
        "within_daily_budget",
        "approved_by_executive",
        "insufficient_budget",
        "policy_violation",
        "unregistered_purpose",
        "timeout",
        "manually_denied"
      ],
      "description": "Why authorization was approved or denied."
    },
    "amount_cents": {
      "type": "integer",
      "minimum": 0,
      "description": "Authorized amount in cents (may be less than requested)."
    },
    "authorized_by": {
      "type": ["string", "null"],
      "description": "Optional: agent or human who authorized (for manual approvals)."
    },
    "expires_at": {
      "type": ["string", "null"],
      "format": "date-time",
      "description": "Optional: authorization expires at this time."
    },
    "created_at": {
      "type": "string",
      "format": "date-time",
      "description": "When authorization decision was made."
    },
    "metadata": {
      "type": "object",
      "description": "Optional: additional context (policy_version, evaluation_time, etc).",
      "additionalProperties": true
    }
  },
  "additionalProperties": false,
  "examples": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "money_intent_id": "550e8400-e29b-41d4-a716-446655440001",
      "workflow_id": "550e8400-e29b-41d4-a716-446655440002",
      "decision": "approved",
      "reason_code": "within_daily_budget",
      "amount_cents": 100000,
      "authorized_by": null,
      "expires_at": "2026-02-21T12:30:45.123456Z",
      "created_at": "2026-02-21T10:30:45.123456Z",
      "metadata": {
        "policy_version": "1.0",
        "evaluation_time_ms": 45
      }
    }
  ]
}
```

---

## ArtifactSpec (Base Schema v1)

**Version:** v1
**Status:** stable
**Last Updated:** 2026-02-21

### Specification

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "https://venture.autonomy/schemas/v1/artifact-spec.json",
  "title": "Artifact Specification Base Schema v1",
  "description": "Base specification for all compiled artifacts. Type-specific schemas extend this.",
  "type": "object",
  "required": [
    "artifact_id",
    "artifact_type",
    "workflow_id",
    "content_hash",
    "schema_version",
    "created_at"
  ],
  "properties": {
    "artifact_id": {
      "type": "string",
      "format": "uuid",
      "description": "Unique artifact identifier."
    },
    "artifact_type": {
      "type": "string",
      "enum": [
        "workflow_plan",
        "decision_tree",
        "code_bundle",
        "report",
        "policy_evaluation",
        "spending_plan"
      ],
      "description": "Type of artifact."
    },
    "workflow_id": {
      "type": "string",
      "format": "uuid",
      "description": "Workflow that generated this artifact."
    },
    "content_hash": {
      "type": "string",
      "pattern": "^[a-f0-9]{64}$",
      "description": "SHA-256 of artifact content for integrity verification."
    },
    "schema_version": {
      "type": "string",
      "enum": ["v1"],
      "description": "Schema version."
    },
    "determinism_checksum": {
      "type": "string",
      "pattern": "^[a-f0-9]{64}$",
      "description": "Deterministic hash including inputs + policy version. Same inputs = same hash."
    },
    "content": {
      "type": "object",
      "description": "Artifact-type-specific content.",
      "additionalProperties": true
    },
    "metadata": {
      "type": "object",
      "description": "Artifact metadata.",
      "properties": {
        "policy_version": {
          "type": "string"
        },
        "compilation_time_ms": {
          "type": "integer"
        },
        "compiler_version": {
          "type": "string"
        }
      }
    },
    "created_at": {
      "type": "string",
      "format": "date-time"
    }
  },
  "additionalProperties": false
}
```

---

## AgentIdentity v1 (Full JSON Schema)

**Version:** v1
**Status:** stable
**Last Updated:** 2026-02-21

### Specification

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "https://venture.autonomy/schemas/v1/agent-identity.json",
  "title": "Agent Identity v1",
  "description": "Identity and authorization context for an agent executing tasks.",
  "type": "object",
  "required": [
    "agent_id",
    "agent_role",
    "workload_id",
    "policy_version"
  ],
  "properties": {
    "agent_id": {
      "type": "string",
      "format": "uuid",
      "description": "Unique agent instance identifier."
    },
    "agent_role": {
      "type": "string",
      "enum": [
        "analyst",
        "executor",
        "business_strategist",
        "executive",
        "researcher"
      ],
      "description": "Agent's role, determines tool allowlist."
    },
    "workload_id": {
      "type": "string",
      "description": "Kubernetes workload ID or container ID for mTLS/cert binding."
    },
    "policy_version": {
      "type": "string",
      "pattern": "^\\d+\\.\\d+(\\.\\d+)?$",
      "description": "Policy bundle version this agent is bound to."
    },
    "allowlist_ref": {
      "type": "string",
      "description": "Reference to policy bundle allowlist for this role (e.g., 'policy-1.0:executor')."
    },
    "ttl_seconds": {
      "type": "integer",
      "minimum": 60,
      "maximum": 86400,
      "description": "Identity validity period (default: 3600).",
      "default": 3600
    },
    "capabilities": {
      "type": "array",
      "items": {
        "type": "string"
      },
      "description": "Optional: explicit capability list (overrides role default).",
      "examples": [
        ["web_search", "read_file"],
        ["approve_spend"]
      ]
    },
    "constraints": {
      "type": "object",
      "description": "Optional: additional constraints (max_spend_day, require_manual_approval, etc).",
      "additionalProperties": true
    },
    "created_at": {
      "type": "string",
      "format": "date-time",
      "description": "When identity was issued."
    },
    "expires_at": {
      "type": "string",
      "format": "date-time",
      "description": "When identity expires."
    }
  },
  "additionalProperties": false,
  "examples": [
    {
      "agent_id": "550e8400-e29b-41d4-a716-446655440000",
      "agent_role": "executor",
      "workload_id": "pod-agent-executor-001",
      "policy_version": "1.0",
      "allowlist_ref": "policy-1.0:executor",
      "ttl_seconds": 3600,
      "capabilities": [
        "web_search",
        "read_file",
        "call_api"
      ],
      "constraints": {
        "daily_budget_cents": 100000,
        "require_human_approval_over_50k": true
      },
      "created_at": "2026-02-21T10:30:45.123456Z",
      "expires_at": "2026-02-21T11:30:45.123456Z"
    }
  ]
}
```

---

## FSM State Machines

### Approval FSM

```
pending --> approved
         --> denied
         --> expired (after TTL)
```

### Payout FSM

```
intent_created --> authorized --> executed --> reconciled
                                           --> disputed
                              --> denied
```

### Compliance FSM

```
open --> investigating --> remediated
                        --> escalated
                        --> waived
```

### Kill-Switch FSM

```
active --> frozen --> recovering --> active
       --> (requires manual intervention to recover)
```

---

## Validation Rules (Comprehensive)

1. **Unknown schema version rejection**: If `schema_version` not in registry, reject entire event/task.
2. **Workflow linkage required**: Every event/task must have `workflow_id`.
3. **Trace ID required**: Every event/task must have `trace_id`.
4. **Timestamp validation**: `created_at` must be within ±5 minutes of current time.
5. **Side-effect authorization chain**: Before executing treasury.executed, must have prior treasury.authorized event.
6. **Policy version immutability**: Once recorded, `policy_version` cannot change for that workflow.
7. **Amount validation**: All amounts in cents (integers), >= 0, consistent across related records.
8. **Event type format**: Must match `^[a-z]+\.[a-z_]+$`.
9. **UUID format**: All IDs must be valid UUIDs.
10. **Hash format**: All hashes must be valid SHA-256 hex strings.
11. **No orphaned records**: Every ledger_entry must reference a workflow_id and authorization.
12. **Double-entry balance**: Sum of all workflow ledger entries == 0.
