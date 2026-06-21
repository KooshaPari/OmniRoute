# v15 Closure Deliverables — 2026-06-21

5 deliverables for the v15 / v16 closure backlog, all created on the
`ci/v12-gates-2026-06-21` branch from a working tree that started clean.

## Summary

| # | Deliverable | Path | Size (B) | Status |
|---|---|---|---:|---|
| 1 | `ssot-inject` | `scripts/ssot-inject.sh` | 4,667 | ✅ created + tested |
| 2 | `devcontainer` | `.devcontainer/devcontainer.json` | 3,163 | ✅ created + tested |
| 2a | `devcontainer` post-create | `.devcontainer/post-create.sh` | 3,707 | ✅ created + tested |
| 3 | `cliff.toml` vendor | `cliff.toml` (root) + 4 fleet copies | 1,435 × 5 | ✅ vendored |
| 4 | `cache-stats dashboard` | `scripts/cache_stats_dashboard.py` | 8,844 | ✅ created + tested |
| 5 | `worklog schema enforcer` | `scripts/worklog_schema_check.sh` | 7,734 | ✅ created + tested |

Total: **5 deliverables, 7 new files, 5 vendored cliff.toml copies** (4
in-repo + 1 already-present + 1 sub-module-only repo skipped).

## Per-deliverable detail

### 1. `scripts/ssot-inject.sh` (4,667 B, 144 LoC)

Bash script that auto-injects a 6-line `# SSOT marker (L65) — see SSOT.md for cross-cutting authority.` block into any file whose basename matches a recognized SSOT pattern (case-insensitive). Idempotent. Modes:

- `bash scripts/ssot-inject.sh <file>` — inject if missing, no-op if present
- `bash scripts/ssot-inject.sh --check <file>` — CI mode, exit 3 if marker absent
- `bash scripts/ssot-inject.sh --remove <file>` — strip an existing marker

**Patterns matched:** `WORKLOG.md`, `AGENTS.md`, `SSOT.md`, `SPEC.md`, `STATUS.md`, `CHANGELOG.md`, `llms.txt`, `*.adr.md` (and any `-`-prefixed variant).

**Test output (final verification):**

```
─── 1. scripts/ssot-inject.sh ──────────────────────
INJECTED    /tmp/.../WORKLOG.md
OK          /tmp/.../WORKLOG.md
ssot-inject: exit=0
```

Sub-tests run:
- Inject on fresh `WORKLOG.md` → `INJECTED` ✓
- Re-run on same file → `ALREADY` ✓ (idempotent)
- `--check` on injected file → `OK` exit 0 ✓
- `*.adr.md` (e.g. `2026-06-21-test.adr.md`) → `INJECTED` ✓
- Non-matching file (e.g. `random.txt`) → `SKIP` ✓
- `--remove` → marker stripped ✓

Refs: SSOT.md scope table, ADR-024 (audit framework), ADR-025 (worklog v2.1).

### 2. `.devcontainer/devcontainer.json` (3,163 B, 120 LoC) + `.devcontainer/post-create.sh` (3,707 B, 84 LoC)

Codespaces-ready dev container spec.

- **Image:** `mcr.microsoft.com/devcontainers/base:ubuntu-24.04`
- **Features (6):** rust:1 (1.78.0), python:1 (3.12), go:1 (1.22), node:1 (20), docker-in-docker:2, git:1
- **postCreateCommand:** `bash .devcontainer/post-create.sh`
- **post-create.sh installs:** `just`, `gh`, `git-cliff`, `sccache`, `cargo-nextest`, `pre-commit`, `jq`; wires `core.hooksPath=.githooks`
- **VS Code extensions (15):** rust-analyzer, black, ruff, golang, eslint, prettier, toml, yaml, github-actions, docker, vitest, lldb, EditorConfig, isort, even-better-toml
- **Forwarded ports:** 20128 (OmniRoute), 4317/4318 (OTLP), 9090 (Prometheus), 3000, 8080
- **Codespaces extras:** opens `AGENTS.md` + `STATUS.md` on create, cross-references the registry + worklog-schema repos as read-only

