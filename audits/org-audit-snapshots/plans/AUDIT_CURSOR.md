# Phenotype Ownership Program — A-Z Audit Cursor

**Source of truth for the rolling 88-repo audit (P2 phase).**
This file is updated by the program cron each tick. The cursor marks the next repo to audit.

## Current Cursor

```
CURRENT: agentapi-plusplus  (index 1 / 88)
LAST_COMPLETED: (none)
LAST_RUN: (none)
```

## A-Z Checklist (88 repos)

Order is case-insensitive alphabetical. Each item: `[ ] <repo>` → `[x] <repo>` when P2 audit complete + scorecard committed.

- [ ] agentapi-plusplus
- [ ] Agentora
- [ ] Apisync
- [ ] argis-extensions
- [ ] AuthKit
- [ ] Authvault
- [ ] Benchora
- [ ] bifrost
- [ ] BytePort
- [ ] clap-ext
- [ ] cliproxyapi-plusplus
- [ ] Configra
- [ ] Conft
- [ ] context-mode
- [ ] context-mode-plusplus
- [ ] DataKit
- [ ] Eidolon
- [ ] Eventra
- [ ] FocalPoint
- [ ] forgecode
- [ ] helios-cli
- [ ] HeliosLab
- [ ] HexaKit
- [ ] Httpora
- [ ] hwLedger
- [ ] KDesktopVirt
- [ ] kmobile
- [ ] KodeVibe
- [ ] localbase3
- [ ] Logify
- [ ] Melosviz
- [ ] nanovms
- [ ] OmniRoute
- [ ] pheno
- [ ] pheno-cdylib-bridge
- [ ] pheno-context
- [ ] pheno-forge-plugins
- [ ] pheno-forge-smoke
- [ ] pheno-runtime-config
- [ ] pheno-tracing
- [ ] phenoAI
- [ ] PhenoCompose
- [ ] PhenoContracts
- [ ] phenodag
- [ ] phenoData
- [ ] phenoDesign
- [ ] phenodocs
- [ ] phenoEvents
- [ ] PhenoHandbook
- [ ] phenokits-commons
- [ ] PhenoObservability
- [ ] PhenoPlugins
- [ ] phenoResearchEngine
- [ ] PhenoRuntime
- [ ] PhenoSpecs
- [ ] phenotype-apps
- [ ] phenotype-contracts
- [ ] phenotype-gfx
- [ ] phenotype-go-sdk
- [ ] phenotype-infra
- [ ] phenotype-journeys
- [ ] phenotype-landing
- [ ] phenotype-ops
- [ ] phenotype-org-audits
- [ ] phenotype-pm-core
- [ ] phenotype-python-sdk
- [ ] phenotype-registry
- [ ] phenotype-router-spec
- [ ] phenotype-tooling
- [ ] phenoUtils
- [ ] PhenoVCS
- [ ] Pine
- [ ] PlayCua
- [ ] PlusForges
- [ ] PolicyStack
- [ ] portage
- [ ] Quillr
- [ ] rich-cli-kit
- [x] sharecli
- [ ] Sidekick
- [ ] Stashly
- [ ] substrate
- [ ] substrate-adapters-bundle
- [ ] Tasken
- [ ] TestingKit
- [ ] thegent
- [ ] Tokn
- [ ] Tracely

## Progress

```
Audited:   0 / 88
Remaining: 88 / 88
Coverage:  0.0%
```

## Excluded (do not audit)

- AgilePlus, Tracera, Civis, Dino, WorldSphereMod, Compound-Spheres-3D, Compound-Spheres-3D-Backup
- QuadSGM, Parpoura, KaskMan, GDK, AtomsBot, KWatch (paused)
- eyetracker, agent-user-status (niche standalone)
- chatta (archived)

## Update Protocol

When a repo audit (P2 scorecard) is committed:
1. Check the box: `- [ ] <repo>` → `- [x] <repo>`
2. Update `CURRENT` to the next unchecked repo (or `COMPLETE` if all done)
3. Update `LAST_COMPLETED` and `LAST_RUN` timestamps
4. Recalculate Progress counters
5. Commit: `chore(cursor): mark <repo> audited — N/88`
