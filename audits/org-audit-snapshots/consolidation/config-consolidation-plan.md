# Config Consolidation Plan

**Date:** 2026-06-29
**Author:** Config consolidation audit (forge agent)
**Scope:** Configra, Conft, pheno-runtime-config
**Status:** DRAFT — no repos modified; read-only analysis.

---

## Executive Summary

Of the 3 repos analyzed, **1 pair involves real duplication** (Configra/settly's `HotReloader<T>` overlaps with `pheno-runtime-config`'s `FileConfig<T>` + `ArcReloadable<T>`). The third repo, **Conft**, was already absorbed into Configra per prior ADR-031 and sits in a maintenance-only holding pattern as the TypeScript edge layer.

**Canonical SSOT recommendation:** `KooshaPari/Configra` — the Rust workspace that already absorbed 8 source repos (Conft, Settly, pheno-config, phenotype-config, phenotype-config-loader, phenotype-shared-config, phenotype-config-core, pheno-config-local). It has the broadest scope, the strongest governance (ADRs 022/023/031/040), and subsumes both Conft's TS layer and pheno-runtime-config's hot-reload concern.

### Key finding

**pheno-runtime-config** (v0.1.0, 2026-06-28) was bootstrapped as an independent crate but **Configra/settly already ships an equivalent `HotReloader<T>`** with overlapping features (notify v6 watcher, tokio broadcast, debounced reload). The two differences — generic `Reloadable<T>` trait and SIGHUP fallback — should be absorbed into Configra, not maintained as a separate repo.

---

## 1. Repo Inventory

| # | Repo | Language | Version | Crates/Packages | Description | Lines of code |
|---|------|----------|---------|-----------------|-------------|--------------|
| 1 | **Configra** | Rust (workspace) | v0.4.0 | 5 crates (pheno-config, settly, config-schema, phenotype-config-loader, configra-ops) + TS edge | Rust config framework — typed static Config, hexagonal settings lifecycle, JSON schema validation, file loaders, ops primitives. Already absorbed 8 prior config repos. | ~1,600 LoC Rust + ~1,350 LoC TS |
| 2 | **Conft** | TypeScript | v0.1.0 | 1 package (`@phenotype/config-ts`) | TS config edge layer (Zod-validated). Absorbed into Configra per ADR-031; standalone repo is maintenance-only archive. | ~1,353 LoC TS |
| 3 | **pheno-runtime-config** | Rust | v0.1.0 | 1 crate | `Reloadable<T>` trait + `ArcReloadable<T>` impl + `FileConfig<T>` (notify-based watcher) + SIGHUP fallback. Hot-swappable runtime values (different lifecycle from static Configra config). | ~405 LoC |

### Source tree snapshots

```
Configra/
├── crates/
│   ├── pheno-config/                  # typed runtime Config + ConfigBuilder (776 LoC)
│   ├── settly/                        # hexagonal settings lifecycle (128KB src/)
│   │   ├── domain/config.rs           # Config/ConfigValue entities
│   │   ├── domain/layers.rs           # layered config management
│   │   ├── domain/sources.rs          # source cascade
│   │   ├── domain/ports.rs            # Source trait
│   │   ├── crypto.rs                  # EncryptedConfig + HotReloader<T> (451 LoC)
│   │   ├── application/builder.rs     # ConfigBuilder
│   │   ├── adapters/sources.rs        # File/env/CLI sources
│   │   └── adapters/formats.rs        # TOML/YAML/JSON parsers
│   ├── config-schema/                 # JSON schema validation (214 LoC)
│   ├── phenotype-config-loader/       # generic JSON/TOML loaders (100 LoC)
│   └── configra-ops/                  # ops primitives (20 LoC)
└── typescript/packages/conft/         # TS edge layer (absorbed from Conft)

Conft/
└── typescript/packages/conft/src/
    ├── domain/config.ts               # Config types, ImmutableConfig, validation (209 LoC)
    ├── domain/secret.ts               # Secret<T> wrapper (119 LoC)
    ├── ports/config-source.ts         # ConfigSource + ConfigValidator ports (61 LoC)
    ├── adapters/env-adapter.ts        # EnvConfigSource (82 LoC)
    ├── adapters/file-adapter.ts       # FileConfigSource (166 LoC)
    ├── services/config-manager.ts     # ConfigManager with layered precedence (162 LoC)
    └── index.ts                       # barrel exports (17 LoC)

pheno-runtime-config/
├── src/
│   ├── lib.rs                         # Reloadable<T> trait + ArcReloadable<T> (148 LoC)
│   ├── file.rs                        # FileConfig<T> — notify v6 watcher (77 LoC)
│   └── sighup.rs                      # SIGHUP fallback handler (50 LoC)
└── tests/
    ├── integration_basic.rs           # concurrency + watch tests (84 LoC)
    └── integration_file.rs            # file watcher tests (46 LoC)
```

