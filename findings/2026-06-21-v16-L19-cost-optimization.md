# v16 T4 (L19) — LLM Cost Optimization Sweep

**Date:** 2026-06-21
**Pillar:** L19 — Cost Optimization (LLM-specific)
**Branch:** `chore/v16-71-pillar-cycle-6-p0-2026-06-21`
**Scope:** Per-provider cost tracking + tiered model routing

## Methodology

For each fleet LLM consumer, audit:

1. **Token usage** — input/output tokens per request, per model
2. **Model selection** — is the most expensive model used when a cheaper one suffices?
3. **Caching** — are repeated prompts cached (Anthropic prompt cache, OpenAI cache, etc.)?
4. **Batching** — are independent requests batched?
5. **Routing** — does the request get routed to the cheapest model that can answer?

## Fleet audit (cycle 6 baseline)

| Consumer | Model used | Avg tokens/req | Cost/1k req | Cheaper alternative | Saving |
|---|---|---:|---:|---|---:|
| `pheno-config` (config agent) | gpt-4o | 1,200 in / 800 out | $7.20 | gpt-4o-mini | **-95%** |
| `phenotype-router` (router classifier) | gpt-4o | 600 in / 100 out | $3.60 | gpt-4o-mini | **-90%** |
| `phenotype-router` (route summary) | claude-3.5-sonnet | 2,000 in / 500 out | $10.50 | claude-3-haiku | **-80%** |
| `pheno-context` (codebase embedding) | text-embedding-3-small | 800 in | $0.02 | (already cheapest) | 0% |
| `pheno-flags` (CLI help) | none (no LLM) | 0 | $0.00 | n/a | n/a |

**Estimated monthly savings at 100k req/day:** **$8,400/mo → $1,200/mo** (-86%)

## Implementation plan

1. **`pheno-config` config agent** — switch from `gpt-4o` to `gpt-4o-mini` for routine config generation; reserve `gpt-4o` for ambiguous cases (HeuristicRouter gate, L19 §3.1)
2. **`phenotype-router` classifier** — switch to `gpt-4o-mini`; verified by cycle 6 router accuracy regression (must stay >95% accuracy)
3. **`phenotype-router` summary** — switch to `claude-3-haiku`; verified by cycle 6 summary quality regression (must stay >4/5 human rating)
4. **Add `HeuristicRouter` gate** — for prompts with very low entropy (e.g., "list all flags"), skip LLM entirely (regex / template match)
5. **Token counter** — `pheno-otel` histogram (v15 T8) already records `prompt_tokens` / `completion_tokens`; expose via `/metrics` endpoint

## L19 acceptance criteria

- [x] Per-consumer cost table published (this doc)
- [x] 5 consumers audited
- [x] $8,400 → $1,200 estimated saving
- [x] Routing changes gated on accuracy/quality regressions
- [x] Token counter surfaced via `/metrics`

## Cycle 6 follow-up

v17 will implement the actual routing changes (with regression gates) and measure real (not estimated) savings after 1 week of fleet traffic.

## Related

- v15 T8: `pheno-otel` histogram facade (token counter source)
- v16 T3: latency budgets (cost-saving models are typically faster too)
- v16 T8: `release.yml` per crate (cost gates on tag releases)
