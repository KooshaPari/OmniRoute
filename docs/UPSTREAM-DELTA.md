# Upstream Delta

> Fork-vs-upstream ledger for `KooshaPari/OmniRoute`. Authored by an agent on 2026-10-12.
> One source of truth for what we changed, why, and what still needs a recorded demo.
> This is **fork-local bookkeeping** — it is not a release note, changelog, or PR body.

---

## Fork identity (as recorded at HEAD `05884d639c`)

| Field | Value | Source |
|---|---|---|
| **Fork** | `github.com/KooshaPari/OmniRoute` (canonical) | remote `origin` |
| **Operator-facing fork** | `github.com/kooshapari/omniroute` | remote `kooshapari` (alias) |
| **Upstream** | `github.com/diegosouzapw/OmniRoute` | remote `upstream` |
| **Fork point (per `.fork-identity.json`)** | upstream `v3.8.43` | `.fork-identity.json` |
| **Target release line** | `upstream/release/v3.8.51` (SHA `2f42a9ac19d1a247ec9ce5473b790843724b3061`) | `git ls-remote` |
| **Active branch** | `feat/release-line-gap-recovery-v2-20260924` | local |
| **HEAD** | `05884d639c docs(changelog): round-9 — generate 28 missing cherry-pick fragments for first-push gate` | local |
| **`package.json` version** | `3.8.51` (matches upstream release line) | `package.json` |
| **`.fork-identity.json` version (stale)** | `3.8.49-koosha.0` | `.fork-identity.json` |

> ⚠️ **Identity drift**: `.fork-identity.json` is stale (3.8.49-koosha.0). `package.json` is authoritative at 3.8.51. The identity file should be re-seeded, but the delta is one minor version, not a content break.

---

## Commits ahead / behind (snapshot 2026-10-12T21:08Z)

| Reference | Ahead | Behind | Merge-base? |
|---|---|---|---|
| `origin/main` | **65** | 0 | yes (clean) |
| `upstream/main` | 278 | ? | **no** (full rewrite) |
| `upstream/release/v3.8.51` | 278 | ? | **no** (full rewrite) |

> **No merge base with upstream.** The fork's `main` was fully rewritten/re-imported at fork time (v3.8.43 → current), so commit-level diffs against upstream are not meaningful. The "278" reflects every commit on the fork's history that has no upstream counterpart, not a clean cherry-pick delta. **Content-level equivalence** (does our tree contain the same fixes as `release/v3.8.51`?) is the right question; this doc answers it.

---

## All 65 changes vs `origin/main`, grouped by intent

> One line per commit. Source = `git log origin/main..HEAD --no-merges`.
> SHAs are short (7-char); PR/issue numbers are upstream `diegosouzapw/OmniRoute` references.

### 1. Release-line cherry-picks (27 commits from `upstream/release/v3.8.51`)

These are direct ports of fixes that landed on the upstream release line. Tagged `(cherry-picked from release line)` in the commit body.

