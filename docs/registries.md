# Registry Reference

## PhenoSpecs

Use PhenoSpecs when the question is about what should be built.

- Specifications by domain
- Architecture decisions
- OpenAPI contracts
- Traceability from requirement to implementation

## PhenoHandbook

Use PhenoHandbook when the question is about how Phenotype software should be
designed or operated.

- Patterns and anti-patterns
- Coding and operational guidelines
- Methodologies such as TDD, BDD, and DDD
- Review checklists and release practices

## HexaKit

Use HexaKit when the question is about scaffolding a new repo or repeated
project structure.

- Language templates
- Project templates
- Architecture templates
- Template registry metadata

## Registry Flow

1. Specs define desired behavior.
2. Handbook patterns explain the preferred implementation model.
3. HexaKit templates scaffold projects that follow those patterns.
4. Implementation repos link back to the source spec and pattern decisions.
5. Every implementation repo carries `docs/intent/` + `docs/boundary/` propagated from this registry via `scripts/propagate-intent-to-repos.py` (L7+ addendum).

## Archive Migration Redirects (2026-06-16)

Deleted or absorbed source repos retain history in `projects/*.json` with `absorbed_into` and `absorption_note`. Resolve capabilities at the canonical owner:

| Retired source | Canonical owner |
|----------------|-----------------|
| phenoVessel | [PhenoPlugins/pheno-plugin-vessel](https://github.com/KooshaPari/PhenoPlugins) |
| phenoTypes | [phenotype-types](https://github.com/KooshaPari/phenotype-types) |
| phenoPatch, Diffuse | [phenotype-tooling/phenotype-diff](https://github.com/KooshaPari/phenotype-tooling) |
| Servion | [phenotype-tooling/phenotype-service-registry](https://github.com/KooshaPari/phenotype-tooling) |
| Guardrail | [phenotype-tooling/phenotype-resilience](https://github.com/KooshaPari/phenotype-tooling) |
| Cryptora | [phenoUtils/pheno-crypto](https://github.com/KooshaPari/phenoUtils) |
| forge, phenoForge | [Tasken](https://github.com/KooshaPari/Tasken) |
| router-docs | [OmniRoute/docs/research/archive/router-docs/](https://github.com/KooshaPari/OmniRoute/tree/main/docs/research/archive/router-docs) |

## phenotype-registry (this repo) — Capability & Intent SSOT

This registry is not just a redirect table — it is the canonical **capability & intent** source of truth for every implementation repo in the fleet. It owns the per-repo intent + boundary contract that every other repo is expected to mirror.

Contracts and templates:

- [`docs/intent/README.md`](./intent/README.md) — the intent contract (what each `docs/intent/<repo>.md` must contain)
- [`docs/boundary/_template.md`](./boundary/_template.md) — the boundary contract (what each `docs/boundary/<repo>.md` must contain)
- [`docs/curated-prompts/{claude-code,codex,cursor-agent,forge,droid,aider,other}/<YYYY-MM>/<id>.md`](./curated-prompts/) — the curated prompt corpus, partitioned by source agent and month
- [`ALIASES.md`](./ALIASES.md) — the canonical-name registry (46 entries; resolves legacy names, retired names, and rename chains to the current canonical repo)
- [`PROGRESS-REPORT.md`](./PROGRESS-REPORT.md) and [`FINAL-L7-001-004-REPORT.md`](./FINAL-L7-001-004-REPORT.md) — L7-001..L7-004 execution reports
- [`PUSH-STATUS.md`](./PUSH-STATUS.md) — the push-state doc (per-repo push outcome, retry queue, and remaining backpressure)
- [`docs/prompts-to-intent.crosswalk.md`](./prompts-to-intent.crosswalk.md) — the gap reconciliation between the curated prompt corpus and the per-repo intent files

Scripts that maintain the SSOT:

- [`scripts/scrape.py`](./scripts/scrape.py) — scrape the curated prompt corpus from each source agent's local store
- [`scripts/run-windows.sh`](./scripts/run-windows.sh) — driver for the Windows-side scrape (run over Tailscale SSH from `kooshapari-desk`)
- [`scripts/render-per-repo.py`](./scripts/render-per-repo.py) — render `docs/intent/<repo>.md` and `docs/boundary/<repo>.md` from the curated corpus + ALIASES
- [`scripts/propagate-intent-to-repos.py`](./scripts/propagate-intent-to-repos.py) — push the rendered per-repo intent + boundary files into every implementation repo
- [`scripts/resolve-collision.py`](./scripts/resolve-collision.py) — detect and resolve canonical-name collisions across legacy names
- [`scripts/render-stubs.py`](./scripts/render-stubs.py) — render the rich-media stubs in this `registries.md` and other registry docs

Coverage:

- Per-repo `docs/intent/<repo>.md` and `docs/boundary/<repo>.md` exist for every repo bound by the L7-001 sweep. **122 per-repo intent + 121 per-repo boundary files committed.**
- Curated corpus: **45,091 records** bound to **108 repos** (Mac + Windows via Tailscale SSH to `kooshapari-desk`). Sources: `claude-code`, `codex`, `cursor-agent`, `forge`, `droid`, `aider`, `other`.

## Boundary owners and rationalization

Use phenotype-registry when the question is **who owns this capability** or **what merges next**.

- [`BOUNDARY_OWNERS.md`](https://github.com/KooshaPari/phenotype-registry/blob/main/BOUNDARY_OWNERS.md) — scaffold vs SDK vs domain workspace; delete gate
- [`ZERO_LOOP_ECOSYSTEM_PLAN.md`](./rationalization/ZERO_LOOP_ECOSYSTEM_PLAN.md) — master DAG, phases, metrics
- [`ECOSYSTEM_DAG.md`](./rationalization/ECOSYSTEM_DAG.md) — 20-lane parallel recipe
- [`SESSION_ARTIFACT_PROTOCOL.md`](./rationalization/SESSION_ARTIFACT_PROTOCOL.md) — agent session folders
- [`RATIONALIZATION_EXECUTION.md`](https://github.com/KooshaPari/phenotype-registry/blob/main/RATIONALIZATION_EXECUTION.md) — merge order + archive shortlist

**AgilePlus** owns spec lifecycle; **phenokits-commons** owns governance templates; this repo owns boundary SSOT.

---

## Rich Media Stubs

<!-- RICH-MEDIA-STUB type="recording-gif" subject="Registry lookup workflow — finding a canonical source of truth" journey="" status="TODO" -->
> **[RICH MEDIA PLACEHOLDER]** *GIF walkthrough of navigating from Registry Reference to the correct canonical repo.*
<!-- END-RICH-MEDIA-STUB -->
