# Phenotype Ecosystem Rationalization Plan

> Derived from ECOSYSTEM_MAP.md (2026-05-30 audit: 111 repos → aggressive target: **38 canonical repos**)
> Bias: monorepos / synthetic-monorepo-collections over thin standalone repos.
> Protected (never touch): P2/472-P2, KVirtualStage, KlipDot, KodeVibeGo, kwality.

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
| **phenotype-tooling** | Absorbs: worktree-manager (binary), heliosApp (TS dashboard subdir), heliosBench (Python benchmarks subdir), agent-devops-setups, BytePort (CLI moved to tooling/byteport), nanovms (VM isolation moved to tooling/nanovms) |

> Net: -5 repos.

---

### AGENT PLATFORM (3 — was 5+)

| Repo | Absorbs |
|------|---------|
| **Agentora** | Absorbs: PhenoAgent (empty stub — add as agentora/crates/pheno-agent), PhenoProc (infrakit stubs folded to HexaKit deps; runtime portion → Agentora) |
| **thegent** | Keep (Python agent runtime, separate language target) |
| **phenoAI** | Absorbs: phenoRouterMonitor Rust core → phenoAI/crates/router-monitor; Streamlit dashboard → phenoAI/monitoring; OmniRoute archived (not absorbed — upstream-maintained) |

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

### GAME / 3D (4)

| Repo | Absorbs |
|------|---------|
| **phenotype-voxel** | Keep (shared adaptive voxel substrate) |
| **phenotype-postfx** | Keep (Unity BRP post-FX) |
| **Dino** | Keep (DINOForge mod platform) |
| **WorldSphereMod** | Keep (active 3D fork) |

> DINOForge-UnityDoorstop: merge into Dino repo as `Dino/doorstop/` subdir or git subtree. Net: -1 repo.

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
worktree-manager   → phenotype-tooling
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
OmniRoute          → archive (upstream-maintained, no local delta)
Planify            → archive (upstream-maintained)
portage            → archive (upstream-maintained)
phenotype-omlx     → archive (upstream-maintained)
phenotype-ops-mcp  → archive (upstream-maintained)
agentapi-plusplus  → archive (upstream-maintained)
cliproxyapi-plusplus → archive (superseded by phenoAI/bifrost)
vibeproxy-monitoring-unified → archive (governance stub only)
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
| Game/3D | 4 |
| Apps/Products | 6 |
| Landing monorepo | 1 |
| Active Forks | 4 |
| **TOTAL** | **33** |

> **33 canonical repos** (well under the <25-50 preferred target, inside <100 ceiling).
> Husks remain as archived redirects — never deleted.

---

## Ordered Execution Sequence

Priority order: highest ROI first, dependency-safe (no step breaks a downstream step).

### SAFE TO EXECUTE (no user sign-off required)

| Step | Action | Repos Retired | Complexity |
|------|--------|---------------|------------|
| **1** | Archive 8 upstream forks with no local changes: OmniRoute, Planify, portage, phenotype-omlx, phenotype-ops-mcp, agentapi-plusplus, cliproxyapi-plusplus, vibeproxy-monitoring-unified | 8 | Trivial — `gh repo archive` only |
| **2** | Retire phenoStandards (self-deprecated) + helioscope (dup of helios-cli) | 2 | Trivial — `gh repo archive` only |
| **3** | Merge PhenoAgent stub → Agentora (add empty crate placeholder) | 1 | Low |
| **4** | Merge phenotype-hub → phenotype-registry as `scaffold/` subdir | 1 | Low |
| **5** | Create phenotype-landing Astro monorepo; git-subtree merge 7 *-landing repos | 7 | Medium — Astro workspace setup + subtree merges |
| **6** | Merge heliosApp + heliosBench + worktree-manager + agent-devops-setups + BytePort CLI + nanovms + PolicyStack → phenotype-tooling | 7 | Medium — Cargo workspace + TS workspace additions |

### NEEDS USER SIGN-OFF (cross-repo merges affecting published packages or dep graphs)

| Step | Action | Why Sign-off Needed |
|------|--------|---------------------|
| **7** | **Merge pheno → HexaKit** (21 crates; renames all phenotype-* crate paths) | Breaking: all consumers (PhenoProc, phenoRouterMonitor, PhenoObservability) must update dep paths simultaneously |
| **8** | **Consolidate 8 *Kit Python SDKs → phenotype-python-sdk** (create new repo, git-subtree merge 7 existing) | New repo creation + PyPI publish strategy needed |
| **9** | **Merge phenoRouterMonitor Rust core → phenoAI; merge Metron + Traceon → HexaKit** | Cascading dep update across 3 repos; Cargo.lock churn |
| **10** | **OmniRoute decision: adopt fork or permanently drop** | If bifrost+phenoAI fully replaces it, confirm no consumers; if any consumer exists, needs migration plan |

---

## Key Invariants

- **DINOForge-UnityDoorstop** merge into Dino is safe but low priority (local Unity asset path).
- **phenotype-auth-ts** stays standalone (TS consumers need independent npm publish).
- **HeliosLab** stays standalone (research/experimental, not tooling).
- **Conft** stays standalone (TS config, separate publish target from Settly's Rust scope).
- **PhenoMCP** stays standalone (dual Rust+Go; Go consumers differ from phenotype-go-sdk consumers).
- Deprecated content: merge THEN archive husk with README pointing to new home. Never delete.

---

*Plan authored: 2026-05-30. Supersedes the ~45-repo target in ECOSYSTEM_MAP.md §5. Execute Steps 1-6 autonomously; Steps 7-10 require explicit user sign-off before cross-repo merges.*
