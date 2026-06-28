# SIDE-04: Cargo.toml Version Alignment Audit (2026-06-21)

**Scope:** Audit the 5 pheno-* repos at the monorepo root (`pheno-otel/`, `pheno-port-adapter/`, `pheno-errors/`, `pheno-context/`, `pheno-config/`) for *internal* dep version alignment: i.e. when a `Cargo.toml` declares `pheno-X = "0.4.0"` (or `{ path = "...", version = "0.4.0" }`), does the actual source `pheno-X/Cargo.toml` `[package].version` match? Method: read each repo's `Cargo.toml` + `cargo tree -p <repo>` + `Cargo.lock` cross-check.

---

## TL;DR

| Repo | Has Cargo.toml? | Source `version` | Internal pheno-* deps declared | Version-pin present? | Mismatches found |
|------|-----------------|------------------|--------------------------------|------------------------|------------------|
| `pheno-otel`        | **YES** | `0.1.0` (`pheno-otel/Cargo.toml:3`)          | 0 (leaf substrate) | n/a | **0** |
| `pheno-port-adapter`| **YES** | `0.1.0` (`pheno-port-adapter/Cargo.toml:3`)  | 1 (`pheno-otel`)   | NO (`path`-only) | **0** |
| `pheno-errors`      | **YES** | `0.1.0` (`pheno-errors/Cargo.toml:3`)        | 1 (`pheno-otel`)   | NO (`path`-only) | **0** |
| `pheno-context`     | **NO**  | n/a                                           | n/a (no manifest)  | n/a | **STRUCTURAL** (see §3) |
| `pheno-config`      | **NO**  | n/a                                           | n/a (no manifest)  | n/a | **STRUCTURAL** (see §4) |

**Headline finding (version alignment):** Of the 5 repos in scope, **3 carry a `Cargo.toml`** and **2 do not** (they are scaffold-state directories with only `docs/`, `i18n/`, and `src/*.rs` files but no manifest). Of the 3 with a manifest, **0 declare a version pin on the one internal pheno-* dep they reference** — both `pheno-port-adapter` and `pheno-errors` use bare `path = "../pheno-otel"` (no `version =` clause). With path-only deps, cargo resolves to whatever the source crate's `[package].version` declares (here, `0.1.0` everywhere), so the structural mismatch count is **0 by design**. The audit's "version-pin drift" dimension is **vacuous**: there is nothing to drift.

**Headline finding (structural):** 2 of 5 repos (`pheno-context`, `pheno-config`) have **no `Cargo.toml` at the monorepo root** — they exist only as `src/*.rs` source fragments. The "real" crate for both lives under `FocalPoint/...` per SIDE-01's prior audit (ADR-038 substrate-canonical placement). The root-level `pheno-config/src/secrets.rs` and `pheno-context/src/oidc.rs` use external crates (`zeroize`, `serde`, `tokio`, `figment`, `toml`) that **have no manifest to declare them in**. They cannot be built as a standalone crate at this path.

---

## Method

1. **Locate each repo:** `ls -la pheno-<name>/` (all 5 dirs confirmed at monorepo root).
2. **Read each `Cargo.toml`:** `[package].version` + `[dependencies]` (filter for `pheno-*` entries).
3. **For each `pheno-*` dep declared**, locate the source crate's `Cargo.toml` and read its `[package].version`.
4. **Run `cargo tree -p <repo>`** for each manifest-bearing repo to get the resolved dep graph.
5. **Cross-check `Cargo.lock`** for the resolved version cargo actually locked.
6. **Diff** declared-version-pin vs. resolved-version.

### `cargo tree -p` results (verbatim, partial)

#### `cargo tree -p pheno-otel`
```
pheno-otel v0.1.0 (/Users/kooshapari/CodeProjects/Phenotype/repos/pheno-otel)
├── serde v1.0.228
├── serde_json v1.0.150
└── thiserror v2.0.18
```
(no internal pheno-* deps)

