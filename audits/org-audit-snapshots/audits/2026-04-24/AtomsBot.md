# Audit: AtomsBot

**Date:** 2026-04-24 | **Repos:** AtomsBot | **Auditor:** Claude  
**LOC:** 188K | **Primary Language:** Node | **Status:** SCAFFOLD

## 10-Dimensional Scorecard

| Dimension | Status | Notes |
|-----------|--------|-------|
| **Build** | SHIPPED | Node/npm build succeeds; no Cargo, Go, or Rust compilation |
| **Tests** | SCAFFOLD | 29 test files present; mostly Discord/GitHub integration stubs |
| **CI/CD** | SCAFFOLD | 2 workflows (.github/workflows); minimal coverage (no lint/format gates) |
| **Docs** | SHIPPED | 31 docs; README (detailed feature matrix), SPEC.md, PLAN.md present |
| **Arch Debt** | SCAFFOLD | Discord bot bridge pattern is clear; no obvious monolith; async handlers well-separated |
| **FR Traceability** | MISSING | No FUNCTIONAL_REQUIREMENTS.md; SPEC.md acts as surrogate but lacks test refs |
| **Velocity** | SHIPPED | Recent commits: AgilePlus scaffolding, CI gate addition, docs push |
| **Governance** | SHIPPED | AgilePlus spec dir present; pre-commit hooks, coderabbit config |
| **Dependencies** | SHIPPED | Standard discord.js + github API client deps; no duplication detected |
| **Honest Gaps** | SCAFFOLD | Bidirectional sync incomplete (GitHub→Discord comment sync pending); half-featured |

## Key Findings

**Use Case:** Discord bot managing GitHub issues via threads; two-way sync bridge.

**Status:** ~60% feature-complete (features marked [ ] in README are not yet shipped).

**Test Gap:** 29 test files but mostly integration test scaffolds; unit test coverage sparse.

**No FR Document:** Should create FUNCTIONAL_REQUIREMENTS.md to codify "sync events" acceptance criteria.

## Consolidation Verdict

**MERGE INTO → phenotype-discord-kit**

- **Rationale:** This is a specialized Discord bot for issue management; non-unique capability
- **Target Collection:** `phenotype-discord-kit` (new productized collection for Discord integrations)
- **Scope:** AtomsBot becomes a reference implementation; core bridge logic extracted to kit
- **Dependencies:** Requires extraction of `pkg/discord/github-sync` pattern

## Recommendations

1. **Add FUNCTIONAL_REQUIREMENTS.md:** Codify 16 feature matrix items as FRs; mark shipped/pending
2. **Expand CI:** Add Node lint (eslint) + format (prettier) gates
3. **Complete bidirectional sync:** GitHub→Discord comment/label/status (blocking for full feature)
4. **Test coverage:** Aim for 70%+ on sync handlers; add mock Discord/GitHub clients
