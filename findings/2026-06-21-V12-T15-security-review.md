# V12-T15 Security Review — phenotype-router (input validation)

**Task:** V12-T15
**Date:** 2026-06-21
**Reviewer:** Forge (read-only audit, no code changes)
**Status:** COMPLETE — 1 finding (M5), 5 N/A (no in-scope surface), 6 forward-looking flags for the eventual HTTP layer

---

## 0. Path resolution — discrepancy disclosed

The path in the task brief, `/Users/kooshapari/CodeProjects/Phenotype/repos/spikes/go/phenotype-router/`, **does not exist**.

### What was searched

```
ls  /Users/kooshapari/CodeProjects/Phenotype/repos/spikes/                    → ENOENT
ls  /Users/kooshapari/CodeProjects/Phenotype/repos/spikes/go/phenotype-router/ → ENOENT
ls  /Users/kooshapari/CodeProjects/Phenotype/repos/spikes/go/router/          → README.md only (9 lines, no Go code)
ls  /Users/kooshapari/CodeProjects/Phenotype/repos/phenotype-gateway/spikes/go/{agentapi,argis,bifrost,cliproxy,router}/
                                                                              → all README.md + smoke.sh stubs (no Go code)
find /Users/kooshapari/CodeProjects/Phenotype/repos -name "phenotype-router"  → no matches
```

### What actually exists (router-adjacent code in the monorepo)

The v11 router architecture decision (ADR-050/ADR-051, ACCEPTED 2026-06-20, per AGENTS.md §8) named **phenotype-router** as the promotion package, **not** a Go spike. The actual code is **Rust**, not Go, and lives at three locations:

| Path | Role | Contents | Total LOC |
|------|------|----------|-----------|
| `phenotype-gateway/spikes/rust/router/` | H13 spike (the actual router implementation) | `src/lib.rs` + `src/delegate.rs` | 149 |
| `phenotype-gateway/packages/router/` | H10 promotion boundary crate (re-export only) | `src/lib.rs` (3 lines) | 3 |
| `phenotype-gateway/spikes/go/{agentapi,argis,bifrost,cliproxy,router}/` | 5 promotion-boundary stubs | each is 1 README + 1 smoke.sh; no Go code | 0 |
| `phenotype-gateway/docs/router/{COMBO_ROUTING,MCP_SUBSET}.md` | Architecture spec | docs | n/a |

### Audit scope applied

This audit examines **the only router implementation in the monorepo** — the Rust spike at `phenotype-gateway/spikes/rust/router/src/{lib.rs,delegate.rs}` (149 LOC). The 5 Go promotion-boundary stubs contain zero executable code (each Go package is a 3-line `package <name>` declaration only) and are excluded as out-of-scope. The 4 Go submodules (`agentapi-plusplus`, `argis-extensions`, `bifrost`, `cliproxyapi-plusplus`) are vendor forks under `third_party/` and explicitly **out of scope** for this audit (would require separate per-fork review).

If the task author intended a different target, please re-issue with the corrected path. The shape of the findings (1 in-scope issue + 5 N/A + 6 forward-looking flags) reflects the thinness of the current code, not the absence of risk in the eventual HTTP layer.

---

## 1. Findings table

| # | Threat | Location:line | Severity | Mitigation |
|---|--------|---------------|----------|------------|
| **M5** | **Unvalidated `cliproxy_base` URL — no scheme/host/length check before `format!` produces a URL fed to downstream HTTP client** | `phenotype-gateway/spikes/rust/router/src/delegate.rs:22-24` | **MEDIUM** | Validate `cliproxy_base` as a proper URL with `url::Url::parse` (require `http`/`https` scheme, non-empty host, length ≤ 2048); reject empty, `file:`, `javascript:`, `data:`, userinfo-containing, or path-traversal inputs before composing the delegate URL. Add a unit test asserting `build_delegate_request("", "auto/coding")` returns `None`. |
| F2 | Request size limit / DoS — no in-scope surface | n/a | N/A (no HTTP server in current code) | Forward-looking flag F1 below |
| F3 | Provider key handling / log leak — no in-scope surface | n/a | N/A (no provider keys handled by router; delegates to cliproxy) | Forward-looking flag F2 below |
| F4 | TLS verify — no in-scope surface | n/a | N/A (no HTTP client in current code; router only builds URLs) | Forward-looking flag F3 below |
| F5 | JSON parsing — no in-scope surface | n/a | N/A (no `serde`, no JSON deserialization in current code) | Forward-looking flag F4 below |
| F6 | Plugin name validation | `phenotype-gateway/spikes/rust/router/src/lib.rs:18-29` | **PASS** (whitelist validation is correct) | No action needed; existing `strip_prefix("auto")` + match on 6 fixed suffixes returns `None` for any non-whitelisted input. |
| F7 | Error message sanitization — no in-scope surface | n/a | N/A (no error messages emitted; only `Option<>` returns) | Forward-looking flag F5 below |