#### `cargo tree -p pheno-port-adapter` (top 8 lines)
```
pheno-port-adapter v0.1.0 (/Users/kooshapari/CodeProjects/Phenotype/repos/pheno-port-adapter)
├── async-trait v0.1.89
├── pheno-otel v0.1.0 (/Users/kooshapari/CodeProjects/Phenotype/repos/pheno-otel)
│   ├── serde v1.0.228
│   ├── serde_json v1.0.150
│   └── thiserror v2.0.18
├── redis v0.27.6
├── thiserror v2.0.18
└── tokio v1.52.3
```

#### `cargo tree -p pheno-errors` (top 8 lines)
```
pheno-errors v0.1.0 (/Users/kooshapari/CodeProjects/Phenotype/repos/pheno-errors)
├── anyhow v1.0.102
├── pheno-otel v0.1.0 (/Users/kooshapari/CodeProjects/Phenotype/repos/pheno-otel)
│   ├── serde v1.0.228
│   ├── serde_json v1.0.150
│   └── thiserror v2.0.18
├── serde v1.0.228
├── thiserror v2.0.18
└── tracing v0.1.44
```

#### `cargo tree -p pheno-context` and `cargo tree -p pheno-config`
Both **fail** with:
```
error: could not find `Cargo.toml` in `/Users/.../repos/pheno-context` or any parent directory
error: could not find `Cargo.toml` in `/Users/.../repos/pheno-config`  or any parent directory
```
→ confirms no manifest at root; cargo cannot construct a dep graph for these paths.

---

## Per-repo findings

### 1. `pheno-otel` — v0.1.0, no internal pheno-* deps

| Declared dep | Source version | Resolved version (`cargo tree`) | `Cargo.lock` lock version | Mismatch? |
|--------------|----------------|---------------------------------|---------------------------|-----------|
| (none — leaf substrate) | — | — | — | n/a |

- **Source manifest:** `pheno-otel/Cargo.toml:2-3` declares `name = "pheno-otel"`, `version = "0.1.0"`.
- **External deps:** `thiserror = "2"`, `serde = { version = "1.0", features = ["derive"] }`, `serde_json = "1.0"` (`pheno-otel/Cargo.toml:25-28`). All external; no fleet-substrate pins.
- **No internal pheno-* dep declared.** Cannot drift on the alignment dimension.

**Verdict: 0 mismatches.** The substrate is a sink, not a source of cross-crate references.

### 2. `pheno-port-adapter` — v0.1.0, depends on `pheno-otel`

| Declared dep | Declaration (Cargo.toml) | Source version of dep | Resolved by cargo | Mismatch? |
|--------------|--------------------------|------------------------|--------------------|-----------|
| `pheno-otel` | `pheno-otel = { path = "../pheno-otel" }` (line 30) — **no `version =` clause** | `0.1.0` (`pheno-otel/Cargo.toml:3`) | `0.1.0` (path-only → resolves to source) | **0** |

- **Source manifest:** `pheno-port-adapter/Cargo.toml:2-3` declares `version = "0.1.0"`.
- **Internal dep declared (1):** `pheno-otel` via bare path (`pheno-port-adapter/Cargo.toml:30`); no version pin.
- **Cross-check via `Cargo.lock:362-368`:** `pheno-otel` locked at `0.1.0` (path source, no registry source line — confirms workspace/path resolution).
- **Cross-check via `cargo tree -p pheno-port-adapter`:** resolves to `pheno-otel v0.1.0 (/Users/.../repos/pheno-otel)`.

**Verdict: 0 mismatches.** Path-only dep cannot drift because there is no version pin to drift from; cargo resolves to whatever the source's `[package].version` is.

### 3. `pheno-errors` — v0.1.0, depends on `pheno-otel`

| Declared dep | Declaration (Cargo.toml) | Source version of dep | Resolved by cargo | Mismatch? |
|--------------|--------------------------|------------------------|--------------------|-----------|
| `pheno-otel` | `pheno-otel = { path = "../pheno-otel" }` (line 17) — **no `version =` clause** | `0.1.0` (`pheno-otel/Cargo.toml:3`) | `0.1.0` (path-only → resolves to source) | **0** |

