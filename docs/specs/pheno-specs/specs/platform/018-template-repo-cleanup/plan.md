# Plan: Template Repo Cleanup — Consolidate 27 Template Repositories

## Phase 1: Audit and Hexagonal Merges
- [x] WP-001: Audit All 14 hexagon-* and Hexa* Repos — Identify Duplicates
  - 6 local repos audited, 21 GitHub-only repos discovered
  - 3 fixable issues found and fixed (CI version mismatch, type errors, placeholder CI)
  - 1 broken repo identified (Hexacore — all workspace members missing)
  - 1 archived repo confirmed (phenotype-design)
  - Duplicate pairs documented in worklog
- [ ] WP-002: Merge hexagon-* + Hexa* Duplicates into Single Template Set
  - PRs created: HexaGo#2, HexaType#3, phenotype-design#28
  - Remaining: merge HexaPy→hexagon-python, hexagon-rs→hexagon-rust, fix Hexacore

## Phase 2: Language Templates and Generator
- [ ] WP-003: Audit All 13 template-lang-* Repos — Consolidate Generators
  - Only template-lang-typescript exists locally; 12 others on GitHub only
  - template-lang-go is private; others are public
- [ ] WP-004: Create Single Template Generator Tool
- [ ] WP-005: Document Remaining Templates and Create Registry

## Dependencies
- 012-github-portfolio-triage (portfolio-wide archival)
- 019-private-repo-catalog (private template repos)
- 001-spec-driven-development-engine (spec-driven workflow)

## Timeline
- Phase 1: Week 1-4
- Phase 2: Week 4-6
