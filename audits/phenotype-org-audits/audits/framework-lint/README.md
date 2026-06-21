# Migrated from KooshaPari/pheno-framework-lint on 2026-06-19 prior to repo deletion

> Original source: https://github.com/KooshaPari/pheno-framework-lint (archived 2026-06-19, L5-112)
> See: [findings/2026-06-19-L5-112-framework-lint-absorption.md](../../findings/2026-06-19-L5-112-framework-lint-absorption.md) for the absorption matrix.
> Note: governance files (CODE_OF_CONDUCT, CONTRIBUTING, SECURITY, etc.) are preserved as snapshots in `governance/` subdir for fleet-history provenance. They are NOT authoritative for org-audits — which has its own.

# pheno-framework-lint

**Substrate graduation & tier-convention linter (ADR-048, L73).**

`pheno-framework-lint` enforces the 4 substrate-tier conventions from
ADR-048 / AGENTS.md "App substrate placement":

| Tier | Required | Forbidden |
|---|---|---|
| `pheno-*-lib` | no business logic, no App deps, no `domain/` dir | `domain/` dir, app-level deps in Cargo.toml, controllers/handlers |
| `phenotype-*-sdk` | polyglot consumers (≥ 2 languages) OR ADR-018 PRCP markers | single-language consumer only |
| `phenotype-*-framework` | ≥ 1 Port trait, ≥ 1 Adapter impl, IoC lifecycle, docs/architecture/ | no Port trait, no Adapter, no architecture doc |
| federated-service | long-running binary, Dockerfile / k8s / compose, `/health` or `/readyz` endpoint | missing health endpoint, no deployment manifest |

This is the L73 (Substrate graduation path) tool, one of three governance
tooling additions for the v8 sweep (2026-06-18).

## Install

```bash
chmod +x pheno_framework_lint.py
ln -s "$(pwd)/pheno_framework_lint.py" /usr/local/bin/pheno-framework-lint
./pheno_framework_lint.py --help
```

## Usage

### Check a single repo

```bash
pheno-framework-lint check --path ../pheno-config
```

Output: JSON report with `inferred_tier`, `violations`, and `passed` rules.

### Check the entire fleet

```bash
pheno-framework-lint check-all --root .. --out fleet-violations.json
```

Walks every subdirectory under `--root`, infers the tier from the repo name,
and applies the tier-specific checks. Repos whose name doesn't match any
ADR-023 substrate pattern are skipped (with a warning).

## Tier inference

The lint infers the tier from the repo name:

| Pattern | Tier |
|---|---|
| `pheno-<name>` (lowercase, dash-separated) | `pheno-*-lib` |
| `phenotype-<name>-{sdk,ts,py,go,rs,js,kotlin,swift}` | `phenotype-*-sdk` |
| `phenotype-<name>-framework` | `phenotype-*-framework` |
| `pheno<Name>` / `phenotype<Name>` (PascalCase) | federated-service |

## Rule reference

### `pheno-*-lib`

| Rule | Severity | What |
|---|---|---|
| `pheno-lib/no-domain` | error | no `domain/` or `src/domain/` dir |
| `pheno-lib/no-business-logic` | warning | no `domain/usecase/app/controller/handler` markers |
| `pheno-lib/no-app-deps` | error | no app-level deps in Cargo.toml |

### `phenotype-*-sdk`

| Rule | Severity | What |
|---|---|---|
| `phenotype-sdk/polyglot-required` | error | ≥ 2 source languages OR ADR-018 PRCP markers |

### `phenotype-*-framework`

| Rule | Severity | What |
|---|---|---|
| `phenotype-framework/port-trait` | error | ≥ 1 Port trait / interface / protocol |
| `phenotype-framework/adapter-impl` | error | ≥ 1 Adapter impl (`impl X for Y` / `class XAdapter` / `implements X`) |
| `phenotype-framework/ioc-lifecycle` | warning | ≥ 1 Lifecycle / Hook / Plugin / Resolver / Builder |
| `phenotype-framework/architecture-doc` | error | `docs/architecture/` or `ARCHITECTURE.md` exists |

### `federated-service`

| Rule | Severity | What |
|---|---|---|
| `federated-service/deploy-config` | warning | Dockerfile / k8s / compose / Procfile / fly.toml |
| `federated-service/health-endpoint` | error | `/health` / `/healthz` / `/readyz` / `/livez` / `/ready` |

## Exit codes

- **0** — no violations
- **1** — scan error
- **2** — violations found (CI can fail on this)

## CI integration

Add to your repo's `.github/workflows/lint-framework.yml`:

```yaml
name: framework-lint
on: [pull_request]
jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: |
          curl -sSL https://raw.githubusercontent.com/KooshaPari/pheno-framework-lint/main/pheno_framework_lint.py | python3 check --path .
```

## Schema

See `findings/71-pillar-2026-06-17-schema.md` §3.10 (L73 — Substrate graduation
path) for the scoring rubric, and `docs/adr/2026-06-18/ADR-048-substrate-graduation-path.md`
for the policy this tool enforces.

## Related tools

- `pheno-predict` — companion L72 tool (similar-code scanner)
- `pheno-drift-detector` — companion L74 tool (app-substrate drift)

## License

MIT (per `pheno-*` fleet convention).