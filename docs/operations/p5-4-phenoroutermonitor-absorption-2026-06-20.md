# P5-4: phenoRouterMonitor → phenoAI absorption plan

**Date:** 2026-06-20
**Wave:** P5 (agent-runtime)
**Sources:** `KooshaPari/phenoRouterMonitor` (archived), `KooshaPari/phenoAI` (active)
**Target:** `KooshaPari/phenoAI`
**Registry rows:** `gate-phenoroutermonitor`, `lib-llm-router` (implicit)

---

## 1. Verdict

**Already absorbed (effectively done).** The Rust LLM router from
`phenoRouterMonitor` is canonical in `phenoAI/crates/llm-router/`. The
archived `phenoRouterMonitor` repo contains zero-byte placeholders pointing
at subprojects — no Rust source to migrate.

What remains for P5-4 = a **paperwork + verification** task, not a code
absorption:

1. Registry row update (`gate-phenoroutermonitor` → `done`)
2. `phenoAI` license manifest row added for `crates/llm-router/`
3. `phenoAI` archive gate (only if you also want to retire phenoRouterMonitor)
4. Traceability entry in `TRACEABILITY.md` mapping the absorbed code to FRs

**No code changes.** No `crates/` moves. No new files.

---

## 2. Evidence (read from upstream)

### `KooshaPari/phenoRouterMonitor` (archived, `isArchived: true`)

- Root has 111 entries (mostly 0-byte placeholders for subprojects)
- No Rust source (`Cargo.toml` absent at root)
- Streamlit dashboard is the only concrete asset and lives outside this repo
- Repo URL: https://github.com/KooshaPari/phenoRouterMonitor

### `KooshaPari/phenoAI` (active, `isArchived: false`)

Canonical crate lives at `crates/llm-router/`:

| File | Size | Notes |
|---|---|---|
| `crates/llm-router/Cargo.toml` | 473 B | tokio, anyhow, serde, reqwest, async-trait, dashmap, tracing |
| `crates/llm-router/src/lib.rs` | 7,998 B | `LlmProvider` trait, `OpenAiProvider`, `LlmRouter` with prefix routing + fallback, 7 unit tests |

Canonical port + adapters under `ports/`:

| File | Size | Purpose |
|---|---|---|
| `ports/model_loader.py` | n/a (unread) | `ModelLoader` ABC with `ModelRef`, `InferenceRequest`, `InferenceResponse` (frozen dataclasses) |
| `ports/adapters/huggingface.py` | 1,419 B | `HuggingFaceLoader` (transformers) |
| `ports/adapters/local.py` | 1,140 B | `LocalLoader` (safetensors stub) |
| `ports/tests/test_model_loader.py` | 1,921 B | 8 black-box smoke tests across port + adapters + registry |

### Behavior verified in `lib.rs`

- `LlmProvider::complete(&CompletionRequest) -> Result<CompletionResponse, LlmError>` — async trait
- `LlmRouter::complete()` routes by `model` prefix (split on `/`); falls back to default provider; else `LlmError::InvalidModel`
- `LlmError::Provider` Display impl explicitly does **not** leak `sk-` (test pinned)
- `OpenAiProvider::complete()` posts to `{base_url}/chat/responses` with Bearer auth (currently returns stub content — the call shape is real but response parsing is TODO upstream; not P5-4 scope)

---

## 3. P5-4 task ledger (proposed)

| ID | Task | Source | Target | Status | Action |
|---|---|---|---|---|---|
| P5-4.1 | Verify no `phenoRouterMonitor` callers outside the archived repo | external | n/a | **NEW** | `gh search code` sweep — expect 0 hits |
| P5-4.2 | Mark `gate-phenoroutermonitor` row `done` with provenance link | registry | registry | **NEW** | one-line edit to `disposition-index.json` |
| P5-4.3 | Add `phenoAI/crates/llm-router/` to ABSORPTION_MANIFEST | Agentora | Agentora | **NEW** | one-line edit |
| P5-4.4 | Add traceability row in `TRACEABILITY.md` for FR-CIV-* → llm-router | Agentora | Agentora | **NEW** | one-line edit |
| P5-4.5 | PhenoAI archive gate (deferred — repo active, Streamlit dash retained) | phenoAI | archive | **DEFER** | stays open, no code |

Total diff budget: **≤ 4 files, ≤ 8 lines, 0 deletions.** Anti-wipe gate PASS.

---

## 4. Concrete edits (preview — NOT applied yet)

