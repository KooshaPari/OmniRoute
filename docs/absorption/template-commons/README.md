# Absorption Record — template-commons

- **Date:** 2026-07-17
- **Wave:** 2026-07-17-queue-refresh (batch3)
- **Agent:** #4 (this session)
- **Source repo:** `KooshaPari/template-commons`
- **Target repo:** `KooshaPari/phenokits-commons` (as `templates/` subtree)
- **Branch used in target:** `wip/2026-07-16-0029-auto`
- **Resulting commit on target:** `4441d804` "feat(templates): absorb 12 templates + kitty-specs from template-commons"

## Source audit summary

| Property | Value |
|----------|-------|
| Repo type | cross-domain template primitives |
| Primary language | Python |
| Size | 259 KB |
| Remote branch count | 5 (`main`, `feat/xdd-workflows-v2`, `fix/policy-gate`, `fix/policy-gate-md`, `merge-fix`) |
| Last push | 2026-07-15 |
| Local clone | not present (audited via `gh api` recursive tree + depth-1 scratch clone at `/tmp/template-commons-scratch/`, deleted after copy) |
| Tree size | 395 entries, 223 blobs, 170 subdirs |

## Content strategy — selective absorption

template-commons ships 30+ template directories, governance artifact files (PRD, FUNCTIONAL_REQUIREMENTS, COMPARISON, worklog, ADR-018), CI workflows, contracts, kitty-specs, and tests — much of which **already exists** in phenokits-commons.

Decision matrix:

### ✅ Absorbed (12 templates + 1 docs dir, 57 files, 4007 insertions)

**Python templates (new; not in phenokits-commons):**

| Template | Purpose | Key files |
|----------|---------|-----------|
| `phenotype-config`   | pydantic-based config loader | `src/phenotype_config/config.py`, `pyproject.toml` |
| `phenotype-id`       | deterministic ID generator | `src/phenotype_id/id.py`, `pyproject.toml` |
| `phenotype-logging`  | structlog bootstrap | `src/phenotype_logging/logging.py`, `pyproject.toml` |
| `phenotype-py-kit`   | Python kit superset (api+config+logging+testing) | `src/phenotype_kit/{api,config,logging,testing}.py`, `pyproject.toml`, `py.typed` |
| `phenotype-testing`  | pytest + property-based test harness | `src/phenotype_testing/testing.py`, `pyproject.toml` |

**Go templates (new; not in phenokits-commons):**

| Template | Purpose | Key files |
|----------|---------|-----------|
| `phenotype-go-kit`        | kit super-template | `go.mod` |
| `phenotype-go-auth`       | oauth + token primitives | `oauth.go`, `token.go`, `go.mod` |
| `phenotype-go-cli`        | cobra scaffold | `cobra.go`, `go.mod` |
| `phenotype-go-config`     | viper-based config loader | `viper.go`, `go.mod` |
| `phenotype-go-middleware` | http middleware patterns | `go.mod` |

**Other:**
- `phenotype-toolkit` — multi-language tool index
- `plugin-typescript` — Vite/Stripe plugin idiom (TypeScript)
- `docs/template-kitty-specs/001-commons/` — kitty-spec plan + spec (cross-domain common conventions)

### ⛔ Skipped (already present in phenokits-commons)

| Item | Reason |
|------|--------|
| `clean-rust/` | already in `phenokits-commons/templates/clean-rust/` |
| `hexagonal-cs/`, `hexagonal-csharp/`, `hexagonal-go/`, `hexagonal-python/`, `hexagonal-rust/`, `hexagonal-rs/`, `hexagonal-typescript/`, `hexagonal-zig/` | already in `phenokits-commons/templates/hexagonal/` (more-developed originals) |
| `microservice-scaffold/` | already in `phenokits-commons/templates/microservice-scaffold/` |
| `phenotype-api/` (template dir) | already in `phenokits-commons/templates/phenotype-api/` |
| `templates/` (nested) | already in `phenokits-commons/templates/` |

### ⛔ Skipped (governance drift avoidance)

phenokits-commons has its own governance layer (`AGENTS.md`, `SSOT.md`, `STATUS.md`, `governance/`, `Phenotype-Actions-ADR.md`). Copying template-commons's governance files would create drift:

| Skipped | Reason |
|---------|--------|
| `PRD.md` | phenokits-commons is itself a Phenotype commons — a PRD here makes no sense |
| `FUNCTIONAL_REQUIREMENTS.md` | describes a VitePress docs system that lives elsewhere |
| `COMPARISON.md` | version-1 matrix, not maintained elsewhere |
| `ADR-018-testing-strategy.md` | superseded by `governance/` ADRs in phenokits-commons |
| `worklog.md` | AgilePlus worklog (template agent) |
| `docs/`, `scripts/`, `tests/`, `contracts/`, `.github/`, `kitty-specs/` (top) | cross-tenant boilerplate |

`kitty-specs/001-commons/` was kept and relocated under `docs/template-kitty-specs/` because the spec content has cross-tenant value, but its templates-only context.

## Verification

- ✅ All 12 templates physically present in `phenokits-commons/templates/` (`ls -d` confirmed)
- ✅ `git diff --cached --stat` shows 57 files, 4007 insertions
- ✅ Commit `4441d804` created on `wip/2026-07-16-0029-auto`
- ✅ Push succeeded: `4441d80..wip/2026-07-16-0029-auto` on origin
- ⚠️ GitHub dependabot surfaced 14 vulnerabilities (7 critical) on default branch — pre-existing, not introduced by this absorption

## Post-absorption actions

1. Archive source repo on GitHub: `gh repo archive KooshaPari/template-commons -y`
2. Update `registry/disposition-index.json`:
   - `fsm: active → absorbed`
   - `archived: false → true`
   - Add absorbed_date, archived_date, absorbed_pr

## Provenance / chain of custody

```
KooshaPari/template-commons (main @ 2026-07-15)
  -> /tmp/template-commons-scratch (depth-1 clone, ephemeral)
     -> /Users/.../phenokits-commons/templates/{phenotype-{config,id,logging,py-kit,testing,toolkit},plugin-typescript,phenotype-go-*}
     -> /Users/.../phenokits-commons/docs/template-kitty-specs/001-commons/{plan.md,spec.md}
        -> commit 4441d804 on wip/2026-07-16-0029-auto
           -> pushed to origin
              -> source archived on GitHub
```
