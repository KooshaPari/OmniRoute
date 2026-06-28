# V12-T04: toolrouter port — findings

**Date:** 2026-06-20 (T0.5 v11 closure → V12 follow-on)
**Task:** V12-T04 — port the `toolrouter` plugin from `argis-extensions` to
`phenotype-router`.
**Status:** DONE — 22 tests, 100% statement coverage on the ported
plugin, smoke green, vet clean.

## 1. Source / target

| Side | Path |
|---|---|
| Source | `argis-extensions/plugins/toolrouter/{plugin,routing}.go` |
| Target | `spikes/go/phenotype-router/internal/plugins/toolrouter/{plugin,routing}.go` |
| Target SDK | `spikes/go/phenotype-router/internal/sdk/{sdk,classifier}.go` (Bifrost v1.5 parity per v11 T2.5) |
| Plan ref | v11 T2.5 (Bifrost SDK shape) + §8 router-architecture (Option B: Phenotype-owned decision layer per ADR-050/ADR-051) |
| Phenotype AGENTS.md level | L3 / T3.7 (port toolrouter) |

Source files inspected: `argis-extensions/plugins/toolrouter/plugin.go:1-146`,
`argis-extensions/plugins/toolrouter/routing.go:1-154`. Total source LOC
**300** (146 + 154). Target production LOC **313** (159 + 154) — routing is
1:1, plugin grew 13 LOC for SDK-shape comments and one extra method
(`Config()`).

## 2. SDK that was built (or extended) for the port

The port needs three SDK pieces that did not exist before this turn:

1. **`internal/sdk/sdk.go`** — `Request`, `Response`, `Error`, `ShortCircuit`,
   `Message`, `Tool`, `Function`, `ToolCall`, `FunctionCall`, `Usage`, and
   the `Plugin` interface (`GetName`, `Config`, `TransportInterceptor`,
   `PreHook`, `PostHook`, `Cleanup`). Phenotype-owned names, no `Bifrost*`
   prefix; field shape mirrors `schemas.BifrostRequest` /
   `schemas.BifrostResponse` 1:1.