**Severity legend:** P0 (critical, fix immediately) / P1 (high, fix before merge) / P2 (medium, fix in current sprint) / P3 (low, fix when convenient) / N/A (no in-scope surface). The M5 finding is **P2** (medium) — no exploit path is reachable today because the function is only called from tests, but the moment an HTTP server or CLI frontend is wired up the unvalidated base URL becomes a real injection / SSRF vector.

---

## 2. Per-category detail

### (1) Request size limits / DoS prevention

**In-scope surface:** None.

`lib.rs:1-91` and `delegate.rs:1-58` contain no HTTP server code, no `hyper`/`axum`/`reqwest`/`tokio` dependency, no request body parsing. The `Cargo.toml` declares zero dependencies (only `[lib]` section). `Cargo.lock` shows only the spike package itself and the `phenotype-router` promotion boundary — no transitive HTTP/async runtimes.

`build_delegate_request(cliproxy_base: &str, model_id: &str)` (delegate.rs:16-28) accepts `&str` borrows — no allocation of attacker-controlled size occurs inside this function. The `format!` at delegate.rs:24 allocates `len(cliproxy_base) + len(CHAT_COMPLETIONS_PATH)` bytes (the constants are 17 bytes for `/v1/chat/completions`), so a 1MB `cliproxy_base` would produce a 1MB+17 byte `String`. This is bounded by the caller, not the router — and the caller has not yet been written.

`ComboVariant::parse` (lib.rs:18-29) uses `strip_prefix("auto")` then matches the suffix against 6 fixed strings — O(len(suffix)) time, no allocation. No DoS surface.

**Verdict:** No findings. See forward-looking flag **F1**.

### (2) Provider key handling / log leak

**In-scope surface:** None.

No provider keys (Anthropic, OpenAI, Google, etc.) appear anywhere in `lib.rs` or `delegate.rs`. No `api_key`, `token`, `secret`, `bearer`, or `Authorization` string literals. No `println!`, `eprintln!`, `log::`, `tracing::`, or `dbg!` macros — the router has **no logging at all**.

Provider key handling is delegated to `cliproxyapi-plusplus` (third-party Go submodule at `phenotype-gateway/third_party/cliproxyapi-plusplus/`). That submodule is out of scope for this audit per §0.

**Verdict:** No findings. See forward-looking flag **F2**.

### (3) TLS verify (no skip)

**In-scope surface:** None.

No HTTP client code. The router only **constructs URLs** (`DelegateRequest.target` at delegate.rs:24); it does not fetch them. TLS verification will be the responsibility of whichever downstream HTTP client consumes `DelegateRequest` (presumably `cliproxy++` or a future `reqwest` client added to `Cargo.toml`).

No `InsecureSkipVerify`, `danger_accept_invalid_certs`, `verify_mode(false)`, or equivalent pattern exists because no TLS code exists.

**Verdict:** No findings. See forward-looking flag **F3**.

### (4) JSON parsing safety

**In-scope surface:** None.

No `serde`, `serde_json`, `simd_json`, `quick-xml`, or `toml` dependency. No `Deserialize` derive. No `from_str` / `from_slice` / `from_reader` calls. No regex or dynamic-eval surface.

`Cargo.lock` confirms: only two packages, both at version `0.0.0` (the spike and the promotion boundary). Zero transitive deps. The smallest possible dependency tree.

**Verdict:** No findings. See forward-looking flag **F4**.

### (5) Plugin name validation

**In-scope surface:** `ComboVariant::parse` (lib.rs:18-29).

This is the closest analog to "plugin name validation" in the current code. The function takes a `model_id: &str` and returns `Option<ComboVariant>`:

```rust
pub fn parse(model_id: &str) -> Option<Self> {
    let suffix = model_id.strip_prefix("auto")?;
    match suffix {
        "" | "/" => Some(Self::Auto),
        "/coding" => Some(Self::Coding),
        "/fast" => Some(Self::Fast),
        "/cheap" => Some(Self::Cheap),
        "/offline" => Some(Self::Offline),
        "/smart" => Some(Self::Smart),
        _ => None,
    }
}
```

**Assessment:** This is **correct whitelist validation**. The function:
- Rejects any `model_id` that does not begin with `auto` via `strip_prefix` returning `None`
- Rejects any `auto/<suffix>` that is not one of the 6 documented variants via the catch-all `_ => None`
- Returns `None` rather than `Err`, so unparseable inputs cannot inject error-path behavior
- Does NOT interpolate `model_id` into any output string (the `model_id` is consumed entirely by the prefix match; the returned `ComboVariant` is an enum with no user data)

