---
title: "Native Router Backend RFC"
version: 3.9-draft
lastUpdated: 2026-07-03
relatedIssue: "https://github.com/diegosouzapw/OmniRoute/issues/5670"
---

# Native Router Backend RFC

## Summary

Move the native-router workstream forward as a staged 3.9/4.0 backend plan instead of
landing disconnected PRs. The current relay strategy already defines three modes for
`/api/v1/relay/chat/completions`: `ts`, `bifrost`, and `auto`, with `auto` preferring
Bifrost and falling back to the TypeScript path on failure.

This RFC treats Bifrost as the supervised native sidecar path, keeps TypeScript as the
safe control-plane and fallback boundary, and gates router changes with replay-backed
router-eval results.

## Source Anchors

- `docs/reference/RELAY_BACKEND_STRATEGY.md` documents the current relay modes and
  production guidance for `OMNIROUTE_RELAY_BACKEND`.
- `scripts/router-eval/index.ts` already supports JSONL input, SQLite replay input,
  `call_logs`, `usage_history`, comparison baselines, AIQ/cost thresholds, and
  `--fail-on-regression`.
- `src/lib/routerEval/index.ts` defines the normalized router observation, aggregate
  metrics, Pareto frontier, and regression comparison shape.
- `open-sse/services/accountFallback.ts` already handles provider connection cooldown
  normalization around `provider_connections.rate_limited_until`.
- `docs/reference/API_REFERENCE.md` documents resilience and cooldown API surfaces.

## Goals

1. Define one backend contract shared by TypeScript and native sidecar routing.
2. Supervise Bifrost as an embedded service with health, timeout, and fallback telemetry.
3. Consume provider manifest data through a sidecar-safe provider capability contract.
4. Normalize backend cooldown state so TypeScript and native routing make the same
   provider/account availability decisions.
5. Require router-eval replay gates before native-router behavior changes merge.

## Non-Goals

- Replacing the TypeScript route boundary in 3.9.
- Moving authentication, allowlist checks, or DB policy gates into the native sidecar.
- Landing sidecar-only routing without fallback.
- Accepting router behavior changes without replay evidence.

## Proposed Stages

### Stage 1: Contract Freeze

Define a small route decision envelope that both backends can consume and emit:

- request family and normalized model intent
- candidate provider/account identifiers
- selected backend mode: `ts`, `bifrost`, or `auto`
- timeout and fallback policy
- cooldown reads and writes
- opaque telemetry correlation id

Acceptance criteria:

- Contract tests cover TypeScript decision output and Bifrost input payload shape.
- Existing TypeScript behavior remains the source of truth for auth, policy, and
  sanitizer gates.
- No new backend can bypass API-key policy or management auth.

### Stage 2: Supervised Bifrost Sidecar

Run Bifrost as a supervised local service behind `OMNIROUTE_RELAY_BACKEND=auto`.
The TypeScript route remains responsible for deciding when to call the sidecar and
when to fall back.

Acceptance criteria:

- Failed sidecar attempts produce explicit fallback telemetry.
- Sidecar timeouts are bounded and shorter than the request SLO.
- `bifrost` mode can intentionally fail closed, while `auto` mode fails back to
  TypeScript.
- Restart/health behavior is covered by integration tests.

### Stage 3: Provider Manifest Consumption

Introduce a provider capability manifest reader that is safe for sidecar use. The
sidecar should consume normalized provider capabilities, not scrape UI or DB-specific
implementation details directly.

Acceptance criteria:

- Manifest fields are versioned.
- Provider capability changes have snapshot tests.
- Native and TypeScript paths use the same capability names and model identifiers.
- Missing or unknown manifest fields fail conservatively.

### Stage 4: Generic Backend Cooldown State

Unify provider/account cooldown semantics across TypeScript and Bifrost. The system
should distinguish:

- persistent provider/account cooldowns stored on provider connections
- transient combo/model lockouts used for request-local exhaustion
- backend health cooldowns for sidecar availability

Acceptance criteria:

- 429 classification decides whether the failure is provider/account specific or only
  combo/model scoped.
- Provider-specific 429s persist a connection cooldown.
- Combo-only exhaustion never mutates provider-account availability.
- Tests cover current `rate_limited_until` normalization and sidecar parity.

### Stage 5: Router-Eval Merge Gate

Every native-router behavior change must provide a replay-backed router-eval artifact.
The existing CLI already supports SQLite replay sources and comparison thresholds.

Acceptance criteria:

- Candidate and baseline runs can read `call_logs` or `usage_history`.
- PRs include AIQ, success rate, p95 latency, cost, and Pareto frontier deltas.
- `--fail-on-regression` is wired into CI for native-router changes.
- Replay corpora never include raw credentials or sensitive prompt content.

## GitHub Comment Summary

Recommended issue comment:

> I split this into a source-backed 3.9/4.0 RFC draft rather than reopening the
> earlier PR stack directly. The draft keeps TypeScript as the auth/policy boundary,
> treats Bifrost as the supervised sidecar behind `OMNIROUTE_RELAY_BACKEND=auto`,
> separates provider/account cooldowns from transient combo lockouts, and makes
> router-eval replay artifacts the merge gate for native-router behavior changes.
> Next PR should be contract tests for the shared route decision envelope, not the
> full sidecar migration.
