# DAG-V5: Consolidated Execution Plan — 2026-06-15

## Goal
Execute remaining waves across 5 active repositories (Tasken, AgilePlus, dispatch-mcp, thegent-dispatch, cheap-llm-mcp) after initial stabilization, achieving SOTA quality, libification, cross-repo dedup, and full traceability.

## Repository State Summary
| Repo | Status | Next Action |
|------|--------|-------------|
| Tasken | CLI wired, 67 tests pass, pushed to main | SOTA features (arg forwarding, DAG, cache persist, error handling) |
| AgilePlus | Compilation fixed, merged to main | Feature audit, gap fixes, CLI completion |
| dispatch-mcp | Compiled, needs protocol compliance + test coverage | LlamaCppProvider migration from cheap-llm-mcp, protocol fixes |
| thegent-dispatch | Cleaned up (main), archived | Archive or merge into OmniRoute |
| cheap-llm-mcp | DEPRECATED | Migrate features → dispatch-mcp, then archive |

## DAG Layout (20 wide × 6 deep = 120 tasks)

### W1: cheap-llm-mcp → dispatch-mcp Migration (20 tasks)
1. Create feat/llama-cpp-provider branch in dispatch-mcp worktree
2. Copy model.py → LlamaCppProvider skeleton
3. Implement generate() async wrapper
4. Implement stream_generate() async wrapper
5. Add provider registration in __init__.py
6. Add LlamaCppSettings to dispatch-mcp settings.py
7. Wire provider into chat routes
8. Wire provider into completion routes
9. Maintain backward compat with existing providers
10. Copy Dockerfile → docker/llama-cpp/Dockerfile
11. Add model pull CLI subcommand
12. Port config tests to dispatch-mcp
13. Port model tests (mocked)
14. Port router tests
15. Implement streaming correctness tests
16. Container build test
17. Deprecation notice in cheap-llm-mcp README
18. Move cheap-llm-mcp LICENSE reference
19. Update dispatch-mcp docs with provider guide
20. Final CI check on dispatch-mcp

### W2: dispatch-mcp Protocol Compliance + Test Coverage (20 tasks)
1. Audit MCP protocol compliance gaps
2. Implement full handshake sequence
3. Add type annotations for message schemas
4. Add protocol-version discovery endpoint
5. Implement delta encoding for file transfers
6. Add exponential backoff reconnection
7. Implement circuit breaker pattern
8. Add message queue persistence
9. Implement priority queue (system > default > batch)
10. Add proptest property-based testing
11. Add cargo-fuzz for parsing validation
12. Add integration test suite (Docker-based MCP clients)
13. Implement cost calculator middleware
14. Implement budget enforcement
15. Add usage quota system
16. Add audit trail for model selections
17. Generate full API docs
18. Create user guide with code examples
19. Performance benchmarking
20. Final CI + coverage report (>80%)

### W3: Tasken SOTA Features (20 tasks)
1. Add argument forwarding (-- separator) to CLI
2. Implement topological sort for task dependency DAG
3. Add variable interpolation ({{ .VAR }} syntax)
4. Implement shell switching (per-task shell definition)
5. Add Cache persistence (disk-backed, not just in-memory)
6. Implement max-parallel concurrency control
7. Add signal handling (graceful Ctrl+C shutdown)
8. Implement error differentiation (task vs runner errors)
9. Add contextual error messages (which file, which line)
10. Strict stdout/stderr separation
11. Add pre-task / post-task hooks
12. Add task recipes/templates (std lib of common tasks)
13. Cross-platform test coverage (Unix + Windows parity)
14. Add assert_cmd + predicates for golden file tests
15. Benchmark suite for execution throughput
16. Add environment variable inheritance tests
17. Add concurrency race condition tests
18. Implement Wasm plugin architecture (basic)
19. Add dependency graph UI (Mermaid export)
20. Final cargo test + check + clippy

### W4: AgilePlus Feature Completion + Libification (20 tasks)
1. Audit all CLI subcommands for completeness
2. Fix agileplus-triage bitvec dep properly
3. Complete worklog/SSOT features
4. Add status tracking with capacity planning
5. Add buffer management for work items
6. Implement role-based access stubs
7. Expand test coverage to >70%
8. Add integration tests for CLI workflows
9. Fix dependency hygiene (upgrade outdated deps)
10. Audit and fix documentation gaps
11. Add rustdoc examples for public API
12. Generate CLI man page
13. Add pre-commit hook configuration
14. Add justfile adoption
15. Add deny.toml for supply chain security
16. Add CI workflow for test + lint + coverage
17. Cross-repo libification: extract shared scheduler logic from Tasken + AgilePlus
18. Cross-repo libification: extract shared CLI patterns into pheno-cli-base
19. Cross-repo libification: extract shared error types into pheno-errors
20. Final cargo check + test + clippy

### W5: thegent-dispatch Cleanup + Tooling Modernization (20 tasks)
1. Determine if thegent-dispatch should be archived
2. If keeping: fix Rust compilation errors
3. Add deny.toml if keeping
4. Add justfile if keeping
5. Add CI workflow if keeping
6. Check for duplication with OmniRoute dispatch system
7. Merge unique features into OmniRoute or archive
8. Tooling: Add justfile to Tasken
9. Tooling: Add deny.toml to Tasken
10. Tooling: Add justfile to AgilePlus
11. Tooling: Add justfile to dispatch-mcp
12. Tooling: Add pre-commit-config to Tasken
13. Tooling: Add pre-commit-config to AgilePlus
14. Tooling: pre-commit-config to dispatch-mcp
15. Tooling: CI workflow standardization across repos
16. Tooling: Add rust-toolchain.toml where missing
17. Tooling: Standardize on nightly fmt + clippy
18. Tooling: Add cargo-deny CI step to all repos
19. Tooling: Add coverage reporting to all CI pipelines
20. Verify all CI pipelines green

### W6: SSOT + Traceability + DAG Completion (20 tasks)
1. Create Tasken worklog (worklog-L5-092-2026-06-15.json)
2. Create AgilePlus worklog
3. Create dispatch-mcp worklog
4. Create Tasken QA matrix
5. Create AgilePlus QA matrix
6. Create dispatch-mcp QA matrix
7. Generate coverage report for Tasken
8. Generate coverage report for AgilePlus
9. Generate coverage report for dispatch-mcp
10. Cross-repo duplication report
11. Cross-repo libification opportunities document
12. ADR for cheap-llm-mcp deprecation
13. ADR for dispatch-mcp consolidation
14. ADR for Tasken architecture decisions
15. Architecture diagram update
16. Final DAG state audit
17. PR review for all branches
18. Merge all completed branches to main
19. Tag release v0.1.0 for Tasken
20. Summary report for user

## Success Criteria
- [ ] All 5 repos compilable (cargo check passes)
- [ ] Tasken: 80+ tests pass, CLI fully functional
- [ ] AgilePlus: 40+ tests pass, all CLI commands work
- [ ] dispatch-mcp: 80%+ test coverage, protocol compliant
- [ ] cheap-llm-mcp: Features migrated to dispatch-mcp, repo archived
- [ ] thegent-dispatch: Archived or merged into OmniRoute
- [ ] All repos have: justfile, deny.toml, rust-toolchain.toml, CI workflow
- [ ] Worklogs + QA matrix + coverage reports generated
- [ ] Cross-repo duplication documented with libification plan
