# Rationalization Execution + Archive Shortlist

> **v2 charter (2026-06-17):** Repoint dependents to **DOMAIN_ROLES canonical repos**, not HexaKit monorepo crate paths. See [ADR-ECO-006](docs/adrs/ADR-ECO-006.md), [registry/chokepoints.json](registry/chokepoints.json), [ZERO_SHOT_ORCHESTRATION.md](docs/rationalization/ZERO_SHOT_ORCHESTRATION.md).

## v2 repoint semantics (authoritative)

| Dependent | Old assumption (v1) | v2 repoint target |
|-----------|----------------------|-------------------|
| PhenoObservability | Traceon → HexaKit tracingkit | PhenoObservability owns Metron/Traceon post-Wave A |
| Pyron | pheno/Stashly/Settly → HexaKit crates | phenotype-types, ResilienceKit, phenoShared |
| thegent | AuthKit → phenotype-python-sdk | Authvault |
| thegent | BytePort → phenotype-tooling | phenotype-tooling (unchanged) |
| phenoRouterMonitor | pheno crates | phenotype-types / phenoShared |

Chokepoint status: [registry/chokepoints.json](registry/chokepoints.json). Execute repoint PRs in **G2** before Waves A–D.

---

> Companion to `RATIONALIZATION_PLAN.md`. Turns the in-flight **absorption wave** into a concrete
> MERGE-ORDER + ARCHIVE-SHORTLIST so that once absorption PRs land green, the org repo count
> actually drops (it is stuck at **144 active**).
>
> **STATUS (2026-06-17):** Lane G archive wave **executed** for gap-port fleet (user sign-off: "do it").
> PhenoProc, PhenoKits, and Metron are archived on GitHub. ObservabilityKit was never a standalone repo
> (absorbed into `phenotype-python-sdk` / PO subtree). Remaining shortlist items still require repoint gates.
>
> Protected (never archive, never listed below): P2 / 472-P2 / KVirtualStage / KlipDot / KodeVibeGo / kwality.

---

## Method

For each of the 25 source repos being absorbed, the canonical package/crate/module identifier was
resolved from its manifest, then GitHub code search (`gh api search/code`, manifest files only:
`Cargo.toml`/`package.json`/`go.mod`/`pyproject.toml`) was run org-wide (`org:KooshaPari`, includes the
63 private repos) to find **external dependents** — repos OTHER than the source itself, its absorber,
or another repo also being absorbed/archived in this same wave.

A source repo is **SAFE to archive after merge** only if it has no external dependents (or its only
dependents are repos already retiring in this wave). A source with a live external dependent is
**BLOCKED** until that dependent's manifest is repointed to the monorepo.

Identifiers resolved: `phenotype-core` (pheno workspace), `metrickit`, `tracingkit`, `stashly`,
`settly`, `focalpoint`, `phenotype-xdd-lib`, `authkit`, `datakit`, `mcpkit`, `observabilitykit`,
`resiliencekit`, `testingkit`, `phenokits`, `worktree-manager`, `heliosapp`, `helios-bench`,
`byteport`, `nanovms`, `policy-federation` (PolicyStack), `devenv`/`devhex` (PlatformKit),
`pheno-agent`, `phenoproc`, `@kooshapari/design` (phenoDesign), `@phenotype/shared-utils` (phenoShared).

---

## Per-Absorber Merge Order + Archive Shortlist

Legend: ✅ = safe to archive once its merge PR is green · 🔶 = blocked, must repoint dependent(s) first.

### 1. HexaKit ← pheno, Metron, Traceon, Stashly, Settly, FocalPoint, phenoXddLib

> **Boundary supersession (2026-06-16):** Runtime observability libs (**Metron**, **Traceon**) absorb into
> **PhenoObservability**, not HexaKit workspace members. HexaKit keeps **template/scaffold mirrors only**
> (`templates/hexagon/rust/{metrickit,tracingkit}`). See `BOUNDARY_OWNERS.md`. Rows below remain for merge-wave
> dependency tracking until consumers are repointed.

