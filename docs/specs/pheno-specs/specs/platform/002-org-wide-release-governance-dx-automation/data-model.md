# Data Model: Org-Wide Release Governance & DX Automation

**Date**: 2026-03-01
**Feature**: 002-org-wide-release-governance-dx-automation

---

## Entities

### Package

A publishable unit detected from a manifest file.

| Field | Type | Description |
|-------|------|-------------|
| name | string | Package name as published to registry |
| version | semver | Current base version (e.g., `0.2.0`) |
| language | enum | rust, python, typescript, go, elixir, zig, mojo |
| registry | enum | crates_io, pypi, npm, go_proxy, hex, zig_registry, mojo_registry |
| manifest_path | path | Absolute path to Cargo.toml / pyproject.toml / package.json / go.mod |
| private | bool | Whether publishing is disabled |
| risk_profile | enum | low, medium, high |
| current_channel | enum | none, alpha, canary, beta, rc, prod |
| repo | string | Repository name |
| workspace_deps | list[string] | Other packages in same workspace this depends on (for topological ordering) |

### ReleaseChannel

One tier in the 5-tier release model.

| Field | Type | Description |
|-------|------|-------------|
| name | enum | alpha, canary, beta, rc, prod |
| ordinal | int | 0-4 (alpha=0, prod=4) |
| gate_criteria | list[GateCriterion] | Required checks for promotion to this channel |
| version_suffix | map[registry → string] | Registry-specific suffix format |

### GateCriterion

A specific check required for channel promotion.

| Field | Type | Description |
|-------|------|-------------|
| id | string | e.g., `lint`, `unit_tests`, `integration_tests`, `security_audit`, `rollback_plan` |
| name | string | Human-readable name |
| required_from | enum | Channel at which this criterion first becomes required |
| command | string | Task runner command to execute (e.g., `mise run test`) |

### Promotion

A request to advance a package from one channel to another.

| Field | Type | Description |
|-------|------|-------------|
| package | Package | The package being promoted |
| from_channel | enum | Current channel |
| to_channel | enum | Target channel |
| triggered_by | enum | tag_push, workflow_dispatch, cli_command |
| gate_results | list[GateResult] | Pass/fail for each criterion |
| status | enum | pending, gates_running, gates_passed, gates_failed, publishing, published, failed |
| published_version | string | Final version string published to registry |

### GateResult

Result of a single gate criterion check.

| Field | Type | Description |
|-------|------|-------------|
| criterion_id | string | References GateCriterion.id |
| passed | bool | Whether the check passed |
| output | string | Stdout/stderr from the check |
| duration_ms | int | Time taken |

### ReleaseMatrix

Org-wide view of all packages and their channel status.

| Field | Type | Description |
|-------|------|-------------|
| generated_at | timestamp | When the matrix was generated |
| packages | list[PackageStatus] | Status for each publishable package |

### PackageStatus

Per-package entry in the release matrix.

| Field | Type | Description |
|-------|------|-------------|
| package | Package | The package |
| channel | enum | Current release channel |
| version | string | Current published version |
| registry_url | string | Link to package on registry |
| blocked_by | list[string] | Gate criteria blocking next promotion |
| last_promoted | timestamp | When last promotion occurred |

---

## Relationships

```
Package 1──* Promotion (a package has many promotions over time)
Promotion 1──* GateResult (each promotion checks multiple gates)
ReleaseChannel 1──* GateCriterion (each channel has required gates)
ReleaseMatrix 1──* PackageStatus (matrix contains all packages)
Package *──* Package (workspace dependencies for topological ordering)
```

## State Machine: Package Channel Progression

```
none → alpha → canary → beta → rc → prod

Transitions governed by:
- Risk profile (low-risk may skip: none → alpha → prod)
- Gate criteria (must pass target channel's gates)
- Dependency order (workspace deps must be at same or higher channel)
```

## Version Calculation

Given `base_version = X.Y.Z`, `channel`, and `increment N`:

| Registry | Formula |
|----------|---------|
| npm | `X.Y.Z-{channel}.N` with `--tag {channel}` |
| PyPI | alpha: `X.Y.ZaN`, canary: `X.Y.Z.devN`, beta: `X.Y.ZbN`, rc: `X.Y.ZrcN` |
| crates.io | `X.Y.Z-{channel}.N` |
| Go proxy | `vX.Y.Z-{channel}.N` |
| Hex.pm | `X.Y.Z-{channel}.N` |
| Zig | git tag `vX.Y.Z-{channel}.N` |
| Mojo | N/A (no registry) |