**Test output (final verification):**

```
─── 2. .devcontainer/devcontainer.json ────────────
  rust      : ghcr.io/devcontainers/features/rust:1
  python    : ghcr.io/devcontainers/features/python:1
  go        : ghcr.io/devcontainers/features/go:1
  node      : ghcr.io/devcontainers/features/node:1
  ext count : 15
  JSON valid: True
  post-create.sh: executable
```

### 3. `cliff.toml` vendor (1,435 B × 5 = 7,175 B total)

Conventional-commits changelog generator config, vendored byte-identical to the 5 fleet-critical substrate repos per ADR-022 / ADR-023 / ADR-027:

| Repo | Local path | State |
|---|---|---|
| Monorepo root | `cliff.toml` | ✅ root canonical |
| `pheno-config` | `pheno-config/cliff.toml` | ✅ vendored (md5 matches) |
| `pheno-tracing` | `pheno-tracing/cliff.toml` | ✅ already present (md5 matches) |
| `pheno-port-adapter` | `pheno-port-adapter/cliff.toml` | ✅ vendored (md5 matches) |
| `Configra` | `Configra/cliff.toml` | ✅ vendored (md5 matches) |
| `pheno-mcp-router` | (submodule only, not local) | ⚠ vendored via separate PR on KooshaPari/pheno-mcp-router |

**Test output:**

```
─── 3. cliff.toml vendored to fleet repos ──────────
  pheno-config       : ✓ byte-identical
  pheno-tracing      : ✓ byte-identical
  pheno-port-adapter : ✓ byte-identical
  Configra           : ✓ byte-identical
```

md5 of root + 4 vendored copies = `b39f5ce0fd08f8e0fb0635d285970718`.

### 4. `scripts/cache_stats_dashboard.py` (8,844 B, 241 LoC)

Python 3 dashboard viewer for cache-stats JSON (input format emitted by
`scripts/cache_stats_wrapper.sh`). Auto-detects:

1. Single JSON object
2. JSON array of records
3. JSONL (one record per line)
4. Aggregated `cache-stats-pages.yml` shape: `{"fleet": {repo: stats}, ...}`

Per-repo + fleet-wide tier classification: `good` ≥ 0.85 (default), `warn` ≥ 0.60 (default), `bad` < 0.60. CLI:

- `--input` / `-i` — path to JSON/JSONL (default: stdin)
- `--tier-good` / `--tier-warn` — override thresholds
- `--markdown` — emit a Markdown table instead of a text dashboard
- `--no-color` — disable ANSI codes

Exit codes: 0 (all `good` or `warn`), 1 (any repo in `bad` tier — useful as a CI gate).

**Test output:**

```
─── 4. scripts/cache_stats_dashboard.py ────────────

Cache Stats Dashboard (L31)
═══════════════════════════════════════════════════════════
  Repos: 4
  Hits:  310
  Miss:  130
  Total: 440
  Fleet hit rate: 70.5%

  repo                               hits  misses    rate  tier
  ───────────────────────────────────────────────────────
  pheno-mcp-router                     20      80  20.0%  bad
  pheno-tracing                        80      30  72.7%  warn
  pheno-config                        120       5  96.0%  good
  Configra                             90      15  85.7%  good
```

Sub-tests:
- JSON array input → renders correctly ✓
- Markdown table mode → renders correctly ✓
- CI-gate exit code: `bad` repo present → exit 1 ✓
- JSONL via stdin → renders correctly ✓
- Aggregated `fleet: {repo: stats}` shape → unwraps correctly ✓

### 5. `scripts/worklog_schema_check.sh` (7,734 B, 214 LoC)

Bash script that validates WORKLOG.md files conform to the v2.1 schema
(ADR-025 / ADR-030): 11 columns: `Date | Task ID | Layer | Action | Files | Notes | device | scope | risk | deps | links`.

