# Traceability Index — sharecli

> Authoritative mapping between Functional Requirements, source code, and
> acceptance tests. Updated by the spec+test+traceability workflow.

**How to use this file:**

1. Every FR in `docs/specs/FR.md` has a row here.
2. The `Source` column lists the canonical Rust module(s) that implement
   the requirement.
3. The `Tests` column lists every acceptance test file that covers the
   requirement. Each test carries an `// FR-XXX` comment in its source.
4. The `Status` column tracks whether the FR has at least one passing
   acceptance test.

**Phase:** 3 (spec+test+traceability e2e)
**Last updated:** 2026-06-15

---

## FR ↔ Source ↔ Tests Matrix

| FR ID   | Title                                | Source                                                                                       | Tests                                                                                              | Status |
|---------|--------------------------------------|----------------------------------------------------------------------------------------------|----------------------------------------------------------------------------------------------------|--------|
| FR-001  | Managed Process Lifecycle            | `src/main.rs:38-91`, `src/commands/mod.rs:25-138`, `src/runtime.rs:44-156`                  | `tests/fr001_process_lifecycle.rs`, `tests/fr001_stop_filter.rs`                                  | ACCEPTED |
| FR-002  | TOML Configuration Management        | `src/config.rs:1-119`, `src/commands/mod.rs:194-222`                                         | `tests/fr002_config_load.rs`, `tests/fr002_config_init.rs`                                         | ACCEPTED |
| FR-003  | Project Registry                     | `src/config.rs:8-68`, `src/commands/mod.rs:225-313`                                          | `tests/fr003_project_registry.rs`, `tests/fr003_project_discover.rs`                              | ACCEPTED |
| FR-004  | Process & Pool Health Status         | `src/runtime.rs:152-356`, `src/monitoring.rs:1-118`, `src/commands/mod.rs:140-191`, `:325-396` | `tests/fr004_status_health.rs`, `tests/fr004_pool_status.rs`                                      | ACCEPTED |
| FR-005  | Per-Project Resource Limits          | `src/runtime.rs:358-455`, `src/commands/mod.rs:398-447`                                     | `tests/fr005_project_limits.rs`, `tests/fr005_resource_check.rs`                                  | ACCEPTED |

**Coverage summary:** 5/5 FRs mapped, 10 acceptance test files, 0 gaps.

---

## Per-FR Detail

### FR-001 — Managed Process Lifecycle

| AC        | Test file                              | Test function                          |
|-----------|----------------------------------------|----------------------------------------|
| AC-001.1  | `tests/fr001_process_lifecycle.rs`     | `fr001_start_records_pid_in_pool`      |
| AC-001.2  | `tests/fr001_process_lifecycle.rs`     | `fr001_ps_table_columns_present`       |
| AC-001.3  | `tests/fr001_process_lifecycle.rs`     | `fr001_ps_filter_by_project`           |
| AC-001.4  | `tests/fr001_stop_filter.rs`           | `fr001_stop_all_terminates_everything` |
| AC-001.5  | `tests/fr001_stop_filter.rs`           | `fr001_stop_without_selector_errors`   |

### FR-002 — TOML Configuration Management

| AC        | Test file                          | Test function                            |
|-----------|------------------------------------|------------------------------------------|
| AC-002.1  | `tests/fr002_config_init.rs`       | `fr002_init_creates_default_toml`        |
| AC-002.2  | `tests/fr002_config_init.rs`       | `fr002_validate_reports_project_count`   |
| AC-002.3  | `tests/fr002_config_load.rs`       | `fr002_show_prints_projects_and_runtime` |
| AC-002.4  | `tests/fr002_config_load.rs`       | `fr002_load_roundtrips_projects_map`     |
| AC-002.5  | `tests/fr002_config_load.rs`       | `fr002_runtime_config_default_values`    |

### FR-003 — Project Registry

| AC        | Test file                            | Test function                              |
|-----------|--------------------------------------|--------------------------------------------|
| AC-003.1  | `tests/fr003_project_registry.rs`    | `fr003_project_add_inserts_and_persists`   |
| AC-003.2  | `tests/fr003_project_registry.rs`    | `fr003_project_list_prints_registered`     |
| AC-003.3  | `tests/fr003_project_registry.rs`    | `fr003_project_show_resolves_path`         |
| AC-003.4  | `tests/fr003_project_discover.rs`    | `fr003_project_discover_finds_git_repos`   |
| AC-003.5  | `tests/fr003_project_registry.rs`    | `fr003_project_remove_drops_entry`         |

### FR-004 — Process & Pool Health Status

| AC        | Test file                          | Test function                            |
|-----------|------------------------------------|------------------------------------------|
| AC-004.1  | `tests/fr004_status_health.rs`     | `fr004_status_prints_harness_table`      |
| AC-004.2  | `tests/fr004_pool_status.rs`       | `fr004_pool_reports_node_and_bun`        |
| AC-004.3  | `tests/fr004_pool_status.rs`       | `fr004_health_reports_healthy_or_degraded` |
| AC-004.4  | `tests/fr004_status_health.rs`     | `fr004_health_status_marks_unhealthy`    |
| AC-004.5  | `tests/fr004_status_health.rs`     | `fr004_process_stats_idle_threshold`     |

### FR-005 — Per-Project Resource Limits

| AC        | Test file                          | Test function                            |
|-----------|------------------------------------|------------------------------------------|
| AC-005.1  | `tests/fr005_project_limits.rs`    | `fr005_project_limits_default_values`    |
| AC-005.2  | `tests/fr005_project_limits.rs`    | `fr005_limits_set_persists_values`       |
| AC-005.3  | `tests/fr005_project_limits.rs`    | `fr005_get_limits_returns_default_for_unknown` |
| AC-005.4  | `tests/fr005_resource_check.rs`    | `fr005_resource_check_overall_ok_logic`  |
| AC-005.5  | `tests/fr005_resource_check.rs`    | `fr005_check_prints_status_lines`        |

---

## Change log

- **2026-06-15 — Phase 3 initial:** 5 FRs published; 10 acceptance test files added; full FR→source→test matrix established.