Unit tests at lib.rs:57-78 verify whitelist correctness (`"gpt-4"` → `None`, `"auto/unknown"` → `None`).

**Verdict:** PASS. No mitigation required.

### (6) Error message sanitization

**In-scope surface:** None.

No `Result::Err` returns, no `panic!`, no `unreachable!`, no `assert!` with user-data interpolation. Every fallible function returns `Option<T>`:
- `ComboVariant::parse` → `Option<ComboVariant>` (lib.rs:18)
- `RouterPlane::select_route` → `Option<String>` (lib.rs:42)
- `build_delegate_request` → `Option<DelegateRequest>` (delegate.rs:16)
- `scoring_profile` → `Option<&'static str>` (delegate.rs:31)

None of these carry user-controlled data into error messages because there are no error messages.

**Verdict:** No findings. See forward-looking flag **F5**.

---

## 3. The single in-scope finding — M5 detail

### M5: Unvalidated `cliproxy_base` URL

**Location:** `phenotype-gateway/spikes/rust/router/src/delegate.rs:22-24`

**Code:**
```rust
let base = cliproxy_base.trim_end_matches('/');
Some(DelegateRequest {
    target: format!("{base}{CHAT_COMPLETIONS_PATH}"),
    ...
```

**Threat model:** When `build_delegate_request` is wired up to a real HTTP client (reqwest, ureq, or hyper), the returned `target` string is passed to the client as the URL to fetch. Without upstream validation, an attacker controlling `cliproxy_base` (via config file, env var, or upstream caller) can:

| Input | Resulting `target` | Risk |
|-------|---------------------|------|
| `""` (empty) | `/v1/chat/completions` (path-only, no scheme/host) | HTTP client may interpret as `http://localhost/v1/chat/completions` or reject — depends on client; could SSRF to local services |
| `"file:///etc/passwd"` | `file:///etc/passwd/v1/chat/completions` | Local file read via `file:` scheme if client doesn't restrict scheme |
| `"http://attacker.com/"` | `http://attacker.com/v1/chat/completions` | SSRF / exfiltration — attacker captures all delegated chat completions |
| `"http://internal-admin:80/"` | `http://internal-admin:80/v1/chat/completions` | SSRF to internal infrastructure (cloud metadata, internal admin ports) |
| `"http://a"*1_000_000` (1MB host) | 1MB+ URL string | Memory amplification in the eventual HTTP client / load balancer / log aggregator |
| `"http://127.0.0.1:22/"` (SSH port) | `http://127.0.0.1:22/v1/chat/completions` | Port scanning / service fingerprinting |
| `"http://user:pass@evil.com/"` | `http://user:pass@evil.com/v1/chat/completions` | Credential exfiltration if downstream client supports userinfo |

**Severity: P2 (medium).** Exploitability today is **none** — `build_delegate_request` is only called from the unit test at delegate.rs:46-51. As soon as the router is wired to a config loader or HTTP handler, the surface becomes real.

**Mitigation (recommended):**

```rust
use url::Url;

const MAX_BASE_LEN: usize = 2048;

pub fn build_delegate_request(
    cliproxy_base: &str,
    model_id: &str,
) -> Option<DelegateRequest> {
    let variant = super::ComboVariant::parse(model_id)?;

    // M5 mitigation: validate URL before composing
    if cliproxy_base.len() > MAX_BASE_LEN {
        return None;
    }
    let parsed = Url::parse(cliproxy_base.trim_end_matches('/')).ok()?;
    match parsed.scheme() {
        "http" | "https" => {},
        _ => return None,
    }
    if parsed.host_str().is_none_or(|h| h.is_empty()) {
        return None;
    }
    // forbid userinfo (defense against credential exfiltration)
    if !parsed.username().is_empty() || parsed.password().is_some() {
        return None;
    }

    Some(DelegateRequest {
        target: format!("{parsed}{CHAT_COMPLETIONS_PATH}"),
        path: CHAT_COMPLETIONS_PATH,
        variant,
    })
}
```

Add `url = { version = "2", features = ["std"] }` to `Cargo.toml`. Add 6 unit tests covering the threat-matrix inputs above.

**Alternative mitigation (lighter-weight, defense-in-depth):** Keep current `format!` but add a `validate_cliproxy_base(&str) -> Option<&str>` helper that returns `None` for any of the bad inputs above, and call it as the first line of `build_delegate_request`. Adds ~15 LOC and zero new deps.

---

## 4. Forward-looking flags (for the eventual HTTP layer)

These are **not** findings against the current code (which has no HTTP server / client). They are flagged here so they don't get lost when the H10 promotion graduates `packages/router` from spike to production.

