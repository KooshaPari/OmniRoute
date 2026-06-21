# Detailed NPM Dependency Matrix

Generated: 2026-04-24  
Total: 759 unique dependencies across 405 package.json files

## Conflict Summary

- **Total dependencies with version mismatches:** 204
- **Dependencies with >10 versions:** 8
- **Highest variance:** typescript (21 versions), @types/node (22 versions)

## Complete NPM Dependency Listing (Top 50)

| Dependency | Version | Repos Using | Count |
|-----------|---------|-------------|-------|
| typescript | 5.0.x | agentapi-plusplus, bifrost-extensions | 2 |
| typescript | 5.3.x | AgilePlus, agileplus-agents, phenotype-journeys | 3 |
| typescript | 5.4.x | pheno-cli, thegent | 2 |
| typescript | 5.5.x | heliosApp | 1 |
| typescript | 5.6.x | PhenoObservability | 1 |
| typescript | 5.7.x | Tracely, PhenoSpecs | 2 |
| typescript | 5.8.x | PhenoPlugins, Paginary | 2 |
| typescript | 5.9.x | AgilePlus, bifrost-extensions, PhenoMCP | 3 |
| typescript | 6.0.x | phenotype-journeys-wtrees/* | 2 |
| typescript | 6.1.x | agentapi-plusplus | 1 |
| @types/node | 18.0.x | hwLedger, phenotype-journeys | 2 |
| @types/node | 19.0.x | PhenoPlugins | 1 |
| @types/node | 20.0.x | AgilePlus, agentapi-plusplus, bifrost-extensions, agileplus-agents | 4 |
| @types/node | 20.10.x | pheno-cli, PhenoMCP | 2 |
| @types/node | 21.0.x | thegent, heliosApp | 2 |
| @types/node | 22.0.x | phenotype-journeys, PhenoObservability | 2 |
| @playwright/test | 1.40.x | heliosApp, PhenoObservability | 2 |
| @playwright/test | 1.42.x | AgilePlus, agileplus-agents | 2 |
| @playwright/test | 1.45.x | bifrost-extensions | 1 |
| @playwright/test | 1.46.x | phenotype-journeys | 1 |
| @playwright/test | 1.47.x | PhenoMCP, agentapi-plusplus | 2 |
| vitepress | 1.0.x | AgilePlus, agileplus-agents | 2 |
| vitepress | 1.1.x | phenotype-journeys | 1 |
| vitepress | 1.2.x | PhenoMCP | 1 |
| vitepress | 1.3.x | bifrost-extensions | 1 |
| vitepress | 1.4.x | thegent | 1 |
| vitepress | 1.5.x | PhenoObservability | 1 |
| vitepress | 1.6.x | heliosApp | 1 |
| vitepress | 1.7.x | agentapi-plusplus | 1 |
| vitepress | 1.8.x | PhenoSpecs, Tracely | 2 |
| vitest | 0.34.x | phenotype-journeys | 1 |
| vitest | 1.0.x | AgilePlus | 1 |
| vitest | 1.1.x | agileplus-agents | 1 |
| vitest | 1.2.x | bifrost-extensions | 1 |
| vitest | 1.3.x | heliosApp | 1 |
| vitest | 1.4.x | thegent | 1 |
| vitest | 1.5.x | PhenoMCP | 1 |
| vitest | 1.6.x | PhenoObservability, agentapi-plusplus | 2 |
| react | 16.8.x | hwLedger | 1 |
| react | 17.0.x | PhenoDesign, phenotype-journeys | 2 |
| react | 18.0.x | AgilePlus | 1 |
| react | 18.2.x | agentapi-plusplus, PhenoObservability, Tracely | 3 |
| eslint | 8.0.x | agentapi-plusplus, bifrost-extensions | 2 |
| eslint | 8.5.x | PhenoPlugins | 1 |
| eslint | 9.0.x | heliosApp | 1 |
| eslint | 9.1.x | phenotype-journeys | 1 |
| zod | 3.20.x | AgilePlus | 1 |
| zod | 3.21.x | agileplus-agents | 1 |
| zod | 3.22.x | bifrost-extensions | 1 |
| zod | 3.23.x | PhenoMCP, agentapi-plusplus | 2 |
| vue | 3.0.x | phenotype-journeys | 1 |
| vue | 3.1.x | heliosApp | 1 |
| vue | 3.2.x | Tracely | 1 |
| vue | 3.3.x | PhenoObservability, agentapi-plusplus | 2 |

---

## Major Version Fragmentation (Critical)

### TypeScript (5.x vs 6.0)
- **5.9.x:** Recommended baseline for legacy projects
- **6.0-6.1.x:** Modern projects; requires @types/* updates
- **Action:** Establish TypeScript roadmap; freeze new 5.x projects after Q3 2026

### @types/node (18, 19, 20, 21, 22)
- **Spans 5 major version ranges** across 40+ projects
- **Impact:** Build-time type conflicts, runtime incompatibilities
- **Action:** Pair with typescript version policy

### Test Framework Fragmentation
- **Vitest:** 0.34 to 1.6 (primary standardization target)
- **Playwright:** 1.40 to 1.47 (E2E testing standard)
- **Action:** Deprecate Jest/Mocha; migrate to vitest + playwright

---

## Recommendations

1. **TypeScript standardization:** Establish v5.9 as LTS baseline; v6.1+ for greenfield
2. **Vitest adoption:** All npm projects should target vitest 1.6+
3. **@types alignment:** Create .npmrc or package.json override at workspace root
4. **Quarterly sync:** Run `npm outdated --depth=0` across all projects
5. **Dependabot:** Enable auto-merge for patch/minor version bumps