| Source | External dependents | Verdict |
|--------|--------------------|---------|
| Metron | (none) | ✅ safe → **ARCHIVED** 2026-06-17 |
| FocalPoint | (none) | ✅ safe |
| phenoXddLib | (none) | ✅ safe → **ARCHIVED** 2026-06-17 |
| Traceon | **PhenoObservability** | 🔶 repoint PhenoObservability → HexaKit `tracingkit` crate |
| Stashly | **Pyron** | 🔶 repoint Pyron → HexaKit `stashly` crate |
| Settly | **Pyron** | 🔶 repoint Pyron → HexaKit `settly` crate |
| pheno | **Pyron, phenoRouterMonitor** (+ PhenoAgent, both retiring this wave) | 🔶 repoint Pyron + phenoRouterMonitor → HexaKit `phenotype-*` crates |

> Merge order: Metron, Traceon, Stashly, Settly, FocalPoint, phenoXddLib, then **pheno last** (21 crates,
> renames `phenotype-*` paths). Pyron is the chokepoint — it depends on pheno/Stashly/Settly; repoint it
> once, in lockstep, against the post-merge HexaKit crate paths.

### 2. phenotype-python-sdk ← AuthKit, DataKit, McpKit, ObservabilityKit, ResilienceKit, TestingKit, PhenoKits

| Source | External dependents | Verdict |
|--------|--------------------|---------|
| DataKit | (none) | ✅ safe |
| ResilienceKit | (none) | ✅ safe |
| TestingKit | (none) | ✅ safe |
| PhenoKits | (none — it was the collection index) | ✅ safe → **ARCHIVED** (pre-wave) |
| AuthKit | **Tracera, thegent** | 🔶 repoint Tracera + thegent → phenotype-python-sdk |
| ObservabilityKit | **PhenoObservability** | 🔶 repoint PhenoObservability → phenotype-python-sdk (no standalone repo to archive) |
| McpKit | **phenotype-go-sdk** (cross-absorber) | 🔶 phenotype-go-sdk must consume McpKit's Go side from the go-sdk monorepo, not McpKit repo |

### 3. phenotype-tooling ← heliosApp, heliosBench, BytePort, nanovms, PolicyStack

| Source | External dependents | Verdict |
|--------|--------------------|---------|
| heliosApp | (none) | ✅ safe |
| nanovms | (none external — only phenoShared, itself absorbed into phenodocs) | ✅ safe → **ARCHIVED** 2026-06-17 (tooling/crates/nanovms) |
| PolicyStack | (none — `policy-federation`) | ✅ safe |
| worktree-manager | **PhenoVCS** | ✅ absorbed into PhenoVCS (2026-06-16); source repo deleted |
| heliosBench | **helios-router, helios-cli** | 🔶 repoint helios-router + helios-cli → phenotype-tooling bench |
| BytePort | **thegent** (byteport-landing retires this wave) | 🔶 repoint thegent → phenotype-tooling `byteport` |

### 4. phenotype-go-sdk ← PlatformKit

| Source | External dependents | Verdict |
|--------|--------------------|---------|
| PlatformKit | **DevHex** | 🔶 repoint DevHex → phenotype-go-sdk module path |

### 5. Agentora ← PhenoAgent, PhenoProc

| Source | External dependents | Verdict |
|--------|--------------------|---------|
| PhenoProc | (none) | ✅ safe → **ARCHIVED** (pre-wave) |
| PhenoAgent | **PhenoDevOps, Pyron, pheno** (pheno retiring this wave) | 🔶 repoint PhenoDevOps + Pyron → Agentora `pheno-agent` crate |

### 6. phenodocs ← phenoDesign, phenoShared

| Source | External dependents | Verdict |
|--------|--------------------|---------|
| phenoDesign | (none — `@kooshapari/design`) | ✅ safe → **ARCHIVED** 2026-06-17 |
| phenoShared | none via real npm name `@phenotype/shared-utils`; legacy textual refs in DataKit/ObservabilityKit/TestingKit/PhenoObservability (all either absorbed this wave or repointed under ObsKit row) — **verify no live import before archiving** | ✅ safe (verify) |

### Must stay standalone (per plan, NOT archived)
None among these 25 — every source is a genuine absorption target. (Plan-level standalones:
phenotype-auth-ts, HeliosLab, Conft, PhenoMCP, PhenoSpecs — not part of this wave.)

---

## Archive wave execution (2026-06-17, Lane G + Batch 3)

