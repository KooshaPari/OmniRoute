# Venture Role Tool Allowlist Matrix

**Status:** Engineering Reference — Authoritative
**Version:** 2.0.0
**Date:** 2026-02-21
**Owner:** Platform Security / Control Plane Team
**Scope:** All agent roles in the Parpour/Venture autonomous AI economic platform

---

## Table of Contents

1. [Overview and Enforcement Model](#1-overview-and-enforcement-model)
2. [Full Tool Registry](#2-full-tool-registry)
3. [Per-Role Allowlist](#3-per-role-allowlist)
4. [Master Allowlist Matrix Table](#4-master-allowlist-matrix-table)
5. [NATS Subject Access Control](#5-nats-subject-access-control)
6. [Conditional Tool Grant System](#6-conditional-tool-grant-system)
7. [Dynamic Role Elevation](#7-dynamic-role-elevation)
8. [Enforcement Implementation](#8-enforcement-implementation)
9. [Violation Handling](#9-violation-handling)
10. [Tool Sensitivity Levels and Preconditions Table](#10-tool-sensitivity-levels-and-preconditions-table)
11. [Domain Allowlist for web.fetch](#11-domain-allowlist-for-webfetch)
12. [Seccomp-BPF Policy for code.exec.sandbox](#12-seccomp-bpf-policy-for-codeexecsandbox)
13. [Audit and Observability](#13-audit-and-observability)
14. [FR Traceability](#14-fr-traceability)

---

## 1. Overview and Enforcement Model

### 1.1 Default-Deny Mandate

Every tool call in the Venture platform is **denied by default**. A tool call succeeds only when:

1. The calling agent's role explicitly lists the tool in its allowlist (static check), AND
2. All conditions attached to that allowlist entry pass at runtime (policy bundle check), AND
3. If the tool invokes sandboxed code execution, the seccomp-bpf profile permits all required syscalls (kernel-level check).

Any failure at any layer results in an immediate deny, a `agent.capability.violation.v1` event, and escalating enforcement response.

### 1.2 Three Enforcement Layers

```
Agent Code
    |
    v
+-----------------------------------------------------+
|  Layer 1: Static Allowlist Check (Control Plane)    |
|  - O(1) dict lookup: role -> tool_id -> ToolGrant   |
|  - Checked before any dispatch; no network required  |
|  - Emits agent.tool.checked.v1 on every call        |
+-------------------------+---------------------------+
                          | PASS
                          v
+-----------------------------------------------------+
|  Layer 2: Policy Bundle Runtime Check               |
|  - Versioned, signed, pinned policy bundle per exec |
|  - Evaluates conditions: budget, dual-approval, TTL |
|  - Validates policy_bundle_id matches active pin    |
|  - policy.evaluate called internally by CP          |
+-------------------------+---------------------------+
                          | PASS
                          v
+-----------------------------------------------------+
|  Layer 3: Seccomp-BPF Syscall Filter                |
|  (only for code.exec.sandbox calls)                 |
|  - Applied by subprocess launcher at fork time      |
|  - Kills process on first disallowed syscall        |
|  - Profile pinned per sandbox invocation            |
+-------------------------+---------------------------+
                          | PASS
                          v
                    Tool executes
```

### 1.3 Tool ID Naming Convention

All tools follow the `{namespace}.{action}` convention, with optional sub-namespacing:

```
{namespace}.{action}
{namespace}.{sub-namespace}.{action}
```

Examples:
- `io.read` — IO namespace, read action
- `money.intent.create` — Money namespace, intent sub-namespace, create action
- `civlab.challenge.submit` — CivLab namespace, challenge sub-namespace, submit action
- `web.fetch.internal` — Web namespace, fetch action, internal variant

**Namespaces:** `io`, `web`, `code`, `event`, `money`, `ledger`, `workflow`, `agent`, `policy`, `artifact`, `compliance`, `civlab`, `admin`

### 1.4 Capability Violation Escalation

Violations are tracked per agent session fingerprint:

| Violation Count | Auto-Response | Event Emitted |
|----------------|---------------|---------------|
| 1st in session | Warn + log | `agent.capability.violation.v1` severity=WARN |
| 2nd in session | Suspend session + alert ops-auditor | `agent.capability.violation.v1` severity=CRITICAL + `agent.session.suspended.v1` |
| 3rd cumulative (across sessions) | Ban agent fingerprint, require admin review | `agent.fingerprint.banned.v1` + ops-auditor paged |

Violation counts reset per calendar day for warn-level only. Suspensions and bans persist until admin review.

### 1.5 Policy Bundle Architecture

Every workflow execution pins a **policy bundle** at dispatch time:

```
PolicyBundle {
  bundle_id:   UUID (pinned at workflow start)
  version:     semver string
  signature:   Ed25519 signature over bundle contents
  valid_from:  ISO8601 datetime
  valid_until: ISO8601 datetime (max TTL: 24h)
  grants:      Map[role, List[ToolGrant]]
  overrides:   List[PolicyOverride]  // dynamic elevation grants
}
```

The `policy_bundle_id` is threaded through every tool call and event envelope. A tool call referencing an expired or revoked bundle is denied at Layer 2.

---

## 2. Full Tool Registry

All tool IDs, descriptions, sensitivity levels, and base preconditions. Preconditions listed here are the **minimum required** — per-role allowlist entries may add further conditions.

### Sensitivity Levels

| Level | Meaning |
|-------|---------|
| LOW | Read-only, non-sensitive data; minimal blast radius |
| MEDIUM | Write access or external I/O; bounded blast radius |
| HIGH | Financial, agent lifecycle, or external exec; significant blast radius |
| CRITICAL | Irreversible, cross-tenant, or existential impact; maximum blast radius |

### 2.1 IO Tools

| Tool ID | Description | Sensitivity | Base Preconditions |
|---------|-------------|-------------|-------------------|
| `io.read` | Read file/object from workspace or artifact store | LOW | Active trace ID |
| `io.write` | Write file/object to workspace | MEDIUM | Active trace ID; path scoped to workspace |
| `io.delete` | Delete file/object from workspace | HIGH | Active trace ID; policy bundle pin; explicit path |
| `io.list` | List files/objects in a workspace directory | LOW | Active trace ID |

### 2.2 Web Tools

| Tool ID | Description | Sensitivity | Base Preconditions |
|---------|-------------|-------------|-------------------|
| `web.fetch` | HTTP GET/POST to external internet URLs | HIGH | Active trace ID; domain on role allowlist; rate limited |
| `web.fetch.internal` | HTTP GET/POST to internal Venture services only | MEDIUM | Active trace ID; URL matches internal service registry |

### 2.3 Code Execution Tools

| Tool ID | Description | Sensitivity | Base Preconditions |
|---------|-------------|-------------|-------------------|
| `code.exec.restricted` | Execute Python via RestrictedPython (in-process, no subprocess) | MEDIUM | Active trace ID; policy bundle pin; no network access |
| `code.exec.sandbox` | Execute code via subprocess with seccomp-bpf filter | HIGH | Active trace ID; policy bundle pin; explicit grant; seccomp profile pinned |

### 2.4 Event Tools

| Tool ID | Description | Sensitivity | Base Preconditions |
|---------|-------------|-------------|-------------------|
| `event.publish` | Publish event to NATS subject | MEDIUM | Active trace ID; NATS subject on role pub list |
| `event.query` | Query historical events from event store | LOW | Active trace ID |
| `event.subscribe` | Subscribe to NATS subject for event stream | LOW | Active trace ID; NATS subject on role sub list |

### 2.5 Money Tools

| Tool ID | Description | Sensitivity | Base Preconditions |
|---------|-------------|-------------|-------------------|
| `money.intent.create` | Create a payment intent (initiates financial transaction) | CRITICAL | Budget envelope; policy bundle pin; trace ID; dual approval >$100 |
| `money.authorize` | Authorize a previously created payment intent | CRITICAL | Budget envelope; policy bundle pin; trace ID; dual approval >$100 |
| `money.void` | Void an authorized but uncaptured payment intent | HIGH | Policy bundle pin; trace ID; finance-controller role only |
| `money.refund` | Issue a refund on a captured payment | HIGH | Policy bundle pin; trace ID; dual approval >$500 |
| `ledger.reconcile` | Reconcile ledger entries (read-write) | HIGH | Policy bundle pin; trace ID; finance-controller role only |
| `ledger.read` | Read ledger entries (read-only) | MEDIUM | Active trace ID |

### 2.6 Workflow Tools

| Tool ID | Description | Sensitivity | Base Preconditions |
|---------|-------------|-------------|-------------------|
| `workflow.dispatch` | Dispatch a new workflow execution | MEDIUM | Active trace ID; policy bundle pin |
| `workflow.cancel` | Cancel a running workflow | HIGH | Active trace ID; policy bundle pin; orchestrator or admin only |
| `workflow.status` | Query workflow execution status | LOW | Active trace ID |

### 2.7 Agent Tools

| Tool ID | Description | Sensitivity | Base Preconditions |
|---------|-------------|-------------|-------------------|
| `agent.spawn` | Spawn a new agent session | HIGH | Policy bundle pin; trace ID; role must be orchestrator or admin |
| `agent.message` | Send a message to another agent session | MEDIUM | Active trace ID; target agent in same tenant |
| `agent.terminate` | Terminate an agent session | HIGH | Policy bundle pin; trace ID; orchestrator or admin only |

### 2.8 Policy Tools

| Tool ID | Description | Sensitivity | Base Preconditions |
|---------|-------------|-------------|-------------------|
| `policy.evaluate` | Evaluate a policy rule against a context | LOW | Active trace ID |
| `policy.bundle.read` | Read a policy bundle by ID | LOW | Active trace ID |
| `policy.bundle.pin` | Pin a policy bundle to current execution context | HIGH | Active trace ID; policy-engine role only |

### 2.9 Artifact Tools

| Tool ID | Description | Sensitivity | Base Preconditions |
|---------|-------------|-------------|-------------------|
| `artifact.render` | Render an artifact (report, document, visualization) | LOW | Active trace ID |
| `artifact.export` | Export artifact to external format/destination | MEDIUM | Active trace ID; destination on allowlist |
| `artifact.verify` | Verify artifact integrity and provenance | LOW | Active trace ID |
| `artifact.ir.register` | Register artifact IR (intermediate representation) in the artifact store | MEDIUM | Active trace ID; policy bundle pin |

### 2.10 Compliance Tools

| Tool ID | Description | Sensitivity | Base Preconditions |
|---------|-------------|-------------|-------------------|
| `compliance.case.review` | Read and review a compliance case | LOW | Active trace ID; ops-auditor or admin role |
| `compliance.case.create` | Create a new compliance case | MEDIUM | Active trace ID; policy bundle pin |
| `compliance.outreach.check` | Check outreach compliance status for a counterparty | LOW | Active trace ID |

### 2.11 CivLab Tools

| Tool ID | Description | Sensitivity | Base Preconditions |
|---------|-------------|-------------|-------------------|
| `civlab.run` | Execute a CivLab scenario simulation | MEDIUM | Active trace ID; policy bundle pin; civlab-runner role |
| `civlab.replay` | Replay a previously recorded CivLab scenario | LOW | Active trace ID |
| `civlab.export` | Export CivLab scenario results | LOW | Active trace ID |
| `civlab.challenge.submit` | Submit a CivLab challenge response | MEDIUM | Active trace ID; policy bundle pin |

### 2.12 Admin Tools

| Tool ID | Description | Sensitivity | Base Preconditions |
|---------|-------------|-------------|-------------------|
| `admin.freeze` | Freeze a tenant or agent session | CRITICAL | Policy bundle pin; trace ID; admin role; dual approval |
| `admin.thaw` | Thaw a frozen tenant or agent session | CRITICAL | Policy bundle pin; trace ID; admin role; dual approval |
| `admin.role.grant` | Grant or modify role assignment | CRITICAL | Policy bundle pin; trace ID; admin role; audit log required |
| `admin.audit.export` | Export audit log for a tenant | HIGH | Policy bundle pin; trace ID; admin or ops-auditor role |

---

## 3. Per-Role Allowlist

Each entry is: `tool_id` with conditions beyond the base preconditions listed in section 2.

### 3.1 orchestrator

The orchestrator coordinates workflow execution, dispatches sub-agents, and manages execution lifecycle. It is the highest-privilege non-admin role.

**Allowed tools:**

| Tool ID | Additional Conditions |
|---------|----------------------|
| `workflow.dispatch` | Requires trace_id; policy bundle pin required; max 50 dispatches/session |
| `workflow.cancel` | Requires trace_id; policy bundle pin; only workflows spawned by this orchestrator |
| `workflow.status` | No additional conditions |
| `policy.evaluate` | No additional conditions |
| `policy.bundle.read` | No additional conditions |
| `event.publish` | NATS subject must match `VENTURE.{tenant}.workflow.>` or `VENTURE.{tenant}.orchestrator.>` |
| `event.query` | Scoped to current tenant; max 30-day lookback |
| `event.subscribe` | NATS subject must match orchestrator sub allowlist (see section 5) |
| `agent.spawn` | Requires policy bundle pin; max 10 concurrent spawned agents; spawned role must not be `admin` |
| `agent.message` | Target agent must be in same tenant and workflow |
| `agent.terminate` | Only agents spawned by this orchestrator session; requires policy bundle pin |
| `io.read` | Scoped to workflow workspace prefix: `/workspace/{workflow_id}/` |
| `io.list` | Scoped to workflow workspace prefix |
| `compliance.case.review` | Read-only; own workflow's cases only |

**Denied by default:** all money tools, `code.exec.*`, `admin.*`, `artifact.*` (except via sub-agent), `civlab.*`

---

### 3.2 researcher

The researcher fetches external information, reads internal data, and renders results. It has no write access to production data and no financial tools.

**Allowed tools:**

| Tool ID | Additional Conditions |
|---------|----------------------|
| `web.fetch` | Domain must match researcher domain allowlist (see section 11); max 20 req/min; no POST with body >64KB |
| `web.fetch.internal` | URL must match internal service registry |
| `io.read` | Scoped to workspace read prefix: `/workspace/{workflow_id}/inputs/` and `/artifacts/` |
| `io.write` | Scratch space only: `/workspace/{workflow_id}/scratch/researcher/`; max file size 50MB |
| `artifact.render` | No additional conditions |
| `artifact.verify` | No additional conditions |
| `event.publish` | NATS subject must match `VENTURE.{tenant}.researcher.results.>` only |
| `event.query` | Read-only; scoped to current tenant; max 7-day lookback |
| `compliance.outreach.check` | No additional conditions |
| `policy.evaluate` | No additional conditions |
| `io.list` | Scoped to workspace input and scratch prefixes |

**Denied by default:** all money tools, `code.exec.*`, `admin.*`, `agent.*`, `civlab.*`, `io.delete`, `workflow.dispatch`, `workflow.cancel`, `ledger.*`

---

### 3.3 solver

The solver executes computation, code, and transformation tasks. It has sandboxed code execution rights and workspace write access, but no financial or agent lifecycle tools.

**Allowed tools:**

| Tool ID | Additional Conditions |
|---------|----------------------|
| `code.exec.restricted` | Policy bundle pin required; no network access from within restricted execution; CPU time limit 30s; memory limit 256MB |
| `code.exec.sandbox` | Requires explicit dynamic grant from orchestrator (see section 7); policy bundle pin; seccomp profile pinned; CPU limit 120s; memory limit 512MB; no network |
| `io.read` | Scoped to workspace: `/workspace/{workflow_id}/` |
| `io.write` | Scoped to workspace outputs: `/workspace/{workflow_id}/outputs/solver/`; max file size 200MB |
| `io.list` | Scoped to workspace prefix |
| `event.publish` | NATS subject must match `VENTURE.{tenant}.solver.results.>` only |
| `artifact.render` | No additional conditions |
| `policy.evaluate` | No additional conditions |

**Denied by default:** all money tools, `admin.*`, `agent.*`, `civlab.*`, `io.delete`, `workflow.*`, `web.fetch`, `web.fetch.internal` (solver is network-isolated by design), `ledger.*`, `compliance.*`

**Note on `code.exec.sandbox`:** This tool is denied unless an explicit dynamic elevation grant is active in the current policy bundle (see section 7). The solver role NEVER has `code.exec.sandbox` in its static allowlist entry — it requires a runtime grant.

---

### 3.4 finance-controller

The finance-controller manages all financial operations. It has the broadest money tool access but is strictly limited to financial and ledger namespaces, with no code execution or external web access.

**Allowed tools:**

| Tool ID | Additional Conditions |
|---------|----------------------|
| `money.intent.create` | Budget envelope pre-flight check required; policy bundle pin; trace ID; dual approval required if amount >$100; rate limited: max 10 intents/hour |
| `money.authorize` | Budget envelope required; policy bundle pin; trace ID; dual approval required if amount >$100; intent must be in PENDING state |
| `money.void` | Policy bundle pin; trace ID; intent must be in AUTHORIZED state; max void $50,000/session |
| `money.refund` | Policy bundle pin; trace ID; dual approval if amount >$500; captured payment must exist; max 48h since capture |
| `ledger.reconcile` | Policy bundle pin; trace ID; reconciliation window max 30 days; idempotency key required |
| `ledger.read` | No additional conditions beyond base |
| `event.publish` | NATS subject must match `VENTURE.{tenant}.finance.>` or `VENTURE.{tenant}.money.>` |
| `event.query` | Scoped to financial events; max 90-day lookback |
| `compliance.case.review` | Finance-related cases only |
| `compliance.outreach.check` | No additional conditions |
| `io.read` | Scoped to financial workspace: `/workspace/{workflow_id}/finance/` |
| `io.write` | Scoped to financial outputs: `/workspace/{workflow_id}/finance/outputs/`; max 50MB |
| `io.list` | Scoped to financial workspace |
| `policy.evaluate` | No additional conditions |
| `workflow.status` | Finance workflows only |

**Denied by default:** `admin.*`, `agent.*`, `civlab.*`, `code.exec.*`, `web.fetch`, `web.fetch.internal`, `io.delete`, `workflow.dispatch`, `workflow.cancel`, `artifact.*`, `compliance.case.create`

---

### 3.5 ops-auditor

The ops-auditor is **read-only** across all namespaces. It can create compliance cases, view all events, and export audit data, but cannot modify any state or execute financial operations.

**Allowed tools:**

| Tool ID | Additional Conditions |
|---------|----------------------|
| `io.read` | Unrestricted read within tenant boundary |
| `io.list` | Unrestricted list within tenant boundary |
| `event.query` | Full tenant scope; max 365-day lookback |
| `event.subscribe` | Read-only subscription; NATS subject must match ops-auditor sub allowlist (see section 5) |
| `compliance.case.review` | All cases within tenant |
| `compliance.case.create` | Policy bundle pin required; trace ID; reason field mandatory |
| `compliance.outreach.check` | No additional conditions |
| `ledger.read` | Tenant-scoped; no write access |
| `admin.audit.export` | Policy bundle pin; trace ID; max 90-day export window per request |
| `policy.evaluate` | No additional conditions |
| `policy.bundle.read` | No additional conditions |
| `workflow.status` | All workflows in tenant |
| `artifact.verify` | No additional conditions |

**Denied by default:** all money write tools (`money.intent.create`, `money.authorize`, `money.void`, `money.refund`, `ledger.reconcile`), `admin.freeze`, `admin.thaw`, `admin.role.grant`, `code.exec.*`, `web.fetch`, `web.fetch.internal`, `agent.*`, `civlab.*`, `io.write`, `io.delete`, `event.publish`, `workflow.dispatch`, `workflow.cancel`, `artifact.render`, `artifact.export`, `artifact.ir.register`

---

### 3.6 artifact-compiler

The artifact-compiler assembles, renders, and exports artifacts. It can fetch external assets and register artifact IR, but has no financial or agent lifecycle access.

**Allowed tools:**

| Tool ID | Additional Conditions |
|---------|----------------------|
| `artifact.render` | No additional conditions |
| `artifact.export` | Destination must be on artifact export allowlist (CDN, designated output buckets); policy bundle pin |
| `artifact.verify` | No additional conditions |
| `artifact.ir.register` | Policy bundle pin; trace ID; IR schema version must match current registry version |
| `web.fetch` | Domain must match artifact-compiler domain allowlist (see section 11); GET only; max 50MB response; no auth headers forwarded |
| `web.fetch.internal` | Internal asset endpoints only |
| `io.read` | Scoped to artifact workspace: `/workspace/{workflow_id}/artifacts/` and `/workspace/{workflow_id}/inputs/` |
| `io.write` | Scoped to artifact outputs: `/workspace/{workflow_id}/artifacts/outputs/`; max 500MB |
| `io.list` | Scoped to artifact workspace |
| `event.publish` | NATS subject must match `VENTURE.{tenant}.artifacts.>` only |
| `policy.evaluate` | No additional conditions |

**Denied by default:** all money tools, `admin.*`, `agent.*`, `civlab.*`, `code.exec.*`, `io.delete`, `workflow.*`, `compliance.*`, `ledger.*`, `event.query`, `event.subscribe`

---

### 3.7 policy-engine

The policy-engine evaluates governance rules, pins policy bundles, and publishes compliance events. It has no financial, code execution, or external web access.

**Allowed tools:**

| Tool ID | Additional Conditions |
|---------|----------------------|
| `policy.evaluate` | No additional conditions |
| `policy.bundle.read` | No additional conditions |
| `policy.bundle.pin` | Trace ID required; bundle must be signed and within validity window; emits `policy.bundle.pinned.v1` |
| `event.publish` | NATS subject must match `VENTURE.{tenant}.policy.>` or `VENTURE.{tenant}.compliance.>` |
| `event.query` | Scoped to policy and compliance events; max 30-day lookback |
| `io.read` | Scoped to policy workspace: `/workspace/{workflow_id}/policy/` and `/policy-bundles/` |
| `compliance.case.create` | Policy bundle pin required; trace ID; used for automated compliance flagging |
| `compliance.case.review` | All cases within tenant |

**Denied by default:** all money tools, `admin.*`, `agent.*`, `civlab.*`, `code.exec.*`, `web.fetch`, `web.fetch.internal`, `io.write`, `io.delete`, `io.list`, `workflow.*`, `artifact.*`, `ledger.*`

---

### 3.8 civlab-runner

The civlab-runner executes CivLab scenario simulations and challenge submissions. It is isolated to CivLab namespaces with read access to scenario configs and publish rights for results.

**Allowed tools:**

| Tool ID | Additional Conditions |
|---------|----------------------|
| `civlab.run` | Policy bundle pin; trace ID; scenario config must be registered in CivLab registry; CPU limit 300s; memory limit 1GB |
| `civlab.replay` | Trace ID; replay source must exist in CivLab result store |
| `civlab.export` | Results only from current session or pinned prior sessions |
| `civlab.challenge.submit` | Policy bundle pin; trace ID; challenge must be in OPEN state; one submission per challenge per session |
| `io.read` | Scoped to CivLab inputs: `/civlab/scenarios/` and `/workspace/{workflow_id}/civlab/` |
| `event.publish` | NATS subject must match `VENTURE.{tenant}.civlab.>` only |
| `policy.evaluate` | No additional conditions |

**Denied by default:** all money tools, `admin.*`, `agent.*`, `code.exec.*`, `web.fetch`, `web.fetch.internal`, `io.write`, `io.delete`, `io.list` (outside CivLab prefix), `workflow.*`, `artifact.*`, `compliance.*`, `ledger.*`, `event.query`, `event.subscribe`

---

## 4. Master Allowlist Matrix Table

**Legend:**
- `YES` — Allowed, no conditions beyond base preconditions
- `COND` — Conditional (see footnotes below the table)
- `NO` — Denied (default-deny applies)

| Tool ID | orchestrator | researcher | solver | finance-controller | ops-auditor | artifact-compiler | policy-engine | civlab-runner |
|---------|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **IO Tools** | | | | | | | | |
| `io.read` | COND-A | COND-B | COND-C | COND-D | YES | COND-E | COND-F | COND-G |
| `io.write` | NO | COND-H | COND-I | COND-J | NO | COND-K | NO | NO |
| `io.delete` | NO | NO | NO | NO | NO | NO | NO | NO |
| `io.list` | COND-L | COND-M | COND-N | COND-O | YES | COND-P | NO | NO |
| **Web Tools** | | | | | | | | |
| `web.fetch` | NO | COND-Q | NO | NO | NO | COND-R | NO | NO |
| `web.fetch.internal` | NO | YES | NO | NO | NO | COND-S | NO | NO |
| **Code Execution** | | | | | | | | |
| `code.exec.restricted` | NO | NO | YES | NO | NO | NO | NO | NO |
| `code.exec.sandbox` | NO | NO | COND-T | NO | NO | NO | NO | NO |
| **Event Tools** | | | | | | | | |
| `event.publish` | COND-U | COND-V | COND-W | COND-X | NO | COND-Y | COND-Z | COND-AA |
| `event.query` | COND-AB | COND-AC | NO | COND-AD | YES | NO | COND-AE | NO |
| `event.subscribe` | COND-AF | NO | NO | NO | COND-AG | NO | NO | NO |
| **Money Tools** | | | | | | | | |
| `money.intent.create` | NO | NO | NO | COND-AH | NO | NO | NO | NO |
| `money.authorize` | NO | NO | NO | COND-AI | NO | NO | NO | NO |
| `money.void` | NO | NO | NO | COND-AJ | NO | NO | NO | NO |
| `money.refund` | NO | NO | NO | COND-AK | NO | NO | NO | NO |
| `ledger.reconcile` | NO | NO | NO | COND-AL | NO | NO | NO | NO |
| `ledger.read` | NO | NO | NO | YES | YES | NO | NO | NO |
| **Workflow Tools** | | | | | | | | |
| `workflow.dispatch` | COND-AM | NO | NO | NO | NO | NO | NO | NO |
| `workflow.cancel` | COND-AN | NO | NO | NO | NO | NO | NO | NO |
| `workflow.status` | YES | NO | NO | COND-AO | YES | NO | NO | NO |
| **Agent Tools** | | | | | | | | |
| `agent.spawn` | COND-AP | NO | NO | NO | NO | NO | NO | NO |
| `agent.message` | COND-AQ | NO | NO | NO | NO | NO | NO | NO |
| `agent.terminate` | COND-AR | NO | NO | NO | NO | NO | NO | NO |
| **Policy Tools** | | | | | | | | |
| `policy.evaluate` | YES | YES | YES | YES | YES | YES | YES | YES |
| `policy.bundle.read` | YES | NO | NO | NO | YES | NO | YES | NO |
| `policy.bundle.pin` | NO | NO | NO | NO | NO | NO | YES | NO |
| **Artifact Tools** | | | | | | | | |
| `artifact.render` | NO | YES | YES | NO | NO | YES | NO | NO |
| `artifact.export` | NO | NO | NO | NO | NO | COND-AS | NO | NO |
| `artifact.verify` | NO | YES | NO | NO | YES | YES | NO | NO |
| `artifact.ir.register` | NO | NO | NO | NO | NO | COND-AT | NO | NO |
| **Compliance Tools** | | | | | | | | |
| `compliance.case.review` | COND-AU | NO | NO | COND-AV | YES | NO | YES | NO |
| `compliance.case.create` | NO | NO | NO | NO | COND-AW | NO | COND-AX | NO |
| `compliance.outreach.check` | NO | YES | NO | YES | YES | NO | NO | NO |
| **CivLab Tools** | | | | | | | | |
| `civlab.run` | NO | NO | NO | NO | NO | NO | NO | COND-AY |
| `civlab.replay` | NO | NO | NO | NO | NO | NO | NO | YES |
| `civlab.export` | NO | NO | NO | NO | NO | NO | NO | YES |
| `civlab.challenge.submit` | NO | NO | NO | NO | NO | NO | NO | COND-AZ |
| **Admin Tools** | | | | | | | | |
| `admin.freeze` | NO | NO | NO | NO | NO | NO | NO | NO |
| `admin.thaw` | NO | NO | NO | NO | NO | NO | NO | NO |
| `admin.role.grant` | NO | NO | NO | NO | NO | NO | NO | NO |
| `admin.audit.export` | NO | NO | NO | NO | COND-BA | NO | NO | NO |

### Matrix Condition Reference

| Code | Role | Tool | Condition |
|------|------|------|-----------|
| COND-A | orchestrator | io.read | Scoped to `/workspace/{workflow_id}/` |
| COND-B | researcher | io.read | Scoped to `/workspace/{workflow_id}/inputs/` and `/artifacts/` |
| COND-C | solver | io.read | Scoped to `/workspace/{workflow_id}/` |
| COND-D | finance-controller | io.read | Scoped to `/workspace/{workflow_id}/finance/` |
| COND-E | artifact-compiler | io.read | Scoped to `/workspace/{workflow_id}/artifacts/` and `/workspace/{workflow_id}/inputs/` |
| COND-F | policy-engine | io.read | Scoped to `/workspace/{workflow_id}/policy/` and `/policy-bundles/` |
| COND-G | civlab-runner | io.read | Scoped to `/civlab/scenarios/` and `/workspace/{workflow_id}/civlab/` |
| COND-H | researcher | io.write | Scratch space only: `/workspace/{workflow_id}/scratch/researcher/`; max 50MB |
| COND-I | solver | io.write | Scoped to `/workspace/{workflow_id}/outputs/solver/`; max 200MB |
| COND-J | finance-controller | io.write | Scoped to `/workspace/{workflow_id}/finance/outputs/`; max 50MB |
| COND-K | artifact-compiler | io.write | Scoped to `/workspace/{workflow_id}/artifacts/outputs/`; max 500MB |
| COND-L | orchestrator | io.list | Scoped to workflow workspace prefix |
| COND-M | researcher | io.list | Scoped to input and scratch prefixes |
| COND-N | solver | io.list | Scoped to workspace prefix |
| COND-O | finance-controller | io.list | Scoped to financial workspace |
| COND-P | artifact-compiler | io.list | Scoped to artifact workspace |
| COND-Q | researcher | web.fetch | Domain allowlist enforced; max 20 req/min; no POST body >64KB |
| COND-R | artifact-compiler | web.fetch | Artifact domain allowlist; GET only; max 50MB response; no auth headers forwarded |
| COND-S | artifact-compiler | web.fetch.internal | Internal asset endpoints only per service registry |
| COND-T | solver | code.exec.sandbox | Requires explicit dynamic elevation grant from orchestrator; policy bundle pin; seccomp profile pinned; no network; CPU 120s; mem 512MB |
| COND-U | orchestrator | event.publish | NATS subject `VENTURE.{tenant}.workflow.>` or `VENTURE.{tenant}.orchestrator.>` |
| COND-V | researcher | event.publish | NATS subject `VENTURE.{tenant}.researcher.results.>` only |
| COND-W | solver | event.publish | NATS subject `VENTURE.{tenant}.solver.results.>` only |
| COND-X | finance-controller | event.publish | NATS subject `VENTURE.{tenant}.finance.>` or `VENTURE.{tenant}.money.>` |
| COND-Y | artifact-compiler | event.publish | NATS subject `VENTURE.{tenant}.artifacts.>` only |
| COND-Z | policy-engine | event.publish | NATS subject `VENTURE.{tenant}.policy.>` or `VENTURE.{tenant}.compliance.>` |
| COND-AA | civlab-runner | event.publish | NATS subject `VENTURE.{tenant}.civlab.>` only |
| COND-AB | orchestrator | event.query | Scoped to current tenant; max 30-day lookback |
| COND-AC | researcher | event.query | Scoped to current tenant; max 7-day lookback |
| COND-AD | finance-controller | event.query | Financial events only; max 90-day lookback |
| COND-AE | policy-engine | event.query | Policy and compliance events only; max 30-day lookback |
| COND-AF | orchestrator | event.subscribe | Per orchestrator sub allowlist in section 5 |
| COND-AG | ops-auditor | event.subscribe | Read-only; per ops-auditor sub allowlist in section 5 |
| COND-AH | finance-controller | money.intent.create | Budget envelope; policy bundle pin; trace ID; dual approval >$100; max 10/hour |
| COND-AI | finance-controller | money.authorize | Budget envelope; policy bundle pin; trace ID; dual approval >$100; intent must be PENDING |
| COND-AJ | finance-controller | money.void | Policy bundle pin; trace ID; intent must be AUTHORIZED; max $50k/session |
| COND-AK | finance-controller | money.refund | Policy bundle pin; trace ID; dual approval >$500; captured payment must exist; max 48h since capture |
| COND-AL | finance-controller | ledger.reconcile | Policy bundle pin; trace ID; idempotency key required; max 30-day window |
| COND-AM | orchestrator | workflow.dispatch | Trace ID; policy bundle pin; max 50/session |
| COND-AN | orchestrator | workflow.cancel | Trace ID; policy bundle pin; only own-spawned workflows |
| COND-AO | finance-controller | workflow.status | Finance workflows only |
| COND-AP | orchestrator | agent.spawn | Policy bundle pin; max 10 concurrent; spawned role must not be `admin` |
| COND-AQ | orchestrator | agent.message | Target must be same tenant and workflow |
| COND-AR | orchestrator | agent.terminate | Own-spawned agents only; policy bundle pin |
| COND-AS | artifact-compiler | artifact.export | Destination on artifact export allowlist; policy bundle pin |
| COND-AT | artifact-compiler | artifact.ir.register | Policy bundle pin; trace ID; IR schema version must match registry |
| COND-AU | orchestrator | compliance.case.review | Own workflow's cases only |
| COND-AV | finance-controller | compliance.case.review | Finance-related cases only |
| COND-AW | ops-auditor | compliance.case.create | Policy bundle pin; trace ID; reason mandatory |
| COND-AX | policy-engine | compliance.case.create | Policy bundle pin; trace ID; automated compliance flagging only |
| COND-AY | civlab-runner | civlab.run | Policy bundle pin; trace ID; registered scenario; CPU 300s; mem 1GB |
| COND-AZ | civlab-runner | civlab.challenge.submit | Policy bundle pin; trace ID; challenge in OPEN state; one per challenge/session |
| COND-BA | ops-auditor | admin.audit.export | Policy bundle pin; trace ID; max 90-day export window |

---

## 5. NATS Subject Access Control

### 5.1 Subject Pattern Conventions

All Venture NATS subjects follow the pattern:

```
VENTURE.{tenant}.{domain}.{subdomain}.{qualifier}
```

Where `{tenant}` is the tenant ID slug, and wildcards follow NATS conventions:
- `*` matches a single token
- `>` matches one or more tokens at the end of a subject

### 5.2 Per-Role NATS Publish / Subscribe Permissions

| Role | Subject Pattern | Pub | Sub | Notes |
|------|----------------|:---:|:---:|-------|
| orchestrator | `VENTURE.{tenant}.workflow.>` | YES | YES | Primary workflow subjects |
| orchestrator | `VENTURE.{tenant}.orchestrator.>` | YES | YES | Orchestrator private subjects |
| orchestrator | `VENTURE.{tenant}.agent.lifecycle.>` | YES | YES | Agent lifecycle events |
| orchestrator | `VENTURE.{tenant}.*.results.>` | NO | YES | Listen to all result streams |
| orchestrator | `VENTURE.{tenant}.policy.>` | NO | YES | Policy events (listen-only) |
| orchestrator | `VENTURE.{tenant}.money.>` | NO | NO | Finance namespace isolated |
| researcher | `VENTURE.{tenant}.researcher.results.>` | YES | NO | Publish results only |
| researcher | `VENTURE.{tenant}.researcher.>` | YES | YES | Researcher namespace |
| researcher | `VENTURE.{tenant}.workflow.status.>` | NO | YES | Listen for workflow status |
| researcher | `VENTURE.{tenant}.money.>` | NO | NO | Finance namespace isolated |
| solver | `VENTURE.{tenant}.solver.results.>` | YES | NO | Publish results only |
| solver | `VENTURE.{tenant}.solver.>` | YES | YES | Solver namespace |
| solver | `VENTURE.{tenant}.workflow.tasks.>` | NO | YES | Listen for assigned tasks |
| solver | `VENTURE.{tenant}.money.>` | NO | NO | Finance namespace isolated |
| finance-controller | `VENTURE.{tenant}.money.>` | YES | YES | Full money namespace |
| finance-controller | `VENTURE.{tenant}.finance.>` | YES | YES | Finance namespace |
| finance-controller | `VENTURE.{tenant}.ledger.>` | YES | YES | Ledger namespace |
| finance-controller | `VENTURE.{tenant}.workflow.>` | NO | YES | Listen-only for workflow |
| finance-controller | `VENTURE.{tenant}.compliance.finance.>` | YES | YES | Finance compliance events |
| ops-auditor | `VENTURE.{tenant}.>` | NO | YES | Full tenant subscribe (read-only) |
| ops-auditor | `VENTURE.{tenant}.compliance.>` | YES | YES | Compliance namespace (can publish cases) |
| ops-auditor | `VENTURE.{tenant}.audit.>` | YES | YES | Audit export subjects |
| artifact-compiler | `VENTURE.{tenant}.artifacts.>` | YES | YES | Artifacts namespace |
| artifact-compiler | `VENTURE.{tenant}.workflow.tasks.>` | NO | YES | Listen for assigned tasks |
| artifact-compiler | `VENTURE.{tenant}.money.>` | NO | NO | Finance namespace isolated |
| policy-engine | `VENTURE.{tenant}.policy.>` | YES | YES | Policy namespace |
| policy-engine | `VENTURE.{tenant}.compliance.>` | YES | YES | Compliance events |
| policy-engine | `VENTURE.{tenant}.*.>` | NO | YES | Full read for policy evaluation |
| policy-engine | `VENTURE.{tenant}.money.>` | NO | NO | Finance namespace isolated |
| civlab-runner | `VENTURE.{tenant}.civlab.>` | YES | YES | CivLab namespace |
| civlab-runner | `VENTURE.{tenant}.workflow.tasks.>` | NO | YES | Listen for assigned tasks |
| civlab-runner | `VENTURE.{tenant}.money.>` | NO | NO | Finance namespace isolated |

### 5.3 Always-Blocked NATS Subjects

No role (including admin) may publish to these subjects via agent code. Only the Control Plane infrastructure may write to these:

```
VENTURE.{tenant}.system.>         # System control plane internal
VENTURE.{tenant}.billing.raw.>    # Raw billing pipeline
_INBOX.>                          # NATS internal inbox
$SYS.>                            # NATS system subjects
```

---

## 6. Conditional Tool Grant System

### 6.1 Condition Types

The following condition types can be attached to any `ToolGrant` entry. All conditions are evaluated with AND semantics.

| Condition Key | Type | Description |
|---------------|------|-------------|
| `requires_policy_bundle_pin` | bool | Tool call must include a valid, active, signed policy bundle ID |
| `requires_budget_envelope` | dict | Pre-flight budget check must pass; envelope specifies currency, max amount, and time window |
| `requires_trace_id` | bool | An active distributed trace ID must be present in the call context |
| `requires_dual_approval` | dict | For amounts above threshold, a second agent of specified role must co-sign |
| `requires_domain_allowlist` | str | `web.fetch` only: called URL domain must match a named allowlist |
| `scope_restricted` | str | `io.*` only: path must have specified prefix |
| `rate_limited` | dict | Max N calls per time window per agent session |
| `max_concurrent` | int | Maximum simultaneous active calls of this tool per session |
| `requires_dynamic_grant` | bool | Tool is not in static allowlist; requires runtime elevation grant |
| `requires_idempotency_key` | bool | Call must include a client-supplied idempotency key |
| `nats_subject_restricted` | str | `event.publish` only: subject must match specified pattern |
| `cpu_limit_seconds` | int | Code exec only: wall-clock CPU time limit |
| `memory_limit_mb` | int | Code exec only: memory ceiling in megabytes |
| `file_size_limit_mb` | int | IO write only: maximum single file size in megabytes |

### 6.2 Python Dataclass Implementation

```python
from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any, Optional
from enum import Enum


class ConditionType(str, Enum):
    REQUIRES_POLICY_BUNDLE_PIN = "requires_policy_bundle_pin"
    REQUIRES_BUDGET_ENVELOPE   = "requires_budget_envelope"
    REQUIRES_TRACE_ID          = "requires_trace_id"
    REQUIRES_DUAL_APPROVAL     = "requires_dual_approval"
    REQUIRES_DOMAIN_ALLOWLIST  = "requires_domain_allowlist"
    SCOPE_RESTRICTED           = "scope_restricted"
    RATE_LIMITED               = "rate_limited"
    MAX_CONCURRENT             = "max_concurrent"
    REQUIRES_DYNAMIC_GRANT     = "requires_dynamic_grant"
    REQUIRES_IDEMPOTENCY_KEY   = "requires_idempotency_key"
    NATS_SUBJECT_RESTRICTED    = "nats_subject_restricted"
    CPU_LIMIT_SECONDS          = "cpu_limit_seconds"
    MEMORY_LIMIT_MB            = "memory_limit_mb"
    FILE_SIZE_LIMIT_MB         = "file_size_limit_mb"


@dataclass(frozen=True)
class Condition:
    condition_type: ConditionType
    params: dict[str, Any] = field(default_factory=dict)

    def describe(self) -> str:
        return f"{self.condition_type.value}({self.params})"


@dataclass(frozen=True)
class ToolGrant:
    tool_id: str
    role: str
    conditions: list[Condition] = field(default_factory=list)
    notes: str = ""

    def has_condition(self, condition_type: ConditionType) -> bool:
        return any(c.condition_type == condition_type for c in self.conditions)

    def get_condition(self, condition_type: ConditionType) -> Optional[Condition]:
        for c in self.conditions:
            if c.condition_type == condition_type:
                return c
        return None


@dataclass
class AllowlistResult:
    allowed: bool
    reason: str
    tool_id: str
    role: str
    conditions_passed: list[str] = field(default_factory=list)
    conditions_failed: list[str] = field(default_factory=list)
    grant: Optional[ToolGrant] = None


# Example grant definitions for orchestrator
ORCHESTRATOR_GRANTS: list[ToolGrant] = [
    ToolGrant(
        tool_id="workflow.dispatch",
        role="orchestrator",
        conditions=[
            Condition(ConditionType.REQUIRES_TRACE_ID, {}),
            Condition(ConditionType.REQUIRES_POLICY_BUNDLE_PIN, {}),
            Condition(ConditionType.RATE_LIMITED, {"max_calls": 50, "window": "session"}),
        ],
    ),
    ToolGrant(
        tool_id="agent.spawn",
        role="orchestrator",
        conditions=[
            Condition(ConditionType.REQUIRES_POLICY_BUNDLE_PIN, {}),
            Condition(ConditionType.MAX_CONCURRENT, {"max": 10}),
        ],
        notes="Spawned role must not be admin -- enforced by ToolAllowlistChecker",
    ),
    ToolGrant(
        tool_id="io.read",
        role="orchestrator",
        conditions=[
            Condition(ConditionType.SCOPE_RESTRICTED, {"prefix": "/workspace/{workflow_id}/"}),
        ],
    ),
]

# Example grant definitions for finance-controller
FINANCE_CONTROLLER_GRANTS: list[ToolGrant] = [
    ToolGrant(
        tool_id="money.intent.create",
        role="finance-controller",
        conditions=[
            Condition(ConditionType.REQUIRES_TRACE_ID, {}),
            Condition(ConditionType.REQUIRES_POLICY_BUNDLE_PIN, {}),
            Condition(ConditionType.REQUIRES_BUDGET_ENVELOPE, {"currency": "USD"}),
            Condition(ConditionType.REQUIRES_DUAL_APPROVAL, {"threshold_usd": 100, "approver_role": "orchestrator"}),
            Condition(ConditionType.RATE_LIMITED, {"max_calls": 10, "window": "hour"}),
        ],
    ),
    ToolGrant(
        tool_id="money.refund",
        role="finance-controller",
        conditions=[
            Condition(ConditionType.REQUIRES_TRACE_ID, {}),
            Condition(ConditionType.REQUIRES_POLICY_BUNDLE_PIN, {}),
            Condition(ConditionType.REQUIRES_DUAL_APPROVAL, {"threshold_usd": 500, "approver_role": "orchestrator"}),
        ],
    ),
    ToolGrant(
        tool_id="ledger.reconcile",
        role="finance-controller",
        conditions=[
            Condition(ConditionType.REQUIRES_TRACE_ID, {}),
            Condition(ConditionType.REQUIRES_POLICY_BUNDLE_PIN, {}),
            Condition(ConditionType.REQUIRES_IDEMPOTENCY_KEY, {}),
        ],
    ),
]
```

### 6.3 Condition Evaluation Order

Conditions are evaluated in fast-fail order (cheapest checks first):

1. `requires_trace_id` — header check, O(1)
2. `scope_restricted` — path prefix check, O(1)
3. `nats_subject_restricted` — regex match, O(n) on subject length
4. `rate_limited` — counter lookup in Redis, O(1)
5. `max_concurrent` — gauge check in Redis, O(1)
6. `requires_policy_bundle_pin` — bundle lookup + signature verify, O(1) cache hit
7. `requires_dynamic_grant` — elevation grant check in policy bundle, O(n) on grant count
8. `requires_budget_envelope` — async budget check via finance service, ~5ms p99
9. `requires_dual_approval` — async approval lookup, ~10ms p99

Any failing condition short-circuits evaluation. The `conditions_failed` list in `AllowlistResult` contains only the first failing condition in fast-fail mode, or all failing conditions in full-evaluation mode (used for audit reports).

---

## 7. Dynamic Role Elevation

### 7.1 Overview

Dynamic elevation allows the orchestrator to temporarily grant a role access to a tool that is NOT in its static allowlist. Elevation is narrowly scoped, time-bounded, and fully audited.

**Elevation is only permitted for these tool/role combinations:**

| Tool ID | Eligible Recipient Roles | Max TTL |
|---------|-------------------------|---------|
| `code.exec.sandbox` | solver | 1 hour |
| `io.delete` | solver, artifact-compiler | 30 minutes |
| `web.fetch` | solver | 30 minutes |
| `agent.spawn` | policy-engine | 1 hour |
| `workflow.dispatch` | policy-engine | 1 hour |

No tool may be elevated to the `finance-controller` role from outside. No admin tools may be elevated to any non-admin role under any circumstances.

### 7.2 Elevation Event Schema

```json
{
  "event_type": "agent.role.elevated.v1",
  "spec_version": "1.0",
  "schema": {
    "type": "object",
    "required": [
      "event_id", "occurred_at", "agent_id", "tenant_id",
      "role", "granted_tool", "granted_by", "expires_at",
      "reason", "policy_bundle_id", "trace_id", "ttl_seconds"
    ],
    "properties": {
      "event_id":          { "type": "string", "format": "uuid" },
      "occurred_at":       { "type": "string", "format": "date-time" },
      "agent_id":          { "type": "string" },
      "tenant_id":         { "type": "string" },
      "role": {
        "type": "string",
        "enum": ["solver", "artifact-compiler", "policy-engine"]
      },
      "granted_tool":      { "type": "string" },
      "granted_by":        { "type": "string", "description": "orchestrator agent_id" },
      "expires_at":        { "type": "string", "format": "date-time" },
      "reason":            { "type": "string", "minLength": 10 },
      "policy_bundle_id":  { "type": "string", "format": "uuid" },
      "trace_id":          { "type": "string" },
      "ttl_seconds": {
        "type": "integer",
        "minimum": 60,
        "maximum": 3600
      }
    }
  }
}
```

### 7.3 Elevation Constraints

1. Only the `orchestrator` role may initiate a dynamic elevation.
2. Max TTL is 1 hour for all elevations. Elevation expires automatically with no renewal path.
3. The elevation grant is embedded in the policy bundle for the current workflow execution.
4. Elevation is logged with `agent.role.elevated.v1` immediately on grant.
5. No more than 3 concurrent elevations may be active per workflow execution.
6. After TTL expiry, the tool call is denied with `ELEVATION_EXPIRED` reason.
7. Admin intervention is required to make any elevation permanent.

---

## 8. Enforcement Implementation

### 8.1 ToolAllowlistChecker Class

```python
from __future__ import annotations

import time
from dataclasses import dataclass, field
from typing import Any, Optional

import structlog

from venture.allowlist.grants import ROLE_GRANTS, ToolGrant, AllowlistResult, ConditionType
from venture.allowlist.conditions import ConditionEvaluator
from venture.events import EventPublisher, build_tool_checked_event

logger = structlog.get_logger(__name__)


@dataclass
class ToolCallContext:
    agent_id: str
    tenant_id: str
    role: str
    tool_id: str
    trace_id: Optional[str]
    policy_bundle_id: Optional[str]
    call_params: dict[str, Any] = field(default_factory=dict)
    session_id: Optional[str] = None
    workflow_id: Optional[str] = None


class ToolAllowlistChecker:
    """
    Central enforcement point for tool allowlist checks.
    Called by the Control Plane before dispatching any tool call.

    Fast path: in-memory dict lookup, O(1) per check.
    Audit: every check emits agent.tool.checked.v1 regardless of outcome.
    Fail fast: no fallbacks, no silent errors. Denial is a hard stop.
    """

    def __init__(
        self,
        grants: dict[str, dict[str, ToolGrant]],
        condition_evaluator: ConditionEvaluator,
        event_publisher: EventPublisher,
    ) -> None:
        # grants: {role: {tool_id: ToolGrant}}
        self._grants = grants
        self._evaluator = condition_evaluator
        self._publisher = event_publisher

    @classmethod
    def from_static_allowlist(
        cls,
        condition_evaluator: ConditionEvaluator,
        event_publisher: EventPublisher,
    ) -> "ToolAllowlistChecker":
        grants: dict[str, dict[str, ToolGrant]] = {}
        for grant in ROLE_GRANTS:
            grants.setdefault(grant.role, {})[grant.tool_id] = grant
        return cls(grants, condition_evaluator, event_publisher)

    def check(self, ctx: ToolCallContext) -> AllowlistResult:
        start_ns = time.monotonic_ns()
        result = self._check_internal(ctx)
        duration_ms = (time.monotonic_ns() - start_ns) / 1_000_000
        self._emit_checked_event(ctx, result, duration_ms)
        if not result.allowed:
            logger.warning(
                "tool_call_denied",
                role=ctx.role,
                tool_id=ctx.tool_id,
                agent_id=ctx.agent_id,
                reason=result.reason,
                conditions_failed=result.conditions_failed,
            )
        return result

    def _check_internal(self, ctx: ToolCallContext) -> AllowlistResult:
        role_grants = self._grants.get(ctx.role)
        if role_grants is None:
            return AllowlistResult(
                allowed=False,
                reason=f"UNKNOWN_ROLE: {ctx.role!r} has no allowlist entry",
                tool_id=ctx.tool_id,
                role=ctx.role,
            )

        grant = role_grants.get(ctx.tool_id)
        if grant is None:
            # Check for dynamic elevation grant in policy bundle (never fall back silently)
            grant = self._evaluator.get_dynamic_grant(ctx)
            if grant is None:
                return AllowlistResult(
                    allowed=False,
                    reason=f"TOOL_NOT_IN_ALLOWLIST: role={ctx.role!r} tool={ctx.tool_id!r}",
                    tool_id=ctx.tool_id,
                    role=ctx.role,
                )

        conditions_passed: list[str] = []
        conditions_failed: list[str] = []

        for condition in grant.conditions:
            passed, fail_reason = self._evaluator.evaluate(condition, ctx)
            if passed:
                conditions_passed.append(condition.describe())
            else:
                conditions_failed.append(f"{condition.describe()}: {fail_reason}")

        if conditions_failed:
            return AllowlistResult(
                allowed=False,
                reason=f"CONDITION_FAILED: {conditions_failed[0]}",
                tool_id=ctx.tool_id,
                role=ctx.role,
                conditions_passed=conditions_passed,
                conditions_failed=conditions_failed,
                grant=grant,
            )

        return AllowlistResult(
            allowed=True,
            reason="ALLOWED",
            tool_id=ctx.tool_id,
            role=ctx.role,
            conditions_passed=conditions_passed,
            conditions_failed=[],
            grant=grant,
        )

    def _emit_checked_event(
        self,
        ctx: ToolCallContext,
        result: AllowlistResult,
        duration_ms: float,
    ) -> None:
        event = build_tool_checked_event(
            agent_id=ctx.agent_id,
            tenant_id=ctx.tenant_id,
            role=ctx.role,
            tool_id=ctx.tool_id,
            allowed=result.allowed,
            reason=result.reason,
            conditions_passed=result.conditions_passed,
            conditions_failed=result.conditions_failed,
            trace_id=ctx.trace_id,
            policy_bundle_id=ctx.policy_bundle_id,
            duration_ms=duration_ms,
        )
        # Fire-and-forget; never block tool dispatch on audit publish
        self._publisher.publish_nowait(event)
```

### 8.2 Control Plane Integration

```python
# venture/control_plane/dispatcher.py  (abbreviated)

class ControlPlaneDispatcher:
    def __init__(
        self,
        checker: ToolAllowlistChecker,
        tool_registry: ToolRegistry,
    ) -> None:
        self._checker = checker
        self._registry = tool_registry

    async def dispatch(self, call: ToolCall) -> ToolResult:
        ctx = ToolCallContext(
            agent_id=call.agent_id,
            tenant_id=call.tenant_id,
            role=call.role,
            tool_id=call.tool_id,
            trace_id=call.trace_id,
            policy_bundle_id=call.policy_bundle_id,
            call_params=call.params,
            session_id=call.session_id,
            workflow_id=call.workflow_id,
        )

        result = self._checker.check(ctx)
        if not result.allowed:
            # Hard stop — no fallback, no alternative path
            raise ToolCallDeniedError(
                tool_id=call.tool_id,
                role=call.role,
                reason=result.reason,
                conditions_failed=result.conditions_failed,
            )

        tool_impl = self._registry.get(call.tool_id)
        return await tool_impl.execute(call)
```

### 8.3 ToolCallDeniedError

```python
class ToolCallDeniedError(RuntimeError):
    """
    Raised when the allowlist checker denies a tool call.
    Never catch this without re-raising or escalating to the violation handler.
    """
    def __init__(
        self,
        tool_id: str,
        role: str,
        reason: str,
        conditions_failed: list[str],
    ) -> None:
        super().__init__(
            f"Tool call denied: tool={tool_id!r} role={role!r} reason={reason!r}"
        )
        self.tool_id = tool_id
        self.role = role
        self.reason = reason
        self.conditions_failed = conditions_failed
```

---

## 9. Violation Handling

### 9.1 Violation Types

| Violation Type | Trigger | Severity |
|---------------|---------|----------|
| `TOOL_NOT_IN_ALLOWLIST` | Agent calls a tool not in its static allowlist | HIGH |
| `CONDITION_FAILURE` | Tool in allowlist but a condition check fails | MEDIUM |
| `NATS_SUBJECT_ACCESS_VIOLATION` | Agent publishes/subscribes to unauthorized NATS subject | HIGH |
| `SECCOMP_SYSCALL_BLOCK` | Sandboxed code attempts a blocked syscall | CRITICAL |
| `DYNAMIC_GRANT_EXPIRED` | Agent calls an elevated tool after TTL expiry | MEDIUM |
| `BUDGET_ENVELOPE_EXCEEDED` | Money tool call exceeds the pre-authorized budget | HIGH |
| `DUAL_APPROVAL_MISSING` | Money tool above threshold without second approval | HIGH |
| `DOMAIN_ALLOWLIST_VIOLATION` | `web.fetch` to a non-allowlisted domain | HIGH |

### 9.2 Auto-Response Matrix

| Violation Count | Response | Events Emitted |
|----------------|----------|----------------|
| 1st in session | Log + warn; tool call denied | `agent.capability.violation.v1` (severity: WARN) + `agent.tool.denied.v1` |
| 2nd in session | Session suspended; ops-auditor alerted via NATS | `agent.capability.violation.v1` (severity: CRITICAL) + `agent.session.suspended.v1` |
| 3rd cumulative | Agent fingerprint banned; admin paged | `agent.fingerprint.banned.v1` + `ops.page.v1` |

**Special case for SECCOMP_SYSCALL_BLOCK:** Immediate process kill + session suspend on the first occurrence, regardless of prior violation count. This violation is always severity CRITICAL.

### 9.3 `agent.capability.violation.v1` JSON Schema

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://venture.parpour.io/schemas/events/agent.capability.violation.v1.json",
  "title": "AgentCapabilityViolationV1",
  "description": "Emitted when an agent attempts to use a tool or access a resource outside its allowlist.",
  "type": "object",
  "required": [
    "event_id",
    "event_type",
    "spec_version",
    "occurred_at",
    "agent_id",
    "tenant_id",
    "session_id",
    "role",
    "violation_type",
    "tool_id",
    "severity",
    "reason",
    "conditions_failed",
    "trace_id",
    "policy_bundle_id",
    "violation_count_in_session",
    "violation_count_cumulative",
    "auto_response"
  ],
  "properties": {
    "event_id": {
      "type": "string",
      "format": "uuid",
      "description": "Unique event identifier (UUIDv4)"
    },
    "event_type": {
      "type": "string",
      "const": "agent.capability.violation.v1"
    },
    "spec_version": {
      "type": "string",
      "const": "1.0"
    },
    "occurred_at": {
      "type": "string",
      "format": "date-time",
      "description": "ISO8601 UTC timestamp of the violation"
    },
    "agent_id": {
      "type": "string",
      "description": "Unique identifier of the agent that violated policy"
    },
    "agent_fingerprint": {
      "type": "string",
      "description": "Stable fingerprint of agent version/config for ban tracking"
    },
    "tenant_id": {
      "type": "string",
      "description": "Tenant scope of the violating agent"
    },
    "session_id": {
      "type": "string",
      "description": "Agent session ID in which violation occurred"
    },
    "workflow_id": {
      "type": ["string", "null"],
      "description": "Workflow execution ID if available"
    },
    "role": {
      "type": "string",
      "enum": [
        "orchestrator", "researcher", "solver",
        "finance-controller", "ops-auditor",
        "artifact-compiler", "policy-engine", "civlab-runner"
      ],
      "description": "Role of the violating agent"
    },
    "violation_type": {
      "type": "string",
      "enum": [
        "TOOL_NOT_IN_ALLOWLIST",
        "CONDITION_FAILURE",
        "NATS_SUBJECT_ACCESS_VIOLATION",
        "SECCOMP_SYSCALL_BLOCK",
        "DYNAMIC_GRANT_EXPIRED",
        "BUDGET_ENVELOPE_EXCEEDED",
        "DUAL_APPROVAL_MISSING",
        "DOMAIN_ALLOWLIST_VIOLATION"
      ]
    },
    "tool_id": {
      "type": "string",
      "description": "Tool ID that was attempted"
    },
    "nats_subject": {
      "type": ["string", "null"],
      "description": "NATS subject involved (for NATS_SUBJECT_ACCESS_VIOLATION only)"
    },
    "syscall_name": {
      "type": ["string", "null"],
      "description": "Blocked syscall name (for SECCOMP_SYSCALL_BLOCK only)"
    },
    "severity": {
      "type": "string",
      "enum": ["WARN", "HIGH", "CRITICAL"]
    },
    "reason": {
      "type": "string",
      "description": "Human-readable denial reason from AllowlistResult"
    },
    "conditions_failed": {
      "type": "array",
      "items": { "type": "string" },
      "description": "List of condition descriptions that failed"
    },
    "trace_id": {
      "type": ["string", "null"],
      "description": "Distributed trace ID at time of violation"
    },
    "policy_bundle_id": {
      "type": ["string", "null"],
      "format": "uuid",
      "description": "Active policy bundle ID at time of violation"
    },
    "violation_count_in_session": {
      "type": "integer",
      "minimum": 1,
      "description": "Number of violations this agent has committed in the current session"
    },
    "violation_count_cumulative": {
      "type": "integer",
      "minimum": 1,
      "description": "Total violations across all sessions for this agent fingerprint"
    },
    "auto_response": {
      "type": "string",
      "enum": ["WARN_AND_DENY", "SUSPEND_SESSION", "BAN_FINGERPRINT"],
      "description": "Automated enforcement action taken"
    },
    "metadata": {
      "type": "object",
      "additionalProperties": true,
      "description": "Additional context: budget amounts, domain attempted, call_params_hash, etc."
    }
  },
  "additionalProperties": false
}
```

---

## 10. Tool Sensitivity Levels and Preconditions Table

| Tool ID | Sensitivity | Preconditions | Audit Level | Notes |
|---------|-------------|---------------|-------------|-------|
| `io.read` | LOW | trace_id | STANDARD | Path-scoped per role |
| `io.write` | MEDIUM | trace_id, scope_restricted | STANDARD | Path-scoped per role |
| `io.delete` | HIGH | trace_id, policy_bundle_pin | DETAILED | No role has static grant; admin or elevation only |
| `io.list` | LOW | trace_id | STANDARD | Path-scoped per role |
| `web.fetch` | HIGH | trace_id, domain_allowlist, rate_limited | DETAILED | Blocked for solver and finance-controller |
| `web.fetch.internal` | MEDIUM | trace_id, service_registry | STANDARD | Internal URLs only |
| `code.exec.restricted` | MEDIUM | trace_id, policy_bundle_pin | DETAILED | solver only; no network; CPU/mem capped |
| `code.exec.sandbox` | HIGH | trace_id, policy_bundle_pin, dynamic_grant, seccomp_profile | FULL | Dynamic elevation required; seccomp-bpf applied |
| `event.publish` | MEDIUM | trace_id, nats_subject_restricted | STANDARD | Subject pattern gated per role |
| `event.query` | LOW | trace_id | STANDARD | Lookback window gated per role |
| `event.subscribe` | LOW | trace_id, nats_subject_restricted | STANDARD | Subject pattern gated per role |
| `money.intent.create` | CRITICAL | trace_id, policy_bundle_pin, budget_envelope, dual_approval (>$100) | FULL | finance-controller only; full param capture |
| `money.authorize` | CRITICAL | trace_id, policy_bundle_pin, budget_envelope, dual_approval (>$100) | FULL | finance-controller only |
| `money.void` | HIGH | trace_id, policy_bundle_pin | FULL | finance-controller only; intent must be AUTHORIZED |
| `money.refund` | HIGH | trace_id, policy_bundle_pin, dual_approval (>$500) | FULL | finance-controller only |
| `ledger.reconcile` | HIGH | trace_id, policy_bundle_pin, idempotency_key | FULL | finance-controller only |
| `ledger.read` | MEDIUM | trace_id | STANDARD | finance-controller and ops-auditor |
| `workflow.dispatch` | MEDIUM | trace_id, policy_bundle_pin | STANDARD | orchestrator only |
| `workflow.cancel` | HIGH | trace_id, policy_bundle_pin | DETAILED | orchestrator only; own workflows only |
| `workflow.status` | LOW | trace_id | STANDARD | orchestrator, finance-controller, ops-auditor |
| `agent.spawn` | HIGH | trace_id, policy_bundle_pin, max_concurrent | DETAILED | orchestrator only; no admin roles |
| `agent.message` | MEDIUM | trace_id | STANDARD | Same tenant/workflow only |
| `agent.terminate` | HIGH | trace_id, policy_bundle_pin | DETAILED | orchestrator only; own agents only |
| `policy.evaluate` | LOW | trace_id | STANDARD | All roles |
| `policy.bundle.read` | LOW | trace_id | STANDARD | orchestrator, ops-auditor, policy-engine |
| `policy.bundle.pin` | HIGH | trace_id | DETAILED | policy-engine only |
| `artifact.render` | LOW | trace_id | STANDARD | researcher, solver, artifact-compiler |
| `artifact.export` | MEDIUM | trace_id, policy_bundle_pin | STANDARD | artifact-compiler; destination allowlisted |
| `artifact.verify` | LOW | trace_id | STANDARD | researcher, ops-auditor, artifact-compiler |
| `artifact.ir.register` | MEDIUM | trace_id, policy_bundle_pin | STANDARD | artifact-compiler; schema version pinned |
| `compliance.case.review` | LOW | trace_id | STANDARD | Scope varies per role |
| `compliance.case.create` | MEDIUM | trace_id, policy_bundle_pin | DETAILED | ops-auditor and policy-engine only |
| `compliance.outreach.check` | LOW | trace_id | STANDARD | researcher, finance-controller, ops-auditor |
| `civlab.run` | MEDIUM | trace_id, policy_bundle_pin, cpu_limit, memory_limit | DETAILED | civlab-runner only; resource-bounded |
| `civlab.replay` | LOW | trace_id | STANDARD | civlab-runner only |
| `civlab.export` | LOW | trace_id | STANDARD | civlab-runner only |
| `civlab.challenge.submit` | MEDIUM | trace_id, policy_bundle_pin | DETAILED | civlab-runner; one per challenge/session |
| `admin.freeze` | CRITICAL | trace_id, policy_bundle_pin, dual_approval | FULL | admin role only; irreversible until thaw |
| `admin.thaw` | CRITICAL | trace_id, policy_bundle_pin, dual_approval | FULL | admin role only |
| `admin.role.grant` | CRITICAL | trace_id, policy_bundle_pin, audit_log | FULL | admin role only |
| `admin.audit.export` | HIGH | trace_id, policy_bundle_pin | FULL | ops-auditor (limited window) and admin |

**Audit Levels:**
- `STANDARD` — tool call logged with role, tool_id, trace_id, allowed, duration_ms
- `DETAILED` — STANDARD + parameters hashed + pre/post state summary
- `FULL` — complete parameter capture, pre/post state snapshot, 7-year retention

---

## 11. Domain Allowlist for web.fetch

### 11.1 researcher Domain Allowlist

```python
# venture/config/domain_allowlists.py

RESEARCHER_DOMAIN_ALLOWLIST: list[str] = [
    # Search and information retrieval
    r"^search\.brave\.com$",
    r"^api\.duckduckgo\.com$",
    r"^serpapi\.com$",
    # News and media
    r"^newsapi\.org$",
    r"^feeds\.reuters\.com$",
    r"^api\.nytimes\.com$",
    # Financial and economic data
    r"^data\.sec\.gov$",
    r"^api\.worldbank\.org$",
    r"^fred\.stlouisfed\.org$",
    r"^api\.crunchbase\.com$",
    r"^query[12]?\.finance\.yahoo\.com$",
    r"^api\.polygon\.io$",
    r"^api\.alphavantage\.co$",
    r"^data\.nasdaq\.com$",
    # Company intelligence
    r"^api\.linkedin\.com$",
    r"^api\.clearbit\.com$",
    # AI inference (for researcher tasks)
    r"^api\.openai\.com$",
    r"^api\.anthropic\.com$",
    r"^generativelanguage\.googleapis\.com$",
    # Academic and reference
    r"^api\.semanticscholar\.org$",
    r"^export\.arxiv\.org$",
    r"^api\.crossref\.org$",
    # General public web
    r"^.*\.wikipedia\.org$",
    r"^.*\.gov$",
    r"^.*\.edu$",
]
```

### 11.2 artifact-compiler Domain Allowlist

```python
ARTIFACT_COMPILER_DOMAIN_ALLOWLIST: list[str] = [
    # CDN and asset delivery
    r"^cdn\.jsdelivr\.net$",
    r"^unpkg\.com$",
    r"^cdnjs\.cloudflare\.com$",
    r"^fonts\.googleapis\.com$",
    r"^fonts\.gstatic\.com$",
    r"^.*\.cloudfront\.net$",
    r"^.*\.fastly\.net$",
    # S3 public objects only (no IAM credentials)
    r"^.*\.s3\.amazonaws\.com$",
    r"^.*\.s3\.[a-z0-9-]+\.amazonaws\.com$",
    # AI content generation
    r"^api\.openai\.com$",
    r"^api\.stability\.ai$",
    r"^api\.replicate\.com$",
    r"^api\.anthropic\.com$",
    # Visualization and charting
    r"^quickchart\.io$",
    r"^api\.datawrapper\.de$",
    # PDF services
    r"^api\.pdfco\.com$",
    r"^api\.pdflayer\.com$",
]
```

### 11.3 Always-Blocked Domain Patterns (All Roles)

These patterns are enforced before any allowlist check. A match here results in immediate denial regardless of role allowlist membership.

```python
ALWAYS_BLOCKED_PATTERNS: list[str] = [
    # RFC 1918 private IPv4 ranges
    r"^10\.\d+\.\d+\.\d+$",
    r"^172\.(1[6-9]|2\d|3[01])\.\d+\.\d+$",
    r"^192\.168\.\d+\.\d+$",
    # Loopback
    r"^127\.\d+\.\d+\.\d+$",
    r"^::1$",
    r"^localhost$",
    # AWS EC2 instance metadata endpoint (SSRF protection)
    r"^169\.254\.169\.254$",
    r"^fd00:ec2::254$",
    # GCP metadata
    r"^metadata\.google\.internal$",
    # Azure metadata
    r"^metadata\.azure\.com$",
    r"^169\.254\.169\.254$",
    # Raw IPv4 addresses (no DNS name resolution)
    r"^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$",
    # Raw IPv6 addresses
    r"^\[?[0-9a-fA-F:]+\]?$",
    # Internal Venture services (must use web.fetch.internal)
    r"^.*\.venture\.internal$",
    r"^.*\.parpour\.internal$",
    r"^.*\.svc\.cluster\.local$",
]
```

### 11.4 Domain Allowlist Update Process

1. Submit a PR to `venture/config/domain_allowlists.py` with the proposed domain pattern and business justification.
2. PR requires approval from: Security team lead AND Platform admin (two distinct approvers).
3. New domain is added to the staging environment allowlist for a 48-hour observation window.
4. If no anomalies (no unexpected traffic patterns, no security alerts), promoted to production with the next release.
5. Domains may be removed from allowlists immediately by any admin without PR review in response to a security incident. Removal takes effect within 30 seconds via config reload.

---

## 12. Seccomp-BPF Policy for code.exec.sandbox

### 12.1 Overview

When `code.exec.sandbox` is dispatched, the Control Plane subprocess launcher applies a seccomp-bpf filter at fork time before exec. The filter uses **default-deny**: all syscalls are blocked unless explicitly listed in the allowlist section below. A disallowed syscall results in `SCMP_ACT_KILL_PROCESS` — the process is killed immediately, and a `SECCOMP_SYSCALL_BLOCK` violation event is emitted.

### 12.2 Seccomp Profile JSON

```json
{
  "defaultAction": "SCMP_ACT_KILL_PROCESS",
  "architectures": [
    "SCMP_ARCH_X86_64",
    "SCMP_ARCH_AARCH64"
  ],
  "syscalls": [
    {
      "comment": "File I/O and stat",
      "names": [
        "read", "write", "close", "fstat", "lstat", "stat",
        "lseek", "pread64", "pwrite64", "readv", "writev",
        "open", "openat", "creat", "access",
        "truncate", "ftruncate",
        "rename", "renameat", "renameat2",
        "mkdir", "mkdirat", "rmdir",
        "link", "linkat", "unlink", "unlinkat",
        "symlink", "symlinkat", "readlink", "readlinkat",
        "chmod", "fchmod", "fchmodat",
        "chown", "fchown", "fchownat", "lchown",
        "getdents", "getdents64",
        "getcwd", "chdir", "fchdir",
        "statx", "statfs", "fstatfs",
        "sendfile", "sendfile64",
        "splice", "tee", "vmsplice", "sync_file_range"
      ],
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "comment": "Memory management",
      "names": [
        "mmap", "mprotect", "munmap", "brk",
        "mremap", "msync", "mincore", "madvise",
        "mlock", "munlock", "mlockall", "munlockall",
        "memfd_create", "shmat", "shmget", "shmctl", "shmdt"
      ],
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "comment": "Process and thread (limited)",
      "names": [
        "getpid", "getppid", "getuid", "getgid",
        "geteuid", "getegid", "getpgrp", "getpgid", "getsid",
        "setuid", "setgid", "setsid", "setpgid",
        "getrlimit", "setrlimit", "prlimit64",
        "getrusage", "times", "sysinfo",
        "uname", "arch_prctl", "prctl",
        "getcpu", "sched_yield", "sched_getaffinity",
        "exit", "exit_group",
        "wait4", "waitid", "waitpid",
        "set_tid_address", "set_robust_list", "get_robust_list",
        "restart_syscall"
      ],
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "comment": "Signals",
      "names": [
        "rt_sigaction", "rt_sigprocmask", "rt_sigreturn",
        "rt_sigsuspend", "rt_sigtimedwait", "rt_sigqueueinfo",
        "sigaltstack", "kill", "tgkill", "tkill"
      ],
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "comment": "Polling and I/O multiplexing",
      "names": [
        "poll", "select", "pselect6", "ppoll",
        "epoll_create", "epoll_create1", "epoll_ctl", "epoll_wait", "epoll_pwait",
        "eventfd", "eventfd2",
        "timerfd_create", "timerfd_settime", "timerfd_gettime",
        "signalfd", "signalfd4",
        "pipe", "pipe2", "dup", "dup2", "dup3",
        "fcntl", "ioctl"
      ],
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "comment": "Misc safe syscalls",
      "names": [
        "gettimeofday", "clock_gettime", "clock_getres",
        "clock_nanosleep", "nanosleep", "pause",
        "umask", "syslog",
        "getrandom",
        "io_uring_setup", "io_uring_enter", "io_uring_register"
      ],
      "action": "SCMP_ACT_ALLOW"
    }
  ]
}
```

### 12.3 Explicitly Blocked Syscalls (Informational)

The following syscalls are blocked by the default-deny policy. This table documents the rationale.

| Syscall | Reason Blocked |
|---------|---------------|
| `fork`, `vfork` | Prevents child process spawning outside Control Plane |
| `execve`, `execveat` | Prevents code injection via exec replacement |
| `clone` (with CLONE_NEWUSER) | Prevents user namespace escape |
| `socket`, `socketpair` | No networking from sandboxed code |
| `connect`, `accept`, `bind`, `listen` | No networking |
| `sendto`, `recvfrom`, `sendmsg`, `recvmsg` | No networking |
| `ptrace` | No process tracing or injection into other processes |
| `process_vm_readv`, `process_vm_writev` | No cross-process memory access |
| `perf_event_open` | No side-channel data collection |
| `keyctl`, `add_key`, `request_key` | No kernel keyring access |
| `personality` | No ABI/personality override |
| `mount`, `umount2` | No filesystem mounting |
| `pivot_root`, `chroot` | No root directory escapes |
| `swapon`, `swapoff` | No swap manipulation |
| `reboot` | No system reboot |
| `kexec_load`, `kexec_file_load` | No kernel image loading |
| `init_module`, `finit_module`, `delete_module` | No kernel module loading |
| `iopl`, `ioperm` | No direct hardware port I/O |
| `bpf` | No BPF program loading from within sandbox |
| `userfaultfd` | No userfaultfd (exploitable for page-fault injection) |
| `unshare` | No namespace creation |
| `setns` | No namespace entry |
| `open_tree`, `move_mount`, `fsopen`, `fsmount` | No filesystem API calls |

### 12.4 Resource Limits Applied at Launch

In addition to the seccomp filter, the subprocess launcher applies the following resource limits via `setrlimit` before exec:

| Resource | Limit | Description |
|----------|-------|-------------|
| `RLIMIT_CPU` | `{cpu_limit_seconds}` | CPU time hard cap; SIGKILL on exceed |
| `RLIMIT_AS` | `{memory_limit_mb} * 1024 * 1024` | Virtual address space limit |
| `RLIMIT_NOFILE` | 64 | Open file descriptor limit |
| `RLIMIT_NPROC` | 1 | No child process creation |
| `RLIMIT_FSIZE` | 256 * 1024 * 1024 | Max file write size (256MB) |

### 12.5 Sandbox Launcher Implementation

```python
# venture/sandbox/launcher.py

from __future__ import annotations

import json
import ctypes
import resource
import subprocess
import sys
from pathlib import Path
from typing import Optional

SECCOMP_PROFILE_PATH = Path(__file__).parent / "seccomp_profile.json"
LIBSECCOMP = ctypes.CDLL("libseccomp.so.2", use_errno=True)


def launch_sandboxed(
    script_path: str,
    cpu_limit_seconds: int,
    memory_limit_mb: int,
    workspace_dir: str,
    env_allowlist: Optional[dict[str, str]] = None,
) -> subprocess.CompletedProcess:
    """
    Launch a script in a seccomp-bpf sandboxed subprocess.
    Applies resource limits and seccomp filter before exec.

    Precondition: caller MUST have verified a valid dynamic elevation grant
    before calling this function. This function does not re-check the grant.
    """
    profile = json.loads(SECCOMP_PROFILE_PATH.read_text())

    env = {
        "PATH": "/usr/local/bin:/usr/bin:/bin",
        "PYTHONPATH": workspace_dir,
        "HOME": workspace_dir,
        "TMPDIR": workspace_dir,
        **(env_allowlist or {}),
    }

    def apply_limits_and_seccomp() -> None:
        # CPU time hard cap
        resource.setrlimit(
            resource.RLIMIT_CPU,
            (cpu_limit_seconds, cpu_limit_seconds),
        )
        # Virtual memory cap
        mem_bytes = memory_limit_mb * 1024 * 1024
        resource.setrlimit(resource.RLIMIT_AS, (mem_bytes, mem_bytes))
        # File descriptor limit
        resource.setrlimit(resource.RLIMIT_NOFILE, (64, 64))
        # No child processes
        resource.setrlimit(resource.RLIMIT_NPROC, (1, 1))
        # Max output file size: 256MB
        fsize = 256 * 1024 * 1024
        resource.setrlimit(resource.RLIMIT_FSIZE, (fsize, fsize))
        # Apply seccomp-bpf profile
        _apply_seccomp_bpf(profile)

    return subprocess.run(
        [sys.executable, "-u", script_path],
        preexec_fn=apply_limits_and_seccomp,
        cwd=workspace_dir,
        env=env,
        capture_output=True,
        timeout=cpu_limit_seconds + 5,
        check=False,
    )


def _apply_seccomp_bpf(profile: dict) -> None:
    """Apply a seccomp-bpf profile using libseccomp."""
    # Implementation uses libseccomp Python bindings or ctypes.
    # In production this calls seccomp_init, seccomp_rule_add, seccomp_load.
    # Omitted here for brevity; profile is validated at startup, not at call time.
    import seccomp  # type: ignore[import]
    f = seccomp.SyscallFilter(defaction=seccomp.KILL_PROCESS)
    for syscall_group in profile.get("syscalls", []):
        for name in syscall_group["names"]:
            f.add_rule(seccomp.ALLOW, name)
    f.load()
```

---

## 13. Audit and Observability

### 13.1 EventEnvelopeV1 Payloads

Every tool call emits `agent.tool.called.v1`. Every allowlist check (before execution) emits `agent.tool.checked.v1`. Both use EventEnvelopeV1 structure.

**agent.tool.called.v1 example payload:**

```json
{
  "event_type": "agent.tool.called.v1",
  "event_id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "spec_version": "1.0",
  "occurred_at": "2026-02-21T14:32:11.447Z",
  "agent_id": "agt-7a3f92b1",
  "tenant_id": "tenant-acme",
  "session_id": "sess-d8e4c2a0",
  "workflow_id": "wf-9b2e1d4f",
  "role": "finance-controller",
  "tool_id": "money.intent.create",
  "allowed": true,
  "conditions_passed": [
    "requires_trace_id({})",
    "requires_policy_bundle_pin({})",
    "requires_budget_envelope({'currency': 'USD'})",
    "requires_dual_approval({'threshold_usd': 100, 'approver_role': 'orchestrator'})"
  ],
  "conditions_failed": [],
  "trace_id": "4bf92f3577b34da6a3ce929d0e0e4736",
  "policy_bundle_id": "bundle-a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "duration_ms": 6.14,
  "call_params_hash": "sha256:8e7b4a1d2c3f4e5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9",
  "result_status": "SUCCESS"
}
```

**agent.tool.checked.v1 example payload (denial case):**

```json
{
  "event_type": "agent.tool.checked.v1",
  "event_id": "1b2c3d4e-5f6a-7b8c-9d0e-1f2a3b4c5d6e",
  "spec_version": "1.0",
  "occurred_at": "2026-02-21T14:33:02.119Z",
  "agent_id": "agt-7a3f92b1",
  "tenant_id": "tenant-acme",
  "session_id": "sess-d8e4c2a0",
  "role": "solver",
  "tool_id": "web.fetch",
  "allowed": false,
  "reason": "TOOL_NOT_IN_ALLOWLIST: role='solver' tool='web.fetch'",
  "conditions_passed": [],
  "conditions_failed": [],
  "trace_id": "4bf92f3577b34da6a3ce929d0e0e4737",
  "policy_bundle_id": "bundle-a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "duration_ms": 0.31
}
```

### 13.2 Prometheus Metrics

```python
# venture/metrics/tool_metrics.py

from prometheus_client import Counter, Histogram

TOOL_CALLS_TOTAL = Counter(
    name="venture_tool_calls_total",
    documentation="Total tool calls attempted by agents",
    labelnames=["role", "tool_id", "allowed", "tenant_id"],
)

CAPABILITY_VIOLATIONS_TOTAL = Counter(
    name="venture_capability_violations_total",
    documentation="Total capability violations by agents",
    labelnames=["role", "tool_id", "violation_type", "tenant_id"],
)

TOOL_CALL_DURATION_MS = Histogram(
    name="venture_tool_call_duration_ms",
    documentation="Duration of allowed tool call executions in milliseconds",
    labelnames=["role", "tool_id"],
    buckets=[1, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000],
)

ALLOWLIST_CHECK_DURATION_MS = Histogram(
    name="venture_allowlist_check_duration_ms",
    documentation="Duration of allowlist check in milliseconds (fast path)",
    labelnames=["role", "tool_id", "allowed"],
    buckets=[0.1, 0.5, 1, 2, 5, 10, 25],
)

SESSION_VIOLATIONS_TOTAL = Counter(
    name="venture_session_violations_total",
    documentation="Violations per session (for escalation tracking)",
    labelnames=["role", "session_id", "tenant_id", "auto_response"],
)

DYNAMIC_ELEVATIONS_TOTAL = Counter(
    name="venture_dynamic_elevations_total",
    documentation="Dynamic role elevation grants issued by orchestrators",
    labelnames=["granted_tool", "recipient_role", "tenant_id"],
)

MONEY_TOOL_AMOUNT_USD = Histogram(
    name="venture_money_tool_amount_usd",
    documentation="Dollar amounts in money tool calls",
    labelnames=["tool_id", "tenant_id", "dual_approval_required"],
    buckets=[1, 10, 50, 100, 500, 1000, 5000, 10000, 50000],
)
```

### 13.3 Grafana Panels

**Panel 1: Capability Violation Heatmap**

- Type: Heatmap
- X-axis: `tool_id` (sorted by violation frequency)
- Y-axis: `role`
- Color intensity: `sum(rate(venture_capability_violations_total[5m])) by (role, tool_id)`
- Color scale: 0 = green, >0 = yellow, sustained >0 = red
- Alert: any cell exceeds 0 violations/min for more than 2 consecutive minutes triggers PagerDuty

**Panel 2: Tool Call Rate by Role**

- Type: Time series (stacked)
- Metric: `rate(venture_tool_calls_total[1m])` grouped by `role` and `tool_id`
- Separate panel series for `allowed="true"` and `allowed="false"`

**Panel 3: Allowlist Check Latency p99**

- Type: Gauge + time series
- Metric: `histogram_quantile(0.99, rate(venture_allowlist_check_duration_ms_bucket[5m]))` by role, tool_id
- Alert: p99 > 10ms for any role/tool combination (indicates cache miss or Redis degradation)

**Panel 4: Session Suspension Rate**

- Type: Stat + time series
- Metric: `rate(venture_session_violations_total{auto_response="SUSPEND_SESSION"}[5m])`
- Alert: any non-zero rate triggers immediate ops-auditor notification

**Panel 5: Money Tool Amounts Distribution**

- Type: Heatmap histogram
- Metric: `venture_money_tool_amount_usd_bucket` by tool_id
- Shows distribution of financial transaction sizes for anomaly detection

---

## 14. FR Traceability

All functional requirements reference the sections in this document and the allowlist enforcement implementation files.

| FR ID | Requirement | Section |
|-------|-------------|---------|
| FR-ROLE-001 | The system SHALL enforce a default-deny policy for all tool calls; a tool call MUST be explicitly listed in the calling agent's role allowlist to succeed. | 1.1 |
| FR-ROLE-002 | The system SHALL implement three enforcement layers: static allowlist check, policy bundle runtime check, and seccomp-bpf syscall filter for sandboxed code execution. | 1.2 |
| FR-ROLE-003 | Tool IDs SHALL follow the `{namespace}.{action}` naming convention with optional sub-namespacing. | 1.3 |
| FR-ROLE-004 | The system SHALL escalate capability violations per session: warn on first occurrence, suspend session on second, ban agent fingerprint on third cumulative. | 1.4, 9.2 |
| FR-ROLE-005 | Every tool call (allowed or denied) SHALL emit `agent.tool.called.v1` containing role, tool_id, trace_id, policy_bundle_id, conditions, and duration_ms. | 13.1 |
| FR-ROLE-006 | Every allowlist check SHALL emit `agent.tool.checked.v1` before the tool executes, capturing the allow/deny decision and all condition results. | 8.1 |
| FR-ROLE-007 | Capability violations SHALL emit `agent.capability.violation.v1` conforming to the JSON Schema defined in section 9.3. | 9.3 |
| FR-ROLE-008 | The allowlist checker SHALL perform its fast-path static lookup in O(1) time using an in-memory dictionary indexed by role and tool_id. | 8.1 |
| FR-ROLE-009 | All money tools in the `money.*` namespace SHALL require a budget envelope pre-flight check before any execution. | 2.5, 6.1 |
| FR-ROLE-010 | Money tool calls with amounts exceeding $100 SHALL require dual approval from a second authorized agent of orchestrator role. | 3.4, 6.1 |
| FR-ROLE-011 | `money.refund` calls with amounts exceeding $500 SHALL require dual approval. | 3.4 |
| FR-ROLE-012 | `code.exec.sandbox` SHALL NOT appear in the static allowlist of any role defined in this document; it SHALL require a dynamic elevation grant from the orchestrator to be accessible. | 3.3, 7.1 |
| FR-ROLE-013 | Dynamic elevation grants SHALL have a maximum TTL of 1 hour and SHALL be embedded in the active policy bundle for the current workflow execution. | 7.3 |
| FR-ROLE-014 | Every dynamic elevation grant event SHALL emit `agent.role.elevated.v1` conforming to the schema defined in section 7.2. | 7.2 |
| FR-ROLE-015 | `web.fetch` calls to external domains SHALL validate the target domain against the per-role domain allowlist before dispatching the HTTP request. | 11.1, 11.2 |
| FR-ROLE-016 | The following domain patterns SHALL be blocked for all roles regardless of allowlist: RFC1918 ranges, cloud metadata endpoints (169.254.169.254), raw IP addresses, and internal Venture service domains. | 11.3 |
| FR-ROLE-017 | NATS subject access SHALL be enforced per-role with explicit publish and subscribe permissions as defined in section 5.2. | 5.2 |
| FR-ROLE-018 | The NATS subjects `VENTURE.{tenant}.system.>`, `VENTURE.{tenant}.billing.raw.>`, `_INBOX.>`, and `$SYS.>` SHALL be inaccessible to all agent roles from agent code. | 5.3 |
| FR-ROLE-019 | `code.exec.sandbox` SHALL apply a seccomp-bpf filter with default-deny policy that explicitly blocks fork, execve, socket, connect, and ptrace syscalls at minimum. | 12.2, 12.3 |
| FR-ROLE-020 | A `SECCOMP_SYSCALL_BLOCK` violation SHALL result in immediate process kill and session suspend on the first occurrence, regardless of prior violation count in the session. | 9.2 |
| FR-ROLE-021 | The system SHALL expose Prometheus metrics `venture_tool_calls_total` and `venture_capability_violations_total` with at minimum `role`, `tool_id`, and `tenant_id` labels. | 13.2 |
| FR-ROLE-022 | The `ops-auditor` role SHALL have read-only access across all namespaces and SHALL NOT have static allowlist access to any money write tools or admin mutation tools. | 3.5 |
| FR-ROLE-023 | The `finance-controller` role SHALL be the only role with static allowlist access to any tool in the `money.*` namespace. | 3.4 |
| FR-ROLE-024 | The `policy-engine` role SHALL be the only role with static allowlist access to `policy.bundle.pin`. | 3.7 |
| FR-ROLE-025 | All admin tools in the `admin.*` namespace SHALL require the `admin` role; no role defined in this document SHALL have static allowlist access to `admin.freeze`, `admin.thaw`, or `admin.role.grant`. | 3, 2.12 |
| FR-ROLE-026 | `io.delete` SHALL have no static allowlist entry in any role defined in this document; deletion requires explicit admin grant or an orchestrator-mediated workflow with explicit elevation. | 4 |
| FR-ROLE-027 | The `civlab-runner` role SHALL be isolated to CivLab namespaces with no access to financial tools, agent lifecycle tools, or general code execution tools. | 3.8 |
| FR-ROLE-028 | Domain allowlist updates SHALL require a PR approved by the Security team lead AND a Platform admin before taking effect in production. | 11.4 |
