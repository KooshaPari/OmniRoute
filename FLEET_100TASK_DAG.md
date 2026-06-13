# Phenotype Fleet-Wide 100-Task Modernization DAG

## Overview

This DAG orchestrates 100+ tasks across 5 stages with 20 parallel lanes, plus a side-DAG backfill pool of 60 tasks for gap filling.

**Implementation:** The DAG is managed by `dagctl` (Go binary), a headless, stateless multi-agent orchestrator using SQLite with WAL mode for state storage.

## Architecture

- **Language:** Go (chosen over Rust for compilation speed, ecosystem maturity, and SQLite driver support)
- **State:** Single SQLite file (`FLEET_DAG.db`) with WAL mode
- **Concurrency:** POSIX `flock` + SQLite `BEGIN IMMEDIATE` transactions
- **Deduplication:** Hybrid token-Jaccard + Levenshtein + repo overlap
- **Crash Recovery:** Heartbeat-based stale claim reclamation
- **Width Gaps:** Side-DAG back-fill queue

## dagctl Commands

```bash
# Initialize DAG database
./dagctl init -db FLEET_DAG.db -width 20 -stages 5

# Seed tasks (100 core + 60 side DAG)
./dagctl seed -db FLEET_DAG.db

# Scan local and remote repos
./dagctl scan -db FLEET_DAG.db

# Agent picks next task (atomic, respects repo/branch claims)
./dagctl pick -db FLEET_DAG.db -agent alpha

# Agent claims repo/branch ownership
./dagctl claim -db FLEET_DAG.db -agent alpha -repo KWatch
./dagctl claim -db FLEET_DAG.db -agent alpha -repo KWatch -branch main

# Agent releases all claims
./dagctl release -db FLEET_DAG.db -agent alpha

# Mark task done/failed
./dagctl done -db FLEET_DAG.db -agent alpha -task task-01-01
./dagctl fail -db FLEET_DAG.db -agent alpha -task task-01-01

# Add new task with dedup check
./dagctl add -db FLEET_DAG.db -desc "Audit: verify Dockerfiles" -repo KWatch

# Detect fuzzy duplicates
./dagctl dupes -db FLEET_DAG.db

# Merge duplicate task
./dagctl merge -db FLEET_DAG.db -task side-01 -into task-01-01

# Fill width gaps from side-DAG
./dagctl fill -db FLEET_DAG.db -agent alpha

# Status, validate, export
./dagctl status -db FLEET_DAG.db
./dagctl validate -db FLEET_DAG.db
./dagctl export -db FLEET_DAG.db -out FLEET_DAG.md

# Next N ready tasks
./dagctl next -db FLEET_DAG.db -agent alpha -n 5

# Heartbeat (prevents stale reclamation)
./dagctl heartbeat -db FLEET_DAG.db -agent alpha
```

## Core DAG (100 tasks)

### Stage 1: State Unification (20 tasks)
1. KWatch: checkout main, merge refactor branch changes, verify clean
2. HeliosCLI: checkout main, apply uncommitted changes, verify clean
3. PolicyStack: checkout main, verify clean
4. KaskMan: checkout main, verify clean
5. portage: checkout main, apply uncommitted changes, verify clean
6. HeliosLab: checkout main, verify clean
7. agent-user-status: checkout main, verify clean
8. FocalPoint: checkout main, verify clean
9. PhenoMCP: checkout main, verify clean
10. phenoForge: checkout main, verify clean
11. phenotype-registry: checkout main, verify clean
12. phenotype-tooling: checkout main, verify clean
13. agslag-docs: checkout main, verify clean
14. Tokn: checkout main, apply uncommitted changes, verify clean
15. argis-extensions: checkout main, verify clean
16. agentapi-plusplus: checkout main, verify clean
17. cliproxyapi-plusplus: checkout main, apply uncommitted changes, verify clean
18. phenoResearchEngine: checkout main, verify clean
19. PhenoDevOps: checkout main, apply uncommitted changes, verify clean
20. helioscope: checkout main, apply uncommitted changes, verify clean

### Stage 2: Stash Resolution + Branch Hygiene (20 tasks)
21. HeliosCLI: pop/apply stashes, delete merged branches (reduce 3575)
22. cliproxyapi-plusplus: delete merged branches (reduce 556), pop stash
23. thegent: pop 2 stashes, delete merged branches (reduce 291)
24. portage: pop 3 stashes, delete merged branches (reduce 167)
25. agentapi-plusplus: delete merged branches (reduce 135)
26. AtomsBot: pop stash, delete merged branches
27. QuadSGM: pop 2 stashes
28. Dino: pop stash
29. Tracera: pop stash
30. chatta: pop stash
31. OmniRoute: pop stash
32. PhenoDevOps: pop 3 stashes
33. PhenoMCP: pop stash
34. phenoForge: pop stash
35. argis-extensions: pop stash
36. phenoResearchEngine: pop stash
37. agent-user-status: pop stash
38. PolicyStack: pop stash
39. KWatch: clean stale branches
40. HexaKit: clean stale branches (reduce 48)

