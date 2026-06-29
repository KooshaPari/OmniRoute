# Ecosystem Map Realignment — 2026-06-28

> **Authority:** `phenotype-registry` (INDEX / boundary SSOT)
> **Scope:** P1 of the Phenotype Ownership Program — audit the registry and
> realign the ecosystem map to current owned-repo reality.
> **Ground truth:** `gh repo list KooshaPari` (142 repos: 102 live, 40 archived)
> reconciled against the 88 OWNED repos in the Ownership Program.

## Summary

| Metric | Before | After |
|--------|-------:|------:|
| `catalog/registry.yaml` substrate entries | 5 | **88** |
| Owned repos covered by the catalog | 5 / 88 (6%) | **88 / 88 (100%)** |
| Excluded/other-owner repos in the map | several (see below) | **0** |
| Catalog entries with stale `archived` status (repo actually live) | 2 | **0** |
| Dangling repo refs (entries) | 0 | 0 |
| `validate-catalog.py` result | pass (5) | **pass (88)** |
| Strict JSON-schema (`jsonschema` Draft7) | pass (5) | **pass (88)** |

The machine-readable catalog (`catalog/registry.yaml`) was the canonical SSOT
but covered only **5 of 88 owned repos**. It is now complete and correct. The
narrative `ECOSYSTEM_MAP.md` is separately stale (111-repo taxonomy, includes
excluded/deleted repos) — its corrections are captured here as the backlog for
the next narrative-map regeneration; the machine catalog is now the trustworthy
source.

## Reality reconciliation (the 88 owned repos)

- **All 88 owned repos exist on GitHub and are LIVE** (none archived, no typos /
  renames). Verified by set-diff of the owned list against
  `gh repo list KooshaPari`.
- Languages, fork-status, and last-push dates were pulled from `gh` and encoded
  per entry (`language`, plus `archetype: fork-tool` where `isFork`).

## Corrections applied to `catalog/registry.yaml`

### A. Added (83 missing owned repos)
Only `Configra`, `pheno-tracing`, `pheno-mcp-router`, `phenotype-sdk`,
`phenotype-infra` were present before. **83 owned repos were missing** and are
now added with `tier`, `architecture`, `archetype`, `language`, and `role`.

### B. Removed / not-carried-forward
| Old entry | Reason |
|-----------|--------|
| `pheno-mcp-router` (KooshaPari/pheno-mcp-router) | Repo **archived** on GitHub AND not in the owned-88; not a current owned substrate. Its substrate classification lives in absorption history, not the active owned catalog. |
| `phenotype-sdk` (KooshaPari/phenotype-sdk) | **No such live repo** in `gh repo list`. The real owned SDKs are `phenotype-go-sdk` and `phenotype-python-sdk` (both present and active). Replaced by those two concrete entries. |

### C. Status corrections
| Repo | Old status | Corrected | Evidence |
|------|-----------|-----------|----------|
| `pheno-tracing` | `archived` | **`active`** | `gh` shows live, pushed 2026-06-28; still consumed by `pheno` via git dep. |

### D. Archetype / tier (re-)classification
Every owned repo received an explicit `archetype` (new field, schema-backed) and
a verified `tier`. Notable role/tier corrections vs. the stale narrative map:

| Repo | Stale map said | Corrected | Why |
|------|----------------|-----------|-----|
| `OmniRoute` | "fork" (lumped with excludes) | `federated-service` / `fork-tool` / role `route` | Flagship SOTA router, canonical routing framework (ADR-001). |
| `forgecode` | "fork" | `federated-service` / `fork-tool` / role `agentic-cli` | Flagship SOTA agentic coding CLI. |
| `substrate` | not in catalog | `federated-service` / `monorepo` / role `connect` | 44-crate Rust workspace; internal crates (omniroute-adapter, phenotype-mcp, engine-*) are NOT separate repos. |
| `pheno` | not in catalog | `phenotype-framework` / `monorepo` | ~40 internal `phenotype-*` crates. |
| `HexaKit` | SDK | `phenotype-framework` / `sdk` / role `genesis` | Genesis owner + dependency HUB (see edges below). |
| `phenotype-infra` | infra | kept `federated-service`, federation members documented | nanovms + PhenoCompose are now its workspace members (ADR-049). |

## Dependency-graph corrections (verified from manifests)

Real cross-repo edges were spot-checked from `Cargo.toml` / `go.mod` /
`pyproject.toml` / `package.json` via the GitHub API. Key truths the stale graph
got wrong:

- **HexaKit is the hub.** Verified LIVE git edges: → Eventra, PhenoObservability,
  Authvault, TestingKit, ResilienceKit, substrate, Agentora, plus
  phenotype-config / phenotype-types / phenotype-rust-sdk.