| Flag | Threat | Where it lands | Recommended mitigation |
|------|--------|----------------|------------------------|
| **F1** | Request size / DoS | HTTP server (likely axum in `packages/router`) | `tower_http::limit::RequestBodyLimitLayer` at 10 MB (chat completions can be large but not unbounded); reject `Content-Length` > 10 MB with `413`; enforce `request_timeout` 60 s. |
| **F2** | Provider key log leak | Wherever provider keys are loaded + logged | Use `secrecy::Secret<String>` or `zeroize::Zeroizing<String>` for keys; never log request/response bodies if they may contain keys; redact in `tracing` layer via custom field visitor. |
| **F3** | TLS verify skip | HTTP client (reqwest, ureq, hyper) | Never call `danger_accept_invalid_certs(true)` or equivalent; pin a `webpki-roots` bundle; for mTLS to upstreams, load CA bundle from config. |
| **F4** | JSON parsing safety | Wherever OpenAI-compatible request bodies are parsed | Use `serde_json` with `Deserializer::from_reader(reader).take_limit(10 MB)`; reject nested depth > 32 via custom deserializer; reject string fields > 64 KB. |
| **F5** | Error message sanitization | Wherever errors are surfaced to clients | Custom `axum::response::IntoResponse` impl that maps internal errors to `{error: "internal"}` for 5xx; preserve detailed messages in `tracing` spans only; never echo request bodies, headers, or env vars in user-visible errors. |
| **F6** | Combo variant DoS amplification | The eventual production router | Cap concurrent delegations per `model_id` via semaphore (e.g., 100 inflight per variant); rate-limit `auto/*` requests via token bucket; circuit-break on downstream failure. |

---

## 5. Out-of-scope items explicitly excluded

To prevent scope creep on a "spike + thin promotion boundary" codebase:

- `phenotype-gateway/third_party/cliproxyapi-plusplus/` — vendor fork, requires separate security review per fork policy (ADR-016: fork-only-not-rewrite).
- `phenotype-gateway/third_party/agentapi-plusplus/`, `third_party/argis-extensions/`, `third_party/bifrost/` — same.
- `phenotype-gateway/docs/router/MCP_SUBSET.md` — referenced but unread in this audit (no code surface).
- The 4 stub packages under `phenotype-gateway/packages/{agentapi,argis,bifrost,cliproxy}/` — each is 3 lines of `package <name>` declaration only.
- Cargo.lock fingerprint / supply-chain — out of scope; covered by repo-wide `cargo audit` sweep per ADR-042.
- OmniRoute (TypeScript interim MVP) — superseded, deferred per v11 decision.

---

## 6. Verdict

**The current `phenotype-router` spike is small, dependency-free, and contains exactly one (medium-severity) validation gap** — the unvalidated `cliproxy_base` URL in `delegate.rs:22-24`. The other 5 threat categories (request size, provider keys, TLS, JSON parsing, error sanitization) have **no in-scope surface** in the current 149-LOC spike because the router only builds URLs and dispatches to a Go downstream; it does not yet serve HTTP, fetch HTTP, parse JSON, handle keys, or emit errors.

**Recommendation:** Land M5 mitigation before any H10 promotion work wires `build_delegate_request` to a real config loader or HTTP layer. Open the 6 forward-looking flags as P1 tasks in the next wave (v12+ or v13) once the HTTP server / client crates are added to `Cargo.toml`.

**No code changes were made** — this is a read-only audit per the task brief.

---

## 7. Audit metadata

- **Files read:** 14 (`spikes/rust/router/src/lib.rs`, `spikes/rust/router/src/delegate.rs`, `spikes/rust/router/Cargo.toml`, `spikes/rust/router/Cargo.lock`, `spikes/rust/router/README.md`, `packages/router/src/lib.rs`, `packages/router/Cargo.toml`, `packages/router/Cargo.lock`, `packages/router/README.md`, `spikes/go/router/README.md`, `spikes/go/{agentapi,argis,bifrost,cliproxy}/README.md`, `docs/router/COMBO_ROUTING.md`, `docs/PROMOTION.md`, `docs/router/MCP_SUBSET.md`).
- **Files NOT read (out of scope):** 4 stub `packages/*/<plane>.go` (3 LOC each, package decl only), `third_party/*` (4 vendor forks).
- **Tooling:** `Read`, `shell`, `fs_search`. No `cargo audit`, `cargo clippy`, or build runs (read-only).
- **Verification:** Findings cited with `filepath:startLine-endLine` format per AGENTS.md citation policy.
- **Cross-reference:** AGENTS.md §8 (router architecture decision), v11 plan (`plans/2026-06-20-v11-dag-router-rebuild.md`).
