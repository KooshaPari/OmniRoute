# ADR-ECO-017: Substrate schema conventions — tier + port/adapter naming

**Status:** Accepted (2026-06-20)
**Deciders:** forge subagent (T23 dispatch), worklog-schema circle
**Refs:** monorepo ADR-013 (pheno-mcp-router substrate model),
monorepo ADR-014 (Hexagonal L4 ports + Adapters),
monorepo ADR-023 (agent-effort governance),
monorepo ADR-040 (test-coverage gates per tier),
monorepo ADR-048 (substrate graduation path),
registry ADR-ECO-014 (decompose phenoShared).

## Context

The Phenotype fleet has ~50+ polyglot sub-repos and a growing number of
**substrate repos** — re-usable libraries/SDKs/frameworks/federated
services that other fleet repos depend on. Two pieces of substrate
governance have been authored in the monorepo's `docs/adr/2026-06-15/`
namespace (ADR-013 and ADR-014) but were never reflected as **catalog
schema requirements** in this registry. As a result:

- `catalog/registry.yaml` had no existence at all (only
  `ECOSYSTEM_MAP.md` and `BOUNDARY_OWNERS.md` carried the substrate
  list, neither machine-validated).
- Boundary entries in `docs/boundary/` had `role: unknown` (no
  classification) — there was no schema enforcing a `tier` field.
- Hexagonal L4 port/adapter names drifted across substrates (e.g. one
  repo used `*Provider`, another used `*Sink`, another used `*Adapter`)
  with no shared convention.

This ADR ports ADR-013 (substrate model) and ADR-014 (hexagonal
port-adapter naming) into the registry catalog as **enforced schema
requirements** rather than prose conventions.

## Decision

1. **`catalog/registry.yaml` is the canonical substrate catalog.** A new
   file, structured YAML, listing every substrate repo with the fields
   described below. Validated by `scripts/validate-catalog.py` on every
   PR via `.github/workflows/registry-validate.yml`.

2. **Required schema fields (per substrate entry):**

   | Field | Required when | Allowed values |
   |---|---|---|
   | `id` | always | `^[a-z0-9-]+$` (unique slug) |
   | `repo` | always | `^KooshaPari/<name>$` |
   | `name` | always | human-readable repo name |
   | `status` | always | `active`, `archived`, `deprecated`, `absorbed` |
   | `tier` | always | `pheno-lib`, `phenotype-sdk`, `phenotype-framework`, `federated-service` |
   | `architecture` | tier = `phenotype-framework` | `hexagonal-l4`, `layered`, `microkernel`, `none` |
   | `ports` | architecture = `hexagonal-l4` | list of `*Port` trait names |
   | `adapters` | architecture = `hexagonal-l4` | list of `*Adapter` impl names |
   | `language` | always | `rust`, `python`, `typescript`, `go`, `swift`, `zig`, `mojo` |
   | `role` | always | domain role per DOMAIN_ROLES.md |
   | `boundary` | optional | relative path to `docs/boundary/<id>.md` (or `null`) |
   | `intent` | optional | relative path to `docs/intent/<id>.md` (or `null`) |
   | `notes` | optional | free-form context |

3. **Tier classification (ported from monorepo ADR-013 + ADR-023):**

   | Tier | Definition | Examples (canonical substrate) |
   |---|---|---|
   | `pheno-lib` | Pure reusable library; single concern; language-specific | `pheno-config`, `pheno-context`, `pheno-port-adapter` (and Configra's four sub-crates) |
   | `phenotype-sdk` | Cross-language SDK; stable public API; polyglot facade | `phenotype-go-sdk`, `phenotype-python-sdk` |
   | `phenotype-framework` | IoC framework; opinionated lifecycle; ports; adapters | `phenotype-hub`, `phenotype-bus` |
   | `federated-service` | Stateful; long-running; independently scalable | `pheno-mcp-router`, `phenotype-otel`, `phenotype-events` |

   Every substrate entry MUST declare exactly one tier. The tier drives
   coverage gates in ADR-040 (80 % lib / 70 % framework / 60 % service).

4. **Hexagonal port/adapter naming (ported from monorepo ADR-014):**

   - A `Port` trait name MUST end in `Port` (CamelCase): `LlmPort`,
     `CostPort`, `McpPort`, etc. No `*Provider`, `*Sink`, `*Interface`.
   - An `Adapter` impl name MUST end in `Adapter` (CamelCase):
     `LlamaAdapter`, `OpenAICompatAdapter`, `AnthropicAdapter`. No
     `*Impl`, `*Concrete`, `*Real`.
   - One `Port` MAY have N `Adapter`s. Each adapter is a separate file
     in `adapters/` (Rust) or equivalent per-language convention.

5. **Validation surface:**

   - `scripts/validate-catalog.py` is the offline validator.
   - `.github/workflows/registry-validate.yml` runs it on every PR.
   - `catalog/registry.schema.json` is the JSON Schema document (for
     tools that prefer JSON Schema to Python validation rules).

## Consequences

- The "catalog" directory is born; the registry now has BOTH a
  machine-readable catalog (`catalog/registry.yaml`) and the
  human-readable index (`ECOSYSTEM_MAP.md`, `BOUNDARY_OWNERS.md`).
- Substrate entries that pre-date this ADR may have `boundary: null` /
  `intent: null`; the validator emits a `WARN` (not `FAIL`) for missing
  files so existing entries stay valid until the docs are written.
- Tier classification becomes the gate that `phenotype-framework-lint`
  (L73, monorepo ADR-048) reads from this registry rather than guessing
  per-repo.
- Hexagonal port/adapter naming becomes a fleet-wide convention; new
  ports that don't end in `Port` will be rejected at PR review.

## Migration

- **Wave 1 (this PR, T23, 2026-06-20):** 3 entries — Configra,
  pheno-tracing, pheno-mcp-router. Configra has full docs; the other
  two are `archived` so `boundary: null` is acceptable.
- **Wave 2 (planned, T23-P2):** add remaining active pheno-* repos.
- **Wave 3 (planned, T23-P3):** add phenotype-sdk and
  phenotype-framework entries.

## Related

- [catalog/registry.yaml](../../catalog/registry.yaml)
- [catalog/registry.schema.json](../../catalog/registry.schema.json)
- [scripts/validate-catalog.py](../../scripts/validate-catalog.py)
- [.github/workflows/registry-validate.yml](../../.github/workflows/registry-validate.yml)
- [docs/boundary/Configra.md](../boundary/Configra.md)
- [docs/intent/Configra.md](../intent/Configra.md)
- monorepo ADR-013 — pheno-mcp-router substrate model
- monorepo ADR-014 — Hexagonal L4 ports + Adapters
- monorepo ADR-023 — agent-effort governance
- monorepo ADR-040 — test-coverage gates per tier
- monorepo ADR-048 — substrate graduation path
