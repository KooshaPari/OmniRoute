# Phenotype Fleet DAG


## Stage 1

⬜ **task-01-01** — KWatch: checkout main, merge refactor branch changes, verify clean
✅ **task-01-02** — HeliosCLI: checkout main, apply uncommitted changes, verify clean
⬜ **task-01-03** — PolicyStack: checkout main, verify clean
⬜ **task-01-04** — KaskMan: checkout main, verify clean
⬜ **task-01-05** — portage: checkout main, apply uncommitted changes, verify clean
⬜ **task-01-06** — HeliosLab: checkout main, verify clean
⬜ **task-01-07** — agent-user-status: checkout main, verify clean
⬜ **task-01-08** — FocalPoint: checkout main, verify clean
⬜ **task-01-09** — PhenoMCP: checkout main, verify clean
⬜ **task-01-10** — phenoForge: checkout main, verify clean
⬜ **task-01-11** — phenotype-registry: checkout main, verify clean
⬜ **task-01-12** — phenotype-tooling: checkout main, verify clean
⬜ **task-01-13** — agslag-docs: checkout main, verify clean
⬜ **task-01-14** — Tokn: checkout main, apply uncommitted changes, verify clean
⬜ **task-01-15** — argis-extensions: checkout main, verify clean
⬜ **task-01-16** — agentapi-plusplus: checkout main, verify clean
⬜ **task-01-17** — cliproxyapi-plusplus: checkout main, apply uncommitted changes, verify clean
⬜ **task-01-18** — phenoResearchEngine: checkout main, verify clean
⬜ **task-01-19** — PhenoDevOps: checkout main, apply uncommitted changes, verify clean
⬜ **task-01-20** — helioscope: checkout main, apply uncommitted changes, verify clean

## Stage 2

🚫 **task-02-01** — HeliosCLI: pop/apply stashes, delete merged branches (reduce 3575)
⬜ **task-02-02** — cliproxyapi-plusplus: delete merged branches (reduce 556), pop stash
🚫 **task-02-03** — thegent: pop 2 stashes, delete merged branches (reduce 291)
🚫 **task-02-04** — portage: pop 3 stashes, delete merged branches (reduce 167)
🚫 **task-02-05** — agentapi-plusplus: delete merged branches (reduce 135)
🚫 **task-02-06** — AtomsBot: pop stash, delete merged branches
🚫 **task-02-07** — QuadSGM: pop 2 stashes
🚫 **task-02-08** — Dino: pop stash
🚫 **task-02-09** — Tracera: pop stash
🚫 **task-02-10** — chatta: pop stash
🚫 **task-02-11** — OmniRoute: pop stash
🚫 **task-02-12** — PhenoDevOps: pop 3 stashes
🚫 **task-02-13** — PhenoMCP: pop stash
🚫 **task-02-14** — phenoForge: pop stash
🚫 **task-02-15** — argis-extensions: pop stash
🚫 **task-02-16** — phenoResearchEngine: pop stash
🚫 **task-02-17** — agent-user-status: pop stash
🚫 **task-02-18** — PolicyStack: pop stash
🚫 **task-02-19** — KWatch: clean stale branches
🚫 **task-02-20** — HexaKit: clean stale branches (reduce 48)

## Stage 3

🚫 **task-03-01** — KWatch: add LICENSE-MIT + LICENSE-APACHE
🚫 **task-03-02** — OmniRoute: add LICENSE-MIT + LICENSE-APACHE
🚫 **task-03-03** — agslag-docs: add LICENSE-MIT + LICENSE-APACHE
🚫 **task-03-04** — KWatch: add .editorconfig
🚫 **task-03-05** — OmniRoute: add .editorconfig
🚫 **task-03-06** — chatta: add .editorconfig
🚫 **task-03-07** — KaskMan: add .editorconfig
🚫 **task-03-08** — phenoForge: add .editorconfig
🚫 **task-03-09** — phenotype-registry: add .editorconfig
🚫 **task-03-10** — FocalPoint: add .editorconfig
🚫 **task-03-11** — KWatch: add CHANGELOG.md
🚫 **task-03-12** — OmniRoute: add CHANGELOG.md
🚫 **task-03-13** — chatta: add CHANGELOG.md
🚫 **task-03-14** — KaskMan: add CHANGELOG.md
🚫 **task-03-15** — phenoForge: add CHANGELOG.md
🚫 **task-03-16** — phenotype-registry: add CHANGELOG.md
🚫 **task-03-17** — FocalPoint: add CHANGELOG.md
🚫 **task-03-18** — agslag-docs: add .editorconfig + CHANGELOG.md
🚫 **task-03-19** — phenotype-ops-mcp: add .editorconfig
🚫 **task-03-20** — phenotype-dep-guard: add .editorconfig