| Repo | Action | Evidence |
|------|--------|----------|
| `KooshaPari/PhenoProc` | archived | pre-existing; absorption PR #79 merged |
| `KooshaPari/PhenoKits` | archived | pre-existing; phenokits-commons #3 merged |
| `KooshaPari/Metron` | archived | post PhenoObservability #157 (metrickit) |
| ObservabilityKit | N/A (package only) | canonical: `phenotype-python-sdk` + PO cleanup |
| `KooshaPari/nanovms` | pre-archived | Batch 3; subtree in `phenotype-tooling/crates/nanovms` |
| `KooshaPari/phenoDesign` | pre-archived | Batch 3; absorbed into phenodocs (`@kooshapari/design`) |
| `KooshaPari/phenoXddLib` | pre-archived | Batch 3; safe per HexaKit shortlist |
| `KooshaPari/portage` | pre-archived | Batch 3; upstream Gentoo fork, no DOMAIN_ROLES entry |

---

## Archive Shortlist Summary

**SAFE after merge (12)** — no external dependents:
`Metron` ✅, `FocalPoint`, `phenoXddLib` ✅, `DataKit`, `ResilienceKit`, `TestingKit`, `PhenoKits` ✅,
`heliosApp`, `nanovms` ✅, `PolicyStack`, `PhenoProc` ✅, `phenoDesign` ✅, plus `phenoShared` (verify).
**Batch 3 extras (no absorption target):** `portage` ✅ pre-archived.

**BLOCKED-BY-DEPS (13)** — repoint listed dependents first, then archive:

| Source | Repoint these first |
|--------|---------------------|
| pheno | Pyron, phenoRouterMonitor |
| Traceon | PhenoObservability |
| Stashly | Pyron |
| Settly | Pyron |
| AuthKit | Tracera, thegent |
| ObservabilityKit | PhenoObservability |
| McpKit | phenotype-go-sdk |
| worktree-manager | PhenoVCS | ✅ absorbed (2026-06-16) |
| heliosBench | helios-router, helios-cli |
| BytePort | thegent |
| PlatformKit | DevHex |
| PhenoAgent | PhenoDevOps, Pyron |
| phenoShared | (verify legacy textual refs only) |

> **Repoint chokepoints:** **Pyron** (gates pheno, Stashly, Settly, PhenoAgent), **PhenoObservability**
> (gates Traceon, ObservabilityKit), **thegent** (gates AuthKit, BytePort). Fix those 3 dependents first
> to unblock 7 of the 13 blocked sources.

---

## Archive Migration Absorptions (2026-06-16)

The following repos were deleted after archive migration; canonical homes and redirect metadata live in `projects/*.json`:

| Source (deleted) | Canonical owner |
|------------------|-----------------|
| phenoVessel | PhenoPlugins/pheno-plugin-vessel |
| phenoTypes | phenotype-types |
| phenoPatch, Diffuse | phenotype-tooling/phenotype-diff |
| Servion | phenotype-tooling/phenotype-service-registry |
| Guardrail | phenotype-tooling/phenotype-resilience |
| Cryptora | phenoUtils/pheno-crypto |
| forge, phenoForge | Tasken |
| router-docs | OmniRoute/docs/research/archive/router-docs/ |

---

## Projected Repo Count

Start: **144 active** (177 total − 33 already archived).

- **After this wave, if only the 12 SAFE sources archive:** 144 − 12 = **132 active**.
  (phenoShared verified-safe would make it 133→131.)
- **After this wave fully drains (all 25 sources archived once 13 dependents are repointed):**
  144 − 25 = **119 active**.
- **After the full RATIONALIZATION_PLAN** (also retires the upstream-fork husks, *-landing monorepo
  consolidation, helioscope, phenoStandards, DINOForge-UnityDoorstop, etc.): converges to the plan's
  canonical target of **~33–38 repos** (plan table computes 33 canonical; header states 38 ceiling).

| Milestone | Active repos |
|-----------|-------------|
| Now | 144 |
| This wave — SAFE-only archived | 132 |
| This wave — fully drained (deps repointed) | 119 |
| Full plan complete | ~33–38 |

---

## Execution Order (this wave)

1. Land each absorber's absorption PRs (green CI).
2. Archive the **12 SAFE** sources immediately on green merge → 144 → 132. *(requires user sign-off)*
3. Repoint the 3 chokepoint dependents (Pyron, PhenoObservability, thegent), then the rest.
4. Archive the **13 BLOCKED** sources as each clears → 132 → 119. *(requires user sign-off)*
5. Husk policy: every archived source keeps a README redirect to its new monorepo home. **Never deleted.**

*Authored 2026-05-30. Read-only analysis; archives pending explicit user approval.*