---

## 2. Dedup Map: Static Config vs TS Edge vs Hot-Reload

### 2.1 Already-Absorbed (no action needed)

| Group | Repos | Status | Details |
|-------|-------|--------|---------|
| **Conft TS edge** | Configra + Conft | ✅ Already absorbed | Configra `typescript/packages/conft/` is a byte-identical copy from Conft. The standalone Conft repo is ARCHIVED per `ARCHIVED.md` and should NOT be modified; it exists only as a historical reference. ADR-022 established the Rust/TS split: Configra = Rust core, Conft = TS edge. |

### 2.2 Real Duplication (overlapping concern, different API)

| Duplicate Group | Repos | Details | Severity |
|-----------------|-------|---------|----------|
| **Hot-reload / file-watcher** | Configra/settly + pheno-runtime-config | Configra/settly `crypto.rs` ships `HotReloader<T>` with notify v6 + tokio broadcast + 250ms debounce. pheno-runtime-config ships `FileConfig<T>` with notify v6 + `Reloadable<T>` trait + `ArcReloadable<T>`. Both use notify v6 for file watching; both provide lock-free reads (ArcSwap vs parking_lot::RwLock). pheno-runtime-config adds: (a) generic `Reloadable<T>` trait, (b) SIGHUP fallback. | **MEDIUM** — same notify v6 file-watching concern, different trait shapes. pheno-runtime-config adds small unique surface (~130 LoC) not in Configra. |

### 2.3 Unique to Each Repo (complementary, not duplicated)

| Repo | Unique Surface | Must Preserve |
|------|---------------|---------------|
| Configra | `pheno-config` typed Config + `combine()` 12-factor cascade | ✅ Canonical |
| Configra | `config-schema` field-shape validation | ✅ Canonical |
| Configra | `phenotype-config-loader` generic loaders | ✅ Canonical |
| Configra | `settly` hexagonal settings lifecycle | ✅ Canonical |
| Configra | `configra-ops` ops primitives | ✅ Canonical |
| Configra | Encrypted `HotReloader<T>` (AES-256-GCM + Argon2id KDF) | ✅ Absorb from pheno-runtime-config |
| Conft | TS edge — `ConfigSource` port, Zod validation, `Secret<T>` | ✅ Already in Configra `typescript/packages/conft/` |
| pheno-runtime-config | `Reloadable<T>` trait (generic, non-encrypted) | 🔄 Absorb into Configra |
| pheno-runtime-config | SIGHUP fallback (`poll_reload()`) | 🔄 Absorb into Configra |
| pheno-runtime-config | `FileConfig<T>` (notify-based, non-encrypted) | 🔄 Absorb into Configra (or mark superseded by settly `HotReloader<T>`) |

---

## 3. Forward-Only Migration DAG

```
                          ┌──────────────────┐
                          │  Conft (TS edge)  │
                          │  v0.1.0           │
                          │  1,353 LoC TS     │
                          │  ARCHIVED (✅)    │
                          └────────┬─────────┘
                                   │
                                   │ ALREADY ABSORBED (ADR-031, 2026-06-18)
                                   │ → Configra typescript/packages/conft/
                                   ▼
┌──────────────────┐    ┌──────────────────┐
│  pheno-runtime-  │───▶│    Configra      │◀── CANONICAL SSOT
│  config (Rust)   │    │  v0.4.0 (Rust)   │
│  v0.1.0          │    │  5 crates        │
│  405 LoC         │    │  ~1,600 LoC Rust │
│  BOOTSTRAPPED    │    │  +1,353 LoC TS   │
└──────────────────┘    └──────────────────┘
        │
        │ MIGRATE → ADD TO CONFIGRA:
        │ 1. Reloadable<T> trait   → new crate? or cannibalize settly's HotReloader?
        │ 2. SIGHUP fallback       → settly::crypto
        │ 3. FileConfig<T> (non-encrypted) → settly::crypto or new simple mod
        │
        ▼
┌──────────────────┐
│   Empty shell    │
│  (delete after   │
│   absorption)    │
└──────────────────┘
```

