# Intent synthesis — phenotype-registry

> Generated from prompt provenance in `prompts/`. Last updated: 2026-06-17.

## Themes (from prompts)

### Theme: Fleet archive audit with domain roles

**Prompts:** [cursor/20260617-b561a593-...](prompts/cursor/20260617-b561a593-1729-44da-b90d-0cfbdf9d72ef-t1.md)

**User language (paraphrase with citations):**

- "audit each w/ suts … delete must have absorption target that has 100% of the boundary covered" — fleet audit thread
- "HexaKit genesis/scaffolding only — not Rust crate junk drawer" — domain role reframe
- "zero shots or zero loops" — AX optimization goal

## Confirmed goals

1. **Domain role SSOT** — `DOMAIN_ROLES.md` + `LANGUAGE_PLACEMENT.md` per [#77](https://github.com/KooshaPari/phenotype-registry/pull/77)
2. **Kit reconcile then delete** — TestingKit/ResilienceKit/ObservabilityKit absorbed into python-sdk; registry #81 retired
3. **RFC migrations** — Traceon→observe, Settly→phenotype-config per [#82](https://github.com/KooshaPari/phenotype-registry/pull/82)

## Inferred goals

| Inferred goal | Evidence | Action taken | Validate? |
|---------------|----------|--------------|-----------|
| Manager checks open PRs before spawn | duplicate genesis subagents | preflight in plan v2 | pending |
| AgilePlus FR-GENESIS links on genesis PRs | STANDARD.md traces | pending fleet rollout | pending |

## Conflicts / tensions

| Tension | Resolution |
|---------|------------|
| RATIONALIZATION_PLAN "never delete" vs 100% delete policy | ADR-017 (proposed): delete at 100% + registry retired |
| HexaKit as crate home vs genesis-only | RFC 001/002 evict domain crates |

## Recommended next actions

1. Batch 3 archive audits (12 parallel lanes) — per reconcile SOP
2. Create `phenotype-config` repo — RFC 002
3. Scrape every manager session end → `docs/intent/prompts/`
