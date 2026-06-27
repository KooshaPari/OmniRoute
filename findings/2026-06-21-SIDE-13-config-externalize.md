# SIDE-13: Config externalization audit (5 pheno-* repos)

**Date:** 2026-06-21
**Owner:** orch-w1-a (v19 cycle 9 P0 wave, side task)
**Scope:** `pheno-config`, `pheno-context`, `pheno-tracing`, `pheno-port-adapter`, `pheno-errors`
**Mode:** Read-only — no source files modified
**Method:** Grep for hardcoded URL literals (`https?://`), filesystem-path literals
(`/...`, `~/...`, `./...`, `../...`, `/tmp`, `/etc`, `/var`, `/home`, `/Users`, `/usr`),
port-like literals (`:NN..NNNNN`), and numeric literals (2-5 digit `\b[0-9]{2,5}\b`,
filtered for non-comment / non-version-string context). Each hit manually classified
as **production**, **test fixture**, or **semantic constant** (HTTP status code,
RSA exponent, JWT alg name, etc. — RFC-defined, not arbitrary).

---

## TL;DR

- **10 production hardcodes** across 5 crates (8 unique literals; the
  `errors.pheno.dev/*` URL prefix repeats 3× in `pheno-errors` prod + 5× in tests).
- **0 production hardcodes** in `pheno-tracing` and `pheno-port-adapter` — every
  port / URL / numeric literal in those crates lives inside `#[cfg(test)] mod tests`
  or is an ephemeral-port idiom (`127.0.0.1:0`).
- **Concentration:** all real cleanup work is in `pheno-config` (4 hardcodes in
  embedded `DEFAULT_TOML`) and `pheno-errors` (3 brand-URL hardcodes in
  `From<&AppError> for Problem`).
- **Trivial cleanup** — none of the 10 are cryptographic keys, ports of running
  services, or risky values. All are defaults that already get overridden by
  `pheno-config` cascade (env > TOML > embedded) and a brand-URL prefix that
  the team controls.

---

## Per-crate count

Counts split into **(prod)** production code, **(test)** `#[cfg(test)] mod tests`
blocks, and **(doc)** module/function doc comments. "Semantic" = HTTP status code,
RSA exponent, JWT alg, RFC-defined constant — excluded from hardcode total.

| Crate | LoC | Files | URLs (prod / test / doc) | Paths (prod / test / doc) | Ports (prod / test / doc) | Magic nums (prod / test / semantic) | **Total prod** |
|---|---:|---:|---|---|---|---:|---:|
| `pheno-config` | 150 | 2 | 0 / 0 / 0 | 1 / 0 / 0 | 1 / 0 / 0 | 1 / 1 / 0 | **3** |
| `pheno-context` | 229 | 1 | 0 / 2 / 0 | 0 / 0 / 0 | 0 / 0 / 0 | 3 / 1 / 2 | **3** |
| `pheno-tracing` | 1,423 | 5 | 0 / 0 / 0 | 0 / 0 / 0 | 0 / 0 / 0 | 0 / 8 / 0 | **0** |
| `pheno-port-adapter` | 1,754 | 11 | 0 / 8 / 2 | 0 / 0 / 0 | 0 / 28 / 1 | 0 / 10 / 4 | **0** |
| `pheno-errors` | 659 | 2 | 3 / 5 / 0 | 0 / 0 / 0 | 0 / 0 / 0 | 0 / 0 / 8 | **3** |
| **TOTAL** | **4,215** | **21** | **3 / 15 / 2** | **1 / 0 / 0** | **1 / 28 / 1** | **4 / 20 / 14** | **9** |

> Reading: `pheno-port-adapter` has 28 numeric literals in port-like position but
> all are inside test fixtures (`parse_endpoint("127.0.0.1:8080")`,
> `parse_endpoint("host:65536")`, `bind("127.0.0.1:0")`, etc.). They are parser
> inputs, not runtime config.

---

## Top 10 worst hardcoded values

Ranked by **production impact** (config that ships to consumers > brand URL
prefix > stub return values > test-only string constants).