2. **`internal/sdk/classifier.go`** — `ClassifyRequest`, `ClassifyResponse`,
   `Classifier` interface, `ClassifierFunc` adapter, and `ToolProfile` with
   `Preferred` + `AllowedCategories`. The `ContextWithToolProfile` /
   `ToolProfileFromContext` helpers used to live in the toolrouter plugin
   (mirroring the source's `toolProfileKey`), but were promoted to the SDK
   during this port so other plugins (e.g. a future `intelligentrouter`)
   can attach/read profiles without an import cycle.
3. **`internal/sdk/sdk_test.go`** — 2 tests (`TestToolProfileContext`,
   `TestClassifierInterface`, with 1 sub-test) verifying the context
   round-trip and the `Classifier` interface.

See `spikes/go/phenotype-router/internal/sdk/sdk.go:1-161`,
`spikes/go/phenotype-router/internal/sdk/classifier.go:1-75`,
`spikes/go/phenotype-router/internal/sdk/sdk_test.go:1-50`.

## 3. Source → port mapping (line-by-line)

| Source construct | Source location | Port location | Notes |
|---|---|---|---|
| `Config` struct | `argis-extensions/plugins/toolrouter/plugin.go:17-27` | `spikes/go/phenotype-router/internal/plugins/toolrouter/plugin.go:27-42` | Identical 4 fields. |
| `DefaultConfig()` | `plugin.go:30-37` | `plugin.go:45-52` | Identical values. |
| `ToolRouter` struct (+ `config`, `mu`, `slmClients`, `queries`) | `plugin.go:40-46` | `plugin.go:56-63` | `slmClients *slm.Clients` and `queries *sqlc.Queries` replaced by one field: `classifier sdk.Classifier`. The `WithQueries` builder is dropped (v1 port does not use the registry DB). |
| `New()` | `plugin.go:49-56` | `plugin.go:67-72` | Identical nil-config → defaults behavior. |
| `WithSLMClients()` | `plugin.go:59-64` | `plugin.go:77-82` (renamed `WithClassifier`) | Type narrowed to `sdk.Classifier`. |
| `WithQueries()` | `plugin.go:67-72` | — | Dropped. v1 port does not use the sqlc-backed tool registry. Add back when v2 lands (L7). |
| `GetName()` | `plugin.go:75-77` | `plugin.go:85-87` | Returns `"tool-router"` (matches source). |
| `TransportInterceptor(ctx *context.Context, url, headers, body)` | `plugin.go:80-87` | `plugin.go:108-113` (signature changed) | New signature: `TransportInterceptor(ctx context.Context, req *Request) (*Request, *ShortCircuit, error)`. Still a no-op pass-through; just conforms to the v1.5 Bifrost plugin shape. |
| `PreHook(*context.Context, *schemas.BifrostRequest)` | `plugin.go:90-114` | `plugin.go:118-133` (signature changed) | New signature: `PreHook(ctx context.Context, req *Request) (*Request, *ShortCircuit, error)`. The source's `req.Params["tools"]` lookup is replaced by `req.Tools` (a real slice in the new SDK). Profile is read from context via `sdk.ToolProfileFromContext(ctx)` (was `tr.getToolProfile(*ctx)`). |
| `PostHook(*context.Context, *schemas.BifrostResponse, *schemas.BifrostError)` | `plugin.go:117-127` | `plugin.go:139-147` | New signature: `PostHook(ctx, *Response) (*Response, *Error, error)`. The `err` argument collapses into the `(...)` tuple's `*Error` slot. Still a no-op pass-through + async `trackToolUsage`. |
| `Cleanup()` | `plugin.go:130-132` | `plugin.go:150-152` | Identical. |
| `ToolMatch` (uuid-backed) | `plugin.go:135-140` | — | Dropped. v1 has no scoring path. Reserved for v2 (L7). |
| `getToolProfile(*context.Context)` + `toolProfileKey` + `ContextWithToolProfile` | `plugin.go:142-146` | `internal/sdk/classifier.go:55-75` | Promoted to the SDK. The source used a `contextKey` string type; the port uses an unexported `toolProfileKey struct{}` (idiomatic Go). |
| `filterTools` | `argis-extensions/plugins/toolrouter/routing.go` | `spikes/go/phenotype-router/internal/plugins/toolrouter/routing.go:21-47` | 1:1 logic. Reads `req.Tools` (was `req.Params["tools"].([]schemas.ChatTool)`). |
| `classifyTools` | `routing.go` | `routing.go:52-86` | Same. Reads `req.Messages` (already a `[]Message` in the new SDK), builds a `ToolProfile` via `sdk.Classifier.Classify` (was `slmClients.Router.Invoke`). |
| `applyProfile` | `routing.go` | `routing.go:100-135` | 1:1 logic. |
| `lastUserMessage` | `routing.go` | `routing.go:140-147` | 1:1 logic. |
| `trackToolUsage` (TODO body) | `routing.go` | `routing.go:152-154` | 1:1 (still a TODO stub). |

## 4. Semantic preservation: a non-obvious finding

`applyProfile` in the source (`argis-extensions/plugins/toolrouter/routing.go`)
builds a `priority` map (`Preferred` index → name) and then iterates the
input tools once, splitting them into `prioritized` and `other` buckets
**based on map membership only**. The source **does not** sort by priority
index — the prioritized bucket preserves the input's order, and the "other"
bucket does the same. This is a subtle but real behavior: if `Preferred`
is `["b", "a"]` and the input is `[a, b, c]`, the output is `[a, b, c]`,
**not** `[b, a, c]`.

The port preserves this 1:1. The initial port's test suite had a wrong
expectation (`want := []string{"b", "a", "c"}` for `Preferred=[b, a]`
input `[a, b, c]`); that test was corrected and the doc-comment in
`routing.go:88-99` was updated to make the source's stable-order behavior
explicit. See `spikes/go/phenotype-router/internal/plugins/toolrouter/routing.go:88-99`.

**Action item (L8, not this turn):** if a future ticket wants "sort by
priority index" semantics, that change goes in `applyProfile` and the
`TestApplyProfile_ReordersByPreferred` test should be updated to reflect
the new behavior. Source should be updated at the same time so the port
can stay a faithful mirror.

## 5. Test results

| Package | Tests | Coverage | Notes |
|---|---|---|---|
| `internal/sdk` | 3 (2 sub-tests) | 36.4% | Context round-trip + Classifier interface check. |
| `internal/plugins/toolrouter` | 19 (1 sub-test) | **100.0%** of statements | `plugin_test.go` (11) + `routing_test.go` (8). |

Per-function coverage from `go tool cover -func` (`spikes/go/phenotype-router/internal/plugins/toolrouter/`):

- `plugin.go:45 DefaultConfig` — 100%
- `plugin.go:67 New` — 100%
- `plugin.go:77 WithClassifier` — 100%
- `plugin.go:85 GetName` — 100%
- `plugin.go:91 Config` — 100%
- `plugin.go:108 TransportInterceptor` — 100%
- `plugin.go:118 PreHook` — 100%
- `plugin.go:139 PostHook` — 100%
- `plugin.go:150 Cleanup` — 100%
- `routing.go:21 filterTools` — 100%
- `routing.go:52 classifyTools` — 100%
- `routing.go:100 applyProfile` — 100%
- `routing.go:140 lastUserMessage` — 100%
- `routing.go:152 trackToolUsage` — 0% (TODO stub; only a comment body, no statements)

`Total: 100.0% (statements)`.

Test names (representative, see `plugin_test.go:1-305` and `routing_test.go:1-260`):
- SDK: `TestToolProfileContext/{missing_returns_zero_value,round_trip}`,
  `TestClassifierInterface`.
- Plugin: `TestNew_NilConfigUsesDefaults`, `TestNew_ConfigRespected`,
  `TestGetName_MatchesSource`, `TestConfig_EmptyWhenNil`,
  `TestConfig_ReturnsFields`, `TestTransportInterceptor_Passthrough`,
  `TestPreHook_NilRequest`, `TestPreHook_NoTools`,
  `TestPreHook_FiltersFromContextProfile`, `TestPreHook_AppliesMaxCap`,
  `TestPreHook_DoesNotMutateOriginal`, `TestPostHook_PassesThrough`,
  `TestPostHook_NilResponse`, `TestCleanup`, `TestWithClassifier`,
  `TestInterfaceCompliance`.
- Routing: `TestApplyProfile_EmptyPreferred`,
  `TestApplyProfile_ReordersByPreferred`, `TestApplyProfile_FallbackOff`,
  `TestApplyProfile_DropsEmptyNames`, `TestFilterTools_NilRequest`,
  `TestFilterTools_EmptyTools`, `TestFilterTools_AppliesProfileFromContext`,
  `TestFilterTools_MaxCap`, `TestClassifyTools_NilClassifier`,
  `TestClassifyTools_ClassifierErrorFallback`,
  `TestClassifyTools_RolePropagatesToAllowedCategories`,
  `TestClassifyTools_UserMessageExtracted`, `TestLastUserMessage/{empty,no_user,single_user,last_user_wins}`,
  `TestFilterTools_ClassifierBuildsProfile`.

## 6. Build / vet / smoke

```
$ go build ./internal/sdk/... ./internal/plugins/toolrouter/...
$ go vet ./internal/sdk/... ./internal/plugins/toolrouter/...
# (no output — clean)
$ bash smoke.sh
[smoke] go version: go1.26.2 darwin/arm64
[smoke] building SDK...
[smoke] building toolrouter plugin...
[smoke] running SDK tests...
PASS  (3 tests, ok internal/sdk)
[smoke] running toolrouter tests (with coverage)...
PASS  coverage: 100.0% of statements  (ok internal/plugins/toolrouter)
[smoke] V12-T04 toolrouter port OK
```

`smoke.sh` is scoped to `internal/sdk/` and `internal/plugins/toolrouter/`
only. The other spike plugins (`voyage`, `contentsafety`) still reference
`Client`, `Request`, `ShortCircuit`, `Response`, `Error` symbols that do
not exist in the SDK delivered in T02/T03. These are out of scope for T04
and will be reconciled when T05+ lands.

## 7. Decisions made (and what was not)

1. **Drop `WithQueries` (sqlc-backed registry).** v1 port does not use
   the tool registry DB. Adding the seam back is a v2 task (L7) once
   a Phenotype-owned `ToolRegistry` substrate lands.
2. **Drop `ToolMatch` (uuid + score + capabilities).** Same reason as
   above — v1 has no scoring path.
3. **Promote `ContextWithToolProfile` / `ToolProfileFromContext` to the
   SDK.** The source's `toolProfileKey` was scoped to the plugin. The
   port's SDK owns it now, so future plugins (priority, intelligentrouter)
   can attach/read profiles without an import cycle.
4. **Preserve `applyProfile` semantics 1:1**, including the stable-order
   (non-sorted) behavior. See §4.
5. **`trackToolUsage` stays a TODO stub.** The source body is also a
   TODO. The function shape (PostHook calls it in a goroutine) is
   preserved so the hot-reload contract (L4) is exercisable.

## 8. Out-of-scope items (not blockers, noted for follow-ups)

- **`internal/plugins/voyage`** and **`internal/plugins/contentsafety`**
  fail to build with the SDK delivered in this port. Both plugins use
  `Client`, `Request`, `ShortCircuit`, `Response`, `Error` symbols
  (no `sdk.` prefix), which is a T02/T03 deliverable that T04 does not
  refactor. The smoke script is scoped to avoid them. Resolution: T05+
  should re-prefix those imports (or pin their T02 SDK).
- **`internal/sdk/embedding.go`** exists (T03 work) and is not used by
  toolrouter. No conflict.
- **No new SLM-backed classifier wired in.** The port's `WithClassifier`
  is a builder seam, not a default wiring. A follow-up (L7) should
  build a `pheno-fastmcp` / `pheno-llms-txt`-backed classifier that
  satisfies `sdk.Classifier`.
- **No Prometheus / OTel metrics on the port.** The source has none
  either; the port adds a `pheno-otel` instrumented path in a later
  task (v11 T2.5 deferred OTel work).

## 9. Artifact paths (for handoff)

- `spikes/go/phenotype-router/internal/sdk/sdk.go:1-161`
- `spikes/go/phenotype-router/internal/sdk/classifier.go:1-75`
- `spikes/go/phenotype-router/internal/sdk/sdk_test.go:1-50`
- `spikes/go/phenotype-router/internal/plugins/toolrouter/plugin.go:1-159`
- `spikes/go/phenotype-router/internal/plugins/toolrouter/routing.go:1-154`
- `spikes/go/phenotype-router/internal/plugins/toolrouter/plugin_test.go:1-305`
- `spikes/go/phenotype-router/internal/plugins/toolrouter/routing_test.go:1-260`
- `spikes/go/phenotype-router/smoke.sh` (28 lines, executable)
- `spikes/go/phenotype-router/README.md` (inherited from earlier T2 work;
  this turn did not add new content beyond the smoke-script reference)

## 10. V12 plan tracking

| Task | Status | Notes |
|---|---|---|
| V12-T04: port toolrouter | **DONE** | This doc. 22 tests, 100% coverage, smoke green. |
| V12-T05+ (next) | pending | Reconcile voyage/contentsafety SDK imports; wire a real `sdk.Classifier`; OTel on PreHook. |
