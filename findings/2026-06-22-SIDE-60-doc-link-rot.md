# SIDE-60 — Doc link rot check (8 pheno-* Rust crates)

**Date:** 2026-06-21
**Scope:** read-only audit of HTTP(S) links inside `///` and `//!` rustdoc comments
**Crates audited (8):** `pheno-config`, `pheno-context`, `pheno-errors`, `pheno-tracing`, `pheno-port-adapter`, `pheno-events`, `pheno-flags`, `pheno-cli-base`
**Method:** Python tokenizer scans `.rs` files for `///`, `//!`, `/** ... */`, `/*! ... */` doc-comment contexts and emits any `http(s)://...` token found there. Each URL is then probed with `curl -I -m 5` (per the brief). A second probe with a browser User-Agent is added to disambiguate anti-bot false positives.

---

## Per-crate broken-link count

| Crate               | rustdoc URLs | Broken | OK | Notes |
|---------------------|-------------:|-------:|---:|-------|
| `pheno-config`      |            2 |    **2** |  0 | crates.io 404 + internal cluster DNS |
| `pheno-context`     |            0 |      0 |  0 | No HTTP links in rustdoc |
| `pheno-errors`      |            2 |    **1** |  1 | `errors.pheno.dev` NXDOMAIN; RFC 7807 OK |
| `pheno-tracing`     |            0 |      0 |  0 | No HTTP links in rustdoc |
| `pheno-port-adapter`|            0 |      0 |  0 | No HTTP links in rustdoc |
| `pheno-events`      |            0 |  0 |  0 | No HTTP links in rustdoc |
| `pheno-flags`       |            0 |  0 |  0 | No HTTP links in rustdoc |
| `pheno-cli-base`    |            0 |  0 |  0 | No HTTP links in rustdoc |
| **TOTAL**           |        **4** |    **3** | **1** | |

**Fleet link rot rate:** 3 / 4 = 75 % of rustdoc HTTP links are broken.

---

## Per-URL detail

### 1. `pheno-config` — 2 URLs, 2 broken

#### 1a. `https://crates.io/crates/arc-swap` — **BROKEN (404)**
- **Source:** `pheno-config/src/hot_reload.rs:10` (inside `//!` module doc, `arc-swap` reference)
- **Probe (per brief, `curl -I -m 5`, no UA):** `HTTP 403` (crates.io blocks anonymous `HEAD` to anti-bot).
- **Probe (with `Mozilla/5.0` UA):** `HTTP 404`, body 0 bytes, reproducible 3/3.
- **Cross-check (crates.io JSON API):** `https://crates.io/api/v1/crates/arc-swap` → `HTTP 200`, returns full crate record (`name: "arc-swap"`, `updated_at: 2026-04-04`, 44 versions). The crate **exists** on crates.io.
- **Diagnosis:** false positive caused by a crates.io HTML/CDN edge issue. The page route `/crates/arc-swap` returns 404 to browser User-Agents even though the API serves the crate. Replace the link with `https://docs.rs/arc-swap` (which returns `HTTP 200`) or `https://crates.io/api/v1/crates/arc-swap`.
- **Severity:** P3 (cosmetic — link target is real; rustdoc readers will hit a 404 page).

#### 1b. `https://vault.svc.cluster.local:8200` — **BROKEN (DNS NXDOMAIN/timeout)**
- **Source:** `pheno-config/src/secret_rotation.rs:289` (inside `///` field doc, backticked example)
- **Probe (per brief, `curl -I -m 5`):** `curl: (28) Resolving timed out after 5005 milliseconds`, `HTTP 000`.
- **Diagnosis:** Kubernetes internal service DNS. `.svc.cluster.local` is the in-cluster service zone; not resolvable from outside any cluster. The link is an example placeholder in a stub `VaultSource` field doc, not a real public reference.
- **Severity:** P3 (cosmetic — example placeholder; rustdoc HTML rendering treats it as a literal link but a reader cannot click it from outside the cluster).

### 2. `pheno-context` — 0 URLs, 0 broken
No HTTP(S) links present in any `///` / `//!` / `/** ... */` / `/*! ... */` context.

### 3. `pheno-errors` — 2 URLs, 1 broken, 1 OK

#### 3a. `https://datatracker.ietf.org/doc/html/rfc7807` — **OK (200)**
- **Source:** `pheno-errors/src/rfc7807.rs:5` (inside `//!` module doc, RFC reference)
- **Probe (per brief, `curl -I -m 5`):** `HTTP 200`, reproducible 3/3, `Content-Type: text/html`, server `Cloudflare`.
- **Severity:** none.