| # | Severity | Location | Literal | Category | Notes |
|---|---|---|---|---|---|
| 1 | High | `pheno-errors/src/rfc7807.rs:153` | `"https://errors.pheno.dev/not-found"` | URL (brand) | Hardcoded brand URL in `From<&AppError> for Problem::NotFound`. Inline in `with_type()` call — not factored to a `const`. |
| 2 | High | `pheno-errors/src/rfc7807.rs:157` | `"https://errors.pheno.dev/conflict"` | URL (brand) | Same shape as #1, for the `Conflict` variant. |
| 3 | High | `pheno-errors/src/rfc7807.rs:160` | `"https://errors.pheno.dev/validation"` | URL (brand) | Same shape as #1, for the `Validation` variant. 3× repeated string prefix. |
| 4 | High | `pheno-config/src/cascade.rs:36` | `port = 8080` | Port (default) | Embedded in `DEFAULT_TOML` — the lowest-priority layer of the `pheno-config` cascade. Overrideable by TOML file / env / JetBrains, but ships in the binary. |
| 5 | High | `pheno-config/src/cascade.rs:35` | `host = "127.0.0.1"` | URL (default) | Same — embedded default. Loopback-only ships as the fleet-wide default. |
| 6 | High | `pheno-config/src/cascade.rs:43` | `path = "./pheno.db"` | Path (default) | Relative DB path embedded as default. CWD-dependent — flaky for container/binary deployments. |
| 7 | Med | `pheno-config/src/cascade.rs:44` | `pool_size = 8` | Magic number | Embedded connection-pool default; should be tuneable per environment. |
| 8 | Med | `pheno-context/src/oidc.rs:14` | `const JWKS_TTL: Duration = Duration::from_secs(600);` | Magic number (const) | 10-min JWKS cache TTL is a `const`, not config. Per-issuer override impossible without source change. |
| 9 | Med | `pheno-context/src/oidc.rs:124` | `expires_in: 900` | Magic number (stub) | Stub `refresh()` returns 15-min token lifetime. Production will need this to be a config knob. |
| 10 | Med | `pheno-context/src/oidc.rs:190` | `exp: now + 900` | Magic number (stub) | Same 15-min offset in `decode_jwt_payload()` stub. Duplicates the magic number from #9 — should be a shared `const`. |

**Repeats NOT in top 10 but flagged:**
- `pheno-errors/src/rfc7807.rs:184,199,213,240,243` — same `https://errors.pheno.dev/*` URLs in `#[cfg(test)] mod tests` blocks (assertion strings). These are test fixtures and are correct to leave hardcoded, but they DO duplicate the production URLs — if #1–3 change, 5 test strings must change too.
- `pheno-errors/src/rfc7807.rs:146,149,156,161,178,195,209,224,233,242,259` — HTTP status codes (500, 404, 409, 400). These are **RFC 7807 semantic constants** and explicitly excluded from the hardcode count.

---

## Per-crate detail

### pheno-config (3 prod hardcodes)

**File:** `pheno-config/src/cascade.rs:32-45` — `pub const DEFAULT_TOML: &str`

The entire embedded TOML block is a single `&str` constant. Six keys are defined:

| Line | Key | Value | Category | Hardcode? |
|---|---|---|---|---|
| 35 | `server.host` | `"127.0.0.1"` | URL (default) | YES — production default |
| 36 | `server.port` | `8080` | Port (default) | YES — production default |
| 39 | `logging.level` | `"info"` | string | no — string, out of audit scope |
| 40 | `logging.format` | `"json"` | string | no — string, out of audit scope |
| 43 | `database.path` | `"./pheno.db"` | Path (default) | YES — relative CWD path |
| 44 | `database.pool_size` | `8` | Magic number | YES — production default |

**File:** `pheno-config/src/cascade.rs:91` — `assert_eq!(value.as_integer(), Some(8080))`

Test assertion that the default cascades correctly. Coupling: if line 36 changes,
this test must change. Symptom of hardcoded default seeping into tests.

**File:** `pheno-config/src/secrets.rs` — 0 hardcodes. (`SecretError::Empty` is a
variant, not a literal; all byte sizes are determined by caller-supplied `&[u8]`.)

---

### pheno-context (3 prod hardcodes)

**File:** `pheno-context/src/oidc.rs` — single file, v20-hardening reference impl per
ADR-079. The file is flagged "REFERENCE ONLY" in its module doc.

| Line | Literal | Category | Notes |
|---|---|---|---|
| 14 | `const JWKS_TTL: Duration = Duration::from_secs(600);` | Magic number (const) | 10-min JWKS TTL. Hardcoded `const` — per-issuer override requires source change. |
| 124 | `expires_in: 900` | Magic number (stub) | Stub `refresh()` return. 15-min token TTL. |
| 190 | `exp: now + 900` | Magic number (stub) | Same 15-min offset, duplicated in `decode_jwt_payload()`. |