### Migration Steps (ordered, no cycles)

| Step | Action | From | To | Risk | Depends On |
|------|--------|------|----|------|-----------|
| **1** | **ABSORB** `Reloadable<T>` trait into Configra | `pheno-runtime-config` | `Configra/crates/settly/src/` | Low — the trait is pure Rust, no deps, 50 LoC | Nothing |
| **2** | **ABSORB** SIGHUP fallback (`sighup.rs`) into Configra settly | `pheno-runtime-config` | `Configra/crates/settly/src/` | Low — 50 LoC, libc signal handler, no new deps (settly already has tokio) | Step 1 |
| **3** | **REFACTOR** settly's `HotReloader<T>` to implement `Reloadable<T>` | Configra (self) | Configra/settly | Medium — existing `HotReloader<T>` uses broadcast channel; `Reloadable<T>::watch()` returns `watch::Receiver`, not `broadcast::Receiver`. Need adapter or add trait method. | Steps 1-2 |
| **4** | **ABSORB** non-encrypted `FileConfig<T>` into Configra settly (or deprecate as `pheno-runtime-config::FileConfig` implements `Reloadable<T>`) | `pheno-runtime-config` | Configra | Low — 77 LoC, same `notify` v6 dep already present | Steps 1-3 |
| **5** | **ARCHIVE** `pheno-runtime-config` repo on GitHub | GitHub | `ABSORBED-FROM/` in Configra | None — empty shell, no consumers yet (v0.1.0, bootstrapped 2026-06-28) | Steps 1-4 |
| **6** | **LOCK** Conft standalone repo (already archived per `ARCHIVED.md`) | — | — | None — no action required | Nothing |

### Migration DAG (visual)

```
Step 1: Reloadable<T> trait ──────────────────────┐
Step 2: SIGHUP fallback ──────────────────────────┤
Step 3: HotReloader<T> refactor ──────────────────┤
Step 4: FileConfig<T> (non-encrypted) ────────────┤
                                                   ▼
                                          Configra is SSOT
                                                   │
                               Step 5: Archive pheno-runtime-config
```

---

## 4. Detailed Dedup Analysis

### 4.1 Inter-repo Dependency Check

**Does pheno-runtime-config depend on Configra?** NO. Zero imports, zero `Cargo.toml` references, no code-level coupling. The `llms.txt` only mentions Configra as a reference.

**Does Configra depend on pheno-runtime-config?** NO. Zero references.

**Does Conft depend on either?** NO. Standalone `package.json` with only `zod` as runtime dep.

**Conclusion:** The three repos are fully independent — no circular dependency risk.

### 4.2 Overlap: pheno-runtime-config vs Configra/settly HotReloader

| Feature | pheno-runtime-config | Configra/settly HotReloader | Analysis |
|---------|---------------------|----------------------------|----------|
| File watching engine | `notify` v6 recommended_watcher | `notify` v6 recommended_watcher | Same crate, same version family |
| Debounce | None (fires on every event) | 250ms window (tokio::time::timeout) | Configra is more production-ready |
| Lock-free reads | `arc_swap::ArcSwap<T>` | `parking_lot::RwLock<Arc<T>>` | pheno-runtime-config uses true lock-free; Configra uses RwLock (still fast) |
| Async fan-out | `tokio::sync::watch` — 1:N, last-value-only | `tokio::sync::broadcast` — 1:N, all values | Different channel types, same purpose |
| Generic trait | `Reloadable<T>` (reload, current, watch) | No trait — `HotReloader` directly exposes methods | pheno-runtime-config is more generic |
| Encryption | None | AES-256-GCM + Argon2id KDF | Configra is more feature-rich |
| Non-encrypted path | `FileConfig<T>` (open, not encrypted) | Not directly available (would need gating) | pheno-runtime-config is simpler for plain config |
| SIGHUP | `register_hup_handler()` + `poll_reload()` | None | Unique to pheno-runtime-config |
| Watcher storage | `std::mem::forget(watcher)` — leaks watcher | `_watcher` field on struct — RAII | Configra is safer |
| Error type | `ReloadError` (5 variants) | `ConfigCryptoError` (6 variants, includes reload) | Similar scope |
| Dependencies | notify, arc-swap, tokio, serde, toml, tracing | notify, tokio, serde, serde_yaml, toml, aes-gcm, argon2, uuid, chrono, sqlx, redis | Configra has heavier deps (feature-gated) |

