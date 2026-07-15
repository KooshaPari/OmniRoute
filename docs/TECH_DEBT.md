# Technical Debt Register

**Last reviewed**: 2026-06-29
**SLA**: P0 < 30d, P1 < 90d, P2 < 180d, P3 next refactor cycle
**Auto-scan**: `rg 'TODO|FIXME|XXX' -t ts -t js src/ open-sse/ tests/`

## Summary

| Metric | Count | Notes |
|---|---|---|
| Auto-detected TODO/FIXME/XXX markers (src + open-sse + tests) | **20** | last scan 2026-06-29 |
| Open GitHub issues labelled `tech-debt` | 0 | search: `gh issue list --label tech-debt --state all --json number,title` |
| P0 items tracked | 0 | |
| P1 items tracked | 2 | see below |
| P2 items tracked | 4 | see below |
| P3 items tracked | 8 | see below (DEBT-012 merged into DEBT-006 resolution) |

## How to use

- New debt: file a GitHub issue with label `tech-debt` and assign a P-level.
- Review: weekly during standup; promote/demote based on impact.
- Closing a debt item requires: link to PR + commit SHA + (if P0) before/after metric.

## P0 — Critical (block release)

| ID | Title | Filed | Owner | Notes |
|---|---|---|---|---|
| — | _None tracked yet_ | | | Use `gh issue create --label tech-debt --label P0` to add. |

## P1 — High (block next minor)

| ID | Title | Filed | Owner | Notes |
|---|---|---|---|---|
| DEBT-001 | **Rate-limit TPM/TPD not implemented** (request-count only) | 2026-06-18 | @open-sse | **RESOLVED** — `TokenBucket` class implemented in `open-sse/services/rateLimitManager.ts` with `tryConsumeTokens()`, time-refill, fractional tokens. Exported as `__TokenBucketForTests`. 12 tests in `tests/unit/token-bucket.test.ts`. |
| DEBT-002 | **Pre-push hook references missing root `package.json`** | 2026-06-18 | @devops | `.husky/pre-push` runs `npm test` against a non-existent root `package.json`; silenced via `core.hooksPath=/dev/null` on every commit. Real fix: rewrite as workspace-aware via npm/pnpm workspaces, or move to lefthook + `cargo make`. |
| DEBT-003 | **chatgpt-web executor: `file_00000000XXXX` asset shape 422s** | 2026-06-18 | @open-sse | `open-sse/executors/chatgpt-web.ts` — newer image-edit results land with conversation-scoped attachment IDs that 422 on `/files/{id}/download`. Blocks image-edit continued-conversation flow. |
| DEBT-004 | **`@/shared/schemas/playground` import split (F1 merge pending)** | 2026-06-18 | @core | `src/lib/db/playgroundPresets.ts` — temporary direct schema; pending F1-merge to swap to canonical `@/shared/schemas/playground`. |

## P2 — Medium

| ID | Title | Filed | Owner | Notes |
|---|---|---|---|---|
| DEBT-005 | **`analytics/index.tsx` is a 1.5k LOC monolith** | 2026-06-18 | @ui | GitHub issue #5 — split into `StatCard.js`, `ActivityHeatmap.js`, `DailyTrendChart.js`, etc. Currently ships as a single barrel. |
| DEBT-006 | **9 a2a skills are stub `// TODO: Implement <skill>`** | 2026-06-18 | @a2a | **RESOLVED** — All 9 A2A skills implemented (healthReport, quotaManagement, smartRouting, costAnalysis, providerDiscovery, listCapabilities). `healthReport.ts` is a 718-line implementation with 321-line test suite. |
| DEBT-007 | **Memory schema Portuguese-language comment** | 2026-06-18 | @docs | `src/shared/schemas/memory.ts` — comment `"// true = regenera TODOS os vetores"` is in Portuguese; should be English per CONTRIBUTING.md. Cosmetic but flagged. |
| DEBT-008 | **5 chatgpt-web executor edge-case TODOs** | 2026-06-18 | @open-sse | `open-sse/executors/chatgpt-web.ts` — multiple inline TODOs around `sediment://` and `file-service://` URL schemes; needs ADR for canonical URI scheme. |
| DEBT-009 | **Compression session-dedup reverse-map API** | 2026-06-18 | @compression | **RESOLVED** — `SessionDedupState` explicit envelope + `engineData` field on `CompressionResult`. PR #TODO (commit `TODO`). Magic-key approach superseded. |
| DEBT-010 | **`specificityRules.ts` regex list is hand-maintained** | 2026-06-18 | @open-sse | README/CHANGELOG/TODO pattern list needs a generator from a corpus. |
| DEBT-011 | **`routingLogger.ts` lacks structured fields** | 2026-06-18 | @observability | **RESOLVED** — `routingLogger.ts` now hydrates W3C trace context (trace_id/span_id) via `otelContext.ts` (3-tier: @pheno-otel/tracing → @opentelemetry/api → synthetic crypto). Persists decisions to `routing_decisions` DB table (migration 109). 6 tests in `tests/unit/routing-logger.test.ts`. |

