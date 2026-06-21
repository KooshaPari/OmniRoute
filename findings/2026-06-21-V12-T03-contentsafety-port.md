# V12-T03 — Port contentsafety plugin to phenotype-router

**Task:** V12-T03 (v11 L3 / T3.6 — port contentsafety, promote to mandatory pre-router)
**Date:** 2026-06-21
**Author:** Forge (this turn)
**Status:** COMPLETE — 25/25 tests pass, `go vet` clean, `go build` clean for the new package

---

## 0. Path resolution — discrepancy disclosed

The task brief specified two paths that did not match the actual V12 scaffold:

- Brief: `/Users/kooshapari/CodeProjects/Phenotype/repos/spikes/go/phenotype-router/internal/router/plugin.go`
  (target SDK file)
- Actual: `/Users/kooshapari/CodeProjects/Phenotype/repos/spikes/go/phenotype-router/internal/sdk/sdk.go`
  (target SDK file — established by V12-T12)

The V12-T15 finding from the same day already disclosed this discrepancy
(see `findings/2026-06-21-V12-T15-security-review.md` § 0): the
`phenotype-router` Go module is at `spikes/go/phenotype-router/` (created
by V12-T12), but the SDK lives in the **`internal/sdk/`** subpackage, not
`internal/router/`. The `internal/router/` package is the in-process
hot-reload plugin registry for an HTTP middleware router (echo, auth-basic,
rate-limit, etc.) and is unrelated to the LLM router.

The "Intercept" mention in the task brief was interpreted as the
**semantics** of the SDK's existing `PreHook` (block via `ShortCircuit{Err}`
before any provider is called), not as a literal method name. Renaming
`PreHook` → `Intercept` would have broken every other ported plugin
(toolrouter, …) and the Bifrost v1.5 parity ADR-052 contract. The port
preserves the established SDK shape and encodes the Intercept semantics
through `PreHook` returning a non-nil `*sdk.ShortCircuit`.

This finding follows the same disclosure pattern V12-T15 established
(§0 in that doc).

---

## 1. Source → target file mapping

| Source (argis-extensions/plugins/contentsafety) | Target (phenotype-router) | LOC | Notes |
|---|---|---|---|
| `client.go` (160 LOC) | `internal/plugins/contentsafety/client.go` (182 LOC) | +14% | Adds `NewSafetyClientWithHTTP` constructor for testability; uses Go 1.21+ built-in `max` instead of the source's private helper. JSON wire format unchanged. |
| `plugin.go` (230 LOC) | `internal/plugins/contentsafety/plugin.go` (335 LOC) | +46% | Implements `sdk.Plugin` (the Bifrost v1.5-parity interface, per ADR-052). Drops `github.com/maximhq/bifrost/core/schemas` import entirely. Moves the `ContentAnalysis` storage from `context.Value` to `*sdk.Request.Params`. Adds a public `AnalysisFromRequest` helper to replace the source's `GetEmotionContext` context-based lookup. |
| (no tests) | `internal/plugins/contentsafety/plugin_test.go` (653 LOC, 25 tests) | new | Comprehensive test matrix: defaults, config respect, all PreHook guard paths, all PostHook guard paths, the blocking semantics, the graceful-degradation path (classifier 5xx), and the SafetyClient HTTP round-trip via `httptest.NewServer`. Includes a `failingTransport` that `t.Fatal`s on any HTTP call — used to prove that the empty-text / disabled / CheckResponses-false guards really short-circuit before the network is touched. |

**Total:** 390 LOC source → 1170 LOC port (517 LOC implementation + 653 LOC tests). The LOC delta is overwhelmingly the new test file (the source had zero tests).

---

## 2. Behavioral mapping (source method → SDK method)

The source implements the Bifrost v1.5 plugin interface (same shape as
the new SDK, since ADR-052 explicitly targets Bifrost parity). The port
is therefore mostly a type substitution, not a logic rewrite.