- **Monorepos ≠ edge clusters.** `substrate`, `pheno`, `Authvault`, `Configra`,
  `Eventra`, `phenotype-python-sdk` are workspaces; their internal members
  (e.g. `phenotype-cipher`, `phenotype-event-bus`, `phenotype-config-loader`,
  `omniroute-adapter`, the absorbed `*Kit` Python packages) are **internal**, not
  separate-repo dependency edges.
- **Vendored ≠ edge.** `PhenoObservability` (`vendor/*`), `nanovms`,
  `argis-extensions` use local `path`/`replace` vendoring — not live repo edges.
- **`thegent` → `phenotype-python-sdk`** (`phenotype-py-utils @ git+…`) is a real
  Python edge.
- **`pheno` → `pheno-tracing`** (git dep) is real and live.
- **Edges to non-owned / inaccessible nodes flagged:** `substrate-adapters-bundle`
  has a git dep on `phenotype-router` (archived repo, not owned-88); HexaKit
  git-depends on `phenotype-types` which Eventra's own comment marks 404 —
  a **potentially broken edge** to surface in P2.

## Excluded repos confirmed OUT of the catalog

Per the Ownership Program these are intentionally NOT catalog entries (the stale
`ECOSYSTEM_MAP.md` still references several and must be cleaned in its next
regen): **AgilePlus** (10 mentions in old map), **Tracera**, **Civis**, **Dino**
(8 mentions), **WorldSphereMod**, **Compound-Spheres-3D(+Backup)**, **QuadSGM**,
**Parpoura**, **KaskMan**, **GDK**, **AtomsBot**, **KWatch**, **eyetracker**
(2 mentions), **agent-user-status**. `Melosviz` is **kept** (depended-on).

## Consolidation / duplication signals (for P2/P3 prioritization)

1. **Two SDK index repos, different languages** — `phenotype-go-sdk` (Go, 10 pkgs)
   and `phenotype-python-sdk` (Python, absorbed 6 `*Kit`s). Confirm there is no
   third "rust-sdk" repo; HexaKit references `phenotype-rust-sdk` as a git dep —
   **resolve whether that is owned, archived, or an alias.**
2. **Config triplication** — `Configra` (Rust, canonical), `Conft` (TS edge),
   `pheno-runtime-config` (Rust). DOMAIN_ROLES names `phenotype-config` as the
   role owner; verify these are tiers of one boundary, not drift.
3. **Events split** — `Eventra` (workspace: event-contracts/-bus/-sourcing) vs.
   `phenoEvents` (plain lib). Overlapping `events` role — candidate to merge or
   clearly separate.
4. **Plus-fork family** — `agentapi-plusplus`, `cliproxyapi-plusplus`,
   `context-mode-plusplus`, `OmniRoute`, `bifrost`, `forgecode`, `helios-cli`,
   `HeliosLab`, `phenotype-ops`, `portage` (+ index repo `PlusForges`). Large
   fork surface; assess which converge onto `substrate` adapters.
5. **Observability spread** — `PhenoObservability` (role owner), `Logify`,
   `pheno-tracing`, `Tracely`, `Tokn`. Confirm single `observe` SSOT.
6. **CLI-UX libs** — `clap-ext` + `rich-cli-kit` overlap on terminal-UX; possible
   merge.
7. **Two contract repos** — `PhenoContracts` (Rust formal verification) vs.
   `phenotype-contracts` (language-agnostic schemas/policy). Different concerns;
   keep separate but cross-link.
8. **`BLOCK A app` placeholders** — `Apisync`, `Httpora`, `DataKit`, `phenoData`,
   `Stashly` share an identical stub description; their true archetype/role needs
   per-repo confirmation in P2.

## Validation

```
$ python3 scripts/validate-catalog.py     # CI gate (registry-validate.yml)
== validate-catalog: 0 fail ==            # 88 entries

$ python3 -c 'jsonschema Draft7 over all entries'
strict schema errors: 0 | entries: 88
```

Internal consistency: 88 entries, 0 duplicate ids, the entry set equals the
owned-88 set exactly (no dangling refs, no missing owned repos), all archetypes
in the schema enum.

### Schema note
`catalog/registry.schema.json` gained an `archetype` enum property. An
explicit `architecture` is now set on **every** entry (not just framework tier):
the draft-07 `if/then` that gates `hexagonal-l4` treats an *absent* `architecture`
as a vacuous match and would otherwise force `ports`/`adapters` on plain libs.
Setting `architecture: layered` makes the conditional correctly false.
