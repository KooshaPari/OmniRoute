# RFC 002 — Settly → `config` role (`phenotype-config` workspace)

| Field | Value |
|-------|-------|
| **Status** | Proposed |
| **Role** | `config` |
| **Canonical owner** | **phenotype-config** (new workspace — repo or multi-root workspace proposal) |
| **Rust core** | `settly` crate |
| **TS edge** | **Conft** |
| **Python edge** | **phenotype-config** (Py 3.14 / uv package) |
| **Supersedes** | HexaKit `crates/settly` as permanent home |
| **Authority** | [DOMAIN_ROLES.md](../../DOMAIN_ROLES.md), [LANGUAGE_PLACEMENT.md](../../LANGUAGE_PLACEMENT.md) |

## Summary

Migrate **Settly** (layered config, validation, env) from HexaKit transitional `crates/settly` into a dedicated **`config` role workspace** named **phenotype-config**. The workspace owns the Rust core; **Conft** and **phenotype-config** (Python) remain justified product edges per language placement policy.

**Pyron** is the primary chokepoint consumer and must repoint in lockstep with the Rust core move.

This RFC rejects:

- Keeping Settly in HexaKit after genesis-only charter enforcement.
- Merging Conft into Settly (different tiers: Rust core vs TS npm surface).
- A `phenotype-rust-sdk` catch-all.

## Problem

Settly was absorbed into HexaKit (`crates/settly`) during the consolidation wave. HexaKit is now **genesis-only**; config domain code belongs under the `config` role ([DOMAIN_ROLES.md](../../DOMAIN_ROLES.md)).

| Artifact | Current location | Target |
|----------|------------------|--------|
| `settly` Rust crate | HexaKit `crates/settly` | phenotype-config workspace |
| Conft | Standalone TS repo | TS edge of phenotype-config role |
| Python config SDK | Scattered / HexaKit `phenotype-config-core` | `phenotype-config` Py package |
| Pyron | HexaKit `settly` (+ stashly/pheno) | phenotype-config / workspace `settly` |

[RATIONALIZATION_EXECUTION.md](../../RATIONALIZATION_EXECUTION.md) marks Settly as **blocked** until Pyron repoints.

## Decision

### Workspace proposal

Create **phenotype-config** as the `config` role owner. Two acceptable shapes (pick one in Phase 0):

| Option | Shape | When to choose |
|--------|-------|----------------|
| **A — New repo** | `KooshaPari/phenotype-config` git repo with Rust workspace + `packages/` for Py | Clean boundary, independent CI |
| **B — Virtual workspace** | Rust root in new repo; Conft + Py packages linked via manifest docs and shared versioning | Minimize repo count; accept multi-repo edges |

Edges stay in their publish targets:

| Component | Repo | Lang | Tier |
|-----------|------|------|------|
| `settly` | phenotype-config | Rust | 1 |
| Conft | Conft (linked role edge) | TS / Bun | 2 |
| `phenotype-config` | phenotype-config `packages/python/` or phenotype-python-sdk extra | Python 3.14 / uv | 2 |

Conft is **not** subtree-merged into Settly — it is the npm/Bun publish surface for TS consumers ([LANGUAGE_PLACEMENT.md](../../LANGUAGE_PLACEMENT.md)).

## Language placement

| Component | Lang | Tier | Rationale |
|-----------|------|------|-----------|
| settly core | Rust | **1** | Layered config, validation, env — correctness-critical |
| Conft | TS / Bun | **2** | npm publish surface, CLI adjacency |
| phenotype-config (Py) | Python 3.14 / uv | **2** | SDK scripting, Pyron integration |
| HexaKit config templates | genesis templates | — | Scaffold only, no runtime config domain |

## Target layout (Option A — recommended)

```
phenotype-config/
├── Cargo.toml                 # workspace
├── crates/
│   └── settly/                # from HexaKit/crates/settly
├── packages/
│   └── python/
│       └── phenotype-config/  # Py edge (uv)
├── docs/
│   └── sota/technical.md      # language placement (required)
├── charter.md                 # config role
└── README.md                  # points to Conft for TS edge
```

Conft remains:

```
Conft/
├── package.json
└── …                          # TS config workspace; documents link to settly schemas/API
```