- **Source manifest:** `pheno-errors/Cargo.toml:2-3` declares `version = "0.1.0"`.
- **Internal dep declared (1):** `pheno-otel` via bare path (`pheno-errors/Cargo.toml:17`); no version pin.
- **Cross-check via `Cargo.lock:181-188`:** `pheno-otel` locked at `0.1.0` (path source).
- **Cross-check via `cargo tree -p pheno-errors`:** resolves to `pheno-otel v0.1.0 (/Users/.../repos/pheno-otel)`.

**Verdict: 0 mismatches.** Same pattern as `pheno-port-adapter`.

### 4. `pheno-context` — STRUCTURAL: no `Cargo.toml` at root

**No `Cargo.toml` exists at this path.** The directory contains only:
- `docs/HEXAGONAL_PORTS.md` (38 lines, the hexagonal-ports adoption notice — v17 T4)
- `src/oidc.rs` (229 lines, an OIDC federation reference client per ADR-079; this is the v19 T3 stub)
- No `[package]`, no `[dependencies]`, no `Cargo.lock`.

**`cargo tree -p pheno-context` fails** with `error: could not find Cargo.toml`. There is no dep graph to compare.

**`src/oidc.rs` import surface (uncompilable as-is, since no manifest declares the deps):**
| Import | External crate needed | Declared in any Cargo.toml? |
|--------|----------------------|------------------------------|
| `use serde::{Deserialize, Serialize};` (line 10) | `serde` | **No** (no manifest) |
| `use tokio::sync::RwLock;` (line 11) | `tokio` | **No** (no manifest) |
| `use zeroize::Zeroize;` (line 12) | `zeroize` | **No** (no manifest) |

The header comment on `src/oidc.rs:1-4` says: *"Deps: zeroize, serde, tokio (parent Cargo.toml; not modified here)."* — confirming the author knew the deps belong in a parent manifest, but the parent manifest **does not exist** at the monorepo root.

**Canonical home (per SIDE-01 audit):** `FocalPoint/pheno-context/Cargo.toml` (workspace member; `publish = false`). That manifest declares `thiserror = { workspace = true }`, `http = "1.1"`, `dev-dependencies: http = "1.1"`. **It does NOT declare `pheno-otel`, `pheno-errors`, `pheno-port-adapter`, `pheno-config`, `serde`, `tokio`, or `zeroize` either** — so even the canonical home is out of sync with the root-level `src/oidc.rs` content. This is a *separate* drift between source content and the canonical manifest, not the version-alignment kind SIDE-04 is about, but it is the same family of issue.

**Verdict: STRUCTURAL FINDING, not a version-alignment mismatch.** The "real" question — does the version pin in some (hypothetical) `pheno-context/Cargo.toml` match? — is moot because no manifest exists. The applicable finding is: "this directory cannot be built as a standalone crate; the source content references external crates with no manifest to resolve them."

### 5. `pheno-config` — STRUCTURAL: no `Cargo.toml` at root

**No `Cargo.toml` exists at this path.** The directory contains:
- `docs/HEXAGONAL_PORTS.md` (36 lines, hexagonal-ports adoption notice — v17 T4)
- `docs/architecture/pheno-config.md` (122 lines, C4 container + cascade-sequence diagrams)
- `i18n/{en,es,ja}/pheno-config.ftl` (3 locale files, no Rust code)
- `src/cascade.rs` (93 lines, the Figment-based config-cascade substrate per ADR-022)
- `src/secrets.rs` (59 lines, the zeroize-based secret-holding wrapper per ADR-078 / v19 T2)
- `tests/cascade_test.rs` (mentioned by the architecture doc but not present at this path)
- No `[package]`, no `[dependencies]`, no `Cargo.lock`.

**`cargo tree -p pheno-config` fails** with `error: could not find Cargo.toml`. There is no dep graph to compare.

**`src/cascade.rs` import surface (uncompilable as-is, since no manifest declares the deps):**
| Import | External crate needed | Declared in any Cargo.toml at this path? |
|--------|----------------------|-------------------------------------------|
| `use figment::providers::{Env, Format, Jetbrains, Toml};` (line 23-25) | `figment` | **No** (no manifest) |
| `use figment::Figment;` (line 25) | `figment` | **No** (no manifest) |
| `toml::Value` in test (line 88) | `toml` | **No** (no manifest) |