## Stage 4

🚫 **task-04-01** — KWatch: add Justfile + .github/workflows/ci.yml
🚫 **task-04-02** — OmniRoute: add Justfile + .github/workflows/ci.yml
🚫 **task-04-03** — chatta: add Justfile + .github/workflows/ci.yml
🚫 **task-04-04** — KaskMan: add Justfile + .github/workflows/ci.yml
🚫 **task-04-05** — phenoForge: add Justfile + .github/workflows/ci.yml
🚫 **task-04-06** — phenotype-registry: add Justfile + .github/workflows/ci.yml
🚫 **task-04-07** — FocalPoint: add Justfile + .github/workflows/ci.yml
🚫 **task-04-08** — agslag-docs: add Justfile + .github/workflows/ci.yml
🚫 **task-04-09** — AtomsBot: add CONTRIBUTING.md + SECURITY.md
🚫 **task-04-10** — PhenoMCP: add CONTRIBUTING.md + SECURITY.md
🚫 **task-04-11** — Parpoura: add CONTRIBUTING.md + SECURITY.md
🚫 **task-04-12** — byteport-landing: add CONTRIBUTING.md + SECURITY.md
🚫 **task-04-13** — phenokits-landing: add CONTRIBUTING.md + SECURITY.md
🚫 **task-04-14** — QuadSGM: add CONTRIBUTING.md + SECURITY.md
🚫 **task-04-15** — phenoResearchEngine: add CONTRIBUTING.md + SECURITY.md
🚫 **task-04-16** — argis-extensions: add CONTRIBUTING.md + SECURITY.md
🚫 **task-04-17** — agentapi-plusplus: add CONTRIBUTING.md + SECURITY.md
🚫 **task-04-18** — Tokn: add CONTRIBUTING.md + SECURITY.md
🚫 **task-04-19** — phenotype-tooling: add CONTRIBUTING.md + SECURITY.md
🚫 **task-04-20** — HeliosLab: add CONTRIBUTING.md + SECURITY.md

## Stage 5

🚫 **task-05-01** — KWatch: add docs/SSOT.md
🚫 **task-05-02** — OmniRoute: add docs/SSOT.md
🚫 **task-05-03** — chatta: add docs/SSOT.md
🚫 **task-05-04** — KaskMan: add docs/SSOT.md
🚫 **task-05-05** — phenoForge: add docs/SSOT.md
🚫 **task-05-06** — phenotype-registry: add docs/SSOT.md
🚫 **task-05-07** — FocalPoint: add docs/SSOT.md
🚫 **task-05-08** — agslag-docs: add docs/SSOT.md
🚫 **task-05-09** — HeliosCLI: add docs/SSOT.md
🚫 **task-05-10** — helioscope: add docs/SSOT.md
🚫 **task-05-11** — portage: add docs/SSOT.md
🚫 **task-05-12** — PolicyStack: add docs/SSOT.md
🚫 **task-05-13** — Dino: add docs/SSOT.md
🚫 **task-05-14** — Tracera: add docs/SSOT.md
🚫 **task-05-15** — thegent: add docs/SSOT.md
🚫 **task-05-16** — PhenoDevOps: add docs/SSOT.md
🚫 **task-05-17** — AtomsBot: add docs/SSOT.md
🚫 **task-05-18** — PhenoMCP: add docs/SSOT.md
🚫 **task-05-19** — agent-user-status: add docs/SSOT.md
🚫 **task-05-20** — phenoResearchEngine: add docs/SSOT.md
