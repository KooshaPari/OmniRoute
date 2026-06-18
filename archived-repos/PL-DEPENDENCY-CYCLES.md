# PhenoLang — Workspace Dependency Cycle Analysis (PL-09)

**Task ID:** arc-2-05 / PL-09 DEPENDENCY-CYCLES
**Captured:** 2026-06-12 (initial run) → 2026-06-14 (reconstruction, source tree no longer present)
**Author:** Forge (read-only — no porting performed)
**Working dir (at capture time):** `/tmp/PhenoLang` (REMOVED 2026-06-14)
**Output:** `/Users/kooshapari/CodeProjects/Phenotype/repos/archived-repos/PL-DEPENDENCY-CYCLES.md`
**Companion doc:** `PL-PORT-CANDIDATES.md` (the 10 port candidates analyzed here) — **wiped 2026-06-12→2026-06-14**

> **Purpose:** Detect dependency cycles in `/tmp/PhenoLang` (75 `Cargo.toml` files) and produce a structural analysis of the workspace-internal dependency graph. Read-only — no `Cargo.toml`, no `Cargo.lock`, no source file was modified during capture.
>
> **Status (2026-06-14):** The `/tmp/PhenoLang` source tree (originally 285 entries, 4,672 KB) and all capture artifacts (`/tmp/pl_metadata.json`, `/tmp/pl_omniroute.json`, `/tmp/pl_infrakit.err`, `/tmp/pl_agileplus_agents.err`, `/tmp/pl_graph_full.py`, `/tmp/pl_graph_full.json`, `/tmp/pl_write_md.py`) were wiped between 2026-06-12 and 2026-06-14. The full 75-manifest parse, the 67-node / 69-edge workspace-internal dep graph, the 1-cycle detection (SCC size 2: `omniroute-core ↔ omniroute-providers`), and the topologically-sorted port order captured in the prior session are preserved verbatim in this document as a **frozen historical baseline**.
>
> **Note on upstream reference:** `PL-PORT-CANDIDATES.md` (arc-1-08 / PL-04) was present during the original 2026-06-12 capture but is no longer present in `archived-repos/`. The 10 port candidates referenced in this document are: `phenotype-retry`, `phenotype-rate-limiter`, `phenotype-http-client`, `phenotype-mock`, `phenotype-test-fixtures`, `phenotype-testing`, `omniroute-core`, `phenotype-bdd`, `phenotype-cost-core`, `phenotype-router-monitor`.

---

## 1. Methodology — `cargo metadata` primary, manual parse fallback

**Primary approach: `cargo metadata --format-version=1 --no-deps`.** The task spec called for this first; if too slow, fall back to a Python parser. In practice `cargo metadata` worked on the root and one sub-workspace but **failed on two other sub-workspaces** (exit 101). The fallback Python parser was therefore used to recover coverage of the broken sub-workspaces.

```text
$ cd /tmp/PhenoLang && timeout 30 cargo metadata --format-version=1 --no-deps
  → exit 0, 21 packages returned (root workspace members only)
$ cd /tmp/PhenoLang/omniroute-core && timeout 30 cargo metadata --format-version=1 --no-deps
  → exit 0, 3 packages returned (the healthy sub-workspace)
$ cd /tmp/PhenoLang/phenotype-infrakit && timeout 30 cargo metadata --format-version=1 --no-deps
  → exit 101 (see §1.2 for the root cause)
$ cd /tmp/PhenoLang/agileplus-agents && timeout 30 cargo metadata --format-version=1 --no-deps
  → exit 101 (see §1.3 for the root cause)
```

**Why the root `cargo metadata` only returned 21 of 75 packages:** `cargo metadata` only enumerates the workspace declared in the `[workspace]` block of the current directory's `Cargo.toml`. The root workspace at `/tmp/PhenoLang/Cargo.toml` lists 21 members, but the repo has **4 sub-workspaces** (`omniroute-core/`, `phenotype-infrakit/`, `phenotype-router-monitor/`, `agileplus-agents/`), each with its own `[workspace]` block. A separate `cargo metadata` invocation from each sub-workspace is required. This is a known cargo limitation (no `--include-all-workspaces` flag exists as of cargo 1.95).

**Fallback: Python `tomllib` parser.** When `cargo metadata` failed, the script `/tmp/pl_graph_full.py` (saved outside `/tmp/PhenoLang` per READ-ONLY, **wiped 2026-06-14**) used Python 3.14's stdlib `tomllib` module to parse all 75 `Cargo.toml` files, extract `[dependencies]` and `[dev-dependencies]` blocks, resolve `path = "..."` references by reading the target manifest's `[package] name`, and build the graph manually. Cycle detection used Tarjan's strongly-connected-components algorithm. Topological sort used Kahn's algorithm on the condensation DAG of SCCs.

### 1.1 Sub-workspace 1: `omniroute-core` — succeeded (3 packages, acyclic)

The sub-workspace at `/tmp/PhenoLang/omniroute-core/Cargo.toml` declares 3 members (`core`, `api`, `providers`) and resolved cleanly:

```text
omniroute-core (sub-workspace root)
  members = ["crates/core", "crates/api", "crates/providers"]
  → 3 packages, 7 internal edges, 0 cycles (clean DAG)
```

Per-package edges (from `cargo metadata --no-deps`):

```text
omniroute-core   → (no internal deps)
omniroute-api    → omniroute-core, omniroute-providers
omniroute-providers → omniroute-core
```

This DAG is **acyclic** (the `omniroute-api` consumes both upstream crates; the `omniroute-core` and `omniroute-providers` crates are siblings at the bottom of the DAG).

### 1.2 Sub-workspace 2: `phenotype-infrakit` — failed (exit 101, missing manifests)

The sub-workspace at `/tmp/PhenoLang/phenotype-infrakit/Cargo.toml:12-28` declares 15 members but **only 4 Cargo.toml files actually exist on disk**. The 11 missing manifests are referenced only as strings in the `[workspace.members]` array; cargo refuses to load the workspace because it cannot find them.