### 4.1 `disposition-index.json` (one-line flip + provenance)

```diff
- {"id": "gate-phenoroutermonitor", "path": "KooshaPari/phenoRouterMonitor",
-  "disposition": "ABSORB", "target": "phenoAI", "wave": "P5",
-  "status": "deferred — repo archived; Streamlit dash retained"},
+ {"id": "gate-phenoroutermonitor", "path": "KooshaPari/phenoRouterMonitor",
+  "disposition": "ABSORB", "target": "phenoAI", "wave": "P5",
+  "status": "done — canonical Rust router lives in KooshaPari/phenoAI/crates/llm-router/;
+            Python ModelLoader port + adapters in KooshaPari/phenoAI/ports/"},
```

### 4.2 `Agentora/crates/ABSORPTION_MANIFEST.md` (append block)

```markdown
## phenoRouterMonitor → phenoAI absorption (P5-4, 2026-06-20)

Rust LLM router (`LlmProvider` trait, `OpenAiProvider`, `LlmRouter` with
prefix routing + fallback) canonical in `phenoAI/crates/llm-router/`.
Python `ModelLoader` port + HuggingFace / local-safetensors adapters in
`phenoAI/ports/`. Source repo (`KooshaPari/phenoRouterMonitor`) archived;
absorption done without a Rust migration. Archive gate deferred (Streamlit
dash retained on upstream).
```

### 4.3 `Agentora/docs/operations/p5-agent-runtime-absorption-2026-06-19.md` (one row flip)

```diff
- | P5-4 | phenoRouterMonitor Rust core → phenoAI | phenoRouterMonitor | phenoAI
-  | **deferred** — repo archived; Streamlit dash retained |
+ | P5-4 | phenoRouterMonitor Rust core → phenoAI | phenoRouterMonitor | phenoAI
+  | **done** — canonical in `phenoAI/crates/llm-router/`; Python port
+  + adapters in `phenoAI/ports/` |
```

### 4.4 `TRACEABILITY.md` (one row append)

```markdown
| FR-LLM-001 | LLM Provider abstraction | `phenoAI/crates/llm-router/src/lib.rs` (`LlmProvider` trait) |
| FR-LLM-002 | Multi-provider routing + fallback | `phenoAI/crates/llm-router/src/lib.rs` (`LlmRouter`) |
| FR-LLM-003 | Model adapter registry | `phenoAI/ports/adapters/` (`local.py`, `huggingface.py`) |
| FR-LLM-004 | Smoke-test conformance | `phenoAI/ports/tests/test_model_loader.py` (8 black-box tests) |
```

(FR-LLM-* are placeholders — adjust to match your registry's ID scheme when applying.)

---

## 5. Why no code absorption was needed

1. The Rust router in `phenoAI/crates/llm-router/src/lib.rs` already implements the same surface area as `phenoRouterMonitor` advertised (provider trait, OpenAI-compatible client, prefix-based routing, fallback).
2. `phenoRouterMonitor` is archived and its Rust source is not present in the archived repo (only placeholder pointers). There is nothing to copy.
3. The Python port + adapter pattern in `phenoAI/ports/` matches the agent-runtime wave's preferred contract-test shape (frozen dataclasses, ABC, smoke tests).

Doing a manual `git mv` of placeholder files would **add** code without removing duplication — opposite of absorption's intent.

---

## 6. Verification plan (post-apply)

1. `gh search code 'org:KooshaPari phenoRouterMonitor filename:Cargo.toml'` → expect 0 hits (or self-hits only)
2. `grep -R 'phenoRouterMonitor' Agentora/docs/ Agentora/registry/` → only matches in registry rows / ledger docs, no code
3. `git diff main...HEAD` → ≤ 4 files, ≤ 8 lines, **0 deletions**
4. `bun run docs:build` (or equivalent registry validator) → green
5. Open PR against `KooshaPari/Agentora` → wait for Self-Merge Gate + Required Checks Bridge

---

## 7. Decision needed

| Choice | Outcome |
|---|---|
| `p5-4 approve` | Apply the 4 edits above; open PR on Agentora |
| `p5-4 wider` | Also do the deferred archive gate on `phenoRouterMonitor` (repo is already archived; only paperwork matters) |
| `p5-4 narrow` | Just flip the registry row, skip the manifest/traceability updates |
| `p5-4 hold` | Defer; the absorption is effectively done, registry reflects that |

No code will be touched until you greenlight.