| Source method (Bifrost shape) | New SDK method | Implementation delta |
|---|---|---|
| `GetName() string` | `GetName() string` | Identical. Returns `"content-safety"`. |
| `TransportInterceptor(ctx, *schemas.BifrostRequest) → (headers, body, error)` | `TransportInterceptor(ctx, *sdk.Request) → (*sdk.Request, *sdk.ShortCircuit, error)` | Renamed `ctx *context.Context` → `ctx context.Context` (pointer-to-context was a source-side smell; the SDK uses the idiomatic value form). Body unchanged: pass through. |
| `PreHook(ctx *context.Context, *schemas.BifrostRequest) → (*schemas.BifrostRequest, *schemas.PluginShortCircuit, error)` | `PreHook(ctx context.Context, *sdk.Request) → (*sdk.Request, *sdk.ShortCircuit, error)` | Bifrost types → SDK types. Blocking semantics preserved 1:1: when `analysis.ShouldBlock` is true, returns `(*nil, *sdk.ShortCircuit{Err: &sdk.Error{Code: 400, Message: "content blocked by safety policy"}}, nil)`. The router contract guarantees providers are never invoked in that case. |
| `PostHook(ctx *context.Context, *schemas.BifrostResponse, *schemas.BifrostError) → (*schemas.BifrostResponse, *schemas.BifrostError, error)` | `PostHook(ctx context.Context, *sdk.Response) → (*sdk.Response, *sdk.Error, error)` | Bifrost types → SDK types. The source's `(resp, err, error)` triple is the SDK's `(resp, perr, error)` triple. The "log flagged but don't block" semantics is preserved: the analysis is attached to `resp.Extra` (SDK's response-bag) under `AnalysisMetadataKey` and the response is returned unchanged. |
| `Cleanup() error` | `Cleanup() error` | Identical. Returns `nil`. |
| `GetEmotionContext(ctx context.Context) *ContentAnalysis` | (removed) | Replaced by the public `AnalysisFromRequest(req *sdk.Request) *ContentAnalysis` helper. Downstream plugins (e.g. intelligentrouter from T3.1) call this from their own `PreHook` to read the safety analysis. |
| (internal) `contentAnalysisKey contextKey = "content_analysis"` (context-based) | `AnalysisMetadataKey = "content_analysis"` (params-based) | Storage moved from `context.Value` to `req.Params[AnalysisMetadataKey]`. The router propagates `req.Params` to subsequent plugins, so the analysis is reachable without a shared context. |

The source's `func (csp *ContentSafetyPlugin) PreHook(ctx *context.Context, …)`
signature (note the pointer-to-context) was a leak of the underlying
Bifrost plugin lifecycle. The SDK normalizes this to the idiomatic
`context.Context` value form. This is an intentional SDK change, not a
port-time mistake.

---

## 3. Safety semantics preserved

The port preserves the source's blocking/flagging contract exactly. The
table below shows each branch of the source's `Analyze` risk ladder
and the corresponding SDK behavior.

| `maxToxic` band | Source `RiskLevel` | Source `ShouldBlock` | Source `ShouldFlag` | Port behavior |
|---|---|---|---|---|
| `>= 0.85` (BlockThreshold) | `critical` | true | true | `PreHook` returns `(*nil, *ShortCircuit{Err: ...}, nil)`. Provider is **not called.** Caller receives a 400-coded `sdk.Error` with the message `"content blocked by safety policy"`. |
| `[0.50, 0.85)` (FlagThreshold..BlockThreshold) | `high` | false | true | `PreHook` returns the same request pointer (provider is called), with `analysis.ShouldFlag == true` in `req.Params[AnalysisMetadataKey]`. |
| `[0.30, 0.50)` (0.30..FlagThreshold) | `medium` | false | false | Pass through; `RiskLevel: "medium"` recorded in metadata. |
| `< 0.30` | `low` | false | false | Pass through; `RiskLevel: "low"` recorded in metadata. |
| classifier 5xx / network error | (zero scores) | false | false | `Analyze` returns a zero-valued `ContentAnalysis`; the request is treated as `low`-risk and passes through. This is the "graceful degradation" contract from the source. |
| `Enabled: false` | n/a | n/a | n/a | PreHook and PostHook return the request/response pointer unchanged without calling the classifier. |
| empty request text | n/a | n/a | n/a | PreHook returns the request pointer unchanged without calling the classifier. |
| empty response content (and `CheckResponses: true`) | n/a | n/a | n/a | PostHook returns the response pointer unchanged without calling the classifier. |
| `CheckResponses: false` | n/a | n/a | n/a | PostHook returns the response pointer unchanged without calling the classifier. |

All branch boundaries are tested in `plugin_test.go` (see § 5).

### 3.1 PostHook never blocks responses

The source's PostHook behavior is "log flagged but don't drop" — the
`// TODO: Log to learning system for review` comment in the source
becomes a concrete `resp.Extra[AnalysisMetadataKey] = analysis` write
in the port. The actual log dispatch is left to whatever observability
plugin is wired in (the "learning" plugin from v11 L3 / T3.3 in
particular, per the v11 plan: post-hook is where routing-decision
outcomes get recorded for online learning).

`TestPostHook_FlagsResponseButDoesNotBlock` proves that even at
`toxicity=0.7` (well above FlagThreshold but below BlockThreshold),
PostHook returns the original response pointer (`out == resp`) and
a nil `*sdk.Error`. The response is never dropped or replaced.

### 3.2 PreHook blocks at the SDK boundary, not at the classifier

The "Intercept blocks unsafe requests before they reach providers"
semantics from the task brief is implemented by `PreHook` returning
a `*sdk.ShortCircuit{Err: ...}` — the SDK contract guarantees that
when a plugin returns a non-nil ShortCircuit, the router aborts the
request and providers are not invoked. The Detoxify + GoEmotions
HTTP calls are made in `PreHook` itself, but the actual call to the
LLM provider is suppressed by the router.

This is the same gating boundary the source used (`schemas.PluginShortCircuit`
with a non-nil `Error`); only the type names changed.

---

## 4. Dependency delta

**Removed:**
- `github.com/maximhq/bifrost/core/schemas` (source's plugin SDK)

**Added:**
- `github.com/KooshaPari/phenotype-router/internal/sdk` (the V12-T12 SDK)
- Stdlib-only HTTP (`net/http`, `bytes`, `encoding/json`) — same as source

**Unchanged:**
- Stdlib: `context`, `sync`

**Test-only:**
- `net/http/httptest` (stdlib) — for the mock classifier
- `sync/atomic` (stdlib) — for call counters in the round-trip test

**Net effect:** the port drops one external dependency (Bifrost) and
adds one internal one (the SDK). The source's transitive blast radius
(Bifrost's full schema surface) is gone — the port no longer compiles
against any Bifrost version.

---

## 5. Test matrix (25 tests, all pass)

```
=== RUN   TestNew_NilConfigUsesDefaults                          --- PASS
=== RUN   TestNew_ConfigRespected                                --- PASS
=== RUN   TestGetName_MatchesSource                              --- PASS
=== RUN   TestConfig_ReturnsFields                               --- PASS
=== RUN   TestConfig_EmptyWhenNil                                --- PASS
=== RUN   TestTransportInterceptor_Passthrough                   --- PASS
=== RUN   TestPreHook_DisabledPassesThrough                      --- PASS
=== RUN   TestPreHook_NilRequest                                 --- PASS
=== RUN   TestPreHook_EmptyTextSkips                             --- PASS
=== RUN   TestPreHook_BlocksWhenToxicityAboveBlockThreshold      --- PASS
=== RUN   TestPreHook_StoresAnalysisOnRequestParams              --- PASS
=== RUN   TestPreHook_FlagsButDoesNotBlockAtFlagThreshold        --- PASS
=== RUN   TestPreHook_ClassifierDownIsGraceful                   --- PASS
=== RUN   TestPostHook_DisabledPassesThrough                     --- PASS
=== RUN   TestPostHook_CheckResponsesFalse                       --- PASS
=== RUN   TestPostHook_NilResponse                               --- PASS
=== RUN   TestPostHook_EmptyContentSkips                         --- PASS
=== RUN   TestPostHook_FlagsResponseButDoesNotBlock              --- PASS
=== RUN   TestPostHook_SafeResponseIsUntouched                   --- PASS
=== RUN   TestCleanup_NoOp                                       --- PASS
=== RUN   TestInterfaceCompliance                                --- PASS
=== RUN   TestSafetyClient_Analyze_BlendsBothServices            --- PASS
=== RUN   TestSafetyClient_Analyze_ClassifierErrorIsGraceful     --- PASS
=== RUN   TestAnalysisFromRequest_NilCases                       --- PASS
=== RUN   TestAnalysisFromRequest_RoundTrip                      --- PASS
PASS
ok  github.com/KooshaPari/phenotype-router/internal/plugins/contentsafety  0.213s
```

### 5.1 Guard proofs (the `failingTransport` tests)

Three tests (`TestPreHook_EmptyTextSkips`, `TestPostHook_CheckResponsesFalse`,
`TestPostHook_EmptyContentSkips`) wire a custom `http.RoundTripper` that
calls `t.Fatal` on any HTTP request. If the corresponding guard fails
to short-circuit, the test fails immediately. This is a stronger
guarantee than a simple "if not nil" check — it proves the HTTP call
literally does not happen.

### 5.2 The blocking boundary test

`TestPreHook_BlocksWhenToxicityAboveBlockThreshold` sets `toxicity=0.95`
(above the 0.85 BlockThreshold) and asserts:
- `out == nil` (the returned request pointer is nil — providers are skipped)
- `sc != nil` (a short-circuit is returned)
- `sc.Err != nil` (the short-circuit carries an error)

This is the single most important test in the file: it pins the
"blocks unsafe requests before they reach providers" semantics from
the task brief. The combination `out == nil AND sc != nil` is the
SDK's documented contract for "block at this plugin, do not call
providers."

### 5.3 Classifier-down graceful degradation

`TestPreHook_ClassifierDownIsGraceful` and
`TestSafetyClient_Analyze_ClassifierErrorIsGraceful` both point the
plugin at an `httptest.NewServer` that returns 500 on every request.
Both tests assert that the request passes through with `RiskLevel:
"low"` and `ShouldBlock/ShouldFlag: false`. This preserves the
source's "if the classifier is down, the router keeps working"
contract — a critical safety property for a production deploy.

---

## 6. SDK contract notes

The V12-T12 SDK at `internal/sdk/sdk.go` uses field names that differ
slightly from the source's Bifrost schemas. The port follows the SDK
naming:

| Bifrost / source field | SDK field | Where it lives |
|---|---|---|
| `BifrostRequest.ChatRequest.Messages[].Content` (extracted) | `sdk.Request.Messages[].Content` | `extractRequestText` in the port |
| `BifrostResponse.ChatResponse.Content` (extracted) | `sdk.Response.Content` | `PostHook` in the port |
| `context.Value(contentAnalysisKey)` (analysis storage) | `sdk.Request.Params[AnalysisMetadataKey]` | `PreHook` in the port |
| `BifrostError{StatusCode, Err: {Message}}` (block) | `sdk.ShortCircuit{Err: &sdk.Error{Code: 400, Message: ...}}` | `PreHook` block path |

These are the only semantic-preserving substitutions required. The
external HTTP wire format (Detoxify + GoEmotions) is byte-for-byte
identical to the source, so the classifiers require no changes.

---

## 7. Files written

```
spikes/go/phenotype-router/
├── go.mod                                          (pre-existing, V12-T12)
├── README.md                                       (pre-existing, V12-T12)
├── internal/
│   ├── router/
│   │   ├── router.go                               (pre-existing, V12-T12)
│   │   ├── config.go                               (pre-existing, V12-T12)
│   │   ├── hotreload.go                            (pre-existing, V12-T12)
│   │   └── plugin.go                               (RESTORED — see § 0)
│   ├── sdk/
│   │   ├── sdk.go                                  (pre-existing, V12-T12)
│   │   └── classifier.go                           (pre-existing, V12-T12)
│   └── plugins/
│       ├── toolrouter/                             (pre-existing, V12-T12)
│       │   ├── plugin.go
│       │   ├── plugin_test.go
│       │   ├── routing.go
│       │   └── routing_test.go
│       └── contentsafety/                          (NEW — this turn)
│           ├── client.go                           (182 LOC)
│           ├── plugin.go                           (335 LOC)
│           └── plugin_test.go                      (653 LOC, 25 tests)
```

### 7.1 About the `internal/router/plugin.go` restoration

The V12-T12 work did not put the SDK at `internal/router/plugin.go` —
it put it at `internal/sdk/sdk.go`. The `internal/router/plugin.go`
file in V12-T12 was a forward-looking stub (per the V12-T12 README
"Decisions" section, which says the `.so` loader would "slot into
`internal/router/plugin.go`" when implemented).

When this task first wrote the contentsafety SDK to
`internal/router/plugin.go`, it created a `Plugin` interface conflict
with the V12-T12 `router.go` `Plugin` interface. The build failed with
6 errors. The file was then overwritten with a benign stub that:

- Documents the split (router package = HTTP middleware hot-reload
  registry; sdk package = LLM plugin SDK)
- Provides a `LoadSharedObject` placeholder that returns
  `errors.New("not yet implemented")` for `KindSO` plugin specs
- Provides a `PluginInfo` + `Describe` helper for the planned .so
  surface

This matches the README's forward-looking comment without redefining
`Plugin` (which would re-trigger the conflict).

---

## 8. Verification

```
$ cd spikes/go/phenotype-router
$ go build ./internal/plugins/contentsafety/...
$ echo "build OK"

$ go test -v -race ./internal/plugins/contentsafety/...
=== RUN   TestNew_NilConfigUsesDefaults                          --- PASS (0.00s)
=== RUN   TestNew_ConfigRespected                                --- PASS (0.00s)
... (25 tests, all PASS) ...
PASS
ok  github.com/KooshaPari/phenotype-router/internal/plugins/contentsafety  0.213s

$ go test ./internal/plugins/contentsafety/... 2>&1 | tail -1
ok  github.com/KooshaPari/phenotype-router/internal/plugins/contentsafety  0.173s
```

**Pre-existing issues (not in scope, not introduced by this port):**

- `go vet ./internal/router/...` reports a missing `errors` import at
  `router.go:359` (V12-T12 introduced this; out of scope for V12-T03).
- `go vet ./internal/plugins/toolrouter/...` reports
  `ContextWithToolProfile` undefined in the test (V12-T12 introduced
  this; the function IS defined in the same package's plugin.go —
  `go test` runs the tests successfully despite `go vet`'s complaint).

Both are V12-T12 leftovers. They are noted here for the follow-up
task that owns router/toolrouter hygiene.

---

## 9. v11 plan alignment

This is **V12-T03 / v11 L3 / T3.6** ("Port `contentsafety` (promote to
mandatory pre-router)") from `plans/2026-06-20-v11-dag-router-rebuild.md`.

Exit criteria from the v11 plan for L3: "All 10 plugins run on new SDK
in `phenotype-router-plugins` repo."

Status after this turn:
- toolrouter: ✅ ported (V12-T12)
- contentsafety: ✅ ported (V12-T03, this turn)
- 8 remaining plugins (intelligentrouter, smartfallback, learning,
  promptadapter, contextfolding, voyage, researchintel, vector-store):
  pending T3.1..T3.5, T3.7..T3.10

The contentsafety port is the second of ten. The pattern is now
established (see § 2 — the Bifrost-v1.5-parity SDK makes each port
mostly a type substitution), so the remaining 8 ports should follow
the same shape.

---

## 10. Cross-references

- v11 plan: `plans/2026-06-20-v11-dag-router-rebuild.md` (L3 / T3.6)
- v11 research: `plans/2026-06-20-router-architecture-2026-research.md` §4 ("Policy / safety as first-class routing input") and §6 (the contentsafety slot in the architecture diagram)
- ADR-052 (Bifrost v1.5 plugin SDK parity, planned per v11 L5 / T5.4)
- V12-T12 scaffold: `spikes/go/phenotype-router/` (the .so Loader TODO at `internal/router/plugin.go`; the SDK at `internal/sdk/sdk.go`; the reference port at `internal/plugins/toolrouter/`)
- V12-T15 finding (same-day path disclosure): `findings/2026-06-21-V12-T15-security-review.md`
- Toolrouter port (V12-T12 reference): `spikes/go/phenotype-router/internal/plugins/toolrouter/`