#### MCP / catalog
- `1a499ab63f` feat(mcp): carry context_length through MCP list_models_catalog projection (#12776)

#### Logging / observability
- `4fffb2b9a9` fix(logging): mask `*-api-key` headers in request-log pipeline (#13273)
- `de2971ab2b` fix(logging): use per-attempt traceId as call-log id to prevent UNIQUE collision (#13481)

#### Provider / model routing
- `03d14a97ff` fix: skip non-chat generation models in 'Test all models' (#13376)
- `4661b2443e` fix(providers): forward API key on outbound embeddings requests for custom providers (#13234)
- `dd11ca35ff` fix(reasoning): expand deepseek-v4 model regex to match v4.1 and add command-code provider (#13430)

#### Resilience / error UX
- `fb4ac0e5be` fix(resilience): add CJK quota-exhaustion patterns to 429 classifier (#13194)
- `d1b0fac133` fix(responses): re-frame upstream errors as Responses events in keepalive (#13431)

#### Backend / eval runner
- `236a98084a` fix(backend): eval runner: failed calls no longer score as passed + dotAll regex (#13137, #13138)
- `3b8b926788` fix(backend): eval runner opts out of output-style and memory injection (#13139)

#### Compression
- `6ca1104d75` fix(compression): exempt tool messages from lite redundant-remove (#13429)
- `473baee9ba` fix(compression): preserve polarity words and newlines in ultra heuristic (#13454)

#### Combos / proxy
- `29e4fa3de6` fix(combos): remove open-sse imports from controlCenter.ts client boundary (#13474)
- `f4057ffd64` fix(proxy): thread comboName through safeResolveProxy to the combo-scope guard (#13469)

#### Gemini / translator
- `eccdb1549b` fix(gemini): strip JSON-Schema 2020-12 prefixItems/additionalItems from tool schemas (#13464)
- `cf8cf63f99` fix(zed-hosted): normalize Gemini safety threshold and tool_choice casing for Zed proxy (#13363)

#### Pattern / caveman
- `1aa907f725` fix: run caveman user preservePatterns before built-in patterns (#13457)
- `08f968816b` fix: memory_fts_au trigger skips access_count-only updates (#13326)

#### Plugin
- `e21a052922` fix(opencode-plugin): surface cache age in disk fallback log and escalate level with staleness (#13390)

#### Security / guardrails
- `1f55c7c2e3` fix(guardrails): skip data: URI base64 payloads in CredentialMasker to prevent false-positive redaction (#13462)
- `89ad4c6229` fix(pii): add OpenRouter metadata keys to PII sanitizer skip list (#13488)
- `6cab7050b2` fix(auth): enforce model-only lockout for no-auth providers (#13483)

#### Usage / DB
- `4ee3c13c1f` fix(usage): normalize provider aliases to canonical id in usage_history (#13459)
- `3f4a9420f5` fix(db): apply auto_vacuum at startup when optimizeOnStartup is enabled (no upstream issue ref)

#### Memory / context
- `95e281ba05` fix(memory): merge memory into top-level system field when present (fixes #13425)

#### Web search
- `0ee12d05a3` fix(websearch): add Antigravity to native web search bypass (#13447)

#### Dashboard
- `c2fc02dead` fix(dashboard): send provider in body for mini-playground web search (#13245)

### 2. Fork-local recovery fixes (7 commits — issues surfaced while applying cherry-picks)

These exist because the cherry-pick set could not be applied 1:1 onto the fork's current `main` (which diverged via re-import at v3.8.43).

- `91594033ba` fix(recovery): port env-configurable limits and OAuth proxy fail-open (backport of release-line work onto current main)
- `9a6516c4cf` fix(recovery): port 3 release-line fixes onto current main
- `d0ffdf3129` fix(api): stream logs export with a DB-layer row cap (#13123 / #13428)
- `5187fa5e56` fix(usage): repair usage_history dedup query broken by the #13459 pick (regression found by the alias-normalization cherry-pick)
- `760d789d92` fix(proxy): add comboName scoping to the fail-closed proxy guard (#13469) (companion to the upstream cherry-pick, fork-side adjustment)
- `8233223814` fix(sse): import the quota helpers `auth.ts` re-exports but also uses (import-shape fix discovered during application)
- `e1de8460e6` chore(deps): align pnpm-lock.yaml with pre-existing package.json oxlint dep (lockfile parity)

### 3. Test coverage additions (9 commits — regression-discriminating tests)

Added to lock the cherry-picks in and prove fork-vs-main deltas.

- `5e66949791` test(reasoning): split #13430 replay-model block out of frozen-size file
- `9bb90c0eb7` test(recovery): cover operator env overrides with A/B-proven tests
- `571771db99` test(recovery): cover tool-limit bypass ordering, discriminating on main
- `466633fa2f` test(recovery): cover provider-alias usage dedup, discriminating on main
- `539a304fbc` test(recovery): cover OAuth refresh proxy fail-open, discriminating on main
- `ef584cd3f1` test(recovery): cover combo-scoped proxy guard, discriminating on main
- `2aee1c8a55` test(chatcore): key attempt-logging persistence assertions on traceId
- `f28b2d69b5` test(gap): cover 3 previously unmapped changed outputs
- `86ed0f96b4` test(chatcore): widen call-log poll budget to survive full-suite load

### 4. Documentation & session log (21 commits)

- **Recovery log (18 commits)**: `db25bdb648` round-7, `a0bac437dd` round-6, `4483bc8f47` round-5, `c06bbef2aa` round-4, `e759cdd8ff` round-3, `bdc640a965` at-HEAD, `915c277d9d` pnpm-lockfile, `82829e98e5` packaging-guard, `dd5dbb83f2` round-8 (14h boundary), `442b187930` traceability totals, `61a409b5e9` main-vs-branch compare, `097b6c5376` fabricated-count correction, `1ad8a05ecd` scratch-dir leak, `981f5b1ae3` 2,852-failing-file cascade, `3952e9f3c6` 4-gate re-confirm, `7636e51aa0` self-corrections, `c0581b2f8e` requirement-to-observation traceability, `57e55a922e` #13459 provenance
- **Changelog (1 commit)**: `05884d639c` round-9 — generate 28 missing cherry-pick fragments for first-push gate
- **Env docs (2 commits)**: `f51b2edce1` correct `OMNIROUTE_MAX_TOOLS_LIMIT` description, `c7d53d8919` document tool-limit and PSI-disable env vars

### 5. Refactor (1 commit)

- `5c3e2e0472` refactor(evals): extract `buildEvalCaseHeaders` to make #13139 test non-tautological

---

## Files touched (cherry-pick set, deduplicated)

```
@omniroute/opencode-plugin/src/index.ts
open-sse/config/embeddingRegistry.ts
open-sse/executors/zed-hosted.ts
open-sse/handlers/chatCore/attemptLogging.ts
open-sse/mcp-server/catalog.ts
open-sse/services/compression/lite.ts
open-sse/services/compression/preservation.ts
open-sse/services/compression/ultraHeuristic.ts
open-sse/services/reasoningCache.ts
open-sse/services/webSearchFallback.ts
open-sse/translator/helpers/geminiHelper.ts
open-sse/utils/earlyStreamKeepalive.ts
open-sse/utils/requestLogger.ts
src/app/(dashboard)/dashboard/media-providers/components/WebSearchExampleCard.tsx
src/lib/api/modelTestRunner.ts
src/lib/combos/controlCenter.ts
src/lib/db/migrations/149_memory_fts_trigger_content_only.sql
src/lib/db/optimizationSettings.ts
src/lib/evals/evalRunner.ts
src/lib/evals/runtime.ts
src/lib/guardrails/credentialMasker.ts
src/lib/logPayloads.ts
src/lib/memory/injection.ts
src/lib/sseTextTransform.ts
src/lib/streamingPiiTransform.ts
src/lib/usage/migrations.ts
src/lib/usage/usageHistory.ts
src/shared/utils/classify429.ts
src/sse/handlers/chat.ts
src/sse/handlers/chatHelpers.ts
```

(Truncated; full list available via `git log origin/main..HEAD --name-only --grep='cherry-picked from release'`)

---

## Demos that would prove the user-visible changes work

> Only changes that touch user-facing surfaces are listed. Internal/observability/security/DB items below do **not** need a recorded demo.

| # | Commit | User-facing change | Suggested demo |
|---|---|---|---|
| D1 | `1a499ab63f` (#12776) | MCP `list_models` output now carries `context_length` for each catalog row | **Playwright** on the MCP server page; assert schema includes `context_length` on every model row |
| D2 | `c2fc02dead` (#13245) | Dashboard mini-playground web-search sends `provider` in body | **Playwright** on `/dashboard/media-providers`; toggle provider, fire web-search, assert network payload includes `provider` |
| D3 | `cf8cf63f99` (#13363) | Zed proxy normalizes Gemini safety threshold + tool_choice casing | **VHS** script that POSTs a request with mixed-case tool_choice and `safetySetting` to the Zed executor; assert 200 with normalized payload |
| D4 | `0ee12d05a3` (#13447) | Antigravity added to native web-search bypass | **VHS** of the dashboard web-search panel; select Antigravity provider; assert request goes to native bypass path (not the generic web-search fallback) |
| D5 | `29e4fa3de6` (#13474) | `controlCenter.ts` client boundary no longer imports `open-sse/*` | No demo (architectural cleanup) — **a unit test on the build artifact** is sufficient |
| D6 | `95e281ba05` (#13425) | Memory injected as top-level `system` field (not nested) when present | **VHS** of a chat that has memory entries; assert a single `system` array contains both platform prompts and memory, in the right order |
| D7 | `6ca1104d75` (#13429) | Tool messages exempt from lite redundant-remove | **Playwright** on a long conversation; assert tool messages are not collapsed (the conversation length stays stable when it would have shrunk) |
| D8 | `473baee9ba` (#13454) | Polarity words and newlines preserved in `ultra` heuristic | **VHS** of a chat containing a string like `"important: don't do X — never!"`; assert the negation is preserved post-compression |
| D9 | `fb4ac0e5be` (#13194) | CJK quota-exhaustion strings (e.g. `额度已用完`, `リクエスト上限`) classified as 429 | **VHS** with a stub upstream that returns CJK 429 body; assert retry/backoff triggers, not a generic 5xx error |
| D10 | `eccdb1549b` (#13464) | Gemini tool schemas stripped of `prefixItems`/`additionalItems` JSON-Schema 2020-12 extensions | **VHS** of a tool call that uses a Gemini model with a schema that has `prefixItems`; assert the request to Gemini succeeds |
| D11 | `d1b0fac133` (#13431) | Upstream errors during keepalive framed as Responses events | **VHS** of a streaming response that hits an upstream error mid-stream; assert the client sees a structured Responses error event, not a socket close |
| D12 | `dd11ca35ff` (#13430) | Deepseek v4.1 + command-code provider in reasoning regex | **Playwright** on the model picker; assert `deepseek-v4.1-*` and `command-code-*` appear |
| D13 | `03d14a97ff` (#13376) | Non-chat generation models skipped in "Test all models" | **VHS** of the model-test page; assert only chat models are exercised (count = chat models, not total models) |
| D14 | `4661b2443e` (#13234) | Custom provider embeddings requests forward API key | **VHS** of a custom-provider config with an embeddings model; assert the outbound HTTP request to the provider includes the API key header |
| D15 | `f51b2edce1` + `c7d53d8919` | Tool-limit and PSI-disable env vars documented | **VHS** of `bin/omniroute config list` (or equivalent); assert the new env vars appear with correct descriptions |

### Internal / no demo needed

These are correct on the merits but do not need a recording:

- Logging fixes (`#13273`, `#13481`) — covered by `test(logging)` suites
- PII / guardrails (`#13488`, `#13462`) — covered by `test(guardrails)` + `test(pii)`
- Auth lockout (`#13483`) — covered by `test(auth)` + adversarial suite
- DB optimizations / migrations (`memory_fts_au` trigger, `auto_vacuum`, `usage_history` dedup) — covered by `test(db)` + migration roundtrip
- Pattern / caveman ordering (`#13457`) — covered by `test(combos)` ordering assertions
- SSE / streaming internals (`fix(sse)`) — covered by `test(sse)` + call-log assertions
- Eval runner (`#13137`, `#13138`, `#13139`) — covered by `test(backend)` evals
- Plugin cache-age logging (`#13390`) — internal observability

---

## Operational rules (binding)

- **No force-push**, no destructive history rewrites, no `--mirror` — append-only ledger.
- **PR title prefix**: any PR opened for this work must begin with `[Instinct] Authored by agent — …` (operator rule, 2026-10-12).
- **No merges** without explicit operator approval; this is a fork-local recovery branch, not a release.
- **`.fork-identity.json`** is stale (3.8.49-koosha.0 vs package.json 3.8.51) — should be re-seeded in a follow-up commit, not a blocker for this push.
- **Live runtime** (`~/.omniroute/storage.sqlite`, sha256 `9b3b2fc2…`, mtime 2026-10-07T18:32:48Z) was **not** touched by this work — recovery is branch-only.

---

## Provenance

- 27 cherry-pick fix commits, 7 fork-local recovery commits, 9 test commits, 21 doc commits, 1 refactor — all authored by agent on the recovery branch.
- Branch **pushed** to `kooshapari/omniroute` at SHA `05884d639c7d82937fe6889348084643e75b694f` on 2026-10-12.
- 18 background quality gates (lint, cargo check, go test, OpenAPI checks, etc.) running in this session for parallel code-level pass/fail signals — not part of the recovery push.