#### 3b. `https://errors.pheno.dev/` — **BROKEN (DNS NXDOMAIN)**
- **Source:** `pheno-errors/src/rfc7807.rs:140` (inside `///` continuation of `//!` module doc, RFC 7807 `type` URI description)
- **Probe (per brief, `curl -I -m 5`):** `curl: (6) Could not resolve host: errors.pheno.dev`, `HTTP 000`.
- **Cross-check (DNS):** `dig +short errors.pheno.dev @8.8.8.8` → empty (NXDOMAIN). Parent `dig +short pheno.dev @8.8.8.8` → `15.197.148.33`, `3.33.130.190` (AWS Global Accelerator). The `pheno.dev` apex is live but the `errors` subdomain is not configured.
- **Diagnosis:** the doc writes a `type` URI per RFC 7807 §3.1, but the `errors.pheno.dev` domain has no DNS record. This is either (a) a planned-but-not-launched error-code catalog or (b) a placeholder. Either way the link is dead.
- **Suggested remediation:** either provision `errors.pheno.dev` (a static site or a redirect to a docs subdomain) or replace the URI with `about:blank` for the duration of the unimplemented state.
- **Severity:** P2 (functional — RFC 7807 docs in this crate cite this URI as the canonical `type` for typed errors; consumers serializing `Problem` will emit a broken `type` until resolved).

### 4. `pheno-tracing` — 0 URLs, 0 broken
No HTTP(S) links present.

### 5. `pheno-port-adapter` — 0 URLs, 0 broken
No HTTP(S) links present.

### 6. `pheno-events` — 0 URLs, 0 broken
No HTTP(S) links present.

### 7. `pheno-flags` — 0 URLs, 0 broken
No HTTP(S) links present.

### 8. `pheno-cli-base` — 0 URLs, 0 broken
No HTTP(S) links present.

---

## Aggregate observations

- **4 of 8 crates (50 %)** carry zero rustdoc HTTP links at all (`pheno-context`, `pheno-tracing`, `pheno-port-adapter`, `pheno-events`, `pheno-flags`, `pheno-cli-base` — 6 of 8 actually). This is consistent with the substrate / framework posture of these crates: their docs reference internal types and traits, not external URLs.
- **Of the 2 crates that do reference external URLs, both have at least one broken link** (`pheno-config` 2/2 broken, `pheno-errors` 1/2 broken). This is a small-N but worrying signal: when authors do reach for external references, the references rot.
- **No links in the 8 crates point to fleet-internal paths** (e.g., no `github.com/KooshaPari/pheno-…` or `docs.rs/pheno-…` cross-references). Fleet crates rely on rustdoc's intra-doc-link resolution for cross-crate references.
- **No links to spec / RFC / Wikipedia / standards bodies are broken** other than the `errors.pheno.dev` placeholder — the IETF reference for RFC 7807 resolves cleanly.

---

## Methodology

1. **Source discovery.** A Python tokenizer (`/tmp/side60_extract.py`) walks every `.rs` file under each crate (excluding `target/`) and tracks when the cursor is inside a rustdoc comment (`///`, `//!`, `/** ... */`, `/*! ... */`, including multi-line `///` continuations). Any `http(s)://…` token in that context is emitted with `(file, line)` provenance. Non-doc comments (`//`, `/* … */`) and string literals are excluded.
2. **Deduplication.** Per crate, hits are deduped by URL; first occurrence is kept.
3. **Probe.** Each unique URL is probed with `curl -I -m 5` per the brief. To disambiguate anti-bot 403/404 false positives, a second probe with `Mozilla/5.0` UA is recorded, plus a targeted cross-check (crates.io JSON API, DNS) for suspect cases.
4. **Classification.**
   - **OK** = `HTTP 200` (or 2xx) reproducible.
   - **BROKEN** = anything else (403, 404, 5xx, DNS failure, timeout). Anti-bot-blocked 403s are re-tested with a browser UA; if the browser UA also fails, the link is broken; if the browser UA succeeds, it is flagged as a "P3 false positive" with diagnosis.

---

## Recommendations (non-binding, no code changes in this read-only audit)

| Prio | URL | Suggested fix |
|------|-----|---------------|
| P2   | `pheno-errors/src/rfc7807.rs:140` → `https://errors.pheno.dev/` | Either provision the subdomain or fall back to `about:blank` until the typed-error catalog is shipped. |
| P3   | `pheno-config/src/hot_reload.rs:10` → `https://crates.io/crates/arc-swap` | Replace with `https://docs.rs/arc-swap` (live) to bypass the crates.io HTML 404 edge bug. |
| P3   | `pheno-config/src/secret_rotation.rs:289` → `https://vault.svc.cluster.local:8200` | Rephrase the field doc to use `https://vault.example.com:8200` (RFC 2606 reserved) or remove the backticks so rustdoc does not treat it as a link. |

---

## Audit-doc status

- **Date of run:** 2026-06-21
- **Tooling:** `/tmp/side60_extract.py` (extraction), `curl 8.x` (probes), `dig` (DNS)
- **Reproducibility:** re-running the script against `HEAD` of the 8 crates will reproduce the 4-URL inventory; the curl outcomes are point-in-time and may shift (especially the crates.io HTML 404 edge).
- **Permissions:** read-only — no commits, no pushes, no edits to any crate.