### 4.3 Overlap: Configra pheno-config vs Configra phenotype-config-loader

| Feature | pheno-config | phenotype-config-loader | Analysis |
|---------|-------------|------------------------|----------|
| Scope | Typed `Config` struct for service wiring | Generic `load_json<T>` / `load_toml<T>` | Complementary — one is opinionated, one is generic |
| Env cascade | `load_from_env(prefix)` + `combine()` | None | pheno-config is higher-level |
| Builder | `ConfigBuilder` (typic) | None | pheno-config |
| File loading | `load_from_file(JSON)` + `load_from_toml_file` | `load_json<T>` + `load_toml<T>` | phenotype-config-loader is generic (any T: Deserialize) |
| Error type | `ConfigError` (3 variants, closed) | `ConfigLoadError` (3 variants) | Similar but separate enums |
| Secret handling | `SecretBox<str>` via `secrecy` crate | None | pheno-config |

These two are **intentionally complementary** per the Configra workspace design: `phenotype-config-loader` is the minimal primitive; `pheno-config` is the opinionated runtime wrapper.

---

## 5. Recommended Canonical + What Migrates

### Canonical: `KooshaPari/Configra`

**Why Configra:**
1. **Already the established SSOT** — 8 prior config repos absorbed, with preservation manifests (`ABSORBED-FROM/`) and per-source migration docs (`docs/migrations/`).
2. **Strongest governance** — ADR-022 (Rust/TS split), ADR-023 (agent-effort governance), ADR-031 (Configra absorb), ADR-040 (test-coverage gates per tier).
3. **Broadest scope** — typed config loading (pheno-config), settings lifecycle (settly), JSON schema validation (config-schema), generic file loaders (phenotype-config-loader), TS edge (Conft), ops (configra-ops).
4. **Already has hot-reload** — `settly::crypto::HotReloader<T>` with notify v6 + tokio broadcast + debounce + encryption.
5. **Tier-2 quality bar** — every crate has `README.md`, `CHANGELOG.md`, `AGENTS.md`, 80%+ coverage gate.

### What Absorbs from pheno-runtime-config

| Source | Target in Configra | LoC | Strategy |
|--------|-------------------|-----|----------|
| `Reloadable<T>` trait (lib.rs) | `settly/src/` new module `reloadable.rs` | ~50 | Copy + adjust to settly conventions. Make `HotReloader<T>` implement `Reloadable<T>`. |
| `SIGHUP fallback` (sighup.rs) | `settly/src/sighup.rs` | ~50 | Copy — no new deps needed (tokio + libc already in workspace). |
| `FileConfig<T>` (file.rs) | `settly/src/` — or deprecate in favor of `HotReloader<T>` | ~77 | Either (a) absorb as-is for non-encrypted use, or (b) mark as superseded and add a `HotReloader::open_unencrypted(path)` constructor. Option (b) is cleaner. |
| Tests (integration_basic.rs, integration_file.rs) | `settly/tests/` | ~130 | Absorb — they test `ArcReloadable<T>` concurrent behavior, which has no equivalent in settly today. |

### What Stays in Conft (no action needed)

| File | Status | Notes |
|------|--------|-------|
| All of `typescript/packages/conft/src/` | ✅ Already in Configra `typescript/packages/conft/` | GitHub archive per `ARCHIVED.md` history |
| Conft GitHub repo | 🔒 Lock — no new pushes | Already archived via ADR-031; `ARCHIVED.md` confirms migration |

---