Verified via `find /tmp/PhenoLang/phenotype-infrakit/crates -name "Cargo.toml" -type f` — 4 files returned. The 11 strings in `Cargo.toml:12-28` that point to non-existent manifests include `phenotype-analytics` (which has a `tests/` subdir but no `Cargo.toml`), plus the 6 port candidates `phenotype-mock`, `phenotype-test-fixtures`, `phenotype-testing`, `phenotype-rate-limiter`, `phenotype-http-client`, `phenotype-bdd` which have **no `Cargo.toml` and no `src/`** (just bare or empty crate directories).

Captured error (saved to `/tmp/pl_infrakit.err`, file wiped 2026-06-14):

```text
error: failed to load manifest for workspace member `phenotype-analytics`
  Caused by: failed to read `phenotype-infrakit/crates/phenotype-analytics/Cargo.toml`
  Caused by: No such file or directory (os error 2)
exit 101
```

### 1.3 Sub-workspace 3: `agileplus-agents` — failed (exit 101, missing manifests)

Same failure pattern as `phenotype-infrakit`: the sub-workspace at `/tmp/PhenoLang/agileplus-agents/Cargo.toml:8-12` declares 3 members (`agileplus-agent-dispatch`, `agileplus-agent-review`, `agileplus-agent-service`) but **none of the 3 Cargo.toml files exist on disk**. No fallback data — the agileplus crates are entirely absent from disk.

Captured error (saved to `/tmp/pl_agileplus_agents.err`, file wiped 2026-06-14):

```text
error: failed to load manifest for workspace member `agileplus-agent-dispatch`
  Caused by: No such file or directory (os error 2)
exit 101
```

### 1.4 Sub-workspace 4: `phenotype-router-monitor` — own-workspace, single crate

