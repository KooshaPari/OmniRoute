---
repo: "phenotype-landing"
aliases:
  - "phenotype-landings"
  - "phenotype-sites-factory"
role: landing
status: archived
last_verified: 2026-07-17
bound_prompts: 6
bound_plans: 0
bound_responses: 0
device: macbook
---

# Intent — phenotype-landing

## Intent Statement

This repo was the **multi-tenant Astro landing site factory** for the
Phenotype org, hosting 7 independently deployable marketing sites
(`sites/{agileplus,byteport,hwledger,phenokits,projects,thegent}-landing` Astro
+ Bun; `sites/odin-landing` static HTML). On 2026-07-17 the absorption audit
rejected moving the source into `phenodocs/packages/landing/` (architectural
mismatch + build-heavy failsafe clause) and pivoted to **ARCHIVE_ONLY**:
source repo archived on GitHub, registry row set to `disposition=ARCHIVE_ONLY`,
and a forward-pointer README at `phenodocs/packages/landing/` records the
deferred absorption decision for future re-evaluation.

The repo is bound to 6 historical prompts, 0 plans, and 0 agent responses
captured between 2025-08 and 2026-06-17.

## Bound Prompts

| Date | Source | File | Tag |
| ---- | ------ | ---- | --- |
| ? | claude-code | `docs/curated-prompts/claude-code/unknown/7616957c93210afb.md` | implementation |
| ? | claude-code | `docs/curated-prompts/claude-code/unknown/1f61d91a504ba2e7.md` | implementation |
| ? | claude-code | `docs/curated-prompts/claude-code/unknown/c536ef6952ec7e22.md` | implementation |
| ? | claude-code | `docs/curated-prompts/claude-code/unknown/609348151d93bd4c.md` | policy-setting |
| ? | claude-code | `docs/curated-prompts/claude-code/unknown/96ec374c8ef87ef2.md` | narrative |
| ? | claude-code | `docs/curated-prompts/claude-code/unknown/0fafe6be9c0714c0.md` | repo-defining |

## Bound Plans

| Date | Source | File | Status |
| ---- | ------ | ---- | ------ |

## Bound Responses (specs, ideas, plans from agents)

| Date | Source | File | Kind |
| ---- | ------ | ---- | ---- |

## Boundary

See: [`docs/boundary/phenotype-landing.md`](../boundary/phenotype-landing.md)

## Ecosystem Role

`phenotype-landing` was a **landing archetype** in the substrate catalog
(`catalog/registry.yaml` row `phenotype-landing`; `archetype: landing`,
`tier: pheno-lib`, `language: typescript`, `role: landing`). The 7 sites under
`sites/` were the canonical marketing surfaces for the org's products
(AgilePlus, BytePort, HwLedger, Phenokits, Projects hub, TheGent) and one
external project (Odin). Subtree-pull reversibility was preserved on per-site
branches.

After the 2026-07-17 ARCHIVE_ONLY pivot, the row's `status` is `archived` and
the disposition is `ARCHIVE_ONLY` (see `registry/disposition-index.json`).

## Open Questions

- Will a future `phenotype-sites` monorepo replace this role? (TBD)
- Should each site be decomposed into a stand-alone `phenodocs/packages/landing-{name}/`
  workspace package? (TBD)
- Is the `packages/design-tokens` subtree re-pullable? (Already absorbed into
  `phenodocs/packages/design-tokens`; re-pull would need deconfliction.)

## Change Log

| Date | Change | Worklog |
| ---- | ------ | ------- |
| 2026-06-17 | Initial binding (L7-001 sweep) | `worklogs/L7-001-intent-boundary-curation-2026-06-17.json` |
| 2026-07-17 | ARCHIVE_ONLY pivot; absorption rejected; source archived; forward-pointer at `phenodocs/packages/landing/` | `audits/absorption-justifications/phenotype-landing-deferred-2026-07-17.md` |