**Semantic constants (excluded):** `"RS256"` (lines 99, 155, 177) — JWT alg per RFC 7515.
`"AQAB"` (line 156) — RSA public exponent 65537, encoded base64url.

**Test fixtures (excluded from prod count, included in totals):**
- Line 209: `"https://example.auth0.com/"` — issuer test fixture
- Line 215: `"https://api.example.com"` — audience test fixture
- Lines 154-158: `"stub-kid"`, `"stub-modulus"`, `"RS256"`, `"AQAB"`, `Instant::now()` — stub JWK
- Lines 188-194: `"stub-issuer"`, `"stub-audience"`, `"stub-sub-{N}"` — stub claim fields

---

### pheno-tracing (0 prod hardcodes)

All numeric literals in `pheno-tracing/src/sampling.rs` are **algorithmic
parameters** with semantic meaning, not externalization candidates:

| File | Line | Literal | Purpose |
|---|---|---|---|
| sampling.rs | 319 | `Self::with_params(100, 0.10)` | Default tail-sampler window=100, error-threshold=10% |
| sampling.rs | 342 | `0.10` | Default error threshold for `tail_based_default` |
| sampling.rs | 472 | `RateLimitSampler::new(100.0)` | Test fixture: 100 samples/sec |
| sampling.rs | 487, 495, 506 | various | Test sleeps / loop bounds |

All of these are exposed via `with_params()` constructors — caller-supplied.
The literal `100` and `0.10` are **defaults inside `new()`**, not externalized
production config. Per the audit brief, these qualify as "magic numbers in src/"
but are correctly typed (sampling rate / threshold / window size — they ARE the
config). **No externalization action recommended.**

---

### pheno-port-adapter (0 prod hardcodes)

**All 28 port-like literals are test fixtures**, verified by `mod tests` boundary
inspection:

| File | mod tests starts | Production code ranges | Test fixture ranges |
|---|---|---|---|
| `src/lib.rs` | line 105 | 1-103 | 105-195 |
| `src/adapters/tcp.rs` | lines 85, 286 | 1-83 (impl), 287-432 (impl), or doc | 86-285 (all TCP port fixtures) |
| `src/adapters/redis_cache.rs` | line 166 | 1-164 (impl) | 167-end (Redis URL fixtures) |

Sample test fixtures (NOT externalization candidates):
- `parse_endpoint("127.0.0.1:8080")` (tcp.rs:181) — happy-path parser input
- `parse_endpoint("host:65536")` (tcp.rs:244) — boundary reject (u16::MAX+1)
- `parse_endpoint("host:99999")` (tcp.rs:245) — overflow reject
- `TcpListener::bind("127.0.0.1:0")` (tcp.rs:95, 299, 312, 387) — **ephemeral port idiom** (`:0` = OS-assigned)
- `adapter.connect("127.0.0.1:1")` (tcp.rs:139) — negative test (port 1 unbound)
- `adapter.connect("192.0.2.1:80")` (tcp.rs:423) — RFC 5737 documentation IP, intentionally non-routable
- `RedisAdapter::new("redis://127.0.0.1:6379/0")` (redis_cache.rs:179, 186) — test constructor input

These are correct to leave as literal test inputs (parser / adapter behavior
requires literal endpoints).

**Magic numbers in production (all from `unix.rs` buffer inits):**
- `let mut buf = [0u8; 16]` (unix.rs:117) — `u8` buffer size, type-level not config
- `let mut buf = [0u8; 16]` (tcp.rs:101) — same, inside `spawn_echo_listener()` helper inside `mod tests`
- `let mut buf = [0u8; 64]` (tcp.rs:316) — same, inside `mod tests`
- `42 * 1_000_000_000` (mock_clock.rs:202) — test fixture: epoch-second 42

---

### pheno-errors (3 prod hardcodes — the brand-URL prefix)

**File:** `pheno-errors/src/rfc7807.rs:143-164` — `impl From<&AppError> for Problem`