### Stage 3: Governance (20 tasks)
41. KWatch: add LICENSE-MIT + LICENSE-APACHE
42. OmniRoute: add LICENSE-MIT + LICENSE-APACHE
43. agslag-docs: add LICENSE-MIT + LICENSE-APACHE
44. KWatch: add .editorconfig
45. OmniRoute: add .editorconfig
46. chatta: add .editorconfig
47. KaskMan: add .editorconfig
48. phenoForge: add .editorconfig
49. phenotype-registry: add .editorconfig
50. FocalPoint: add .editorconfig
51. KWatch: add CHANGELOG.md
52. OmniRoute: add CHANGELOG.md
53. chatta: add CHANGELOG.md
54. KaskMan: add CHANGELOG.md
55. phenoForge: add CHANGELOG.md
56. phenotype-registry: add CHANGELOG.md
57. FocalPoint: add CHANGELOG.md
58. agslag-docs: add .editorconfig + CHANGELOG.md
59. phenotype-ops-mcp: add .editorconfig
60. phenotype-dep-guard: add .editorconfig

### Stage 4: Tooling + Security (20 tasks)
61. KWatch: add Justfile + .github/workflows/ci.yml
62. OmniRoute: add Justfile + .github/workflows/ci.yml
63. chatta: add Justfile + .github/workflows/ci.yml
64. KaskMan: add Justfile + .github/workflows/ci.yml
65. phenoForge: add Justfile + .github/workflows/ci.yml
66. phenotype-registry: add Justfile + .github/workflows/ci.yml
67. FocalPoint: add Justfile + .github/workflows/ci.yml
68. agslag-docs: add Justfile + .github/workflows/ci.yml
69. AtomsBot: add CONTRIBUTING.md + SECURITY.md
70. PhenoMCP: add CONTRIBUTING.md + SECURITY.md
71. Parpoura: add CONTRIBUTING.md + SECURITY.md
72. byteport-landing: add CONTRIBUTING.md + SECURITY.md
73. phenokits-landing: add CONTRIBUTING.md + SECURITY.md
74. QuadSGM: add CONTRIBUTING.md + SECURITY.md
75. phenoResearchEngine: add CONTRIBUTING.md + SECURITY.md
76. argis-extensions: add CONTRIBUTING.md + SECURITY.md
77. agentapi-plusplus: add CONTRIBUTING.md + SECURITY.md
78. Tokn: add CONTRIBUTING.md + SECURITY.md
79. phenotype-tooling: add CONTRIBUTING.md + SECURITY.md
80. HeliosLab: add CONTRIBUTING.md + SECURITY.md

### Stage 5: SSOT + Docs + Final Verification (20 tasks)
81. KWatch: add docs/SSOT.md
82. OmniRoute: add docs/SSOT.md
83. chatta: add docs/SSOT.md
84. KaskMan: add docs/SSOT.md
85. phenoForge: add docs/SSOT.md
86. phenotype-registry: add docs/SSOT.md
87. FocalPoint: add docs/SSOT.md
88. agslag-docs: add docs/SSOT.md
89. HeliosCLI: add docs/SSOT.md
90. helioscope: add docs/SSOT.md
91. portage: add docs/SSOT.md
92. PolicyStack: add docs/SSOT.md
93. Dino: add docs/SSOT.md
94. Tracera: add docs/SSOT.md
95. thegent: add docs/SSOT.md
96. PhenoDevOps: add docs/SSOT.md
97. AtomsBot: add docs/SSOT.md
98. PhenoMCP: add docs/SSOT.md
99. agent-user-status: add docs/SSOT.md
100. phenoResearchEngine: add docs/SSOT.md

## Side DAG (60 tasks)

The side DAG contains additional tasks for gap filling, audits, SOTA research, and guardrails. These are promoted to the main DAG when a stage has fewer than 20 ready tasks.

### Side DAG Examples
- Audit: verify all Dockerfiles use multi-stage builds
- Audit: verify all GitHub Actions use pinned action versions
- SOTA research: evaluate QUIC for inter-service mesh transport
- SOTA research: evaluate io_uring for async disk I/O
- Guardrail: add commit-msg hook for Conventional Commits
- Guardrail: add pre-commit hook for cargo fmt/clippy

## Repo Inventory

- **Local Repos:** 316 (scanned from `/Users/kooshapari/CodeProjects/Phenotype/repos`)
- **Remote Repos:** 64 (scanned from GitHub via `gh` CLI)
- **Total:** 380 repos

## Concurrency & Deduplication

- **Max Parallelism:** 20 agents (configurable via `-width`)
- **Claim Blocking:** Agents cannot pick tasks for repos/branches claimed by other agents
- **Fuzzy Deduplication:** Hybrid similarity (Jaccard + word overlap + repo match) with threshold 0.75
- **Stale Reclamation:** 1-hour timeout (configurable via `StaleThresholdMin`)

## Validation

```bash
./dagctl validate -db FLEET_DAG.db
```

Checks:
- Duplicate task IDs
- Dangling edges
- Stage width compliance
- Cycle detection (DFS)

## Build

```bash
go build -mod=mod -o dagctl .
```

## Dependencies

- `modernc.org/sqlite` (pure Go SQLite driver)
- `gh` CLI (optional, for remote repo scanning)
- `git` (for local repo scanning)

## State File

- **Path:** `FLEET_DAG.db` (configurable via `-db` or `DAG_DB` env var)
- **Lock File:** `FLEET_DAG.db.lock` (POSIX flock)
- **WAL Mode:** Enabled for concurrent read/write

## License

MIT + Apache-2.0
