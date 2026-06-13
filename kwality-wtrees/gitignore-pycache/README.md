# Kwality

**LLM Validation & Quality Assurance Platform** — An archived experimental framework for AI code validation, test quality assessment, and knowledge graph-based requirements tracing using DeepEval, Playwright MCP, and Neo4j.

> **⚠️ ARCHIVED** — This project is preserved for historical and research reference only. Do not delete or unarchive without explicit authorization. Not maintained; use Phenotype ecosystem tooling for current quality assurance and validation work.

## Overview

Kwality was an exploratory project investigating automated AI code validation and LLM-based quality assurance. It pioneered several techniques now adopted across the Phenotype ecosystem:

- **AI Test Evaluation** — DeepEval framework for assessing test quality, coverage, and effectiveness
- **Browser Automation MCP** — Playwright integration as an MCP tool for automated UI testing
- **Knowledge Graphs** — Neo4j-based requirement tracing and test coverage mapping

While the project itself is archived, concepts from Kwality influenced production systems in the Phenotype ecosystem.

## Technology Stack

- **Language**: Python 3.9+
- **LLM Framework**: DeepEval (for test evaluation)
- **Browser Automation**: Playwright + Playwright MCP
- **Knowledge Graph**: Neo4j (for requirement tracing)
- **API**: FastAPI (if API server was present)

## Original Purpose

Kwality explored three key research areas:

1. **AI-Driven Test Quality Assessment**
   - Evaluate test cases for comprehensiveness
   - Measure test coverage semantically (not just line coverage)
   - Suggest test improvements using LLMs

2. **Browser Automation via MCP**
   - Playwright as an MCP server tool
   - UI testing through language models
   - Visual assertion validation

3. **Semantic Requirement Tracing**
   - Neo4j knowledge graphs for FR mapping
   - Trace code <-> tests <-> requirements
   - Identify coverage gaps via graph queries

## Key Insights (Research Outputs)

- **DeepEval Integration**: Validated that LLMs can effectively assess test quality beyond syntax
- **MCP Browser Tool**: Demonstrated feasibility of Playwright-as-a-service via MCP protocol
- **Knowledge Graphs for Tracing**: Graph-based traceability outperforms string matching for FR coverage

These insights have been incorporated into:
- **Benchora** — FR traceability and validation framework (successor)
- **phenotype-shared** — Shared testing utilities and frameworks
- **PhenoObservability** — Knowledge graph-based observability
- **Tracera** — Distributed tracing with Neo4j backend

## Project Structure (As Archived)

```
kwality/
├── src/
│   ├── main.py               # Entry point
│   ├── deepeval_client.py    # DeepEval integration
│   ├── playwright_mcp.py     # Playwright MCP server
│   ├── neo4j_graph.py        # Knowledge graph ops
│   └── evaluators/           # Custom DeepEval evaluators
├── tests/
│   └── test_validation.py    # Test quality validation tests
├── prompts/                  # LLM prompt templates
├── requirements.txt          # Python dependencies
└── README.md
```

## Why It Was Archived

1. **Resource Allocation**: Shifted focus to production systems (Benchora, Tracera)
2. **Complexity**: DeepEval + Neo4j + Playwright MCP proved overkill for initial use cases
3. **Maintainability**: No ongoing maintenance resources for experimental projects
4. **Consolidation**: FR traceability moved to Benchora, test evaluation to phenotype-shared

## Migration Path (For Related Work)

If you need similar capabilities, consult:

| Need | Use | Notes |
|------|-----|-------|
| FR Traceability | **Benchora** | Production-grade FR coverage validation |
| Test Quality | **phenotype-shared** | Testing utilities and fixtures |
| Observability | **Tracera** + **Neo4j** | Production observability with knowledge graphs |
| Browser Automation | **Playwright MCP** | Standalone MCP tool for browser testing |
| LLM Evaluation | **cheap-llm-mcp** | Model routing and cost-sensitive eval |

## Research Contributions

Kwality's key findings are documented in:
- `/repos/docs/research/ai-test-evaluation-research.md` (if available)
- Benchora SOTA.md references Kwality experiments
- PhenoObservability ADR records use Kwality insights

## Preservation Guidelines

This repository is preserved under the following constraints:

- **Do NOT delete** — Historical reference and research artifact
- **Do NOT unarchive** — Unless explicitly authorized and resource-committed
- **Do NOT update** — No maintenance; snapshot as of 2026-04-XX
- **DO reference** — Link to from successor projects for context
- **DO cite** — Academic or internal papers referencing this work

## Related Phenotype Projects (Successors)

- **Benchora** — FR validation framework (successor to FR traceability research)
- **phenotype-shared** — Testing utilities extracted from Kwality
- **Tracera** — Distributed tracing with knowledge graphs (successor to Neo4j research)
- **PhenoObservability** — Production observability stack (consumer of Kwality insights)

## Archived Project Contact

For questions about Kwality's research or to request unarchival:
- Contact: Phenotype Architecture Team
- See: `/repos/AgilePlus` for governance and team structure
- Reference: Kwality in AgilePlus audit trail for context

## License

MIT — Archived research project, available for reference and study.

---

**Last Updated**: 2026-04-XX (archived snapshot)  
**Status**: 🔴 Archived — Read-only, preserved for reference  
**Maintenance**: None — No active development

## License

MIT — see [LICENSE](./LICENSE).
