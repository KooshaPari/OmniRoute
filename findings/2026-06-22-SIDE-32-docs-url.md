# SIDE-32: docs.rs URL lint across pheno-* crates

**Date:** 2026-06-21 (system_date anchor; doc filename carries 2026-06-22 per task)
**Task:** SIDE-32 — For each pheno-* crate with docs.rs presence, check the URL in `README.md` points to the actual published version
**Method:** `git grep` for `docs.rs` references + `curl` against `https://docs.rs/<crate>` (HTTP status) + `curl` against `https://crates.io/api/v1/crates/<crate>` (publication registry) — read-only; no mutations, no `cargo publish`
**Verdict sources:**
- `https://docs.rs/<crate>/` — actual docs.rs landing page; HTTP 200 = built, HTTP 404 = not published
- `https://crates.io/api/v1/crates/<crate>` — publication registry; 404 with `{"errors":[{"detail":"crate ... does not exist"}]}` = not published

---

## TL;DR

- **0 / 10** pheno-* Rust crates have a `docs.rs` URL referenced anywhere in their `README.md`.
- **2 / 10** declare `documentation = "https://docs.rs/..."` in `Cargo.toml` (`pheno-otel`, `pheno-tracing`) — both URLs return **HTTP 404** at the docs.rs landing page because the crate is not published to crates.io.
- **0 / 10** pheno-* Rust crates are actually published on crates.io (verified per-crate via the crates.io API). The crates.io search for `q=pheno-` returns 10 hits, **none of which** are KooshaPari-owned or owned by any known Phenotype contributor — they are unrelated third-party / abandoned crates.
- **The literal task ("check the URL in README.md points to actual published version") cannot produce a per-crate mismatch table, because there are zero `docs.rs` URLs in any README.md.** The two `Cargo.toml` URLs are flagged as `BROKEN` (point to non-existent published versions).
- A crates.io / docs.rs publish pipeline is the prerequisite remediation; without it the lint is structurally a no-op for this fleet. See [§ Recommended remediation](#recommended-remediation).

---

## Scope

The pheno-* Rust crate set on the sparse-checkout cone (10 directories, all with `Cargo.toml`):

| # | Crate | README.md present? | docs.rs URL in README | docs.rs URL in Cargo.toml | Crate version (local) |
|---|---|---|---|---|---|
| 1 | `pheno-chaos` | no | n/a | none | `0.1.0` |
| 2 | `pheno-cli-base` | yes | none | none | `0.1.0` |
| 3 | `pheno-config` | yes | none | none | `0.1.0` |
| 4 | `pheno-context` | no | n/a | none | `0.1.0` |
| 5 | `pheno-errors` | no | n/a | none | `0.1.0` |
| 6 | `pheno-events` | no | n/a | none | `0.1.0` |
| 7 | `pheno-flags` | no | n/a | none | `0.1.0` |
| 8 | `pheno-otel` | yes | none | `https://docs.rs/pheno-otel` | `0.1.0` |
| 9 | `pheno-port-adapter` | no | n/a | none | `0.1.0` |
| 10 | `pheno-tracing` | yes | none | `https://docs.rs/pheno-tracing` | `0.3.0-pre.0` |

**Other pheno-* directories (excluded from this audit — not Rust crates):** `pheno-ci-templates` (workflow YAML), `pheno-drift-detector` (Python), `pheno-fastapi-base` (Python), `pheno-framework-lint` (Python), `pheno-go-ctxkit` (Go), `pheno-llms-txt` (Python), `pheno-mcp-router` (Python), `pheno-predict` (Python), `pheno-pydantic-models` (Python), `pheno-scaffold-kit` (Python), `pheno-secret-scan` (Python), `pheno-ssot-template` (Python), `pheno-vibecoding-guard` (Python), `pheno-worklog-schema` (Python), `pheno-zod-schemas` (TypeScript). docs.rs is Rust-only; the 10 directories listed above are the entire Rust-pheno fleet on this cone.

---

## Per-crate results

Columns:

- **README** — does `<crate>/README.md` exist?
- **README → docs.rs** — literal `docs.rs` mention in README? (Captured verbatim below.)
- **Cargo.toml `documentation=`** — `documentation = "..."` field in `[package]`?
- **Declared URL** — what URL the crate claims (README or Cargo.toml, whichever fires).
- **docs.rs HTTP** — `curl -L -w '%{http_code}' https://docs.rs/<crate>/`.
- **crates.io status** — `curl -s https://crates.io/api/v1/crates/<crate>` ⇒ 200 (published) or 404 with `"does not exist"` body (not published).
- **Lint verdict** — `OK` / `BROKEN` / `NO_URL` / `NO_README`.
- **Latest published** — `max_stable_version` from crates.io API; `—` if not published.

| # | Crate | README | README → docs.rs | Cargo.toml `documentation=` | Declared URL | docs.rs HTTP | crates.io | Lint verdict | Latest published |
|---|---|---|---|---|---|---|---|---|---|
| 1 | `pheno-chaos` | no | n/a | none | — | **404** | 404 `does not exist` | `NO_README` | — |
| 2 | `pheno-cli-base` | yes | none | none | — | **404** | 404 `does not exist` | `NO_URL` | — |
| 3 | `pheno-config` | yes | none | none | — | **404** | 404 `does not exist` | `NO_URL` | — |
| 4 | `pheno-context` | no | n/a | none | — | **404** | 404 `does not exist` | `NO_README` | — |
| 5 | `pheno-errors` | no | n/a | none | — | **404** | 404 `does not exist` | `NO_README` | — |
| 6 | `pheno-events` | no | n/a | none | — | **404** | 404 `does not exist` | `NO_README` | — |
| 7 | `pheno-flags` | no | n/a | none | — | **404** | 404 `does not exist` | `NO_README` | — |
| 8 | `pheno-otel` | yes | none | `https://docs.rs/pheno-otel` | `https://docs.rs/pheno-otel` | **404** | 404 `does not exist` | **`BROKEN`** | — |
| 9 | `pheno-port-adapter` | no | n/a | none | — | **404** | 404 `does not exist` | `NO_README` | — |
| 10 | `pheno-tracing` | yes | none | `https://docs.rs/pheno-tracing` | `https://docs.rs/pheno-tracing` | **404** | 404 `does not exist` | **`BROKEN`** | — |

**Verdict counts**

| Verdict | Count |
|---|---|
| `OK` (URL declared and resolves to published crate) | **0** |
| `BROKEN` (URL declared but does not resolve) | **2** |
| `NO_URL` (README exists, no docs.rs reference) | **2** |
| `NO_README` (no README to lint) | **6** |
| Total | **10** |

---

## Declared URL content (verbatim)

The two `BROKEN` crates have a single line each in their `Cargo.toml` under `[package]`:

### `pheno-otel/Cargo.toml` (relevant lines)

```toml
[package]
name = "pheno-otel"
version = "0.1.0"
description = "OpenTelemetry OTLP exporter substrate for the pheno-* fleet (ADR-037). ..."
repository = "https://github.com/KooshaPari/pheno-otel"
documentation = "https://docs.rs/pheno-otel"
```

`README.md` does **not** contain any reference to docs.rs (verified: `grep -in 'docs.rs\|crates.io\|api.*doc\|documentation' pheno-otel/README.md` returns no match).

### `pheno-tracing/Cargo.toml` (relevant lines)

```toml
[package]
name = "pheno-tracing"
version = "0.3.0-pre.0"
description = "Canonical port-driven distributed tracing substrate for the pheno-* fleet (ADR-036). ..."
repository = "https://github.com/KooshaPari/pheno-tracing"
documentation = "https://docs.rs/pheno-tracing"
```

`README.md` does **not** contain any reference to docs.rs (verified: `grep -in 'docs.rs\|crates.io\|api.*doc\|documentation' pheno-tracing/README.md` returns no match).

### `pheno-cli-base/Cargo.toml` / `pheno-config/Cargo.toml`

These crates have `repository = "..."` set in some sources, but the local copy under the sparse-checkout cone has neither `repository` nor `documentation` fields populated. Their READMEs also contain no docs.rs link.

---

## crates.io search (prefix `pheno-`)

Cross-check query: `GET https://crates.io/api/v1/crates?q=pheno-` returns **10 crates**, none of which are owned by `KooshaPari` or any known Phenotype contributor. They appear to be third-party / abandoned crates whose name happens to share the prefix:

| Crate (returned by crates.io) | max_version | downloads | Owner notes |
|---|---|---|---|
| `pheno-core` | 0.1.0 | 136 | unrelated (likely abandoned) |
| `pheno-crypto` | 0.1.0 | 31 | unrelated |
| `pheno-db` | 0.1.0 | 19 | unrelated |
| `rsgenetic` | 1.8.1 | 159,274 | unrelated (genetic-algorithms crate) |
| `rsomics-plink-missing` | 0.1.0 | 14 | unrelated |
| `rsomics-plink-score` | 0.1.0 | 14 | unrelated |
| `genalg` | 0.1.0 | 764 | unrelated |
| `phenomenon` | 1.0.0 | 46,917 | unrelated (procedural-generation crate) |
| `phenopackets` | 0.2.2-post2 | 3,970 | unrelated (biomedical crate) |
| `phenotype-cache-adapter` | 0.1.0 | 126 | unrelated (looks abandoned) |

Sanity-check query: `GET https://crates.io/api/v1/crates/serde` returns the expected payload (`max_stable_version=1.0.228`, `downloads=1,097,646,726`), confirming the API path is exercised correctly. The 404 / `does not exist` body returned for `pheno-tracing` (see Reproduction) is a real "not on crates.io" response, not a network error.

**Conclusion: zero of the 10 in-scope pheno-* crates have ever been published to crates.io, and therefore docs.rs has nothing to build for them.**

---

## GitHub repo cross-reference

`curl https://github.com/KooshaPari/<crate>` (HTTP 200 = repo exists, 404 = not created):

| # | Crate | GitHub HTTP | Latest release tag (GitHub Releases API) |
|---|---|---|---|
| 1 | `pheno-chaos` | 404 | n/a (no repo) |
| 2 | `pheno-cli-base` | 404 | n/a (no repo) |
| 3 | `pheno-config` | 404 | n/a (no repo) |
| 4 | `pheno-context` | 200 | (none) |
| 5 | `pheno-errors` | 404 | n/a (no repo) |
| 6 | `pheno-events` | 404 | n/a (no repo) |
| 7 | `pheno-flags` | 404 | n/a (no repo) |
| 8 | `pheno-otel` | 200 | (none) |
| 9 | `pheno-port-adapter` | 200 | (none) |
| 10 | `pheno-tracing` | 200 | (none) |

4 / 10 have a GitHub repo but **none** has any tagged release (`releases/latest` returns 404 on the GitHub Releases API). The 2 `BROKEN` crates (`pheno-otel`, `pheno-tracing`) — the ones whose `Cargo.toml` claims a docs.rs URL — are among the 4 with repos, but the absence of any GitHub release is consistent with the absence of any crates.io publish.

---

## Recommended remediation

The lint finds are structural, not URL-syntax. None of the pheno-* crates can ship a working docs.rs URL today because none are published to crates.io. Two remediation paths, ordered by leverage:

### Path A — Publish the canonical 4 substrates (highest leverage)

The 4 pheno-* crates that have a GitHub repo AND a Cargo.toml with proper `[package]` metadata are publishable today:

1. `pheno-tracing` (v0.3.0-pre.0, ADR-036) — tracing substrate
2. `pheno-otel` (v0.1.0, ADR-037) — OTLP exporter substrate
3. `pheno-context` (v0.1.0, ADR) — context propagation substrate
4. `pheno-port-adapter` (v0.1.0, ADR-038) — hexagonal port-adapter substrate

A `cargo publish --dry-run` per crate is the first verification step (no mutations); followed by `cargo publish` once CI is green. After publish, the existing `documentation = "https://docs.rs/<crate>"` lines in `Cargo.toml` start resolving automatically — docs.rs rebuilds on every crates.io publish within ~30 minutes.

**Blocking questions before publish** (decide before opening the publish PRs):

- Should `pheno-tracing` bump from `0.3.0-pre.0` to a stable `0.3.0` before first publish, or is `pre` acceptable as the v0 release? Cargo allows pre-releases but docs.rs renders them as the default landing page.
- API tokens: `CARGO_REGISTRY_TOKEN` must be set in the monorepo's CI secret for `cargo publish` to succeed. Currently no evidence of one being configured.
- Workspace vs single-crate publish: `pheno-chaos` is a workspace root. Decide whether to publish the inner members individually (`crates/pheno-chaos`, `crates/pheno-chaos-macros`) or convert to a single-crate layout first.

### Path B — Remove the dead `documentation =` lines until publish is ready

If Path A is out of scope for this cycle, the lower-risk immediate fix is to **delete the `documentation = "https://docs.rs/..."` line from `pheno-otel/Cargo.toml` and `pheno-tracing/Cargo.toml`** so future audits do not flag broken links. The crate's own repo URL (`repository = "https://github.com/KooshaPari/pheno-otel"`) remains as the canonical link from `cargo info` and IDE tooltips. A one-line PR per crate, ~4 lines total.

Path B is non-blocking and can ship in a Friday-cleanup wave.

### Path C — Add a CI gate that fails when declared docs.rs URLs do not resolve

A `pheno-ci-templates` job that:

1. Extracts `documentation = ...` from every pheno-*/Cargo.toml.
2. `curl -L -sf -o /dev/null -w '%{http_code}' "$url"` per URL.
3. Fails the PR if any URL is non-200.

This is the durable guard. Until Path A publishes the crates, Path C will fail every PR against `pheno-otel` / `pheno-tracing`, which is the correct signal. Wire it to a `pathsoft` lint rather than a separate workflow to keep the matrix small.

---

## Findings index

| Finding | Severity | Status |
|---|---|---|
| `pheno-otel/Cargo.toml:6` declares `documentation = "https://docs.rs/pheno-otel"` — URL returns HTTP 404 | **P1** | by-design until Path A runs; remediate via Path B (delete line) or Path A (publish) |
| `pheno-tracing/Cargo.toml:6` declares `documentation = "https://docs.rs/pheno-tracing"` — URL returns HTTP 404 | **P1** | same as above |
| 0 / 10 pheno-* crates have a docs.rs URL in their README.md | P3 informational | README-first documentation pattern is fleet-default (per AGENTS.md § "Meta-bundle for a release-ready crate"); documented for audit trail |
| 6 / 10 pheno-* crates lack a README.md (`pheno-chaos`, `pheno-context`, `pheno-errors`, `pheno-events`, `pheno-flags`, `pheno-port-adapter`) | P2 | blocks ADR-023 quality bar (Rule 3.1) for substrate class; orthogonal to SIDE-32 but surfaces here |
| 6 / 10 pheno-* crates lack a GitHub repo entirely | P2 | blocks publish + release tracking; orthogonal to SIDE-32 but surfaces here |
| 0 / 10 pheno-* crates are published on crates.io | **P0 fleet-wide** | root cause of every other finding in this audit; remediation = Path A |
| crates.io search `q=pheno-` returns 10 unrelated / abandoned crates — none KooshaPari-owned | P3 informational | no collision risk with the chosen names; documented for audit trail |

---

## Reproduction

```bash
# 1. Find every pheno-* Rust crate on the sparse-checkout cone
for d in pheno-*/Cargo.toml; do
  echo "$d"
done

# 2. Per-crate README + docs.rs URL grep
for d in pheno-chaos pheno-cli-base pheno-config pheno-context pheno-errors \
         pheno-events pheno-flags pheno-otel pheno-port-adapter pheno-tracing; do
  echo "=== $d ==="
  [ -f "$d/README.md" ] && grep -in 'docs\.rs\|crates\.io' "$d/README.md" || echo "(no README.md)"
  grep -E '^documentation = ' "$d/Cargo.toml" || true
done

# 3. docs.rs landing page HTTP status per crate
for crate in pheno-chaos pheno-cli-base pheno-config pheno-context pheno-errors \
             pheno-events pheno-flags pheno-otel pheno-port-adapter pheno-tracing; do
  code=$(curl -sf -o /dev/null -w '%{http_code}' -L -m 8 "https://docs.rs/$crate")
  printf '%-22s docs.rs HTTP=%s\n' "$crate" "$code"
done

# 4. crates.io publication status per crate
for crate in pheno-chaos pheno-cli-base pheno-config pheno-context pheno-errors \
             pheno-events pheno-flags pheno-otel pheno-port-adapter pheno-tracing; do
  body=$(curl -s -m 8 -H 'User-Agent: side32-lint' "https://crates.io/api/v1/crates/$crate")
  printf '%-22s %s\n' "$crate" "$(echo "$body" | python3 -c 'import sys,json; d=json.load(sys.stdin); print(\"published\" if \"crate\" in d else d.get(\"errors\",[{}])[0].get(\"detail\",\"?\"))')"
done

# 5. Sanity-check the crates.io API path
curl -sf -m 8 -H 'User-Agent: side32-lint' 'https://crates.io/api/v1/crates/serde' \
  | python3 -c "import sys,json; d=json.load(sys.stdin); c=d.get('crate',{}); print(f'sanity OK: serde max_stable={c.get(\"max_stable_version\")}')"

# 6. crates.io prefix search (returns 10 unrelated crates — see § "crates.io search")
curl -sf -m 10 -H 'User-Agent: side32-lint' 'https://crates.io/api/v1/crates?q=pheno-' \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d.get('crates',[])))"
```

End of audit.