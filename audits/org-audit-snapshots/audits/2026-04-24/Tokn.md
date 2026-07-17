# Audit: Tokn

**Date:** 2026-04-24 | **Repos:** Tokn | **Auditor:** Claude  
**LOC:** 23K | **Primary Languages:** Rust, Node | **Status:** BROKEN

## 10-Dimensional Scorecard

| Dimension | Status | Notes |
|-----------|--------|-------|
| **Build** | BROKEN | Cargo.toml parse error: virtual manifest has invalid [bench] section; blocks all Rust builds |
| **Tests** | SCAFFOLD | 1 test file present; blocked by Cargo.toml syntax error |
| **CI/CD** | SHIPPED | 21 workflows (heavy governance); template-commons integration; but build gate fails |
| **Docs** | SHIPPED | 94 doc files; comprehensive reference; README + SPEC + FUNCTIONAL_REQUIREMENTS.md |
| **Arch Debt** | MISSING | Unclear due to build block; likely modular but unverifiable |
| **FR Traceability** | SHIPPED | FUNCTIONAL_REQUIREMENTS.md exists; FR refs in code likely but unverifiable |
| **Velocity** | SHIPPED | Recent commits: governance standards, CI migration, legacy-enforcement |
| **Governance** | SHIPPED | AgilePlus spec dir; pre-commit; phenotype governance standards |
| **Dependencies** | SHIPPED | No obvious conflicts; deps structure sound (when build works) |
| **Honest Gaps** | BROKEN | Cargo.toml corruption blocks all downstream work; critical blocker |

## Key Findings

**Critical Blocker:** Cargo.toml [bench] section is invalid in virtual manifest. This is a syntax error introduced in a recent commit (likely during governance migration).

**Good News:**
- 94 docs (excellent documentation coverage)
- FUNCTIONAL_REQUIREMENTS.md present (full FR traceability)
- 21 workflows (heavy CI investment)

**Bad News:**
- Single syntax error blocks entire Rust workspace
- Only 1 test file suggests low test coverage despite heavy docs

## Consolidation Verdict

**KEEP** (unblock immediately)

- **Root cause:** Recent governance commit introduced [bench] to virtual manifest (invalid)
- **Fix:** Remove [bench] from root Cargo.toml; move to member crates if needed
- **Unique capability:** Token management (unclear from name alone; check README)
- **No merge target:** Likely core infrastructure piece; keep standalone

## Recommendations

1. **Immediate:** Fix Cargo.toml by removing [bench] section (2-minute fix)
2. **After unblock:** Run `cargo test --workspace` to verify test suite
3. **Expand tests:** 1 test file is insufficient for 23K LOC; aim for 10-15 test files
4. **CI gate fix:** Ensure CI tests catch Cargo.toml syntax errors before merge
