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
