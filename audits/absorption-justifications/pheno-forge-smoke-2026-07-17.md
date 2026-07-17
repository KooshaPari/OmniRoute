# pheno-forge-smoke Absorption-Justification Audit (2026-07-17)

**Audit ID:** ABS-JUS-pheno-forge-smoke-2026-07-17
**Auditor:** Forge (autonomous governance audit)
**Date:** 2026-07-17
**Phase:** Queue Refresh — `2026-07-17-queue-refresh-batch4`
**Source Repo:** `KooshaPari/pheno-forge-smoke` (cloned locally at `repos/pheno-forge-smoke`)
**Verdict:** **ABSORB** with target `pheno (crates/pheno-forge-smoke)`
**Confidence:** HIGH (0.85) — content audited, single-purpose crate, sibling pair fits cleanly

---

## Source

`pheno-forge-smoke` is the **single-purpose smoke binary** owned by `kooshapari`.
- Last push: `2026-07-16T10:38:36Z`
- Default branch: `wip/2026-07-16-0029-auto`
- Languages: ['rust']
- Has README: True
- Branches: 1 (single-branch repo)
- Size: 144 KB (small, single-binary crate)
- Lines of code: ~700 (src/lib.rs: 283 + src/main.rs: 412)

### Why this is in scope for absorption review

This repo is in scope because it is one of the **`2026-07-17-queue-refresh-batch4`**
candidates — a fresh wave of 10 least-active non-archived repos on the kooshapari
remote. It's a sibling-binary to `pheno-cdylib-bridge` (which was absorbed earlier
today at commit `26ec806` on the `pheno` monorepo).

### What the source contains

