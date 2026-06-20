# Sample WORKLOG.md (ADR-015 v2.1 schema)

**Date:** 2026-06-20
**Schema:** v2.1 (7 columns: Date | Task ID | Layer | Action | Files | Notes | device:)
**Reference:** docs/adr/2026-06-20/ADR-015-v2.1-worklog-schema.md

## Header

```
| Date       | Task ID      | Layer | Action  | Files                                  | Notes                              | device:        |
|------------|--------------|-------|---------|----------------------------------------|------------------------------------|----------------|
```

## Example rows

| Date       | Task ID      | Layer | Action  | Files                                  | Notes                              | device:        |
|------------|--------------|-------|---------|----------------------------------------|------------------------------------|----------------|
| 2026-06-20 | T12-T6       | L65   | code    | scripts/validate-ssot.sh               | SSOT auto-check (L65)              | macbook        |
| 2026-06-20 | T12-T6       | L65   | code    | justfile                               | add `validate-ssot` target         | macbook        |
| 2026-06-20 | T12-T10      | L31   | code    | scripts/cache_stats_wrapper.sh         | CI cache hit-rate wrapper          | macbook        |
| 2026-06-20 | T12-T10      | L31   | code    | findings/2026-06-20-v12-T10-cache-stats-design.md | design doc                     | macbook        |
| 2026-06-20 | T12-T11      | L67   | code    | cliff.toml, .github/workflows/changelog.yml | git-cliff config + workflow  | macbook        |
| 2026-06-20 | T12-T11      | L67   | docs    | docs/conventions/changelog-convention.md | convention doc                  | macbook        |
| 2026-06-20 | T12-T9       | L57   | code    | benchmarks/rust/benches/parse_flag.rs  | criterion bench (Rust side)        | macbook        |
| 2026-06-20 | T12-T9       | L57   | code    | benchmarks/python/pytest.ini           | pytest-benchmark (Python side)     | macbook        |
| 2026-06-19 | T11-CARGO    | L29   | build   | full workspace                         | `cargo test --workspace`           | heavy-runner   |
| 2026-06-19 | T10-CARGO    | L29   | build   | full workspace                         | `cargo test --workspace`           | heavy-runner   |
| 2026-06-20 | M4-SCAN      | L20   | code    | findings/2026-06-20-Mission-4-*        | Mission 4 candidate selection      | subagent       |
| 2026-06-19 | CI-CARGO     | L29   | test    | full workspace                         | automated CI run                   | ci             |
| 2026-06-19 | CI-DENY      | L20   | audit   | full workspace                         | `cargo deny` + `govulncheck`       | ci             |
| 2026-06-20 | ADR-015-21   | L64   | docs    | docs/adr/2026-06-20/ADR-015-v2.1-worklog-schema.md | formal ADR                   | macbook        |
| 2026-06-20 | ADR-015-21   | L64   | code    | scripts/migrate-worklog-v20-to-v21.py  | migration script (idempotent)      | macbook        |
| 2026-06-20 | T6-VALIDATE  | L65   | review  | 30 SSOT.md files in fleet              | manual review of validate-ssot output | macbook      |

## Device value distribution (this sample)

- `macbook`: 11 (69%)
- `heavy-runner`: 2 (12%)
- `subagent`: 1 (6%)
- `ci`: 2 (12%)

DORA-style insight: 69% orchestrator-direct, 18% automated, 12% subagent,
12% heavy-runner. Subagent utilization is the growth vector for next quarter.

## Migration

```bash
# Migrate a v2.0 file to v2.1
python3 scripts/migrate-worklog-v20-to-v21.py WORKLOG.md

# Migrate all fleet WORKLOG.md
find /Users/kooshapari/CodeProjects/Phenotype/repos -name "WORKLOG.md" \
  -exec python3 /Users/kooshapari/CodeProjects/Phenotype/repos/scripts/migrate-worklog-v20-to-v21.py {} \;
```
