# Parser Anomalies — Audit Format Analysis

Audits where >=7 dimensions could not be parsed (suspected format drift).

## Affected Audits (53)

- **KlipDot**: Could not parse 10 dimensions; attempted formats: numbered-sections, table-rows, text-search
- **phenotype-tooling**: Could not parse 10 dimensions; attempted formats: numbered-sections, table-rows, text-search
- **BytePort**: Could not parse 7 dimensions; attempted formats: numbered-sections, table-rows, text-search
- **phenoDesign**: Could not parse 10 dimensions; attempted formats: numbered-sections, table-rows, text-search
- **cheap-llm-mcp**: Could not parse 10 dimensions; attempted formats: numbered-sections, table-rows, text-search
- **AppGen**: Could not parse 7 dimensions; attempted formats: numbered-sections, table-rows, text-search
- **AgentMCP**: Could not parse 10 dimensions; attempted formats: numbered-sections, table-rows, text-search
- **McpKit**: Could not parse 7 dimensions; attempted formats: numbered-sections, table-rows, text-search
- **loc_reverify**: Could not parse 8 dimensions; attempted formats: numbered-sections, table-rows, text-search
- **phenotype-auth-ts**: Could not parse 10 dimensions; attempted formats: numbered-sections, table-rows, text-search
- **PlayCua**: Could not parse 10 dimensions; attempted formats: numbered-sections, table-rows, text-search
- **phenotype-journeys**: Could not parse 10 dimensions; attempted formats: numbered-sections, table-rows, text-search
- **ResilienceKit**: Could not parse 10 dimensions; attempted formats: numbered-sections, table-rows, text-search
- **PhenoPlugins**: Could not parse 7 dimensions; attempted formats: numbered-sections, table-rows, text-search
- **Conft**: Could not parse 7 dimensions; attempted formats: numbered-sections, table-rows, text-search
- **tooling_adoption**: Could not parse 7 dimensions; attempted formats: numbered-sections, table-rows, text-search
- **agslag-docs**: Could not parse 10 dimensions; attempted formats: numbered-sections, table-rows, text-search
- **netweave-final2**: Could not parse 7 dimensions; attempted formats: numbered-sections, table-rows, text-search
- **phench**: Could not parse 10 dimensions; attempted formats: numbered-sections, table-rows, text-search
- **go-nippon**: Could not parse 7 dimensions; attempted formats: numbered-sections, table-rows, text-search
- **bare-cua**: Could not parse 7 dimensions; attempted formats: numbered-sections, table-rows, text-search
- **artifacts**: Could not parse 10 dimensions; attempted formats: numbered-sections, table-rows, text-search
- **PhenoVCS**: Could not parse 7 dimensions; attempted formats: numbered-sections, table-rows, text-search
- **kmobile**: Could not parse 10 dimensions; attempted formats: numbered-sections, table-rows, text-search
- **PlatformKit**: Could not parse 7 dimensions; attempted formats: numbered-sections, table-rows, text-search
- **Dino**: Could not parse 7 dimensions; attempted formats: numbered-sections, table-rows, text-search
- **Tracely**: Could not parse 10 dimensions; attempted formats: numbered-sections, table-rows, text-search
- **TestingKit**: Could not parse 10 dimensions; attempted formats: numbered-sections, table-rows, text-search
- **fr_scaffolding**: Could not parse 9 dimensions; attempted formats: numbered-sections, table-rows, text-search
- **chatta**: Could not parse 7 dimensions; attempted formats: numbered-sections, table-rows, text-search
- **atoms.tech**: Could not parse 10 dimensions; attempted formats: numbered-sections, table-rows, text-search
- **AuthKit**: Could not parse 7 dimensions; attempted formats: numbered-sections, table-rows, text-search
- **hwLedger**: Could not parse 10 dimensions; attempted formats: numbered-sections, table-rows, text-search
- **test_scaffolding**: Could not parse 8 dimensions; attempted formats: numbered-sections, table-rows, text-search
- **PhenoSpecs**: Could not parse 10 dimensions; attempted formats: numbered-sections, table-rows, text-search
- **agent-user-status**: Could not parse 10 dimensions; attempted formats: numbered-sections, table-rows, text-search
- **CONSOLIDATION_MAPPING**: Could not parse 10 dimensions; attempted formats: numbered-sections, table-rows, text-search
- **phenotype-ops-mcp**: Could not parse 10 dimensions; attempted formats: numbered-sections, table-rows, text-search
- **archived**: Could not parse 10 dimensions; attempted formats: numbered-sections, table-rows, text-search
- **agentapi-plusplus**: Could not parse 10 dimensions; attempted formats: numbered-sections, table-rows, text-search
- **org-github**: Could not parse 10 dimensions; attempted formats: numbered-sections, table-rows, text-search
- **thegent-dispatch**: Could not parse 10 dimensions; attempted formats: numbered-sections, table-rows, text-search
- **rich-cli-kit**: Could not parse 10 dimensions; attempted formats: numbered-sections, table-rows, text-search
- **thegent-workspace**: Could not parse 10 dimensions; attempted formats: numbered-sections, table-rows, text-search
- **PhenoHandbook**: Could not parse 10 dimensions; attempted formats: numbered-sections, table-rows, text-search
- **DevHex**: Could not parse 7 dimensions; attempted formats: numbered-sections, table-rows, text-search
- **portage**: Could not parse 10 dimensions; attempted formats: numbered-sections, table-rows, text-search
- **phenoSDK**: Could not parse 10 dimensions; attempted formats: numbered-sections, table-rows, text-search
- **governance_adoption**: Could not parse 10 dimensions; attempted formats: numbered-sections, table-rows, text-search
- **dep_alignment**: Could not parse 10 dimensions; attempted formats: numbered-sections, table-rows, text-search
- **phenoXdd**: Could not parse 10 dimensions; attempted formats: numbered-sections, table-rows, text-search
- **DataKit**: Could not parse 7 dimensions; attempted formats: numbered-sections, table-rows, text-search
- **kwality**: Could not parse 10 dimensions; attempted formats: numbered-sections, table-rows, text-search

## Formats Supported

Parser supports three dominant audit formats:

1. **Numbered Sections** (e.g., `## Dimension 1: Build & TypeCheck`) — text-block status
2. **Table Rows** (`| Dimension | Status | Notes |`) — per-row dimension mapping
3. **Scorecard Numeric** (`| Dimension | Score | Notes |`) — numeric scores (e.g., 7/10 → SHIPPED)