## Migration phases

### Phase 0 — Workspace bootstrap

- [ ] Create `phenotype-config` repo (or approve Option B virtual workspace).
- [ ] Apply HexaKit genesis template (`templates/genesis/`) — charter, review, SOTA, OKF.
- [ ] Document Conft + Py edges in workspace README and DOMAIN_ROLES cross-links.

### Phase 1 — Rust core move

- [ ] Subtree-merge or path-copy HexaKit `crates/settly` → `phenotype-config/crates/settly` (history-preserving).
- [ ] Merge or supersede HexaKit `phenotype-config-core` into settly where duplicated ([ECOSYSTEM_MAP.md](../../ECOSYSTEM_MAP.md)).
- [ ] `cargo check --workspace` green; publish/set path/git dep strategy documented.

### Phase 2 — Pyron repoint (chokepoint)

- [ ] Update Pyron manifests to depend on phenotype-config `settly` (git/path/crates.io per fleet policy).
- [ ] Repoint any other org consumers found via manifest search (`settly` crate name).
- [ ] Pyron CI green against new dep paths **before** HexaKit excision.

### Phase 3 — Python & TS edges

- [ ] Stand up `phenotype-config` Python package (uv) with API parity plan vs settly (FFI or pure-Py layered config — document in SOTA).
- [ ] Conft: add role link + schema/version alignment docs; no Rust merge.
- [ ] Optional: `[config]` extra on phenotype-python-sdk pointing at Py package.

### Phase 4 — HexaKit excision

- [ ] Remove `crates/settly` from HexaKit workspace.
- [ ] Remove `phenotype-config-core` if fully absorbed.
- [ ] Update HexaKit charter transitional note; CI green.
- [ ] Archive `KooshaPari/Settly` source repo when zero external deps confirmed.

### Phase 5 — Registry & governance

- [ ] Update [DOMAIN_ROLES.md](../../DOMAIN_ROLES.md) chokepoint: Pyron → phenotype-config.
- [ ] Add `phenotype-config` to ECOSYSTEM_MAP / projects JSON.
- [ ] Mark RATIONALIZATION_PLAN Conft “keep standalone” row as “config role TS edge.”

## Pyron repoint checklist

Pyron depends on Settly (and related HexaKit crates) today. Minimum lockstep changes:

1. `Cargo.toml` / lockfile: `settly` path/git → `phenotype-config`.
2. Integration tests referencing HexaKit config paths.
3. Document migration note in Pyron README until stashly/pheno repoints complete (out of scope for this RFC but track in registry).

Do **not** archive HexaKit settly until Pyron is green on the new path.

## Non-goals

- Absorbing Conft into Rust workspace source tree.
- Creating `phenotype-rust-sdk`.
- Migrating Stashly or pheno workspace crates (separate role/RFC tracks).
- Breaking Pyron in Phase 1 without a repoint PR ready.

## Success criteria

1. `settly` canonical source lives in phenotype-config workspace.
2. HexaKit has zero config **domain** runtime crates.
3. Pyron builds and tests against phenotype-config `settly`.
4. Conft and phenotype-config Py documented as Tier 2 edges with SOTA rationale.
5. DOMAIN_ROLES chokepoint table updated.

## Open questions

| # | Question | Default if unresolved |
|---|----------|------------------------|
| 1 | New repo vs virtual workspace | **Option A** — new `phenotype-config` repo |
| 2 | Py package in same repo vs python-sdk extra | Same repo `packages/python/` |
| 3 | crates.io publish vs git-only deps | Match fleet dep-guard policy (document in SOTA) |

## References

- [DOMAIN_ROLES.md](../../DOMAIN_ROLES.md) — `config` role, Settly routing
- [LANGUAGE_PLACEMENT.md](../../LANGUAGE_PLACEMENT.md) — settly Tier 1, Conft Tier 2
- [RATIONALIZATION_EXECUTION.md](../../RATIONALIZATION_EXECUTION.md) — Pyron / Settly blocker
- [ECOSYSTEM_MAP.md](../../ECOSYSTEM_MAP.md) — Conft, phenotype-config-core notes
- HexaKit `crates/settly` — transitional source