**`src/secrets.rs` import surface:**
| Import | External crate needed | Declared? |
|--------|----------------------|-----------|
| `use zeroize::{Zeroize, ZeroizeOnDrop};` (line 15) | `zeroize` | **No** (no manifest) |

**Canonical home (per SIDE-01 audit):** Two candidates exist for the "real" `pheno-config` crate:
1. `FocalPoint/pheno-config/Cargo.toml` (workspace member; `publish = false`); declared deps: `figment = { version = "0.10", features = ["toml", "env"] }`, `serde = "1"`, `thiserror = "1"`, `pheno-errors = "0.1"`, dev-deps: `pheno-tracing`, `pheno-port-adapter`. **This is the canonical substrate per SIDE-01 and ADR-022.**
2. `Configra/crates/pheno-config/Cargo.toml` (per ADR-031, Configra is the **canonical repo name** for config; this is where new config work should land going forward).

Neither of these is the same path as the monorepo-root `pheno-config/` directory. The root-level `pheno-config/src/cascade.rs` and `src/secrets.rs` are **source fragments that were inlined at root** (likely as part of a v17/v19 track) but never wrapped in a manifest.

**Verdict: STRUCTURAL FINDING, not a version-alignment mismatch.** Same shape as `pheno-context`. Cannot be built as a standalone crate; source content references external crates (`figment`, `toml`, `zeroize`) with no manifest to resolve them.

---

## Summary table — all internal pheno-* dep references across the 3 manifest-bearing repos

| From (consumer) | To (dep) | Declaration form | Version requested | Source `[package].version` of dep | Resolved by cargo | Locked in `Cargo.lock` | Drifted? |
|-----------------|----------|------------------|-------------------|----------------------------------|-------------------|------------------------|----------|
| `pheno-otel`        | (none — leaf)            | n/a        | n/a    | n/a    | n/a    | n/a    | n/a |
| `pheno-port-adapter` | `pheno-otel`            | `path`-only | —      | `0.1.0` | `0.1.0` | `0.1.0` | **No** |
| `pheno-errors`       | `pheno-otel`            | `path`-only | —      | `0.1.0` | `0.1.0` | `0.1.0` | **No** |
| `pheno-context`      | (no manifest exists)    | n/a        | n/a    | n/a    | n/a    | n/a    | **STRUCTURAL** |
| `pheno-config`       | (no manifest exists)    | n/a        | n/a    | n/a    | n/a    | n/a    | **STRUCTURAL** |

**Total version-alignment mismatches: 0.**
**Total structural "no Cargo.toml" findings: 2** (`pheno-context`, `pheno-config`).

---

## Cross-check vs. SIDE-01 (2026-06-21, earlier same-day audit)

SIDE-01 audited the same 6 crates for **crates.io publication status** and found:
- All 6 declare `version = "0.1.0"` in their primary manifest.
- None are published to crates.io.
- All internal pheno-* deps use `path = "..."` or `workspace = true` — zero SemVer pins exist anywhere.
- → "the audit's stated goal (list crates where current < latest) returns 0 actionable items, because there is no `latest` to compare against."