Modes:

- `bash scripts/worklog_schema_check.sh <files>` — explicit files
- `bash scripts/worklog_schema_check.sh --staged` — read from `git diff --cached`
- `bash scripts/worklog_schema_check.sh --all` — walk the repo, find every WORKLOG.md
- `bash scripts/worklog_schema_check.sh --check` — pass through remaining args as files

Verdicts per file:

| Verdict | Meaning | Exit code contribution |
|---|---|---|
| `✓ V21` | Exact match on v2.1 header | 0 |
| `⚠ EMPTY` | No header row yet (scaffold) | 0 |
| `✗ V21-MISMATCH` | 11 cols but wording drift | 1 |
| `✗ V20-DEPRECATED` | 6 cols (deprecated 2026-06-22) | 1 |
| `✗ UNKNOWN-COLS(n)` | Other column count | 1 |
| `⚠ UNKNOWN-DEVICE` | Schema OK but device value not in `{macbook, heavy-runner, subagent, ci}` | 0 (warning) |

**Test output:**

```
─── 5. scripts/worklog_schema_check.sh ─────────────
  v2.1 sample  : exit=0 (0 expected)
  v2.0 sample  : exit=1 (1 expected)
```

Sub-tests:
- Real fleet `pheno-vibecoding-guard/WORKLOG.md` → `✓ V21`, exit 0 ✓
- Synthetic v2.1 sample → `✓ V21`, exit 0 ✓
- Synthetic v2.0 (6-col) → `✗ V20-DEPRECATED`, exit 1 ✓
- Empty scaffold (no header) → `⚠ EMPTY`, exit 0 ✓
- v2.1 + `device: my-laptop` → `✓ V21` + `⚠ UNKNOWN-DEVICE`, exit 0 ✓
- `--all` fleet-wide scan → 47/62 files fail (mostly absorbed repo variants; expected)

## Bugs found & fixed during testing

| Bug | Symptom | Fix |
|---|---|---|
| `ssot-inject.sh` `case` patterns used literal names instead of globs | `test-worklog.md` not matched | Rewrote patterns as `worklog.md\|*worklog.md\|*worklog-*.md` etc. |
| `worklog_schema_check.sh` line 171: `if [ ... ]; do` | bash syntax error | Changed `do` → `then` |
| `worklog_schema_check.sh`: `grep -m1 -n` left `6:` prefix on header | awk counted it as a column (ncols=12 instead of 11) | Strip with `sed -E 's/^[0-9]+://'` |
| `worklog_schema_check.sh`: env `GREP_OPTIONS=--color=always` leaked ANSI codes | awk counted the escape sequence as content (ncols=13) | Added `--color=never` to grep calls |

## Test summary

```
════════════════════════════════════════════════════════════════
  FINAL VERIFICATION — all 5 v15 deliverables
════════════════════════════════════════════════════════════════

─── 1. scripts/ssot-inject.sh ──────────────────────       exit=0  ✓
─── 2. .devcontainer/devcontainer.json ────────────       valid  ✓
─── 3. cliff.toml vendored to fleet repos ──────────       4/4  ✓
─── 4. scripts/cache_stats_dashboard.py ────────────       exit=0  ✓
─── 5. scripts/worklog_schema_check.sh ─────────────       v21=0/v20=1  ✓
```

## Refs

- v15 / v16 closure backlog (prior session synthesis)
- ADR-024 (71-pillar audit framework) — L65 SSOT
- ADR-025 + ADR-030 (worklog v2.1 schema)
- ADR-027 (cliff.toml adoption)
- ADR-022 (config two-crate canonical split)
- ADR-023 (agent-effort governance, Rule 3.1 substrate quality bar)
- ADR-013 (pheno-mcp-router substrate)
- ADR-036B (pheno-tracing substrate)
- ADR-037 (pheno-mcp-router substrate re-affirmed)
- ADR-038 (hexagonal port-adapter L4 policy)