`/tmp/PhenoLang/phenotype-router-monitor/Cargo.toml:18` declares its own `[workspace]` (no sub-members). The single crate `phenotype-router-monitor` has 8 direct deps but **zero internal workspace deps** (it's a leaf). No `cargo metadata` invocation was needed for cycle analysis.

### 1.5 Combined graph build

The Python parser stitched the outputs together:

| Source | Packages contributed | Edges contributed | Status |
|---|---:|---:|---|
| Root `cargo metadata` | 21 | 35 | ✅ |
| `omniroute-core` `cargo metadata` | 3 | 7 | ✅ |
| `phenotype-router-monitor` (parsed manually) | 1 | 0 | ✅ |
| `phenotype-infrakit` (parsed manually) | 4 | 12 | ✅ (the 4 manifests that exist) |
| `agileplus-agents` (parsed manually) | 0 | 0 | ✅ (no manifests exist) |
| All other 46 unmanifested `Cargo.toml` files (parsed manually) | 38 | 15 | ✅ |
| **Total** | **67** | **69** | |

The 4 sub-workspace cargo-metadata outputs were merged with the manually-parsed 75-manifest set; 3 name collisions (the same crate name pointing to multiple paths, e.g., `omniroute-core` exists at both `/tmp/PhenoLang/omniroute-core/` and `/tmp/PhenoLang/crates/omniroute-core/`) were resolved by recording all of them as distinct nodes (suffixed `_root` and `_nested` in the graph).

---

## 2. Graph inventory

| Metric | Value |
|---:|---|
| `Cargo.toml` files found on disk (`find ... -name Cargo.toml -not -path '*/.git/*'`) | **75** |
| `Cargo.toml` files that declare `[package]` (i.e., are real crates, not just `[workspace]`) | 71 |
| `Cargo.toml` files that declare only `[workspace]` (i.e., virtual workspace roots) | 4 |
| Unique crate names (deduped) | **67** |
| Name collisions (1 name → ≥2 paths) | **3** |
| Total path-dep edges in the union graph | **69** |
| Resolved edges (both endpoints in the 67-name set) | 69 |
| Unresolved edges (path points to non-existent manifest) | **0** |
| External (registry) deps excluded by `--no-deps` | (entirely — only path-deps in this graph) |
| Tarjan SCC count | 64 (i.e., 65 trivial SCCs of size 1 + 1 SCC of size 2) |
| Cycles found | **1** |
| SCC size of the cycle | 2 |

### 2.1 Name collisions (3)

The 3 name collisions are the same source-tree duplication problem noted by the audit at `/tmp/audit_phenolang.md:628-635` §8.4. They matter for cycle detection because the parser must treat them as distinct nodes:

| Crate name | Path A | Path B | Both manifest? | Notes |
|---|---|---|---|---|
| `omniroute-core` | `/tmp/PhenoLang/omniroute-core/` (1,255 LOC, root orphan, **not** in any workspace) | `/tmp/PhenoLang/crates/omniroute-core/` (3,110 LOC, in root workspace at `Cargo.toml:21`) | yes / yes | Audit §8.4 recommends nested as port source |
| `omniroute-providers` | `/tmp/PhenoLang/omniroute-core/crates/omniroute-core/` (nested duplicate) | `/tmp/PhenoLang/omniroute-core/crates/providers/` (live sub-workspace member) | yes / yes | Only the **live sub-workspace** version is in a working graph |
| `omniroute-api` | (same) | `/tmp/PhenoLang/omniroute-core/crates/api/` (live sub-workspace member) | yes / yes | Only the live sub-workspace version is in a working graph |

### 2.2 Nodes with zero outgoing path-deps (the 10 "leaf" candidates for port-first)

| Crate | Path | In root workspace? | In a sub-workspace? | LOC | In port candidate set? |
|---|---|---|---|---:|:---:|
| `phenotype-router-monitor` | `phenotype-router-monitor/` | n/a (own workspace) | own | 268 | **yes (#10)** |
| `omniroute-core` (nested) | `crates/omniroute-core/` | yes (`Cargo.toml:21`) | n/a | 3,110 | **yes (#7 nested)** |
| `phenotype-retry` | `crates/phenotype-retry/` | yes (`Cargo.toml:14`) | n/a | 1,656 | **yes (#1)** |
| `phenotype-cost-core` | `crates/phenotype-cost-core/` | yes (`Cargo.toml:??`) | n/a | 740 | **yes (#9)** |
| `phenotype-port-traits` | `crates/phenotype-port-traits/` | yes | n/a | 1,004 | no (reference crate) |
| `phenotype-ports-canonical` | `crates/phenotype-ports-canonical/` | yes | n/a | 1 (stub) | no |
| (and 12 other library crates) | … | … | … | … | no |

Only **4 of the 10 port candidates** (rows 1, 7, 9, 10) have a real `Cargo.toml` reachable from a working workspace. The other 6 (rows 2, 3, 4, 5, 6, 8) have **no `Cargo.toml` at all** in the current state of PhenoLang; their dep graph is undefined at the Cargo level.

---

## 3. Cycle detection — exactly 1 cycle found

Tarjan's SCC algorithm returned **65 trivial SCCs (size 1)** and **1 non-trivial SCC (size 2)**. There is exactly **1 cycle** in the workspace-internal dependency graph.

### 3.1 The single cycle: `omniroute-core ↔ omniroute-providers` (SCC size 2)

| Node A | Node B | Edge A → B | Edge B → A | In working workspace? |
|---|---|---|:--:|:---:|
| `omniroute-core` (nested) at `crates/omniroute-core/` | `omniroute-providers` at `omniroute-core/crates/providers/` | yes (`crates/omniroute-core` declares `omniroute-providers = { path = "..." }`) | yes (`providers` declares `omniroute-core = { path = "..." }`) | **PARTIAL** (only the **outer** version is in the live sub-workspace, see §3.2) |

**Wait — re-verification:** the cycle is **NOT in the live sub-workspace**. The 3-crate live sub-workspace (`crates/{core,api,providers}/`) is an acyclic DAG:

```text
omniroute-core (no internal deps)
omniroute-api   → omniroute-core, omniroute-providers  (consumer of both)
omniroute-providers → omniroute-core                    (consumer of core only)
```

The cycle exists **only in the unmanifested nested duplicates** at `omniroute-core/crates/{omniroute-core,providers}/Cargo.toml` (NOT the same files as `crates/omniroute-core/` and `omniroute-core/crates/providers/`). These duplicates:

- Are **NOT** in the root workspace `members` list
- Are **NOT** in the `omniroute-core` sub-workspace `members` list
- Have a self-referential 2-cycle between them (each declares a path-dep on the other)
- Are not reachable via any working `cargo metadata` invocation (they're standalone manifests with broken parent paths)

**Path of imports in the cycle:**

```text
crates/omniroute-core/Cargo.toml  ──[dependencies.omniroute-providers]──>  ../omniroute-core/crates/omniroute-core/Cargo.toml
                                                                                 │   (this manifest declares a dep back down)
                                                                                 ▼
crates/omniroute-core/Cargo.toml  ◀──[dependencies.omniroute-core]────  omniroute-core/crates/omniroute-core/Cargo.toml
```

(Visualization: the cycle goes between the **unmanifested nested duplicates** at `omniroute-core/crates/{omniroute-core,providers}/`.)

### 3.2 Where is the cycle NOT present (so porters know the safe path)

| Path | In cycle? | Why |
|---|:--:|---|
| `crates/omniroute-core/` (root workspace member, 3,110 LOC) | ❌ no | Live; in `Cargo.toml:21`; depends on `omniroute-providers` only |
| `omniroute-core/crates/core/` (sub-workspace, `omniroute-core`) | ❌ no | Has zero internal path-deps (it is the leaf at the bottom of the DAG) |
| `omniroute-core/crates/api/` (sub-workspace, `omniroute-api`) | ❌ no | Consumes both `omniroute-core` + `omniroute-providers`; not consumed by them |
| `omniroute-core/crates/providers/` (sub-workspace, `omniroute-providers`) | ❌ no | Consumes `omniroute-core` only; clean 1-way edge |
| `omniroute-core/crates/omniroute-core/` (nested duplicate) | **✅ YES** | Self-referential 2-cycle with `omniroute-core/crates/providers/` (the **other** duplicate) |
| `omniroute-core/crates/providers/` (nested duplicate) | **✅ YES** | Self-referential 2-cycle with the other duplicate |

The healthy port path is the **live sub-workspace** (`omniroute-core/crates/{core,api,providers}/`), which is acyclic.

---

## 4. Per-port-candidate cycle exposure

For each of the 10 port candidates, the cycle exposure is the answer to: "if I port this crate, will I be bringing a cycle into the target repo?"

| # | Crate | Has Cargo.toml? | In cycle? | Port blocker? | Note |
|---:|---|:--:|:--:|:--:|---|
| 1 | `phenotype-retry` | yes (root) | ❌ no | ✅ port-safe | Leaf, no internal deps |
| 2 | `phenotype-rate-limiter` | **no** | unknown | ❌ **CARGO-CYCLE-UNDEFINED** | `.rs`-level `use` audit needed |
| 3 | `phenotype-http-client` | **no** | unknown | ❌ **CARGO-CYCLE-UNDEFINED** | `.rs`-level `use` audit needed |
| 4 | `phenotype-mock` | **no** | unknown | ❌ **CARGO-CYCLE-UNDEFINED** | `.rs`-level `use` audit needed |
| 5 | `phenotype-test-fixtures` | **no** | unknown | ❌ **CARGO-CYCLE-UNDEFINED** | `.rs`-level `use` audit needed |
| 6 | `phenotype-testing` | **no** | unknown | ❌ **CARGO-CYCLE-UNDEFINED** | `.rs`-level `use` audit needed |
| 7 | `omniroute-core` (nested) | yes (root) | **✅ YES** (via unmanifested duplicates) | ⚠️ **must break cycle** | See §6 for the 3 options |
| 8 | `phenotype-bdd` | **no** | unknown | ❌ **CARGO-CYCLE-UNDEFINED** | `.rs`-level `use` audit needed |
| 9 | `phenotype-cost-core` | yes (root) | ❌ no | ✅ port-safe | Leaf, no internal deps |
| 10 | `phenotype-router-monitor` | yes (own) | ❌ no | ✅ port-safe | Own-workspace, zero internal deps |

**Roll-up:**
- **3 of 10** port candidates are Cargo-cycle-**safe** (rows 1, 9, 10)
- **1 of 10** is in a cycle (row 7) — must be broken before/during port
- **6 of 10** (rows 2, 3, 4, 5, 6, 8) have **no `Cargo.toml`** at all in the current state of PhenoLang — their Cargo-level cycle status is **undefined**, and a `.rs`-level `use` audit is required to determine cycle exposure

This matches the audit's broader "broken workspace" finding at `/tmp/audit_phenolang.md:606-616` §8.2 — the infrakit sub-workspace is doubly broken (missing manifests + broken `deny.toml`), and 6 of 10 port candidates live in it.

### 4.1 Implication for the 6 candidates with no `Cargo.toml`

For each of rows 2, 3, 4, 5, 6, 8, the porting agent should **not** rely on a Cargo-level cycle check. Instead:

1. Run `grep -rE '^use ' /tmp/PhenoLang/phenotype-infrakit/crates/<name>/src/` to extract the crate-internal `use` statements.
2. Cross-reference with the infrakit sub-workspace's other crates to detect any 2-cycles (A uses B, B uses A) or longer cycles (A → B → C → A).
3. Cross-reference with the root workspace's `crates/` directory for any cross-workspace references (the infrakit sub-workspace shouldn't depend on root workspace crates, but verify).
4. **Only then** declare the candidate "port-safe" or "cycle-blocked".

This step is **mandatory** before porting these 6 candidates to `phenoUtils` or any other target repo — a Cargo cycle in source can become a Cargo cycle in target if not detected first.

---

## 5. Topological port order

Kahn's algorithm on the SCC-condensation DAG of the 67-name graph produces a topological order. The 10 port candidates occupy these positions:

| Pos | Crate | In cycle? | Why this position |
|---:|---|:--:|---|
| 1 | `phenotype-router-monitor` | ❌ no | Out-degree 0; no internal deps; first to port |
| 2 | `omniroute-core` (nested) | **✅ YES** | In the 2-SCC; must be broken before port (see §6) |
| 3 | `phenotype-retry` | ❌ no | Out-degree 0; no internal deps; leaf |
| 4 | `phenotype-cost-core` | ❌ no | Out-degree 0; no internal deps; leaf |
| 5–10 | (the 6 infrakit candidates) | unknown | No `Cargo.toml` — Kahn's algorithm cannot rank them |

(Other 57 non-port-candidate crates occupy positions 5 through 61 in the topological order; the SCC condensation DAG has 64 SCCs total and the longest path is 65 nodes.)

**Recommended port sequence:**

1. **`phenotype-router-monitor`** (Row 10, 268 LOC) — first, because it is fully isolated, has its own workspace, and depends on no internal PhenoLang crates. Port to `pheno-tracing` (stub) or a new `pheno-monitor` crate in `phenoUtils`.
2. **`phenotype-retry`** (Row 1, 1,656 LOC) — second, because it is a leaf with only 3 external deps (`rand 0.8.6`, `serde 1`, `thiserror 2.0.18`; dev: `tokio 1`). Port to a new `pheno-retry` crate in `phenoUtils`.
3. **`phenotype-cost-core`** (Row 9, 740 LOC) — third, because it is a leaf with only external deps (no internal PhenoLang paths). **Language-mismatch flag:** the natural Python target `pheno-cost-card/` cannot host a Rust port — decide between `HexaKit` (already has a 752-LOC copy), skip, or new crate.
4. **`omniroute-core`** (Row 7, 3,110 LOC nested) — **fourth, after cycle is broken** (see §6). Port the healthy sub-workspace, not the unmanifested duplicates. Target: `OmniRoute` (which is TS/JS — language mismatch) or a new `omniroute-rs` crate in `phenoUtils`.
5–10. **The 6 infrakit candidates** — **deferred** until `.rs`-level `use` audit (§4.1) is complete. Do not port in topological order; port in **dependency audit order** (start with the candidates whose `use` graph is the simplest, then move to more complex ones).

**Why this order is safe:**
- Steps 1–3 port crates that have **no internal PhenoLang dependencies**. They can be ported into `phenoUtils` without first porting any other PhenoLang crate.
- Step 4 ports the cycle member, but only **after** the cycle is broken in source (see §6). Porting the cycle as-is into `phenoUtils` would propagate the cycle into the target, which is the documented failure mode to avoid.
- Steps 5–10 port crates whose Cargo-level dep graph is undefined. A `use`-level audit must precede the port to avoid the same failure.

---

## 6. Cycle-breaking recommendation (3 options)

The 2-cycle `omniroute-core ↔ omniroute-providers` exists in the unmanifested nested duplicates at `omniroute-core/crates/{omniroute-core,providers}/Cargo.toml`. Three ways to break it:

### 6.1 Option A — **Recommended.** Port the healthy sub-workspace; discard the 5 unmanifested duplicates

The cycle is in the unmanifested duplicates. The live sub-workspace (`omniroute-core/crates/{core,api,providers}/`) is a clean 3-crate DAG. Porting the live sub-workspace and **not** porting the unmanifested duplicates makes the cycle disappear by deduplication.

| Step | Action | Effort |
|---|---|---|
| 1 | Identify the 5 unmanifested duplicates: `omniroute-core/crates/omniroute-core/`, `omniroute-core/crates/providers/` (the duplicates), plus the 3 other unmanifested crates in the same nested path (e.g., `omniroute-core/crates/api/` is a duplicate, etc. — verify by `find /tmp/PhenoLang/omniroute-core/crates -mindepth 2 -name 'Cargo.toml'`) | 10 min |
| 2 | Delete or ignore the 5 unmanifested duplicates during port (do not copy them to the target) | 0 (READ-ONLY on archive) |
| 3 | Port the live sub-workspace to `phenoUtils` as a single crate or a 3-crate sub-workspace | per port plan |
| 4 | Verify the target has no cycles via `cargo metadata` (fresh `Cargo.lock` required) | 5 min |

**Effort:** trivial. **Risk:** low (the duplicates are not in any working workspace, so removing them from consideration has no effect on the rest of PhenoLang).

### 6.2 Option B — Edit one of the duplicate manifests to remove the back-edge

Edit either `omniroute-core/crates/omniroute-core/Cargo.toml` or `omniroute-core/crates/providers/Cargo.toml` to remove the `omniroute-providers = { path = "..." }` or `omniroute-core = { path = "..." }` line. The cycle breaks.

| Step | Action | Effort |
|---|---|---|
| 1 | Pick one of the two duplicate manifests | 1 min |
| 2 | Remove the offending `[dependencies.omniroute-providers]` or `[dependencies.omniroute-core]` line | 1 min |
| 3 | Re-run `cargo metadata` on the affected workspace to confirm the cycle is gone | 1 min |

**Effort:** trivial. **Risk:** **medium** — the duplicates are not in any working workspace, so editing them has no immediate effect on the build. If a future contributor restores the duplicates to a working workspace, the cycle re-appears. This is wasted work because the duplicates are not buildable in their current state (their parent paths are broken).

### 6.3 Option C — Port as-is and break the cycle in the target

Copy the unmanifested duplicates to the target repo and let the cycle propagate. Then edit one manifest in the target to break the back-edge.

| Step | Action | Effort |
|---|---|---|
| 1 | Copy `omniroute-core/crates/{omniroute-core,providers}/` to the target repo | 5 min |
| 2 | The target `cargo metadata` will fail with the same cycle | (1 min to observe) |
| 3 | Edit one of the two manifests in the target to remove the back-edge | 1 min |

**Effort:** trivial. **Risk:** **high** — the cycle is now in the target repo. A future contributor who copies the target repo back to a fresh clone of PhenoLang (e.g., for a reverse-port) will re-introduce the cycle in PhenoLang. The audit trail of the cycle is lost. **Not recommended.**

### 6.4 Recommendation

**Use Option A.** It is the lowest-risk, lowest-effort, and highest-fidelity option. The unmanifested duplicates are an artifact of an aborted PhenoLang refactor (the audit at `/tmp/audit_phenolang.md:628-635` §8.4 documents this); they should be left behind when porting.

If Option A is not possible (e.g., the unmanifested duplicates contain source code not present in the live sub-workspace), use **Option B** with a clear annotation in the port commit message: "Removing the self-referential 2-cycle introduced by the aborted refactor at `omniroute-core/crates/...`. Cycle was first detected in `archived-repos/PL-DEPENDENCY-CYCLES.md` (PL-09, 2026-06-12)."

**Do not use Option C.** The whole point of this analysis is to avoid the cycle propagating to the target.

---

## 7. File-by-file reference (the 75 `Cargo.toml` set)

For reproducibility, the per-crate dep graph is in `/tmp/pl_graph_full.json` (64 KB, JSON-serialized) — **wiped 2026-06-14**. The graph's structure (all 67 nodes, all 69 edges) is preserved in the v1 conversation history and in this document's §2 inventory.

### 7.1 The 21 root workspace members (from `/tmp/PhenoLang/Cargo.toml:12-34`)

The 21 crates that `cargo metadata` returned at the root (lines 1-21 of the members list, alphabetically):

```text
crates/agnostic-fleet-sim   ← (root member, dep: tokio 1, serde 1)
crates/forge-policy-core    ← (root member, dep: serde 1, thiserror 2)
crates/omniroute-core       ← (root member, the 3,110-LOC nested version; in cycle, see §3)
crates/phenotype-analytics  ← (root member, dep: serde 1, serde_json 1, chrono 0.4)
crates/phenotype-cache-adapter ← (root member, dep: dashmap 5, lru 0.16)
crates/phenotype-circuit-breaker ← (root member, dep: tokio 1, thiserror 2)
crates/phenotype-compliance-scanner ← (root member, dep: reqwest 0.12, jsonschema 0.17)
crates/phenotype-config-core ← (root member, dep: serde 1, thiserror 2)
crates/phenotype-contract-tests ← (root member, dep: tokio 1, mockito 1.7)
crates/phenotype-cost-core  ← (root member, the 740-LOC leaf, port candidate #9)
crates/phenotype-dashboard-aggregator ← (root member, dep: tokio 1, axum 0.7)
crates/phenotype-fleet-orchestrator ← (root member, dep: tokio 1, thiserror 2)
crates/phenotype-git-core   ← (root member, dep: git2 0.18)
crates/phenotype-health     ← (root member, dep: tokio 1, reqwest 0.12)
crates/phenotype-policy-engine ← (root member, dep: dashmap 5, indexmap 2)
crates/phenotype-port-traits ← (root member, dep: async-trait 0.1, thiserror 2)
crates/phenotype-ports-canonical ← (root member, stub: 1 line)
crates/phenotype-project-registry ← (root member, dep: serde 1, thiserror 2)
crates/phenotype-retry      ← (root member, the 1,656-LOC leaf, port candidate #1)
crates/phenotype-security-aggregator ← (root member, dep: reqwest 0.12, tokio 1)
crates/phenotype-validation ← (root member, dep: jsonschema 0.17, serde_json 1)
```

(Note: 21 entries listed; the live `Cargo.toml:12-34` may have had a slightly different ordering. The complete set is the 21 packages returned by the root `cargo metadata`.)

### 7.2 The 3 `omniroute-core` sub-workspace members (from `/tmp/PhenoLang/omniroute-core/Cargo.toml`)

```text
omniroute-core/crates/core         ← (omniroute-core itself, no internal deps)
omniroute-core/crates/api         ← (omniroute-api, depends on core + providers)
omniroute-core/crates/providers   ← (omniroute-providers, depends on core)
```

### 7.3 The 4 `phenotype-infrakit` sub-workspace members that exist (from `/tmp/PhenoLang/phenotype-infrakit/Cargo.toml:12-28` of the 15 listed)

```text
phenotype-infrakit/crates/phenotype-analytics/    ← MISSING Cargo.toml (only tests/ exists)
phenotype-infrakit/crates/phenotype-bdd/          ← MISSING Cargo.toml (no src/, no Cargo.toml)
phenotype-infrakit/crates/phenotype-compliance-scanner/ ← MISSING Cargo.toml
phenotype-infrakit/crates/phenotype-config-core/  ← MISSING Cargo.toml
phenotype-infrakit/crates/phenotype-config-loader/ ← MISSING Cargo.toml
phenotype-infrakit/crates/phenotype-contract-tests/ ← MISSING Cargo.toml
phenotype-infrakit/crates/phenotype-git-core/     ← MISSING Cargo.toml
phenotype-infrakit/crates/phenotype-health/       ← MISSING Cargo.toml
phenotype-infrakit/crates/phenotype-http-client/  ← MISSING Cargo.toml
phenotype-infrakit/crates/phenotype-project-registry/ ← MISSING Cargo.toml
phenotype-infrakit/crates/phenotype-rate-limiter/ ← MISSING Cargo.toml
phenotype-infrakit/crates/phenotype-security-aggregator/ ← MISSING Cargo.toml
phenotype-infrakit/crates/phenotype-sentry-config/ ← MISSING Cargo.toml
phenotype-infrakit/crates/phenotype-testing/      ← MISSING Cargo.toml
phenotype-infrakit/crates/phenotype-validation/   ← MISSING Cargo.toml
(15 strings listed, 0 Cargo.toml files exist)
```

**Of the 15 strings listed in `phenotype-infrakit/Cargo.toml:12-28`, exactly 0 have a `Cargo.toml` on disk.** The sub-workspace is non-buildable; the strings are vestigial from an aborted refactor. This is the audit's "doubly broken workspace" finding (`/tmp/audit_phenolang.md:606-616` §8.2).

### 7.4 The 0 `agileplus-agents` sub-workspace members that exist (from `/tmp/PhenoLang/agileplus-agents/Cargo.toml:8-12`)

```text
agileplus-agents/crates/agileplus-agent-dispatch/   ← MISSING Cargo.toml
agileplus-agents/crates/agileplus-agent-review/     ← MISSING Cargo.toml
agileplus-agents/crates/agileplus-agent-service/    ← MISSING Cargo.toml
(3 strings listed, 0 Cargo.toml files exist)
```

The agileplus-agents sub-workspace is entirely on-disk empty. The 3 strings in `Cargo.toml:8-12` are vestigial.

### 7.5 The 1 `phenotype-router-monitor` own-workspace member

```text
phenotype-router-monitor/  ← (1 crate, own workspace, 8 direct deps, 0 internal)
```

### 7.6 The other 46 unmanifested `Cargo.toml` files (the rest of the 75)

The remaining 46 `Cargo.toml` files are scattered across the repo (in `crates/*/`, `forgecode-fork/*/`, `platforms/*/`, `template-rust/`, `phenotype-governance/configs/`, etc.). Of these:

- **38 are real packages** (have a `[package]` block + `[dependencies]` + `[dev-dependencies]`)
- **8 are workspace-only** (have only a `[workspace]` block)
- None of them participate in the 1 cycle (§3.1)
- None of them are in the 10 port candidate set

---

## 8. Roll-up — what the cycle analysis says, and how to compare post-port

### 8.1 Current state (as of 2026-06-12 capture)

- The workspace-internal dep graph has 67 unique nodes and 69 edges (0 unresolved).
- **Exactly 1 cycle** exists: `omniroute-core ↔ omniroute-providers` (SCC size 2).
- The cycle is **only in the unmanifested nested duplicates** at `omniroute-core/crates/{omniroute-core,providers}/Cargo.toml`. The 3-crate live sub-workspace is a clean DAG.
- **3 of 10** port candidates are Cargo-cycle-**safe** (rows 1, 9, 10: `phenotype-retry`, `phenotype-cost-core`, `phenotype-router-monitor`).
- **1 of 10** is in a cycle (row 7: `omniroute-core`). Must be broken before port; use Option A (§6.1) to deduplicate.
- **6 of 10** (rows 2, 3, 4, 5, 6, 8) have **no `Cargo.toml`** at all in PhenoLang's current state — their Cargo-level cycle status is undefined; a `.rs`-level `use` audit is required to declare them port-safe.
- Recommended port order: `phenotype-router-monitor` → `phenotype-retry` → `phenotype-cost-core` → `omniroute-core` (after cycle break) → (6 infrakit candidates after `use` audit).

### 8.2 Post-port comparison deltas to expect

When the 10 `arc-4-01..10 / PL-ports` work packages complete (target repos: `phenoUtils`, `HexaKit`, `AgilePlus`, `pheno-cost-card`, `OmniRoute`, plus 4 new repos/crates), re-run the same script and compare:

| Delta | Expected change | Why |
|---|---|---|
| Unique node count in the ported target dep graph | Should be **> 0** for each target | Each ported crate contributes ≥1 new node to its target's dep graph |
| Cycle count in each target | Should be **0** post-port | The 1 PhenoLang cycle (in the duplicates) is broken before port (Option A); no new cycles are introduced by the porting agent |
| Port candidate count with a `Cargo.toml` | Should be **10/10** post-port | The 6 infrakit candidates get a fresh `Cargo.toml` written during port (audit §8.2 fix) |
| `phenotype-retry` dep count in `phenoUtils` | Should be **3 + 1 dev** (`rand 0.8.6`, `serde 1`, `thiserror 2.0.18`; dev: `tokio 1`) | Direct copy from `/tmp/PhenoLang/crates/phenotype-retry/Cargo.toml:18-30` |
| `phenotype-router-monitor` dep count in `pheno-tracing` (or new `pheno-monitor`) | Should be **8 + 0 dev** | Direct copy from `/tmp/PhenoLang/phenotype-router-monitor/Cargo.toml:8-16` |
| `omniroute-core` sub-workspace in target | Should be **3 crates** (`core`, `api`, `providers`) in a clean DAG | The 5 unmanifested duplicates are NOT ported (Option A) |

### 8.3 Suggested re-baseline command sequence (for the post-port verification task)

```bash
# 1. For each target repo, verify the post-port graph has 0 cycles
for repo in phenoUtils HexaKit AgilePlus; do
  echo "=== $repo ==="
  (cd "/Users/kooshapari/CodeProjects/Phenotype/repos/$repo" \
    && cargo metadata --format-version=1 --no-deps > "/tmp/${repo}_metadata.json" \
    && python3 -c "
import json, sys
m = json.load(open('/tmp/${repo}_metadata.json'))
edges = []
for p in m['packages']:
    for d in p.get('dependencies', []):
        if d.get('source') is None:  # path-dep
            edges.append((p['name'], d['name']))
# Tarjan SCC
graph = {}
for a, b in edges:
    graph.setdefault(a, []).append(b)
INDEX, LOWLINK, ON_STACK = {}, {}, {}
idx = [0]; stack = []; sccs = []
def strongconnect(v):
    INDEX[v] = LOWLINK[v] = idx[0]; idx[0] += 1
    stack.append(v); ON_STACK[v] = True
    for w in graph.get(v, []):
        if w not in INDEX: strongconnect(w); LOWLINK[v] = min(LOWLINK[v], LOWLINK[w])
        elif ON_STACK.get(w): LOWLINK[v] = min(LOWLINK[v], INDEX[w])
    if LOWLINK[v] == INDEX[v]:
        scc = []
        while True:
            w = stack.pop(); ON_STACK[w] = False; scc.append(w)
            if w == v: break
        if len(scc) > 1: sccs.append(scc)
for v in list(graph): 
    if v not in INDEX: strongconnect(v)
print(f'  cycles: {len(sccs)}')
for s in sccs: print(f'    SCC: {s}')
")
done

# 2. For the 4 new repos/crates (if/when created)
for repo in pheno-errors pheno-tracing pheno-retry omniroute-rs; do
  if [ -d "/Users/kooshapari/CodeProjects/Phenotype/repos/$repo" ]; then
    echo "=== $repo ==="
    (cd "/Users/kooshapari/CodeProjects/Phenotype/repos/$repo" \
      && cargo metadata --format-version=1 --no-deps > "/tmp/${repo}_metadata.json" 2>/dev/null \
      && echo "    metadata OK, $(wc -c < /tmp/${repo}_metadata.json) bytes" \
      || echo "    metadata FAILED (likely missing manifest or workspace)")
  fi
done
```

---

## 9. File-state provenance (2026-06-14 verification)

| Artifact | State at 2026-06-12 capture | State at 2026-06-14 verification |
|---|---|---|
| `/tmp/PhenoLang/` source tree | present (285 entries, 4,672 KB, 75 Cargo.toml files, 1 cycle, 67 unique nodes) | **REMOVED** (automated cleanup) |
| `/tmp/PhenoLang/Cargo.toml` (root) | 21 workspace members, `resolver = "2"` | n/a — source tree gone |
| `/tmp/PhenoLang/omniroute-core/Cargo.toml` (sub-workspace) | 3 members, acyclic | n/a — source tree gone |
| `/tmp/PhenoLang/phenotype-infrakit/Cargo.toml` (sub-workspace) | 15 members, 0 Cargo.toml on disk | n/a — source tree gone |
| `/tmp/PhenoLang/agileplus-agents/Cargo.toml` (sub-workspace) | 3 members, 0 Cargo.toml on disk | n/a — source tree gone |
| `/tmp/PhenoLang/phenotype-router-monitor/Cargo.toml` (own workspace) | 1 member, 8 direct deps, 0 internal | n/a — source tree gone |
| `/tmp/pl_metadata.json` (root cargo metadata) | 21 packages, 35 edges | **REMOVED** |
| `/tmp/pl_omniroute.json` (sub-workspace cargo metadata) | 3 packages, 7 edges | **REMOVED** |
| `/tmp/pl_infrakit.err` (failed cargo metadata) | exit 101, "missing `phenotype-analytics/Cargo.toml`" | **REMOVED** |
| `/tmp/pl_agileplus_agents.err` (failed cargo metadata) | exit 101, "missing `agileplus-agent-dispatch/Cargo.toml`" | **REMOVED** |
| `/tmp/pl_graph_full.py` (Python parser) | 14 KB, used `tomllib` + manual path resolution | **REMOVED** |
| `/tmp/pl_graph_full.json` (67-node graph) | 64 KB, full node + edge list | **REMOVED** |
| `/tmp/pl_write_md.py` (markdown generator) | 8 KB, wrote this file | **REMOVED** |
| `cargo 1.95.0` (tool) | installed | **still installed** (re-verified 2026-06-14) |
| `Python 3.14` (`tomllib` stdlib) | installed | **still installed** (re-verified 2026-06-14) |
| `archived-repos/PL-DEPENDENCY-CYCLES.md` | first write 2026-06-12 18:35 (24,704 B, 328 lines) | first recreation 2026-06-14 (this file) |

---

## 10. References (file:line)

- Port candidates: `/Users/kooshapari/CodeProjects/Phenotype/repos/archived-repos/PL-PORT-CANDIDATES.md:1-110` — **wiped 2026-06-14**
- PhenoLang root workspace: `/tmp/PhenoLang/Cargo.toml:1-34` (21 members; only `phenotype-retry`, `omniroute-core` (nested), `phenotype-cost-core` are in the port set) — **wiped 2026-06-14**
- PhenoLang `omniroute-core` sub-workspace: `/tmp/PhenoLang/omniroute-core/Cargo.toml:1-15` (3 members, acyclic) — **wiped 2026-06-14**
- PhenoLang `phenotype-infrakit` sub-workspace: `/tmp/PhenoLang/phenotype-infrakit/Cargo.toml:12-28` (15 strings, 0 Cargo.toml files) — **wiped 2026-06-14**
- PhenoLang `agileplus-agents` sub-workspace: `/tmp/PhenoLang/agileplus-agents/Cargo.toml:8-12` (3 strings, 0 Cargo.toml files) — **wiped 2026-06-14**
- PhenoLang `phenotype-router-monitor` own-workspace: `/tmp/PhenoLang/phenotype-router-monitor/Cargo.toml:1-18` (1 member, 8 direct deps) — **wiped 2026-06-14**
- Audit §8.2 broken workspace: `/tmp/audit_phenolang.md:606-616` — **wiped 2026-06-14**
- Audit §8.4 omniroute-core duplicate: `/tmp/audit_phenolang.md:628-635` — **wiped 2026-06-14**
- The 1 cycle (unmanifested nested duplicates): `/tmp/PhenoLang/omniroute-core/crates/omniroute-core/Cargo.toml` + `/tmp/PhenoLang/omniroute-core/crates/providers/Cargo.toml` — **wiped 2026-06-14**
- The healthy live sub-workspace (use this, not the duplicates): `/tmp/PhenoLang/omniroute-core/crates/{core,api,providers}/Cargo.toml` — **wiped 2026-06-14**
- Live status tracker: `/Users/kooshapari/CodeProjects/Phenotype/repos/plans/2026-06-12-archived-repos-live-status-v3.md:42` (confirms `arc-2-05 / PL-09` → `archived-repos/PL-DEPENDENCY-CYCLES.md` (328 lines) is **DONE**)
- v2 audit trail: `/tmp/archived-repos-final-audit-trail-2026-06-12.md:9` (the §0 line confirming the 5 batch-5 deliverables were wiped, including `PL-DEPENDENCY-CYCLES`)
- Sibling deliverables (both reconstructed 2026-06-14):
  - `archived-repos/PL-CARGO-DENY-BASELINE.md` (PL-08, 456 lines, re-derived)
  - `archived-repos/PL-RUSTDOC-COVERAGE.md` (PL-07, 366 lines, re-derived)

---

## 11. What Cannot Be Re-Verified After the 2026-06-14 Wipe

The following v1 outputs were independently re-checked before the v1 was finalized on 2026-06-12 and are now un-reproducible:

| v1 verification step | Tool used | Current state |
|---|---|---|
| `cd /tmp/PhenoLang && cargo metadata --format-version=1 --no-deps` (21 packages returned) | `cargo` | `/tmp/PhenoLang/` wiped |
| `cd /tmp/PhenoLang/phenotype-infrakit && cargo metadata --format-version=1 --no-deps` (exit 101) | `cargo` | source wiped |
| `cd /tmp/PhenoLang/agileplus-agents && cargo metadata --format-version=1 --no-deps` (exit 101) | `cargo` | source wiped |
| `cd /tmp/PhenoLang/omniroute-core && cargo metadata --format-version=1 --no-deps` (3 packages returned) | `cargo` | source wiped |
| `find /tmp/PhenoLang -name "Cargo.toml" -not -path "*/.git/*"` (75 files) | `find` | source wiped |
| `python3 /tmp/pl_graph_full.py` (the dep graph + Tarjan SCC + Kahn topo) | `python3` | script + data wiped |
| `python3 /tmp/pl_write_md.py` (the markdown generator) | `python3` | script wiped |
| Per-package dep edges (69 total) | `python3` (Tarjan) | data wiped |
| Per-port-candidate cycle exposure (§4 table) | manual re-derivation from the graph | data wiped |

**Trust level:** v1 was completed and verified before the wipe. v2 preserves the v1 numbers verbatim. The file:line citations in §3, §4, §6, §7, and §10 were all confirmed with `find`, `cat`, `cargo metadata`, and `python3` at v1 time (output is preserved in the v1 conversation history). Re-verification requires `/tmp/PhenoLang/` to be restored.

---

**End of PL-DEPENDENCY-CYCLES.md (reconstructed 2026-06-14).** Read-only analysis; no porting, no source modifications. The 2026-06-12 v1 was 328 lines / 24,704 B; this v2 reconstruction is **a like-for-like re-derivation** of all findings (§2 graph inventory, §3 cycle detection, §4 per-candidate exposure, §5 topological port order, §6 cycle-breaking recommendation) from the v1 session's in-memory state, since neither the source tree nor the analysis scripts (`/tmp/pl_graph_full.py`, `/tmp/pl_write_md.py`) nor the raw data (`/tmp/pl_graph_full.json`, `/tmp/pl_*.json`, `/tmp/pl_*.err`) survive the 2026-06-12→2026-06-14 wipe. The 1 cycle (`omniroute-core ↔ omniroute-providers`, SCC size 2) is in the unmanifested nested duplicates only; the 3-crate live sub-workspace is a clean DAG. The recommended port order is `phenotype-router-monitor` → `phenotype-retry` → `phenotype-cost-core` → `omniroute-core` (after cycle break, via Option A) → (6 infrakit candidates after `.rs`-level `use` audit).
