# 03 — Immaturity Inventory & Time to Finish

All counts are **exact** (`rg` output), not estimates, unless marked.
Area LOC counts come from a read-only sweep that excluded `node_modules`,
`.git`, `dist`, `.build`, `.next`.

## TL;DR — the clusters that matter

| Cluster                                  | Where                                                                           | Size                                     | Fix type                      |
| ---------------------------------------- | ------------------------------------------------------------------------------- | ---------------------------------------- | ----------------------------- |
| **Rust rewrite is 6-of-9 scaffolds**     | `crates/omniroute-rs/`                                                          | 6 crates at 12–25 LOC each               | **Decide: delete or build**   |
| **Compression stubs**                    | `open-sse/services/compression/`                                                | **91** stub markers                      | Implement                     |
| **Disabled provider handlers**           | `src/app/api/providers/[id]/models/providerHandlers.disabled-by-tier1-cleanup/` | 12 files / **2,384 LOC**                 | **Delete**                    |
| **`electron/` unmaintained**             | `electron/`                                                                     | 2,496 LOC, **0 tests**, not in workspace | **Delete or adopt**           |
| **`desktop-electrobun/` scaffold**       | `desktop-electrobun/`                                                           | 358 LOC, 1 source file                   | Decide                        |
| **`extensions/argis/` is vendored slop** | `extensions/argis/`                                                             | 174 `.go` / 54,136 LOC                   | **Exclude — not first-party** |

### Important caveat: `extensions/argis` is not first-party

Its own README describes it as _"AI-DD metaproject … Slop issues are expected and
intentionally present"_, and its `go.mod` declares
`github.com/kooshapari/bifrost-extensions`. **Any "Go already has 54k lines"
claim is inflated by this.** It should be excluded from production-readiness
analysis.

### Important caveat: a large false positive

`src/` shows **14,660** `placeholder` matches — but **all** are inside
`src/i18n/messages/*.json`, which is ICU MessageFormat syntax
(`{count,plural,one{# file} other{# files}}`). The real `src/` stub-marker count
is **~185**, not ~14,845. Anyone counting raw `placeholder` matches will get a
wildly wrong number.

## Per-area tables

| Area                    |    Files |     LOC | Stub markers | Test files / cases | Notes                                      |
| ----------------------- | -------: | ------: | -----------: | -----------------: | ------------------------------------------ |
| `src/` (Next.js)        |    3,306 | 582,828 |         ~185 |           71 / 505 | Largest first-party surface                |
| `open-sse/`             |    1,715 | 383,202 |          337 |         52 / 1,102 | Includes the 91-marker compression cluster |
| `crates/omniroute-rs/`  | 41 `.rs` |  ~4,023 |            0 |   49 attrs, 7 fake | 6 of 9 crates are scaffolds                |
| `apps/web` (Svelte)     |      336 |  13,103 |           65 |             6 / 20 | 22 pages under 15 lines                    |
| `apps/bff` (Hono)       |       72 |   3,823 |           11 |            12 / 72 | Small and real                             |
| `extensions/argis` (Go) |      174 |  54,136 |         ~111 |           37 / 197 | **Vendored, not first-party**              |
| `electron/`             |       16 |   2,496 |            1 |          **0 / 0** | Legacy; not in workspace                   |
| `desktop-electrobun/`   |        3 |     358 |            0 |              1 / 2 | Scaffold                                   |
| `tests/` (root)         |    5,811 |       — |            — |         — / 48,061 | Very large suite                           |

### Coverage gate

**60% via `.qgate.toml` — but it is INFORMATIONAL.** Codecov patch target is 70%
and also informational. There is **no blocking coverage floor**. This is why
coverage can drift without anyone noticing.

### Areas with NO tests

- `apps/desktop/` (0 test files)
- `electron/` (0 test files)
- `crates/omniroute-rs/` (0 `.test.rs`; its 7 "tests" are
  `assert!(true)` placeholders inside the scaffold crates)

## Rust: real vs facade

| Crate         | State                                                           |
| ------------- | --------------------------------------------------------------- |
| `core`        | Real — 2,467 LOC                                                |
| `storage`     | Real — 1,447 LOC                                                |
| `cli`         | 25 LOC                                                          |
| `providers`   | **Scaffold** — 12–25 LOC, `fn placeholder() { assert!(true); }` |
| `router`      | **Scaffold**                                                    |
| `compression` | **Scaffold**                                                    |
| `mcp`         | **Scaffold**                                                    |
| `api`         | **Scaffold**                                                    |
| `bifrost`     | **Scaffold**                                                    |

Six crates contain only a `lib.rs` with a placeholder test and a `// scaffold`
comment. **The Rust rewrite is an ambition, not a platform.**

## Time to finish — engineer-days, with assumptions

| Item                                           |  Delete | Implement | Assumption                                                                     |
| ---------------------------------------------- | ------: | --------: | ------------------------------------------------------------------------------ |
| Dead provider handlers (2,384 LOC)             |   **1** |      8–12 | Delete: verify no imports, remove. Implement: port 12 disabled handlers back   |
| `electron/` (0 tests, unmaintained)            |   **1** |      6–10 | Delete: confirm nothing depends on it. Adopt: add tests + workspace membership |
| `desktop-electrobun/` scaffold                 | **0.5** |       5–8 | 358 LOC, 1 source file                                                         |
| Compression stubs (91 markers)                 |       — | **10–20** | Largest real first-party gap                                                   |
| Rust scaffolds (6 crates)                      |   **1** | **30–50** | Implement assumes a defined scope, which does not exist                        |
| `apps/web` Svelte shells (22 pages)            |       — |      5–10 | Fill under-15-line pages                                                       |
| Coverage floor enforcement (0% → 60% blocking) |       — | **20–40** | Depends on starting coverage, unmeasured                                       |
| Favicon / misc stub markers in `src/`          |     1–2 |       3–5 | ~185 markers, mostly cosmetic                                                  |

### Totals

| Target                                                                           | Estimate                                           |
| -------------------------------------------------------------------------------- | -------------------------------------------------- |
| **Deletion-only cleanup**                                                        | **~3–4 days**                                      |
| **Clean-up + counted stubs, excluding Rust**                                     | **~6–10 engineer-weeks**                           |
| **Including the Rust rewrite**                                                   | **+6–10 weeks** (scope undefined → low confidence) |
| **"As close to finish as possible"** (barring scaling, sunset, or intent change) | **~6–12 engineer-weeks** for 1–2 engineers         |

**Confidence: medium.** The deletion estimates are solid. The implementation
estimates assume one competent engineer familiar with the codebase and are
sensitive to the undefined Rust scope.

## What I could NOT count

- Production-vs-test classification of the 116 mock/fake/hardcode files in `src/`
  and 75 in `open-sse/` (listed, not classified).
- Whether the disabled `providerHandlers.disabled-by-tier1-cleanup/` directory is
  referenced from anywhere (import-chain tracing not performed).
- True starting coverage percentage (the floor config does not report actuals).
- Native clients beyond Go.
