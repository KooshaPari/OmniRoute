# OmniRoute Rust Foundation Fix — record_call_log await bugs

**Session:** 20260705-omniroute-backend-rewrite
**Date:** 2026-07-05 08:00Z
**Author:** root (manager)
**Branch:** `feat/omni-foundation-2026-07-05`
**Commit:** `686eb215e fix(omni-server): await record_call_log futures (4 sites)`
**Pushed:** yes (new branch on origin)

---

## The bug

In `crates/omni-server/src/dispatcher.rs`, the `record_call_log` helper is
declared `async fn` (line 657). It returns a `Future` that, when polled,
inserts a row into the `call_logs` table. The 4 call sites were:

| Site | Function | Indent | Original |
|------|----------|--------|----------|
| line 293 | `complete_chat` | 20sp | `self.record_call_log(...);` (no await) |
| line 510 | `dispatch_embeddings` (error path) | 12sp | `self.record_call_log(...);` |
| line 531 | `dispatch_embeddings` (success path) | 8sp | `self.record_call_log(...);` |
| line 598 | `dispatch_anthropic_messages` | 20sp | `self.record_call_log(...);` |

`cargo check` flagged all 4 as `unused implementer of futures::Future that must be used`.
The 5th site (line 437, the streaming path) was already correct: `app.dispatcher_record_call_log(...).await`.

The futures were constructed but never polled, so the call_log rows for
non-streaming OpenAI chat, embeddings, and Anthropic messages were silently
never inserted. The audit log is the contract for billing and observability
— this is a production-readiness bug.

## The fix

Add `.await` to each of the 4 sites. Each call is inside an `async fn`, so
the future can be awaited in-line. No signature changes, no shims, no
behavioural changes for the caller — just `poll()` the future that the
function already returned.

| Before | After |
|--------|-------|
| `self.record_call_log(&ctx, &handle.id.0, status, usage, None);` | `self.record_call_log(&ctx, &handle.id.0, status, usage, None).await;` |

4 lines changed, 4 insertions, 4 deletions, 1 file.

## Verification

```
$ cargo check -p omni-server
warning: `omni-server` (lib) generated 16 warnings (run `cargo fix --lib -p omni-server` to apply 13 suggestions)
    Finished `dev` profile [unoptimized + debuginfo] target(s) in 2.01s

$ cargo test --workspace
... all suites pass ... 141 tests passing (same as before)

$ cargo clippy -p omni-server --all-targets
warning: `omni-server` (lib) generated 150 warnings (run `cargo clippy --fix --lib -p omni-server -- ` to apply 87 suggestions)
    Finished `dev` profile [unoptimized + debuginfo] target(s) in 0.72s
```

- cargo check: 20 -> 16 warnings (-4 unused-Future warnings gone)
- cargo test: 141 -> 141 tests pass (no regressions)
- cargo clippy: 150 warnings (mostly auto-fixable style; not blocking the foundation)

The remaining 16 cargo warnings are unused variables, unused imports, and
dead-code in `omni-server` (e.g. `CallContext::surface` is never read).
None are bugs. The 150 clippy lints are mostly `default_trait_access`,
`needless_pass_by_value`, etc. — quality, not correctness.

## What's now possible that wasn't before

- Non-streaming OpenAI chat completions are now correctly billed and
  recorded in `call_logs` (was silently dropped before).
- Non-streaming Anthropic messages are now correctly billed and recorded
  (was silently dropped before).
- Embeddings (success and error paths) are now correctly recorded
  (were silently dropped before).
- The audit log is now complete for the OpenAI / Anthropic / Embeddings
  surfaces, which is the contract for billing and observability.

## What still needs work (not in this commit)

- The remaining 16 unused/import warnings and 150 clippy lints are
  quality, not correctness. They are a separate lane ("PR-0.5: lint
  cleanup") and can land after the foundation slice is fully covered by
  the strangler-fig migration.
- The `stream_chat` path (line 315) is the only remaining surface that
  needs an audit-log record. The streaming dispatch already records via
  `app.dispatcher_record_call_log(...).await` at line 444 inside the
  stream-end cleanup, so streaming is correct. But the records land AFTER
  the response is fully streamed, not at first-byte; document this
  semantic in the API reference.

## Out of scope (deferred to other PRs)

- PR-1 (RouterPort + Provider traits) — separate lane.
- PR-2 (OpenAI provider port) — separate lane.
- Strangler-fig migration plan — separate lane.

---

**End of foundation-fix note.** Branch pushed, commit `686eb215e` on
`feat/omni-foundation-2026-07-05`. PR creation is a sponsor gate; this
commit is on a feature branch, ready for review when the user signals.