| File | Purpose | Notes |
|---|---|---|
| `src/lib.rs` (283 lines) | Pure-Rust facade: `Provider` enum, `Scope` enum, `MemoryValue` enum, `MemoryHandle`, `Bridge` struct, `default_bridge_path()` | dlopen via `libloading::Library`; resolves 8 `pheno_*` C-ABI symbols at load |
| `src/main.rs` (412 lines) | Tokio CLI: parses `--mode={mock,sidecar}` + `--bridge-path` + 3 sidecar endpoint overrides; runs 7 checks; emits JSONL or human-readable report | Uses `tracing-subscriber::EnvFilter` (needs `env-filter` feature) |
| `Cargo.toml` | Standard Rust crate; deps: tokio 1.49, serde 1, serde_json 1, anyhow 1, chrono 0.4, clap 4.5, tracing 0.1, tracing-subscriber 0.3 (env-filter), colored 2.1, reqwest 0.12 (rustls-tls), libloading 0.8 | `[profile.release]` opt-level=3, lto=thin |
| `scripts/run-smoke.sh` | Helper script: builds the bridge, sets `DYLD_LIBRARY_PATH` / `LD_LIBRARY_PATH`, runs the binary | **NOT absorbed.** The pheno monorepo root `.gitignore` line 146 has a blanket `scripts/` exclusion; absorbed crates do not carry `scripts/` directories. The script remains in the GitHub archive of the source repo. |
| `sidecars/` | Separate Cargo workspace for stub sidecar servers (`pheno-sidecar-stub`, axum-based) | **Absorbed as a non-workspace sub-crate** at `crates/pheno-forge-smoke/sidecars/`. Source files (`Cargo.toml`, `src/main.rs`) preserved; not a `pheno` workspace member (the smoke binary spawns it as an external process, so workspace integration isn't needed). |

## Target

The target for absorption is **`pheno (monorepo crates/pheno-forge-smoke)`**.

End-to-end smoke binary for the 4-PR forgecode improvement stack per ADR-096.
Loads `libpheno_bridge` via `libloading` and exercises composite routing across
the 4 memory scopes (episodic / identity / project_knowledge / fallback). Sits at
the bridge entry-point and verifies every layer below the user-facing forge CLI
works. Single-purpose CLI, not a library.

The `pheno` monorepo is the canonical Rust substrate per `RATIONALIZATION_PLAN.md`
and `RATIONALIZATION_EXECUTION.md`. The sibling crate `crates/pheno-cdylib-bridge`
(also absorbed today) is the immediate upstream — the smoke binary dlopens the
bridge's `.dylib` at runtime.

## Dependency alignment

Of 11 runtime deps in the source `Cargo.toml`:

| Dep | Source version | Pheno workspace | Notes |
|---|---|---|---|
| `tokio` | 1.49 | `tokio = "1"` ✓ | Inherit |
| `serde` | 1.0 | `serde = "1"` ✓ | Inherit |
| `serde_json` | 1.0 | `serde_json = "1"` ✓ | Inherit |
| `anyhow` | 1.0 | `anyhow = "1"` ✓ | Inherit |
| `chrono` | 0.4 + serde | `chrono = "0.4", features = ["serde"]` ✓ | Inherit (workspace already has serde feature) |
| `clap` | 4.5 + derive | `clap = "4", features = ["derive"]` ✓ | Inherit |
| `tracing` | 0.1 | `tracing = "0.1"` ✓ | Inherit |
| `tracing-subscriber` | 0.3 + env-filter | `tracing-subscriber = "0.3"` (no features) | Inherit + add `env-filter` feature locally |
| `reqwest` | 0.12 + json + rustls-tls | `reqwest = "0.12", features = ["json", "rustls-tls"], default-features = false` ✓ | Inherit |
| `libloading` | 0.8 | — | Pin locally (`"0.8"`) |
| `colored` | 2.1 | — | Pin locally (`"2.1"`) |

`libloading` and `colored` are NOT in the pheno `workspace.dependencies`. They are
pinned locally in the new crate's `Cargo.toml` for now. A follow-up PR may promote
them to workspace deps if another crate needs them.

## ADR-096 alignment

Per ADR-096 (accepted 2026-06-23), the 4-PR forgecode improvement stack is:

1. **PR 1: pheno-cdylib-bridge** (Rust C-ABI shared lib exposing the memory facade) — absorbed 2026-07-17 at commit `26ec806`
2. **PR 2: thegent-memory v2** (polyglot MemoryPort facade with CompositeAdapter) — already lives in thegent monorepo
3. **PR 3: pheno-forge-plugins** (sidecar servers for Supermemory/Letta/Cognee/Mem0/Config/Tracing) — absorbed 2026-07-17 into `phenotype-tooling`
4. **PR 4: forge_pheno_memory** (upstream forgecode Rust workspace crate) — pending upstream PR `tailcallhq/forgecode#3559`

**This smoke binary sits at the bridge entry-point of the entire stack** — it is the
single check-point that verifies every layer below the user-facing CLI works. It is
the **first PR in the post-merge follow-up wave** (ADR-097 + ADR-098).

## Status

**Status:** `ABSORB` — absorption executed; `fsm` will be updated to `absorbed` in
disposition-index after this audit lands.

This is a **POST-ABSORPTION** audit (the transfer already happened). The crate is
now at `KooshaPari/pheno` → `crates/pheno-forge-smoke/`. Build + test pass; binary
runs; bridge-missing path is graceful.

## Confidence

**Confidence:** 0.85 (HIGH).

**Confidence drivers:**
- **+0.30** — Repo is real, non-archived, on kooshapari remote.
- **+0.20** — Target absorber (`pheno (monorepo crates/pheno-forge-smoke)`) is a canonical spine per RATIONALIZATION_PLAN.md.
- **+0.15** — Disposition matches standing rationale in plan docs (ADR-096 explicit).
- **+0.10** — Content audit complete: 700 LOC, 11 deps (9 mapped to workspace), no path-deps, no external consumers to repoint.
- **+0.10** — Sibling crate `pheno-cdylib-bridge` already absorbed; this binary is its runtime smoke test.
- **-0.05** — `libloading` + `colored` not in workspace deps yet (pinned locally); minor cosmetic gap.

**Final:** 0.85 = HIGH. Absorption is verified and ready to commit.

---

## Restore-Command

```bash
# Pre-absorption snapshot (already captured by GitHub archive command)
gh repo archive KooshaPari/pheno-forge-smoke
git clone https://github.com/KooshaPari/pheno-forge-smoke.git /tmp/pheno-forge-smoke-pre-absorption
```

**Restore posture:** Source repo will be archived after this absorption PR is pushed.
Local clone at `/Users/kooshapari/CodeProjects/Phenotype/repos/pheno-forge-smoke` will
be retained for forensic reconciliation per the container policy.

---

## Cross-References

- `RATIONALIZATION_PLAN.md` — canonical absorbers per domain role.
- `RATIONALIZATION_EXECUTION.md` — per-absorber merge order + archive shortlist.
- `DOMAIN_ROLES.md` — terminal owners per language/domain.
- `BOUNDARY_OWNERS.md` — boundary ownership map.
- `registry/disposition-index.json` — registry spine; row `repo-pheno-forge-smoke-batch4`.
- **ADR-096** — forgecode improvement (the locked stack this smoke tests).
- **ADR-097** — eval harness design (consumes this smoke as its entry point).
- **ADR-098** — additional adapters (next wave; uses this smoke as regression baseline).
- `docs/absorption/pheno-forge-smoke/README.md` — absorption record (this PR's diff).
- `docs/boundary/pheno-forge-smoke.md` — boundary doc.

**End of audit.**