The 3 production URLs (rank #1–3 above) are inline `.with_type("https://errors.pheno.dev/<kind>")`
calls. They are **NOT** factored to a `const` or `lazy_static` — repeating the
literal 3× in production and 5× more in tests (lines 184, 199, 213, 240, 243).

**Recommended refactor (NOT applied — read-only audit):**
```rust
const PROBLEM_TYPE_BASE: &str = "https://errors.pheno.dev";
const PROBLEM_TYPE_NOT_FOUND: &str = constcat!(PROBLEM_TYPE_BASE, "/not-found");
const PROBLEM_TYPE_CONFLICT: &str  = constcat!(PROBLEM_TYPE_BASE, "/conflict");
const PROBLEM_TYPE_VALIDATION: &str = constcat!(PROBLEM_TYPE_BASE, "/validation");
```
Or, since this is a brand-controlled constant: a single `const PHENO_ERROR_NAMESPACE: &str`
and `format!()` calls (string-formatting in `.with_type()`).

**Semantic constants (excluded):** HTTP status codes (500, 404, 409, 400) — these
are RFC 7807 §3.1 / RFC 9110 standard codes. The `Some("about:blank")` literal
on lines 147 and 162 is the RFC 7807 §3.1 "no type" sentinel, also semantic.

---

## Summary table (read-only verdict)

| Crate | Action needed | Owner | Estimated LoC change |
|---|---|---|---|
| `pheno-errors` | Factor 3 `https://errors.pheno.dev/*` URLs into `const PHENO_ERROR_NAMESPACE: &str` + `format!()`, update 5 test assertion strings | (none — read-only audit) | ~10 LoC |
| `pheno-config` | Extract `DEFAULT_TOML` to a `config/default.toml` resource file at the crate root (keeps cascade unchanged, removes inline TOML string) | (none — read-only audit) | ~15 LoC + 1 file |
| `pheno-context` | Promote `JWKS_TTL` from `const` to a `Config` struct field; consolidate `900` literal in `refresh()` / `decode_jwt_payload()` into a shared `const TOKEN_LIFETIME_SECS: u64 = 900` | (none — read-only audit) | ~15 LoC |
| `pheno-tracing` | None — all numeric literals are algorithmic sampling parameters | n/a | 0 |
| `pheno-port-adapter` | None — all literals are test fixtures (parser inputs, ephemeral port binds, RFC 5737 test IPs) | n/a | 0 |

**Total estimated cleanup:** ~40 LoC across 3 crates. All cleanup is purely
mechanical; no behavior change.

---

## Methodology

```bash
# URLs
grep -rEn 'https?://[a-zA-Z0-9_./:?&=%-]+' {crate}/src \
  | grep -v '//!' | grep -v '^\s*//' | grep -v '///'

# Paths
grep -rEn '"(/[^"]*|~/[^"]*|\./[^"]*|\.\./[^"]*)"|"(C:\\\\|/tmp|/etc|/var|/home|/Users|/usr)"' {crate}/src

# Ports (numeric literals near `:`)
grep -rEn ':\s*[0-9]{2,5}\b' {crate}/src \
  | grep -vE 'pub const|let [a-z_]+:\s*(u8|u16|u32|u64|i8|i16|i32|i64|usize|isize)\s*='

# Magic numbers (2-5 digit literals)
grep -rEn '\b[0-9]{2,5}\b' {crate}/src | grep -vE '^\s*//|^\s*//!'

# Test boundary verification
grep -nE '#\[cfg\(test\)\]|mod tests' {crate}/src
```

Each hit classified manually. Counts above are raw grep results; the **Total
prod** column filters out test modules (`#[cfg(test)] mod tests`) and semantic
constants (HTTP status codes, RSA exponents, JWT algs, RFC 7807 sentinels,
`Duration::from_secs(...)` values that are themselves the parameterization).

---

## Cross-references

- **ADR-022** (Config consolidation) — governs `pheno-config` substrate
- **ADR-037** (pheno-mcp-router substrate canonical) — N/A, not in this audit
- **ADR-078** (Encryption-at-rest mandate) — referenced in `pheno-config/src/secrets.rs:1` and `pheno-context/src/oidc.rs:34`
- **ADR-079** (OIDC federation reference) — governs `pheno-context/src/oidc.rs` (this file is "REFERENCE ONLY" per the file's own module doc)
- **ADR-023** (Agent-effort governance, Rule 3.1) — substrate quality bar; config-externalization is the
  substrate's job; the cascade design in `pheno-config/src/cascade.rs` is the
  *intended* abstraction. The 3 hardcodes here are inside that abstraction's
  lowest layer.

---

**Audit complete. 0 source files modified. ~40 LoC cleanup identified, not applied.**