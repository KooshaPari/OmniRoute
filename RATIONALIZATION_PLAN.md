# Phenotype Ecosystem Rationalization Plan

> **SUPERSEDED (execution):** Monorepo absorption into HexaKit is **retired** per [ADR-ECO-006](docs/adrs/ADR-ECO-006.md). Authoritative: [boundary-shaping.md](docs/rationalization/boundary-shaping.md) + [HexaKit DISPOSITION](https://github.com/KooshaPari/HexaKit/blob/main/docs/boundary/DISPOSITION.md). Below is historical inventory.

> Derived from ECOSYSTEM_MAP.md (2026-05-30 audit: 111 repos → aggressive target: **38 canonical repos**)
> Bias: monorepos / synthetic-monorepo-collections over thin standalone repos.
> Protected (never touch): P2/472-P2, KVirtualStage, KlipDot, KodeVibeGo, kwality.

> **2026-06-17 update:** Organize by **domain role** ([DOMAIN_ROLES.md](DOMAIN_ROLES.md)), not language monorepos.
> Do **not** create `phenotype-rust-sdk` as a crate dump. HexaKit = **genesis** only.
> See [LANGUAGE_PLACEMENT.md](LANGUAGE_PLACEMENT.md).
>
> **2026-06-18 update (post-archive, L5-114):** **phenotype-gfx is the replacement for the 4 sister repos** (phenotype-voxel, phenotype-terrain, phenotype-water, phenotype-postfx) per ADR-004 + ADR-031. The 4 source repos are **ARCHIVED + DELETED** 2026-06-18 after [phenotype-gfx#10](https://github.com/KooshaPari/phenotype-gfx/pull/10) merged (sha 5380b2bd, 311 tests pass, 18,957 lines migrated). See the [Active Consolidation](#active-consolidation-2026-06-18-phenotype-gfx-absorbs-the-4-sister-repos) section below for the migration matrix and [§ GAME / 3D](#game--3d) for the post-consolidation target shape.
>
> **2026-06-17 gateway fork correction (wave 15):** Steps below that archive **OmniRoute**, **agentapi-plusplus**, **cliproxyapi-plusplus**, or **phenotype-omlx** are **STALE**. Authoritative: [ADR-ECO-007](docs/adrs/ADR-ECO-007-gateway-merge-superset.md), [wave15-execution](docs/operations/wave15-execution-2026-06-17.md), [ECOSYSTEM_MAP Cluster M](ECOSYSTEM_MAP.md). **OmniRoute** = canonical router (never archive). **agentapi++** / **cliproxy++** = platform superset merge (G15–G16). **bifrost** = vendor engine only.

---

## Active Consolidation (2026-06-18): phenotype-gfx absorbs the 4 sister repos

> **L5-104.7 / ADR-031 supersession pattern.** The "sister repo / mono umbrella" pattern is
> retired. phenotype-gfx is now the single canonical graphics/visual substrate (Rust core
> + Zig/Mojo hot-path ports + C#/other edges, per ADR-004 single-core-ffi-edges). The 4
> sister repos (phenotype-voxel, phenotype-terrain, phenotype-water, phenotype-postfx) are
> SUPERSEDED, not archived-after-extract. Absorbing PR: [phenotype-gfx#10](https://github.com/KooshaPari/phenotype-gfx/pull/10)
> (open as of 2026-06-18, awaiting merge). Once merged, source repos flip `fsm=awaiting-pr-merge`
> → `fsm=archived` and the `gh repo archive` flow runs (Stream D, out of scope here).

### Migration matrix (4 absorptions → 1 PR)

| Source repo | Target path in phenotype-gfx | PR | Lines migrated (approx) | Disposition pre → post |
|-------------|------------------------------|-----|-------------------------|--------------------------|
| `KooshaPari/phenotype-voxel` | `phenotype-gfx/crates/voxel` | [phenotype-gfx#10](https://github.com/KooshaPari/phenotype-gfx/pull/10) (merged) | voxel substrate (adaptive voxel) | AFFIRM → **SUPERSEDE → ARCHIVED** |
| `KooshaPari/phenotype-terrain` | `phenotype-gfx/crates/unity-terrain-shim` | [phenotype-gfx#10](https://github.com/KooshaPari/phenotype-gfx/pull/10) (merged) | Unity terrain bridge | AFFIRM → **SUPERSEDE → ARCHIVED** |
| `KooshaPari/phenotype-water` | `phenotype-gfx/crates/unity-water-shim` | [phenotype-gfx#10](https://github.com/KooshaPari/phenotype-gfx/pull/10) (merged) | Unity water bridge | AFFIRM → **SUPERSEDE → ARCHIVED** |
| `KooshaPari/phenotype-postfx` | `phenotype-gfx/crates/unity-postfx-shim` | [phenotype-gfx#10](https://github.com/KooshaPari/phenotype-gfx/pull/10) (merged) | Unity BRP post-FX | (new entry) → **SUPERSEDE → ARCHIVED** |

### Policy (ADR-004 + ADR-031)

- **gfx is a replacement, not a sibling.** A single core (Rust) with FFI edges (Zig for hot
  paths, Mojo for compute, C#/other for engine bindings). The "sister repos under a mono
  umbrella" pattern (`phenotype-voxel` + `phenotype-terrain` + `phenotype-water` +
  `phenotype-postfx` as peers under the gfx umbrella) is retired.
- **Source repos archived 2026-06-18.** All 4 sister repos (phenotype-voxel, phenotype-terrain, phenotype-water, phenotype-postfx) archived + deleted (delete_repo scope) 2026-06-18 after [phenotype-gfx#10](https://github.com/KooshaPari/phenotype-gfx/pull/10) merged (sha 5380b2bd). Registry rows now terminal `fsm=archived`. Stream D COMPLETE.
- **Wave I Tier 2 row 13 (phenotype-water + phenotype-terrain "archive-after-extract") is
  REWRITTEN below** to reflect the SUPERSEDE pattern.

### Reference ADRs

- `docs/adrs/ADR-004-single-core-ffi-edges.md` (gfx architecture)
- `docs/adr/2026-06-17/ADR-031-configra-absorb.md` (precedent: supersession pattern)
- `registry/disposition-index.json` — block-c-phenotype-water/terrain/voxel/postfx rows updated
  to disposition=SUPERSEDE, target=phenotype-gfx, pr=phenotype-gfx#10, fsm=archived (post L5-114)

---

## Target Shape: 38 Canonical Repos

### GOVERNANCE / DOCS (3 — was 5+)

| Repo | Absorbs |
|------|---------|
| **phenotype-registry** | Absorbs: phenotype-hub (scaffold docs), PhenoHandbook content surfaced via index |
| **PhenoSpecs** | Keep standalone (spec artifacts, not docs prose) |
| **phenodocs** | Absorbs: phenoDesign (design tokens live here), phenoShared npm layer (`@phenotype/shared-utils` → `@phenotype/docs` sub-package) |

> **Collapse:** PhenoHandbook → phenotype-registry index link; phenoDesign + phenoShared npm → phenodocs. Net: -3 repos.

---

### SHARED CRATES MONOREPO (1 — was 5+ competing homes)

| Repo | Absorbs |
|------|---------|
| **HexaKit** | Absorbs: pheno (all 21 workspace crates), Metron (metrics crate), Traceon (tracing crate), Stashly (cache crate), Settly (config crate), FocalPoint (policy/focus crates), phenoXddLib (xDD BDD utilities) |

> HexaKit becomes the single Rust crate monorepo. PhenoProc + phenoRouterMonitor local path-dep copies are removed (they depend on HexaKit via registry/git dep). Net: -7 repos absorbed into HexaKit.

---

### LANGUAGE SDKs (2 — was 9+)

| Repo | Absorbs |
|------|---------|
| **phenotype-python-sdk** | Absorbs: AuthKit, DataKit, McpKit, ObservabilityKit, ResilienceKit, TestingKit, PhenoKits (was the collection index — now the repo itself IS the index) |
| **phenotype-go-sdk** | Absorbs: PlatformKit, Go module from PhenoMCP (go/ subdir) |

> Net: -7 repos.

---

### TOOLING MONOREPO (1 — was 6+)

| Repo | Absorbs |
|------|---------|
| **phenotype-tooling** | Absorbs: heliosApp (TS dashboard subdir), heliosBench (Python benchmarks subdir), agent-devops-setups, BytePort (CLI moved to tooling/byteport), nanovms (VM isolation moved to tooling/nanovms) |

> Net: -5 repos.

---

### AGENT PLATFORM (3 — was 5+)

| Repo | Absorbs |
|------|---------|
| **Agentora** | Absorbs: PhenoAgent (empty stub — add as agentora/crates/pheno-agent), PhenoProc (infrakit stubs folded to HexaKit deps; runtime portion → Agentora) |
| **thegent** | Keep (Python agent runtime, separate language target) |
| **phenoAI** | Absorbs: phenoRouterMonitor Rust core → phenoAI/crates/router-monitor; Streamlit dashboard → phenoAI/monitoring; **OmniRoute stays canonical** (consumes routing — not absorbed) |

> Net: -2 repos (PhenoAgent absorbed, PhenoProc runtime folded).

---

### MCP / PROTOCOL (1)

| Repo | Absorbs |
|------|---------|
| **PhenoMCP** | Keep (Rust bin + Go module; Go side now depended on by phenotype-go-sdk). Drop phenotype-go-sdk Go module dep if PhenoMCP workspace covers it. |

---

### AUTH / SECURITY (2 — was 3)

| Repo | Absorbs |
|------|---------|
| **Authvault** | Keep (Rust OAuth2/JWT/RBAC canonical) |
| **phenotype-auth-ts** | Merge INTO phenodocs TS layer OR keep as standalone if consumers need standalone npm package. **Recommendation: keep standalone** (TS consumers need independent package.json / npm publish). |

> PolicyStack folded → phenotype-tooling (CLI binary).

---

### OBSERVABILITY (1 — was 5)

| Repo | Absorbs |
|------|---------|
| **PhenoObservability** | Absorbs: Metron, Traceon (already listed in HexaKit — PhenoObservability is the *application-level* workspace; Metron/Traceon crates go to HexaKit, PhenoObservability keeps higher-level exporters/dashboards) |

---

### DATA (2)

| Repo | Absorbs |
|------|---------|
| **phenoData** | Keep (SurrealDB + Postgres + query planner workspace) |
| **Conft** | Keep (TS config workspace; different domain than Settly which is absorbed into HexaKit) |

---

### TESTING / QA (2 — was 3)

| Repo | Absorbs |
|------|---------|
| **phenotype-journeys** | Keep (e2e journey harness; standalone binary) |
| **phenotype-dep-guard** | Keep (supply-chain audit; Python, different domain) |

> phenoXddLib absorbed into HexaKit (already listed above).

---

### GAME / 3D (3)

> **2026-06-18 update (post-archive, L5-114):** The 4-repo layout below is **retired** per ADR-004 + ADR-031. The 4 sister repos (phenotype-voxel, phenotype-terrain, phenotype-water, phenotype-postfx) have been absorbed into `phenotype-gfx` via [PR #10](https://github.com/KooshaPari/phenotype-gfx/pull/10) (merged 2026-06-18, sha 5380b2bd, 311 tests pass, 18,957 lines migrated). Source repos **archived + deleted** 2026-06-18. phenotype-gfx uses a Rust core + Zig/Mojo ports for hot paths, with C#/other edges — single core, multiple language edges. See the [Active Consolidation](#active-consolidation-2026-06-18-phenotype-gfx-absorbs-the-4-sister-repos) section below for the migration matrix.

| Repo | Status |
|------|--------|
| **phenotype-gfx** | **CANONICAL** — Rust core + Zig/Mojo ports + C#/other edges (ADR-004 single-core-ffi-edges). Unity terrain/water/postfx shims + bevy adapter feature live under `phenotype-gfx/crates/`. |
| **Dino** | Keep (DINOForge mod platform; consumes phenotype-gfx as a git dep) |
| **WorldSphereMod** | Keep (active 3D fork) |

> DINOForge-UnityDoorstop: merge into Dino repo as `Dino/doorstop/` subdir or git subtree. Net: -1 repo.
>
> **ARCHIVED 2026-06-18** (L5-114): phenotype-voxel (→ phenotype-gfx/voxel), phenotype-terrain (→ phenotype-gfx/crates/unity-terrain-shim), phenotype-water (→ phenotype-gfx/crates/unity-water-shim), phenotype-postfx (→ phenotype-gfx/crates/unity-postfx-shim). All 4 source repos deleted after phenotype-gfx#10 merged (sha 5380b2bd). Registry rows terminal `fsm=archived`.

---

### APPS / PRODUCTS (6)

| Repo | Notes |
|------|-------|
| **Tracera** | Keep (requirements traceability) |
| **AgilePlus** | Keep (spec-driven dev; dual tooling/product role) |
| **hwLedger** | Keep |
| **eyetracker** | Keep |
| **PlayCua** | Keep |
| **slickport** | Keep (pending triage) |

---

### LANDING MONOREPO (1 — was 8)

| Repo | Absorbs |
|------|---------|
| **phenotype-landing** | Absorbs: agileplus-landing, byteport-landing, hwledger-landing, phenokits-landing, projects-landing, thegent-landing; AppGen becomes scaffold template inside repo |

> Net: -7 repos (create new monorepo, merge 7 existing).

---

### ACTIVE FORKS (4)

| Repo | Notes |
|------|-------|
| **helios-cli** | Keep (active codex-monorepo fork) |
| **HeliosLab** | Keep (research lab, distinct purpose from helios-cli) |
| **forgecode** | Keep (AI pair-programmer fork, active local use) |
| **bifrost** | Keep (AI gateway fork, vendor-only gateway) |

> helioscope: retire (overlaps helios-cli exactly, same upstream). Net: -1 repo.

---

### ARCHIVE / HUSK (merges completed, husks left as redirects)

These are retired but NOT deleted (husks left with archive notice pointing to new home):

```
pheno              → HexaKit
Metron             → HexaKit (metrics crate)
Traceon            → HexaKit (tracing crate)
Stashly            → HexaKit (cache crate)
Settly             → HexaKit (config crate)
FocalPoint         → HexaKit (policy module)
phenoXddLib        → HexaKit (xDD utilities)
PhenoShared        → phenodocs (npm layer)
phenoDesign        → phenodocs (design tokens)
PhenoHandbook      → phenotype-registry (linked index)
phenotype-hub      → phenotype-registry (scaffold docs)
AuthKit            → phenotype-python-sdk
DataKit            → phenotype-python-sdk
McpKit             → phenotype-python-sdk
ObservabilityKit   → phenotype-python-sdk
ResilienceKit      → phenotype-python-sdk
TestingKit         → phenotype-python-sdk
PhenoKits          → phenotype-python-sdk
PlatformKit        → phenotype-go-sdk
worktree-manager   → PhenoVCS (absorbed 2026-06-16)
phenoVessel        → PhenoPlugins/pheno-plugin-vessel (deleted 2026-06-16)
phenoTypes         → phenotype-types (deleted 2026-06-16)
phenoPatch         → phenotype-tooling/phenotype-diff (deleted 2026-06-16)
Diffuse            → phenotype-tooling/phenotype-diff (deleted 2026-06-16)
Servion            → phenotype-tooling/phenotype-service-registry (deleted 2026-06-16)
Guardrail          → phenotype-tooling/phenotype-resilience (deleted 2026-06-16)
Cryptora           → phenoUtils/pheno-crypto (deleted 2026-06-16)
forge              → Tasken (deleted 2026-06-16)
phenoForge         → Tasken (deleted 2026-06-16)
router-docs        → OmniRoute/docs/research/archive/router-docs/ (deleted 2026-06-16)
heliosApp          → phenotype-tooling
heliosBench        → phenotype-tooling
agent-devops-setups→ phenotype-tooling
BytePort           → phenotype-tooling
nanovms            → phenotype-tooling
PolicyStack        → phenotype-tooling
PhenoAgent         → Agentora
PhenoProc          → Agentora + HexaKit
phenoRouterMonitor → phenoAI
DINOForge-UnityDoorstop → Dino
helioscope         → helios-cli
agileplus-landing  → phenotype-landing
byteport-landing   → phenotype-landing
hwledger-landing   → phenotype-landing
phenokits-landing  → phenotype-landing
projects-landing   → phenotype-landing
thegent-landing    → phenotype-landing
AppGen             → phenotype-landing (scaffold template)
OmniRoute          → **KEEP** (canonical LLM router — wave 15 correction)
Planify            → archive (upstream-maintained)
portage            → archive (upstream-maintained)
phenotype-omlx     → **SPLIT** platform/engine (ADR-ECO-008); archived pending product decision
phenotype-ops-mcp  → archive (upstream-maintained)
agentapi           → **KEEP_ARCHIVED** (tombstone; docs-only → agentapi-plusplus)
agentapi-plusplus  → **UNIFY** superset merge (G15); substrate engine-agentapi consumer
cliproxyapi-plusplus → **UNIFY** superset merge (G16); go-sdk third_party pin
vibeproxy-monitoring-unified → retire stub → phenotype-infra (G19)
phenoStandards     → archive (self-deprecated)
Profila            → already archived
tehgent            → already archived
thegent-sharecli   → already archived
```

---

## Final Target Count

| Category | Repos |
|----------|-------|
| Governance/Docs | 3 |
| Shared Crates (HexaKit monorepo) | 1 |
| Language SDKs | 2 |
| Tooling monorepo | 1 |
| Agent Platform | 3 |
| MCP/Protocol | 1 |
| Auth/Security | 2 |
| Observability | 1 |
| Data | 2 |
| Testing/QA | 2 |
| Game/3D | 3 |
| Apps/Products | 6 |
| Landing monorepo | 1 |
| Active Forks | 4 |
| **TOTAL** | **32** |

> **32 canonical repos** (well under the <25-50 preferred target, inside <100 ceiling).
> Husks remain as archived redirects — never deleted.
> _2026-06-18:_ -1 vs 2026-05-30 (phenotype-voxel + phenotype-postfx absorbed into phenotype-gfx via PR #10; 33 → 32).

---

## Ordered Execution Sequence

Priority order: highest ROI first, dependency-safe (no step breaks a downstream step).

### SAFE TO EXECUTE (no user sign-off required)

| Step | Action | Repos Retired | Complexity |
|------|--------|---------------|------------|
| **1** | Archive upstream forks with no local changes: Planify, portage, phenotype-ops-mcp (gateway forks **excluded** — see wave 15) | 3 | Trivial — `gh repo archive` only |
| **2** | Retire phenoStandards (self-deprecated) + helioscope (dup of helios-cli) | 2 | Trivial — `gh repo archive` only |
| **3** | Merge PhenoAgent stub → Agentora (add empty crate placeholder) | 1 | Low |
| **4** | Merge phenotype-hub → phenotype-registry as `scaffold/` subdir | 1 | Low |
| **5** | Create phenotype-landing Astro monorepo; git-subtree merge 7 *-landing repos | 7 | Medium — Astro workspace setup + subtree merges |
| **6** | Merge heliosApp + heliosBench + agent-devops-setups + BytePort CLI + nanovms + PolicyStack → phenotype-tooling | 6 | Medium — Cargo workspace + TS workspace additions |

### NEEDS USER SIGN-OFF (cross-repo merges affecting published packages or dep graphs)

| Step | Action | Why Sign-off Needed |
|------|--------|---------------------|
| **7** | **Merge pheno → HexaKit** (21 crates; renames all phenotype-* crate paths) | Breaking: all consumers (PhenoProc, phenoRouterMonitor, PhenoObservability) must update dep paths simultaneously |
| **8** | **Consolidate 8 *Kit Python SDKs → phenotype-python-sdk** (create new repo, git-subtree merge 7 existing) | New repo creation + PyPI publish strategy needed |
| **9** | **Merge phenoRouterMonitor Rust core → phenoAI; merge Metron + Traceon → HexaKit** | Cascading dep update across 3 repos; Cargo.lock churn |
| **10** | **Gateway fork superset merges (G15–G17)** | agentapi++, cliproxy++, bifrost vendor hygiene — see [wave15-execution](docs/operations/wave15-execution-2026-06-17.md); OmniRoute **resolved** — canonical, do not archive |

---

## Key Invariants

- **DINOForge-UnityDoorstop** merge into Dino is safe but low priority (local Unity asset path).
- **phenotype-auth-ts** stays standalone (TS consumers need independent npm publish).
- **HeliosLab** stays standalone (research/experimental, not tooling).
- **Conft** stays standalone (TS config, separate publish target from Settly's Rust scope).
- **PhenoMCP** stays standalone (dual Rust+Go; Go consumers differ from phenotype-go-sdk consumers).
- Deprecated content: merge THEN archive husk with README pointing to new home. Never delete.

---

## Wave I — Surface-reduction fresh triage (2026-06-18, #153)

> **Scope:** 18 reduction candidates identified via live REST audit 2026-06-18 that are
> NOT already covered by `ECOSYSTEM_MAP.md`, this plan, `EXECUTION.md`, `DOMAIN_ROLES.md`,
> or `BOUNDARY_OWNERS.md`. Complements the active wave cluster (#129 / #131 / #135 /
> #144 / #147). **Registry-only triage** — no archives executed here; pointers to
> local agents only.
>
> **Highest-leverage single action:** de-vendor the two accumulators
> `phenoRouterMonitor` (34 MB) and `HexaKit` (22 MB). Each vendors ~60 copies of
> other org repos at root, including **~20 ghost namespaces** that do not exist as
> standalone repos: `Cmdra, Cursora, Datamold, Docuverse, Duple, Evalora, Eventra,
> Flagward, Flowra, Guardis, KaskMan, Kogito, Logify, Portalis, Queris, Schemaforge,
> Seedloom, Tossy, Tracely, bare-cua, helMo, zen`. HexaKit's README is also a
> misplaced `.github` reusable-workflows doc, not a hexagon doc. Recommend
> dedicated de-vendoring pass: replace vendored copies with refs/submodules, delete
> ghost dirs.

### Tier 1 — high confidence, do first

| # | Repo | Pattern | Action | Risk |
|---|------|---------|--------|------|
| 1 | **helioscope** | own description says `SUPERSEDED — use helios-cli`; active | archive-with-redirect → helios-cli | Low-Med |
| 2 | **HeliosCLI** | byte-identical to helioscope (same README `# heliosCLI`, same tree incl. `helios.db`) | consolidate cluster first | Med |
| 5 | **phenotype-runs** | README-only stub (23 KB, no code) | delete-after-extract or archive | Low |
| 6 | **phenotype-templates** | 1 KB README-only; template scaffolding actually lives in `phenokits-commons/templates` | convert to real GitHub template repo OR archive | Low |

> ⚠️ **Helios cluster caveat (verified):** the declared canonical target
> `helios-cli` is itself only a **10% non-building scaffold** (README: _"SCAFFOLD
> … codex-rs workspace members declared but source NOT committed; does not
> build"_). Do **not** archive `helioscope` / `HeliosCLI` until the working code
> is migrated into `helios-cli` (or retarget the redirect to whichever copy is
> kept). This needs a dedicated triage issue on `helios-cli`.

### Tier 2 — medium confidence (functional overlap / fragmentation)

| # | Repo(s) | Overlap | Action |
|---|---------|---------|--------|
| 7 | **Authvault** ↔ AuthKit (tracked) | OAuth2/JWT/RBAC in both | designate canonical (Authvault = framework, AuthKit = SDK); record in BOUNDARY_OWNERS |
| 8 | **phenoShared-niche** | self-described "1-2 dependents" split-out of phenoShared | fold back into phenoShared |
| 9 | **phenoUtils** ↔ phenoShared (tracked) | two Rust shared-utility repos | consolidate into phenoShared; record crate ownership in DOMAIN_ROLES |
| 10 | **PhenoFastMCP + PhenoFastMCP-go + PhenoFastMCP-rust** | 3 upstream MCP forks vs tracked McpKit/PhenoRMCP/MCPForge | one canonical per language; extract SUPERSET.md deltas first |
| 11 | **phenotype-otel + Profila** ↔ PhenoObservability | PO already has `tracing/` + `profiling/` dirs | fold both into PhenoObservability |
| 12 | **agileplus-spec-harmonizer** ↔ AgilePlus | 13 KB format-bridge (Rust, 12/12 tests) | merge into AgilePlus; keep spec-kitty only if plugin actively distributed |
| 13 | **phenotype-water + phenotype-terrain** | (supersession pattern — see [Active Consolidation](#active-consolidation-2026-06-18-phenotype-gfx-absorbs-the-4-sister-repos)) absorbed into KooshaPari/phenotype-gfx via [phenotype-gfx#10](https://github.com/KooshaPari/phenotype-gfx/pull/10) per ADR-004 + ADR-031. Disposition: SUPERSEDE (target=phenotype-gfx, fsm=archived). All 4 source repos archived + deleted 2026-06-18 (delete_repo scope). phenotype-voxel + phenotype-postfx absorbed in the same PR. |
| 14 | **Httpora + Quillr** | half-baked HTTP repos with self-acknowledged naming drift (Quillr README: _"repo 'Quillr'/README 'quill'…to reconcile"_) | reconcile identity/name first |

### Tier 3 — lower confidence (worth a look)

| # | Repo | Note | Action |
|---|------|------|--------|
| 15 | **phenotype-monorepo-state** | 22 KB governance snapshots (no README) | fold into phenotype-registry |
| 16 | **pheno-context** | 6 KB crate, no README | fold into phenoShared/pheno |
| 17 | **TripleM** | **156 MB, 2-yr stale (2024-08), no README, `GET /repos/KooshaPari/TripleM` returns 404 even with auth — anomaly** | investigate via clone; if empty/corrupt/abandoned, delete |
| 18 | **Zerokit** | "Restored: Zerokit" scaffold, no `src/` | confirm intent; archive if not built out |

### Anomalies / hygiene flags (separate concerns, noted)

- **TripleM 404 anomaly** — listed in `/users/KooshaPari/repos` but root GET 404s
  with auth. Could be a renamed/deleted/private-visibility quirk or corruption.
  Worth a direct investigation before any registry entry is written.
- **Secrets hygiene (out of scope here, flag for security pass):** `phenokits-commons`
  has root `secrets/` + `credentials/` dirs; `Tracera` commits a `server.exe` binary;
  `thegent` has `research_secrets.html`. Recommend trufflehog/gitleaks sweep
  independent of this triage (aligns with phenotype-org-governance enforcement surface).

### Wave I ordering (no auto-execute — registry pointers only)

1. **Investigate TripleM 404 anomaly** before any registry indexing.
2. **De-vendor `phenoRouterMonitor` + `HexaKit`** — highest-leverage single action.
3. **Helios cluster** (#1, #2) — block on `helios-cli` triage issue (caveat above).
4. Tier 3 folds (#15, #16) — content-only merges, safe to delegate.
5. Tier 2 consolidations — pending local-agent disposition PRs against
   `BOUNDARY_OWNERS.md` and `DOMAIN_ROLES.md`.
6. Tier 1 archive-eligible (#5, #6) — execute via `gh repo archive` only after
   extract verification.

### Confirmed NOT candidates (preserved)

Real active charters verified and intentionally NOT proposed: `substrate`,
`phenotype-gateway`, `Apisync`, `Pine`, `services`, `phenoAI`, `dispatch-mcp`,
`Agentora`, `Tasken`, `Benchora`, `localbase3`, `phenotype-ts-utils`,
`phenokits-commons`, `Tracera`, `AgilePlus`, `phenodag`, `sharecli`, `thegent`.
Landing pages already consolidated (`phenotype-landing` canonical;
`projects-landing` archived).

### Provenance

Full triage report (200 lines, per-repo API evidence quotes) on request.
Companion to #144 / #147 (PolicyStack audit).

---

*Plan authored: 2026-05-30. Supersedes the ~45-repo target in ECOSYSTEM_MAP.md §5. Execute Steps 1-6 autonomously; Steps 7-10 require explicit user sign-off before cross-repo merges.*
*Last updated: 2026-06-18 (L5-104.7 — phenotype-gfx supersedes the 4 sister repos per ADR-004 + ADR-031; see [Active Consolidation](#active-consolidation-2026-06-18-phenotype-gfx-absorbs-the-4-sister-repos)).*

> **Wave I (2026-06-18, #153):** 18 fresh untracked candidates appended above as
> registry pointers. No archives executed in this wave; local-agent disposition
> only. Protected repos still excluded: `KlipDot`, `KodeVibeGo`, `kwality`,
> `AppGen`, `P2/472-P2`, `KVirtualStage`. Rationalization-tracked sources
> excluded from the triage list.