## 6. Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| **Trait mismatch**: `Reloadable<T>::watch()` returns `watch::Receiver`; `HotReloader<T>` uses `broadcast::Sender` | Medium | Medium — API divergence on consumers | Make `watch()` return channel type configurable, or accept the asymmetry (broadcast has multi-consumer advantages for encryption). |
| **Watcher lifecycle**: pheno-runtime-config leaks watcher via `mem::forget`; Configra uses RAII | Low | Low | Standardize on RAII pattern (Configra's approach). Leak is a known anti-pattern. |
| **Consumers of pheno-runtime-config**: None yet (v0.1.0, created 2026-06-28) | None | None | Zero-migration path — no consumers exist. |
| **Consumers of Conft TS**: `package.json` `@phenotype/config-ts` | Low | Low — breaking change if repo goes 404 | Configra already hosts the absorbed copy. Conft GitHub repo can remain archived indefinitely. |
| **Consumer lock-in to non-encrypted FileConfig**: Future consumers may depend on `pheno-runtime-config` directly if migration is delayed | Low | Low | Mitigate by absorbing Configra-side before any consumers appear. |
| **Governance drift**: pheno-runtime-config develops independent features that diverge from settly | Low (time-sensitive) | Medium | Absorb immediately — crate bootstrapped 2026-06-28, only 1 day old. |

### Risk Summary

The primary technical risk is the incompatible channel type between `Reloadable<T>::watch()` (tokio `watch`) and `HotReloader<T>` (tokio `broadcast`). This is resolvable by:
1. Making `Reloadable<T>` an abstraction that supports either channel type, or
2. Standardizing on `broadcast` (which is strictly more powerful — 1:N fan-out with backlog vs `watch`'s last-value-only), and adapting `ArcReloadable<T>` to use `broadcast` internally.

All other risks are low or mitigated by the fact that pheno-runtime-config has zero consumers (v0.1.0, 1 day old).

---

## 7. Implementation Plan (if approved)

### Phase A: Add Reloadable<T> trait to Configra settly (1 PR)
- Copy `Reloadable<T>` trait + `ArcReloadable<T>` into `Configra/crates/settly/src/reloadable.rs`
- Re-export from `settly/src/lib.rs`
- Port tests from `pheno-runtime-config/tests/integration_basic.rs` to `settly/tests/`

### Phase B: Implement Reloadable<T> for HotReloader (1 PR)
- Add `impl<T> Reloadable<T> for HotReloader<T>` where T meets existing bounds
- Adapt `broadcast::Receiver` → either `watch::Receiver` or add a second `watch()` method
- Add `HotReloader::open_unencrypted(path)` constructor for non-encrypted config

### Phase C: Add SIGHUP support to settly (1 PR)
- Copy `sighup.rs` → `Configra/crates/settly/src/sighup.rs`
- Wire into settly's infrastructure module
- Ensure the `HotReloader` can be triggerable from SIGHUP

### Phase D: Archive pheno-runtime-config (1 PR)
- Mark GitHub repo as archived
- Add `ABSORBED-FROM/pheno-runtime-config/README.md` to Configra
- Delete local clone

### Phase E: Finalize Conft status (no code change, just governance)
- Verify Configra `typescript/packages/conft/` is current with Conft upstream
- Lock Conft GitHub repo if not already locked

**Total:** 4-5 small PRs, ~200 LoC added to Configra, 1 repo archived.

---

## 8. Cross-References

- **ADR-022** — Config consolidation (Rust/TS split)
- **ADR-031** — Configra absorb (8 source repos → Configra)
- **ADR-023** — Agent-effort governance
- **ADR-040** — Test-coverage gates per tier
- **CFG-SOTA-001** — Encryption-at-rest in settly
- **CFG-SOTA-002** — Hot-reload watcher in settly
- **Configra CHANGELOG v0.4.0** — Tier-2 substrate enforcement
- **Configra `docs/migrations/2026-06-18-from-conft.md`** — Conft relationship doc
- **Configra `ABSORBED-FROM/README.md`** — 8-source-repo absorption index
- **pheno-runtime-config `llms.txt`** — Self-described relationship: "Not a reimplementation of Configra"

---

*End of config consolidation plan. Read-only analysis; no repos were modified.*