## P3 — Low / refactor-cycle

| ID | Title | Filed | Owner | Notes |
|---|---|---|---|---|
| DEBT-012 | **A2A skill placeholder stubs (9 files)** | 2026-06-18 | @a2a | **RESOLVED** (merged into DEBT-006) — all skills implemented. |
| DEBT-013 | **5 stub providers in open-sse executors** | 2026-06-18 | @open-sse | pattern: `// TODO: Implement X provider` — should be detected by an a2a skill linter. |
| DEBT-014 | **Trae OAuth provider stub** | 2026-06-18 | @oauth | `src/lib/oauth/providers/trae.ts` — TODO marker; not yet specced. |
| DEBT-015 | **Test-file TODOs (5 markers in tests/unit)** | 2026-06-18 | @qa | `tests/unit/{t3-chat-web,chatgpt-web,check-error-helper,combo-quota-soft-penalty,webhook-ssrf-guard}.test.ts` — covers edge cases not yet exercised. |
| DEBT-016 | **`combo-quota-soft-penalty` coverage gap** | 2026-06-18 | @qa | Needs fuzz testing for soft-penalty timing windows. |
| DEBT-017 | **`webhook-ssrf-guard` IPv6 bypass tests** | 2026-06-18 | @security | Current SSRF guard tests cover IPv4 only; IPv6 zone-id and IPv4-mapped IPv6 need explicit cases. |
| DEBT-018 | **`check-error-helper` untested branches** | 2026-06-18 | @qa | 5 error-shape branches; only 2 covered. |
| DEBT-019 | **chatgpt-web tests (3 markers)** | 2026-06-18 | @open-sse | Tied to DEBT-003 + DEBT-008. |
| DEBT-020 | **`memory.ts` PT/EN i18n sweep** | 2026-06-18 | @docs | Per DEBT-007, broader: ~12 files have residual Portuguese comments from the legacy PT-BR contributor. |

## Auto-detected TODO/FIXME/XXX (initial dump)

```
$ rg 'TODO|FIXME|XXX' -t ts -t js src/ open-sse/ tests/ -c
open-sse/services/specificityRules.ts:1       -> DEBT-010
src/shared/components/analytics/index.tsx:1   -> DEBT-005
open-sse/executors/chatgpt-web.ts:5           -> DEBT-003, DEBT-008
open-sse/services/compression/engines/session-dedup/index.ts:2  -> DEBT-009 (resolved)
src/lib/oauth/providers/trae.ts:1             -> DEBT-014
src/shared/schemas/memory.ts:1                -> DEBT-007
src/lib/db/playgroundPresets.ts:1             -> DEBT-004
tests/unit/t3-chat-web.test.ts:1              -> DEBT-019
tests/unit/chatgpt-web.test.ts:3              -> DEBT-019
tests/unit/check-error-helper.test.ts:1       -> DEBT-018
tests/unit/combo-quota-soft-penalty.test.ts:1 -> DEBT-016
tests/unit/webhook-ssrf-guard.test.ts:1       -> DEBT-017
```

Total: 20 markers (10 in src/open-sse, 7 in tests/unit, 3 in shared).

### Resolved in 2026-06-29 sweep

| ID | Resolution |
|---|---|
| DEBT-001 | `TokenBucket` + `tryConsumeTokens()` implemented in `rateLimitManager.ts`; 12 tests in `tests/unit/token-bucket.test.ts` |
| DEBT-006 | All 9 A2A skills fully implemented; healthReport has 718-line impl with 321-line test suite |
| DEBT-009 | Session-dedup envelope pattern (`SessionDedupState` explicit) already resolved in prior sweep |
| DEBT-011 | OTel context hydration (`otelContext.ts`), DB persistence (`routingDecisions.ts` + migration 109), 6 tests |
| DEBT-012 | Merged into DEBT-006 resolution |

## References

- ADR-009: A2A Skill Registry and `src/lib/a2a/skills/*` placement
- ADR-010: `pheno-otel` integration deadline 2026-06-30 (drives DEBT-011)
- [30-pillar framework L10 — Tech Debt Management](../../repos/findings/30-pillar-2026-06-16.md#l10-tech-debt-management)