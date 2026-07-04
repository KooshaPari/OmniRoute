# Native Router Workstream RFC

Status: proposed
Tracker: https://github.com/diegosouzapw/OmniRoute/issues/5670
Related PRs: #6071, #6079, #6081, #6083

## Problem

OmniRoute already has mature combo routing, provider cooldown, usage history, and
compression evaluation surfaces. The native-router backlog should not land as
independent helper PRs until the maintainer accepts a staged contract for how those
surfaces fit together.

The current deferred slices are:

- #6071: router evaluation gate using retained replay/evaluation output.
- #6079: backend failure/cooldown state helper keyed by backend identity.
- #6083: provider plugin manifest HTTP client for sidecars and native backends.
- #6081: backend migration plan for the native-router workstream.

## Goals

- Define the order that turns the deferred PRs into a single 3.9/4.0 workstream.
- Keep existing combo routing behavior stable while native backends are introduced.
- Require measurable routing quality gates before routing selection changes.
- Keep provider cooldown semantics explicit across combo targets and future native backends.
- Avoid adding a new provider manifest path until its trust and cache boundaries are clear.

## Non-Goals

- Do not replace current combo routing in one release.
- Do not change provider credential storage or encryption as part of the first native-router slice.
- Do not persist transient combo failures as provider-wide cooldowns without provider-specific evidence.
- Do not introduce a sidecar manifest client as an implicit security boundary.

## Current Source Anchors

- Combo cascade and live combo events are surfaced through `src/hooks/useLiveDashboard.ts`.
- Provider cooldown and combo-live behavior are exercised by
  `scripts/test/combo-live-vps.mjs`.
- Provider connection data is stored in `provider_connections`, referenced by
  `scripts/dev/sync-env.mjs`.
- Usage and call-log history are documented around `usage_history` and `call_logs` in
  `docs/ops/DATABASE_GUIDE.md`.
- Compression evaluation already has a CLI entrypoint in `scripts/compression-eval/index.ts`.
- Session cooldown state exists in `open-sse/services/sessionPool/session.ts`.

## Proposed Stages

### Stage 0: Contract and Fixture Inventory

Before code changes, document the native-router boundary:

- Inputs: request metadata, provider/model candidates, account health, usage history.
- Outputs: ordered backend candidates, rejection reasons, selected backend, fallback history.
- State that can affect future calls: provider/account cooldown, circuit-breaker state,
  usage aggregates, and explicit user policy.

Exit criteria:

- The router contract can be tested without live provider credentials.
- Existing combo routing remains the default.
- Every new persisted field has an owner and a rollback plan.

### Stage 1: Evaluation Gate

Land the #6071 class of work first, but only as a read-only gate:

- Replay retained request/call history.
- Produce scorecards for current routing behavior.
- Track regressions before native routing can select traffic.
- Fail the gate only on deterministic fixtures, not on live-provider variance.

Exit criteria:

- A maintainer can run the gate locally without secrets.
- The report explains which routing decision changed and why.
- No production routing path depends on the new evaluator yet.

### Stage 2: Backend State Model

Land the #6079 class of work after the gate exists:

- Normalize backend failure and cooldown state behind a single helper.
- Keep provider/account cooldown distinct from transient combo-target failure.
- Preserve current `provider_connections` semantics unless an issue provides raw
  provider evidence requiring a broader cooldown classification.

Exit criteria:

- Tests cover provider-wide cooldown, account-specific cooldown, and transient target failure.
- Existing combo behavior remains unchanged unless the new helper is explicitly enabled.
- The data model avoids ambiguous "backend" IDs that cannot be mapped back to a provider/account.

### Stage 3: Provider Manifest Client

Land the #6083 class of work only after Stage 2 defines backend identity:

- Treat manifests as untrusted input.
- Validate provider IDs, model IDs, endpoint URLs, and capability flags.
- Cache manifests with explicit TTL and failure behavior.
- Do not allow a manifest to override credential, egress, or auth policy.

Exit criteria:

- Manifest parsing is covered by fixtures for missing, malformed, stale, and hostile input.
- Network fetch failures do not block existing configured providers.
- The manifest client does not become a hidden bypass around provider config.

### Stage 4: Native Backend Migration Plan

Land the #6081 class of work as the release plan:

- 3.9: evaluator and state helper ship behind non-routing paths.
- 3.9.x: manifest client ships as opt-in discovery only.
- 4.0: native-router selection can become eligible after scorecard parity.

Exit criteria:

- Rollout can be disabled without schema rollback.
- Dashboards show current route, candidate order, and fallback reason.
- Known rollback path is documented before native-router selection is enabled.

## Acceptance Gates

- No route-selection change lands without a deterministic replay fixture.
- No provider cooldown behavior changes without a unit test and, when provider-specific,
  a captured raw upstream status/body/header sample.
- No manifest-sourced backend is eligible until validation and trust boundaries are tested.
- No dashboard-visible state is added without a stable event/field owner.

## Risks

- A native-router slice could accidentally change combo semantics before the evaluation gate exists.
- Backend identity could collapse provider/account/model into one key and make cooldowns too broad.
- Manifest discovery could become a policy bypass if it is treated as trusted configuration.
- Live-provider tests can be flaky; deterministic fixtures must remain the release gate.

## Recommended Next PR Order

1. RFC-only PR for this document.
2. Rebase #6071 as a read-only evaluator/gate PR.
3. Rebase #6079 as a backend state helper with no default routing behavior change.
4. Rebase #6083 as a manifest parser/client behind opt-in discovery.
5. Rebase #6081 as the 3.9/4.0 migration plan after the first three contracts are accepted.
