# Paginary — Boundary

> Stub boundary file generated on 2026-06-18 by `scripts/render-stubs.py`
> for canonical repos with no curated prompts yet.

## In Scope

- Federated VitePress multi-app hub aggregating 4 pillars (Handbook, Specs, X-DD, Journeys) into one navigation surface
- Shared `paginary-theme` package (CSS baseline, fonts, dark-mode, WCAG 2.1 AA) consumed by all 4 sub-sites
- Turbo + Bun workspace orchestration for parallel builds and incremental task execution
- Content sync (copy, not move) from source repos so the originals remain authoritative
- Unified navbar, global search, and sidebar switching across the 4 sub-sites

## Out of Scope

| Not here | Lives in | Reason |
| -------- | -------- | ------ |
| Canonical handbook content | `PhenoHandbook` | PhenoHandbook is the single source of truth; Paginary is a read-only mirror |
| Canonical spec / ADR / design-doc content | `PhenoSpecs` | ADRs and feature specs are authored in PhenoSpecs; Paginary only renders |
| BDD / TDD / QA governance utilities | `phenoXdd` | xDD is the canonical home for test methodology content; Paginary is its doc shell |
| User-flow / journey authoring | `phenotype-journeys` | Journey definitions live in phenotype-journeys; Paginary surfaces them |
| Doc-site build/serve for non-Phenotype orgs | N/A | Paginary is an internal collection, not a general-purpose SSG |

## Crossings

| Crossing | Direction | Surface | Status |
| -------- | --------- | ------- | ------ |
| Handbook content mirror | this-repo→PhenoHandbook | File copy (VitePress content dir) | green |
| Specs content mirror | this-repo→PhenoSpecs | File copy (VitePress content dir) | green |
| XDD content mirror | this-repo→phenoXdd | File copy (VitePress content dir) | green |
| Journeys content mirror | this-repo→phenotype-journeys | File copy (VitePress content dir) | green |
| Theme tokens | this-repo→phenodocs | Shared CSS / TS exports | amber — coordination with phenodocs design system pending |

## Review cadence

Weekly per ADR-024. Refresh by `scripts/render-per-repo.py --force`
once any prompt binds to this repo.

## Source-of-Truth

- ECOSYSTEM_MAP.md § 6 (role classification)
- docs/intent/Paginary.md (intent statement)
- docs/registries.md (Capability & Intent SSOT layer)