SIDE-04 audits the **internal alignment** dimension (does the version in dep A's Cargo.toml match the source of dep B?) and arrives at the same conclusion by a different route:
- 3 of the 5 in-scope repos have a manifest; 2 do not.
- The 3 manifests collectively declare **2 internal pheno-* references** (both `pheno-otel`, both bare `path`).
- Both references are unpinned → resolution is structural (source-version) → cannot drift.

**Combined SIDE-01 + SIDE-04 verdict:** The 5 in-scope crates have a version-alignment posture that is **structurally drift-proof** (path-only, no pins) **but not structurally sound** (2 of 5 lack a manifest entirely). The "alignment" question has a vacuous "yes" answer for the 3 buildable repos; the more pressing question — *"should these 5 repos even be top-level crates?"* — is the structural concern that ADR-031 (Configra absorb) and ADR-038 (hex-port L4) are already answering in the substrate-canonical-homes direction.

---

## Findings (numbered, with severity)

1. **F-1 (Informational):** Zero version-alignment mismatches across the 3 manifest-bearing repos (`pheno-otel`, `pheno-port-adapter`, `pheno-errors`). Both internal pheno-* references are bare `path` deps and resolve cleanly to the source's `[package].version = "0.1.0"`.

2. **F-2 (P2 — Structural):** `pheno-context/` at the monorepo root has no `Cargo.toml`. It contains `src/oidc.rs` (a v19 T3 OIDC reference client per ADR-079) that imports `serde`, `tokio`, and `zeroize`, none of which are declared. The crate cannot be built from this path. The canonical home (`FocalPoint/pheno-context/Cargo.toml` per SIDE-01) does not currently declare these deps either — so the `src/oidc.rs` content is in transit between scaffolds and is not aligned with any active manifest.

3. **F-3 (P2 — Structural):** `pheno-config/` at the monorepo root has no `Cargo.toml`. It contains `src/cascade.rs` (Figment cascade per ADR-022) and `src/secrets.rs` (zeroize wrapper per ADR-078), both of which import external crates (`figment`, `toml`, `zeroize`) that are undeclared. The crate cannot be built from this path. The canonical homes (`FocalPoint/pheno-config/Cargo.toml`, `Configra/crates/pheno-config/Cargo.toml`) are separate from this root-level directory; the root-level source fragments have no manifest binding them.

4. **F-4 (P3 — Documentation drift, out of strict scope):** The header comment in `pheno-context/src/oidc.rs:1-4` says *"Deps: zeroize, serde, tokio (parent Cargo.toml; not modified here)"* — confirming the author knew the parent manifest was supposed to exist. It does not. This is a non-actionable-but-noteworthy documentation-vs-reality drift.

5. **F-5 (P3 — Reproducibility note, repeats SIDE-01 §4):** With path-only deps, switching to `pheno-otel = { path = "../pheno-otel", version = "0.1.0" }` would not change resolution today (the source IS `0.1.0`) but would catch future drift if the source bumps. Worth adding as a hygiene pass once v19 T2/T3 land.

---

## Recommendations (in order of urgency)

### R-1 (resolve F-2 + F-3) — Decide the fate of root-level `pheno-context/` and `pheno-config/`

Three options; pick one per repo:

| Option | What | Trade-off |
|--------|------|-----------|
| **(a) Move to canonical home** | `git mv pheno-context/src/oidc.rs FocalPoint/pheno-context/src/oidc.rs` (and update `FocalPoint/pheno-context/Cargo.toml` to add `tokio`, `serde`, `zeroize` deps for it). Same for `pheno-config/src/cascade.rs` and `src/secrets.rs` → `FocalPoint/pheno-config/src/` (or `Configra/crates/pheno-config/src/` per ADR-031). | Cleanest. Aligns with SIDE-01's canonical-home guidance and ADR-031's Configra absorb. |
| **(b) Add a manifest at root** | Author a `pheno-context/Cargo.toml` + `pheno-config/Cargo.toml` at the monorepo root that declares the deps referenced by the source files. | Duplicates the canonical home. Inverts the ADR-022/031/038 substrate-placement direction. **Not recommended** unless there's a reason these specific fragments must be siblings to other root-level crates. |
| **(c) Delete the root-level fragments** | If the source content is already replicated at the canonical home, just delete the root-level `pheno-context/` and `pheno-config/` directories. | Cleanest *if* the canonical home already has equivalent content. Worth checking first: does `FocalPoint/pheno-config/src/cascade.rs` exist? Does it have the same `build_cascade()` shape? If yes, the root-level `pheno-config/src/cascade.rs` is redundant. |

**Recommendation:** **R-1 (a) — move to canonical home, for both repos.** This is the path the rest of the fleet is already on (per SIDE-01 + ADR-022/031/038). The root-level `pheno-context/` and `pheno-config/` directories look like staging areas that were never wrapped in manifests; the v19 plan already routes new config/context work to `Configra` (ADR-031) and the existing substrate (per `focalpoint-wt-v12-16-17/pheno-config/Cargo.toml` which IS a manifest), so the right move is to consolidate, not to add new manifests.

### R-2 (hygiene, low priority) — Add `version = "0.1.0"` to the two `pheno-otel` path-deps

Trivial change to `pheno-port-adapter/Cargo.toml:30` and `pheno-errors/Cargo.toml:17`:
```toml
pheno-otel = { path = "../pheno-otel", version = "0.1.0" }
```
Today this changes nothing (source IS `0.1.0`). It is **defensive** against future drift if `pheno-otel` bumps to `0.2.0` without a coordinated update to the consumers' `Cargo.toml`. F-5's reproducibility note. P3.

### R-3 (out of scope but flagged) — Decide if `pheno-context` should grow a `Cargo.toml` at all

`pheno-context/docs/HEXAGONAL_PORTS.md:10-14` describes `pheno-context` as *"the canonical `Context` carrier (request id, span id, trace id, user/org metadata, extensible key-value bag) and a `ContextBuilder`"* — i.e. a pure value type. The current `src/oidc.rs` content is **OIDC**, not context — it's the v19 T3 stub (per ADR-079). So `pheno-context` is conflating two substrate roles:
- (a) The original "request context carrier" (FocalPoint home)
- (b) The v19 OIDC federation client (per ADR-079 / `plans/2026-06-21-v19-71-pillar-cycle-9-p0.md §2 T3`)

These should live in different crates. Recommend R-1a for the OIDC code (move to a new `pheno-oidc` substrate or to `pheno-context/src/oidc.rs` at the FocalPoint canonical home, with the OIDC deps added to that manifest). This is a v19+ decision and out of scope for the immediate SIDE-04 audit, but the version-alignment audit surfaces it.

---

## Appendix: raw evidence

### A.1 — Per-repo `Cargo.toml` snippets (verifiable in-place)

**`pheno-otel/Cargo.toml:1-31`**
```toml
[package]
name = "pheno-otel"
version = "0.1.0"
edition = "2021"
...
[dependencies]
thiserror = "2"
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
[dev-dependencies]
# Reserved for OTLP smoke test fixtures.
```

**`pheno-port-adapter/Cargo.toml:1-34`**
```toml
[package]
name = "pheno-port-adapter"
version = "0.1.0"
edition = "2021"
...
[dependencies]
thiserror = "2.0"
tokio = { version = "1", features = ["rt-multi-thread", "macros", "sync", "time"] }
async-trait = "0.1"
redis = { version = "0.27", default-features = false, features = ["tokio-comp", "connection-manager"] }
pheno-otel = { path = "../pheno-otel" }   # line 30 — NO version pin
```

**`pheno-errors/Cargo.toml:1-21`**
```toml
[package]
name = "pheno-errors"
version = "0.1.0"
edition = "2021"
...
[dependencies]
anyhow = "1"
thiserror = "2"
tracing = "0.1"
serde = { version = "1", features = ["derive"] }
pheno-otel = { path = "../pheno-otel" }   # line 17 — NO version pin
```

**`pheno-context/Cargo.toml`:** does not exist at this path.

**`pheno-config/Cargo.toml`:** does not exist at this path.

### A.2 — `Cargo.lock` excerpts

**`pheno-port-adapter/Cargo.lock:361-381`**
```toml
[[package]]
name = "pheno-otel"
version = "0.1.0"
dependencies = [
 "serde",
 "serde_json",
 "thiserror",
]

[[package]]
name = "pheno-port-adapter"
version = "0.1.0"
dependencies = [
 "async-trait",
 "pheno-otel",
 "redis",
 "serde_json",
 "thiserror",
 "tokio",
]
```

**`pheno-errors/Cargo.lock:167-188`**
```toml
[[package]]
name = "pheno-errors"
version = "0.1.0"
dependencies = [
 "anyhow",
 "pheno-otel",
 "proptest",
 "serde",
 "serde_json",
 "thiserror",
 "tracing",
 "tracing-test",
]

[[package]]
name = "pheno-otel"
version = "0.1.0"
dependencies = [
 "serde",
 "serde_json",
 "thiserror",
]
```

**`pheno-otel/Cargo.lock:18-24`**
```toml
[[package]]
name = "pheno-otel"
version = "0.1.0"
dependencies = [
 "serde",
 "serde_json",
 "thiserror",
]
```

All three `Cargo.lock` files agree: `pheno-otel` is locked at `0.1.0`, with no registry source line (path-only resolution). All source `[package].version` declarations are `0.1.0`. No drift.

### A.3 — `ls -la` proof of "no Cargo.toml" for the 2 structural findings

```
pheno-context/:
total 0
drwxr-xr-x@   4 kooshapari  staff   128 Jun 21 13:25 .
drwxr-xr-x@ 250 kooshapari  staff  8000 Jun 21 13:30 ..
drwxr-xr-x@   3 kooshapari  staff    96 Jun 21 13:13 docs
drwxr-xr-x@   3 kooshapari  staff    96 Jun 21 13:25 src

pheno-config/:
total 8
drwxr-xr-x@   7 kooshapari  staff   224 Jun 21 13:13 .
drwxr-xr-x@ 250 kooshapari  staff  8000 Jun 21 13:30 ..
drwxr-xr-x@   4 kooshapari  staff   128 Jun 21 13:13 docs
drwxr-xr-x@   5 kooshapari  staff   160 Jun 21 13:13 i18n
-rw-r--r--@   1 kooshapari  staff  1584 Jun 21 02:39 llms.txt
drwxr-xr-x@   4 kooshapari  staff   128 Jun 21 13:31 src
drwxr-xr-x@   3 kooshapari  staff    96 Jun 21 02:39 tests
```

`find pheno-context -name "Cargo.toml" -maxdepth 4` → no results.
`find pheno-config  -name "Cargo.toml" -maxdepth 4` → no results.

### A.4 — Cross-check: `focalpoint-wt-v12-16-17/` mirror state (informational, not in scope)

The `focalpoint-wt-v12-16-17` worktree (a worktree-of-a-worktree per the project conventions) carries **older / divergent** copies of all 5 crates:

| Crate | `repos/<name>/Cargo.toml` (current) | `focalpoint-wt-v12-16-17/<name>/Cargo.toml` (older) |
|-------|-------------------------------------|------------------------------------------------------|
| `pheno-otel`         | v0.1.0, deps: thiserror/serde/serde_json | v0.1.0, deps: opentelemetry 0.27 + otlp 0.27 + thiserror |
| `pheno-port-adapter` | v0.1.0, deps: thiserror/tokio/async-trait/redis/pheno-otel | v0.1.0, deps: thiserror only (no pheno-otel) |
| `pheno-errors`       | v0.1.0, deps: anyhow/thiserror/tracing/serde/**pheno-otel** | v0.1.0, deps: thiserror/anyhow/tracing (no pheno-otel) |
| `pheno-config`       | NO Cargo.toml                          | v0.1.0, deps: thiserror/serde/serde_json |
| `pheno-context`      | NO Cargo.toml                          | v0.1.0, deps: thiserror/http |

This confirms the v17/v18/v19 wave work: the root-level `pheno-otel`, `pheno-port-adapter`, `pheno-errors` are the **post-OTLP-substrate** versions (per ADR-037), while the worktree mirror is the **pre-OTLP-substrate** versions. The structural absence of `pheno-config` and `pheno-context` manifests at root aligns with the substrate-canonical-homes migration (ADR-031 → Configra for config; ADR-038 → FocalPoint workspace for context-hexagonal-ports).

This is **not a version-alignment mismatch** in the strict SIDE-04 sense (different paths, different worktrees, different points in time) but is corroborating evidence that the root-level `pheno-config/` and `pheno-context/` are **intentionally scaffold-state**, awaiting either a manifest or a move to canonical home.

---

**Audit date:** 2026-06-21
**Method reproducibility:** All evidence in this doc can be re-verified by re-running the `cargo tree -p <repo>` and `grep` commands listed above from `/Users/kooshapari/CodeProjects/Phenotype/repos/`. The `ls -la`/`find` commands under A.3 are also fully reproducible.
**Cross-references:** SIDE-01 (`findings/2026-06-21-SIDE-01-dep-audit.md`) covers the crates.io-publication dimension. This doc (SIDE-04) covers the internal dep version-alignment dimension. Both reach the same zero-drift conclusion via different routes.
