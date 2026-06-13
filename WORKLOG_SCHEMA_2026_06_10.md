# Worklog JSON Schema - 2026-06-10

This document records the inferred worklog JSON schema for the fleet worklog corpus under
`worklogs/` as of 2026-06-10.

## Source Corpus

Observed inputs:

- `worklogs/worklog-coverage-audit-20260608.json`
- `worklogs/worklog-coverage-baseline-20260608.json`
- `worklogs/worklog-coverage-rebaseline-20260607.json`
- Task/audit JSON artifacts in `worklogs/*.json`
- L1 task list in `worklogs/TICK20_FANOUT_FINDINGS_20260608.md`

The coverage audit reports:

- `total_repos`: 253
- `with_worklogs`: 204
- Root `worklogs/*.json` files observed locally: 51

The current root artifacts are mostly audit-result JSON files, not normalized per-task
records. This schema is therefore the canonical normalized task-worklog schema inferred
from the audit corpus plus the required fields used by downstream L1 coverage checks.

## Canonical Task Worklog Object

Each normalized worklog JSON file MUST contain one top-level object with the fields below.

```json
{
  "status": "completed",
  "task_id": "L1-001",
  "agent_id": "agent-name-or-session-id",
  "files_changed": ["relative/path.ext"],
  "commit_sha": "40-char-git-sha-or-null",
  "verification_result": {
    "status": "passed",
    "commands": ["command that was run"],
    "notes": "short verification summary"
  },
  "started_at": "2026-06-10T00:00:00Z",
  "completed_at": "2026-06-10T00:10:00Z"
}
```

## Field Definitions

| Field | Type | Required | Description |
|---|---:|---:|---|
| `status` | string | yes | Task lifecycle state. Canonical values: `pending`, `running`, `blocked`, `completed`, `failed`, `cancelled`. |
| `task_id` | string | yes | Stable task identifier. For L1 audit rows use `L1-001` through `L1-017`. |
| `agent_id` | string | yes | Agent, worker, or session identifier responsible for the worklog. |
| `files_changed` | array[string] | yes | Relative paths changed by the task. Use an empty array for read-only audits. |
| `commit_sha` | string or null | yes | Git commit SHA containing the work, or `null` when no commit was made. |
| `verification_result` | object | yes | Structured verification outcome. See nested schema below. |
| `started_at` | string | yes | ISO-8601 UTC timestamp when work began. |
| `completed_at` | string or null | yes | ISO-8601 UTC timestamp when work completed, or `null` while running/blocked. |

## Verification Result Schema

`verification_result` MUST be an object with this shape:

```json
{
  "status": "passed",
  "commands": ["python cli.py test run --scope unit"],
  "notes": "All targeted checks passed."
}
```

| Field | Type | Required | Description |
|---|---:|---:|---|
| `status` | string | yes | Canonical values: `passed`, `failed`, `not_run`, `partial`. |
| `commands` | array[string] | yes | Commands or checks used for verification. Empty only when `status` is `not_run`. |
| `notes` | string | yes | Human-readable verification summary or reason verification was not run. |

## JSON Schema

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://phenotype.dev/schemas/worklog-2026-06-10.json",
  "title": "Phenotype Worklog",
  "type": "object",
  "additionalProperties": true,
  "required": [
    "status",
    "task_id",
    "agent_id",
    "files_changed",
    "commit_sha",
    "verification_result",
    "started_at",
    "completed_at"
  ],
  "properties": {
    "status": {
      "type": "string",
      "enum": ["pending", "running", "blocked", "completed", "failed", "cancelled"]
    },
    "task_id": {
      "type": "string",
      "minLength": 1
    },
    "agent_id": {
      "type": "string",
      "minLength": 1
    },
    "files_changed": {
      "type": "array",
      "items": {
        "type": "string",
        "minLength": 1
      },
      "uniqueItems": true
    },
    "commit_sha": {
      "type": ["string", "null"],
      "pattern": "^[0-9a-f]{7,40}$"
    },
    "verification_result": {
      "type": "object",
      "additionalProperties": true,
      "required": ["status", "commands", "notes"],
      "properties": {
        "status": {
          "type": "string",
          "enum": ["passed", "failed", "not_run", "partial"]
        },
        "commands": {
          "type": "array",
          "items": {
            "type": "string",
            "minLength": 1
          }
        },
        "notes": {
          "type": "string"
        }
      }
    },
    "started_at": {
      "type": "string",
      "format": "date-time"
    },
    "completed_at": {
      "type": ["string", "null"],
      "format": "date-time"
    }
  }
}
```

## Inferred Audit Artifact Patterns

The existing audit JSON files in `worklogs/` commonly use these non-normalized shapes:

| Pattern | Fields | Meaning |
|---|---|---|
| Coverage audit | `generated_at`, `total_repos`, `with_worklogs`, `by_repo` | Fleet-level worklog coverage. |
| Baseline coverage | `generated_at`, `by_repo`, `summary` | Per-repo worklog directory/file inventory. |
| Rebaseline coverage | `generated_at`, `total_repos`, `with_worklog`, `with_changelog` | Earlier coverage and changelog inventory. |
| Presence audit | `generated_at`, `present`, `missing` | Repository compliance check result. |
| Dependency/library audit | `generated_at`, `total_repos`, `by_repo`, domain-specific arrays | Fleet scan grouped by repository. |

These artifacts MAY remain as audit outputs, but task-level worklog records SHOULD use the
canonical schema above so coverage can be checked uniformly.

## L1 Audit Schema Coverage Matrix

The L1 task rows below come from the 17-task fanout audit list. Each row requires all eight
canonical fields.

| L1 Task | Audit Area | status | task_id | agent_id | files_changed | commit_sha | verification_result | started_at | completed_at |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| L1-001 | Cross-repo Makefile audit | required | required | required | required | required | required | required | required |
| L1-002 | Repo inactivity audit | required | required | required | required | required | required | required | required |
| L1-003 | CI test matrix audit | required | required | required | required | required | required | required | required |
| L1-004 | Stale PR triage | required | required | required | required | required | required | required | required |
| L1-005 | Pre-commit consistency audit | required | required | required | required | required | required | required | required |
| L1-006 | Orphaned docs audit | required | required | required | required | required | required | required | required |
| L1-007 | Stale branches audit | required | required | required | required | required | required | required | required |
| L1-008 | Workflow dependency graph audit | required | required | required | required | required | required | required | required |
| L1-009 | Extensible provider/registry design audit | required | required | required | required | required | required | required | required |
| L1-010 | M3/foundation-model references | required | required | required | required | required | required | required | required |
| L1-011 | Stale issue triage | required | required | required | required | required | required | required | required |
| L1-012 | Dependency rotation and CVE scan | required | required | required | required | required | required | required | required |
| L1-013 | Stale worktree .gitignore | required | required | required | required | required | required | required | required |
| L1-014 | License/CODEOWNERS gaps | required | required | required | required | required | required | required | required |
| L1-015 | SHA pin hygiene | required | required | required | required | required | required | required | required |
| L1-016 | README/landing-page hygiene | required | required | required | required | required | required | required | required |
| L1-017 | Code orphan detection | required | required | required | required | required | required | required | required |

Coverage rule: a task is schema-covered only when all eight canonical top-level fields are
present and `verification_result` contains `status`, `commands`, and `notes`.
