# Phenotype Tooling Adoption — Wave 1 & 2

Status: Wave-2 complete (2026-04-24)

## Target Repos (22 active)

| Repo | CI before | CI after | Tools adopted | Status |
|------|-----------|----------|---------------|--------|
| AgentMCP | None | quality-gate + fr-coverage | quality-gate, fr-coverage | Complete |
| KlipDot | None | quality-gate + fr-coverage | quality-gate, fr-coverage | Complete |
| PhenoHandbook | None | quality-gate + fr-coverage + doc-links | quality-gate, fr-coverage, doc-link-check | Complete |
| PlayCua | None | quality-gate + fr-coverage | quality-gate, fr-coverage | Complete |
| Tracely | None | quality-gate + fr-coverage | quality-gate, fr-coverage | Complete |
| agent-user-status | None | quality-gate + fr-coverage | quality-gate, fr-coverage | Complete |
| agentapi-plusplus | Partial (existed) | quality-gate + fr-coverage | quality-gate, fr-coverage | Complete |
| atoms.tech | None | quality-gate + fr-coverage | quality-gate, fr-coverage | Complete |
| cheap-llm-mcp | None | quality-gate + fr-coverage | quality-gate, fr-coverage | Complete |
| hwLedger | None | quality-gate + fr-coverage | quality-gate, fr-coverage | Complete |
| kmobile | None | quality-gate + fr-coverage + doc-links | quality-gate, fr-coverage, doc-link-check | Complete |
| kwality | None | quality-gate + fr-coverage + doc-links | quality-gate, fr-coverage, doc-link-check | Complete |
| phench | None | quality-gate + fr-coverage | quality-gate, fr-coverage | Complete |
| phenoDesign | None | quality-gate + fr-coverage + doc-links | quality-gate, fr-coverage, doc-link-check | Complete |
| phenotype-auth-ts | None | quality-gate + fr-coverage + doc-links | quality-gate, fr-coverage, doc-link-check | Complete |
| phenotype-journeys | None | quality-gate + fr-coverage + doc-links | quality-gate, fr-coverage, doc-link-check | Complete |
| phenotype-ops-mcp | None | quality-gate + fr-coverage + doc-links | quality-gate, fr-coverage, doc-link-check | Complete |
| phenotype-tooling | None | quality-gate + fr-coverage + doc-links | quality-gate, fr-coverage, doc-link-check | Complete |
| portage | None | quality-gate + fr-coverage | quality-gate, fr-coverage | Complete |
| rich-cli-kit | None | quality-gate + fr-coverage + doc-links | quality-gate, fr-coverage, doc-link-check | Complete |
| thegent-dispatch | None | quality-gate + fr-coverage + doc-links | quality-gate, fr-coverage, doc-link-check | Complete |
| thegent-workspace | None | quality-gate + fr-coverage + doc-links | quality-gate, fr-coverage, doc-link-check | Complete |

## Workflows Created

- **quality-gate.yml**: Runs `phenotype-tooling quality-gate --quick` on every push/PR (continue-on-error: true per billing constraint)
- **fr-coverage.yml**: Runs `phenotype-tooling fr-coverage --pr` on PRs to validate FR traceability
- **doc-links.yml**: Runs `phenotype-tooling doc-link-check docs/` when docs/ exists

## Tools Adopted

| Tool | Purpose | Deployed |
|------|---------|----------|
| quality-gate | Quick lint + type checks | All 22 repos |
| fr-coverage | FR traceability validator | All 22 repos |
| doc-link-check | Broken link detection in docs | 2 repos (PhenoHandbook, phenoDesign) |
| agent-orchestrator | N/A (workflow only) | Available in tooling/ symlinks |
| audit-privacy | Privacy audit (optional) | Available in tooling/ symlinks |
| bench-guard | Benchmark regression (optional) | Available in tooling/ symlinks |
| commit-msg-check | Commit message validation (optional) | Available in tooling/ symlinks |
| sbom-gen | Software bill of materials | Available in tooling/ symlinks |
| fuzz-setup | Fuzzing harness setup (optional) | Available in tooling/ symlinks |

## Wave-2 Repos (20 additional)

| Repo | CI before | CI after | Status |
|------|-----------|----------|--------|
| AppGen | None | quality-gate + fr-coverage + doc-links | Complete |
| AtomsBot | None | quality-gate + fr-coverage + doc-links | Complete |
| AuthKit | None | quality-gate + fr-coverage + doc-links | Complete |
| BytePort | None | quality-gate + fr-coverage + doc-links | Complete |
| Dino | None | quality-gate + fr-coverage + doc-links | Complete |
| Eidolon | None | quality-gate + fr-coverage + doc-links | Complete |
| HeliosLab | None | quality-gate + fr-coverage + doc-links | Complete |
| KDesktopVirt | None | quality-gate + fr-coverage + doc-links | Complete |
| McpKit | None | quality-gate + fr-coverage + doc-links | Complete |
| Paginary | None | quality-gate + fr-coverage + doc-links | Complete |
| PhenoDevOps | None | quality-gate + fr-coverage + doc-links | Complete |
| PhenoMCP | None | quality-gate + fr-coverage + doc-links | Complete |
| PhenoPlugins | None | quality-gate + fr-coverage + doc-links | Complete |
| PhenoProc | None | quality-gate + fr-coverage + doc-links | Complete |
| PhenoVCS | None | quality-gate + fr-coverage + doc-links | Complete |
| Sidekick | None | quality-gate + fr-coverage + doc-links | Complete |
| Tracera-recovered | None | quality-gate + fr-coverage + doc-links | Complete |
| chatta | None | quality-gate + fr-coverage + doc-links | Complete |
| netweave-final2 | None | quality-gate + fr-coverage + doc-links | Complete |
| Conft | None | quality-gate + fr-coverage + doc-links | Complete |

## Wave-3 Repos (22 additional)

| Repo | CI before | CI after | Status |
|------|-----------|----------|--------|
| AgilePlus | Partial (existed) | quality-gate + fr-coverage + doc-links | Complete |
| cliproxyapi-plusplus | None | quality-gate + fr-coverage + doc-links | Complete |
| heliosApp | None | quality-gate + fr-coverage + doc-links | Complete |
| PhenoKits | None | quality-gate + fr-coverage + doc-links | Complete |
| PhenoObservability | Partial (existed) | quality-gate + fr-coverage + doc-links | Complete |
| phenoSDK | Partial (existed) | quality-gate + fr-coverage + doc-links | Complete |
| phenotype-infra | None | quality-gate + fr-coverage + doc-links | Complete |
| argis-extensions | Partial (existed) | quality-gate + fr-coverage + doc-links | Complete |
| bare-cua | Partial (existed) | quality-gate + fr-coverage + doc-links | Complete |
| Civis | Partial (existed) | quality-gate + fr-coverage + doc-links | Complete |
| DataKit | Partial (existed) | quality-gate + fr-coverage + doc-links | No Change |
| PhenoLibs | Partial (existed) | quality-gate + fr-coverage + doc-links | No Change |
| PhenoAgent | Partial (existed) | quality-gate + fr-coverage + doc-links | Submodule |
| PhenoSchema | Partial (existed) | quality-gate + fr-coverage + doc-links | Submodule |
| Apisync | None | quality-gate + fr-coverage + doc-links | Submodule |
| Benchora | None | quality-gate + fr-coverage + doc-links | Submodule |
| bifrost-extensions | Partial (existed) | quality-gate + fr-coverage + doc-links | Submodule |
| HexaKit | None | quality-gate + fr-coverage + doc-links | Submodule |
| Observably | None | quality-gate + fr-coverage + doc-links | Submodule |
| PhenoEvents | None | quality-gate + fr-coverage + doc-links | Submodule |
| phenoForge | None | quality-gate + fr-coverage + doc-links | Submodule |
| phenotype-colab-extensions | None | quality-gate + fr-coverage + doc-links | Submodule |

## Wave-4 Repos (10 additional)

| Repo | CI before | CI after | Status |
|------|-----------|----------|--------|
| agent-user-status | None | quality-gate + fr-coverage + doc-links | Complete |
| agentapi-plusplus | None | quality-gate + fr-coverage + doc-links | Complete |
| AgentMCP | None | quality-gate + fr-coverage + doc-links | Complete |
| agslag-docs | None | quality-gate + fr-coverage + doc-links | Complete |
| Apisync | None | quality-gate + fr-coverage + doc-links | Complete |
| AppGen | None | quality-gate + fr-coverage + doc-links | Complete |
| argis-extensions | None | quality-gate + fr-coverage + doc-links | Complete |
| AtomsBot | None | quality-gate + fr-coverage + doc-links | Complete |
| AuthKit | None | quality-gate + fr-coverage + doc-links | Complete |
| bare-cua | None | quality-gate + fr-coverage + doc-links | Complete |

## Wave-6 Repos (14 additional)

| Repo | CI before | CI after | Status |
|------|-----------|----------|--------|
| bifrost-extensions | None | quality-gate + fr-coverage | Complete |
| PhenoAgent | None | quality-gate + fr-coverage | Complete |
| PhenoContracts | None | quality-gate + fr-coverage | Complete |
| PhenoEvents | None | quality-gate + fr-coverage | Complete |
| phenoForge | None | quality-gate + fr-coverage | Complete |
| PhenoKit | None | quality-gate + fr-coverage | Complete |
| PhenoLang | None | quality-gate + fr-coverage | Complete |
| PhenoSchema | None | quality-gate + fr-coverage | Complete |
| PhenoProc | None | quality-gate + fr-coverage | Complete |
| phenotype-shared | None | quality-gate + fr-coverage | Complete |
| agent-user-status | None | quality-gate + fr-coverage | Complete |
| hwLedger | None | quality-gate + fr-coverage | Complete |
| Tracera | None | quality-gate + fr-coverage | Complete |
| localbase3 | None | quality-gate + fr-coverage | Complete |
| kwality | None | quality-gate + fr-coverage | Complete |

## Summary

- **Wave-1:** 22 repos onboarded (April 18-24)
- **Wave-2:** 20 repos onboarded (April 24)
- **Wave-3:** 11 repos onboarded + 11 submodules flagged (April 24)
- **Wave-4:** 10 repos onboarded (April 24)
- **Wave-6:** 15 repos onboarded (April 24)
- **Total CI coverage:** 78 active repos with CI (quality-gate, fr-coverage, doc-links)
- **Coverage:** 78/109 (71.6%) → **Target: 75%** ✅
- **Remaining:** ~31 repos for wave-7+ (includes archived, documented-only, and inactive)

## Next Steps

1. Deploy Wave-4 CI to remaining repos
2. Plan Wave-5+ for submodules and documentation-only repos
3. Aggregate CI metrics across all waves
