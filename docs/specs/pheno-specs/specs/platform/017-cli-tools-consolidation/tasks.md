# Work Packages: CLI Tools Consolidation — Consolidate Across 7 Repositories

**Inputs**: Design documents from `kitty-specs/017-cli-tools-consolidation/`
**Prerequisites**: spec.md, Rust toolchain, TypeScript/Node, Go toolchain
**Scope**: Cross-repo (7 repositories): cliproxyapi-plusplus, agentapi-plusplus, Cmdra, forgecode, thegent-sharecli, thegent-cli-share, thegent-subprocess

---

## WP-001: cliproxyapi-plusplus — Complete LLM Proxy with 8+ Providers

- **State:** planned
- **Sequence:** 1
- **File Scope:** cliproxyapi-plusplus repository (src/, tests/, docs/)
- **Acceptance Criteria:**
  - LLM proxy supporting 8+ providers (OpenAI, Anthropic, Google, Mistral, Cohere, Groq, Ollama, local)
  - Request routing, rate limiting, and retry logic per provider
  - Response streaming support for all providers
  - Provider-agnostic API with consistent error handling
  - Integration hooks for agentapi-plusplus
  - ≥80% test coverage on proxy core
  - All quality checks passing
- **Estimated Effort:** L

Complete cliproxyapi-plusplus as the LLM proxy with support for 8+ providers. This serves as the unified interface for all LLM API calls, handling provider-specific quirks, rate limiting, retries, and streaming. It integrates with agentapi-plusplus for agent-facing API access.

### Subtasks
- [ ] T001 Audit current cliproxyapi-plusplus: existing providers, gaps, architecture
- [ ] T002 Design provider abstraction: unified request/response types, provider-specific adapters
- [ ] T003 Implement OpenAI provider adapter (chat completions, embeddings, streaming)
- [ ] T004 Implement Anthropic provider adapter (messages, streaming)
- [ ] T005 Implement Google, Mistral, Cohere provider adapters
- [ ] T006 Implement Groq, Ollama, and local model provider adapters
- [ ] T007 Implement request routing: select provider based on model, fallback chain
- [ ] T008 Implement rate limiting: per-provider limits, token bucket algorithm
- [ ] T009 Implement retry logic: exponential backoff, circuit breaker for failing providers
- [ ] T010 Implement response streaming: SSE for all providers, unified stream format
- [ ] T011 Define integration API for agentapi-plusplus
- [ ] T012 Write unit tests for each provider adapter (target: ≥80% coverage)
- [ ] T013 Write integration tests: proxy requests to mock providers, verify routing
- [ ] T014 Add documentation: provider configuration, rate limiting setup, streaming guide
- [ ] T015 Run quality checks: `cargo test` / `npm test`, linter, formatter

### Dependencies
- None (can start independently)

### Risks & Mitigations
- Provider API changes: Abstract provider interfaces, test against provider SDKs
- Rate limit complexity: Use well-tested rate limiting library, document limits per provider

---

## WP-002: agentapi-plusplus — Complete HTTP API for CLI Agents

- **State:** planned
- **Sequence:** 2
- **File Scope:** agentapi-plusplus repository (src/, tests/, docs/)
- **Acceptance Criteria:**
  - Complete HTTP API for CLI agent interactions (dispatch, status, results)
  - No functionality duplication with cliproxyapi-plusplus (clear boundary: proxy vs. agent API)
  - Authentication and authorization for API endpoints
  - WebSocket support for real-time agent status updates
  - Integration with cliproxyapi-plusplus for LLM calls
  - ≥80% test coverage on API handlers
  - All quality checks passing
- **Estimated Effort:** M

Complete agentapi-plusplus as the HTTP API for CLI agent interactions. This API handles agent dispatch, status queries, and result retrieval — distinct from cliproxyapi-plusplus which handles LLM proxying. The two components integrate but have clear boundaries.

### Subtasks
- [ ] T016 Audit current agentapi-plusplus: existing endpoints, gaps, overlap with cliproxyapi
- [ ] T017 Define API boundary: what belongs in agent API vs. LLM proxy
- [ ] T018 Implement agent dispatch endpoint: create agent task, assign to cliproxyapi
- [ ] T019 Implement agent status endpoint: query running/complete/failed agents
- [ ] T020 Implement agent results endpoint: retrieve agent output, artifacts
- [ ] T021 Implement authentication: API key validation, role-based access
- [ ] T022 Implement WebSocket endpoint: real-time agent status streaming
- [ ] T023 Integrate with cliproxyapi-plusplus: route LLM calls through proxy
- [ ] T024 Write unit tests for API handlers (target: ≥80% coverage)
- [ ] T025 Write integration tests: full agent lifecycle via HTTP API
- [ ] T026 Add API documentation: OpenAPI spec, endpoint examples
- [ ] T027 Run quality checks: `cargo test` / `npm test`, linter, formatter

### Dependencies
- WP-001 (cliproxyapi-plusplus integration API defined)

### Risks & Mitigations
- API boundary confusion: Clear documentation, separate codebases, integration tests verify boundaries
- WebSocket scalability: Document connection limits, implement connection pooling

---

## WP-003: Cmdra — Universal CLI Framework Completion

- **State:** planned
- **Sequence:** 3
- **File Scope:** Cmdra repository (src/, tests/, docs/)
- **Acceptance Criteria:**
  - Complete CLI framework with command registration, argument parsing, and help generation
  - Plugin system for CLI extensions
  - Consistent command patterns: subcommands, flags, positional args
  - Adoption by all other CLI tools in this spec (cliproxyapi, agentapi, forgecode)
  - ≥80% test coverage on framework core
  - All quality checks passing
- **Estimated Effort:** L

Complete Cmdra as the universal CLI framework adopted by all CLI tools in this consolidation. Cmdra provides command registration, argument parsing, help generation, and a plugin system for extensions. All other CLI tools migrate to use Cmdra as their framework.

### Subtasks
- [ ] T028 Audit current Cmdra: existing framework code, gaps, plugin system status
- [ ] T029 Complete command registration: hierarchical commands, subcommands, aliases
- [ ] T030 Complete argument parsing: flags, positional args, validation, defaults
- [ ] T031 Implement help generation: auto-generated from command metadata, formatted output
- [ ] T032 Implement plugin system: discover, load, and register CLI plugins
- [ ] T033 Implement consistent command patterns: before/after hooks, error handling
- [ ] T034 Implement configuration loading: per-command config, global config, env vars
- [ ] T035 Write unit tests for framework core (target: ≥80% coverage)
- [ ] T036 Write integration tests: register commands, parse args, execute with plugins
- [ ] T037 Add comprehensive rustdoc with CLI framework usage guide
- [ ] T038 Run quality checks: `cargo test`, `cargo clippy -- -D warnings`, `cargo fmt`

### Dependencies
- None (can start in parallel with WP-001)

### Risks & Mitigations
- Framework adoption resistance: Provide migration guides, backward-compatible adapters
- Plugin system complexity: Start simple (file-based discovery), add advanced features incrementally

---

## WP-004: forgecode — Git Workflow Framework Completion

- **State:** planned
- **Sequence:** 4
- **File Scope:** forgecode repository (src/, tests/, docs/)
- **Acceptance Criteria:**
  - Complete git workflow framework: branch management, PR creation, review loops
  - Integrated with Cmdra CLI framework (forgecode commands use Cmdra)
  - Conventional commit enforcement
  - Worktree management for parallel development
  - ≥80% test coverage on workflow core
  - All quality checks passing
- **Estimated Effort:** M

Complete forgecode as the git workflow framework, integrated with Cmdra. forgecode handles branch management, PR creation, review loops, and worktree operations — all accessible through Cmdra-based CLI commands.

### Subtasks
- [ ] T039 Audit current forgecode: existing workflows, gaps, Cmdra integration status
- [ ] T040 Complete branch workflow: create branch from spec, checkout, merge to target
- [ ] T041 Complete PR workflow: create PR with structured description, set reviewers
- [ ] T042 Implement review loop: poll for reviews, feed comments back to agent, re-push
- [ ] T043 Implement conventional commit enforcement: validate commit messages, auto-fix
- [ ] T044 Implement worktree management: create, list, cleanup worktrees
- [ ] T045 Integrate with Cmdra: register forgecode commands as Cmdra plugins
- [ ] T046 Write unit tests for git workflows (target: ≥80% coverage)
- [ ] T047 Write integration tests with real git repositories (temp repos)
- [ ] T048 Add documentation: workflow configuration, Cmdra integration guide
- [ ] T049 Run quality checks: `cargo test`, `cargo clippy -- -D warnings`, `cargo fmt`

### Dependencies
- WP-003 (Cmdra framework available for integration)

### Risks & Mitigations
- Git operation complexity: Use git2 crate, test on macOS and Linux
- Review loop reliability: Implement timeout, max retry count, graceful failure

---

## WP-005: Deduplicate thegent-sharecli vs thegent-cli-share — Merge or Delete One

- **State:** planned
- **Sequence:** 5
- **File Scope:** thegent-sharecli repository, thegent-cli-share repository
- **Acceptance Criteria:**
  - Decision documented: which repo is kept, which is archived, rationale
  - All functionality from both repos preserved in the kept implementation
  - Kept implementation integrated with Cmdra CLI framework
  - Archived repo README documents migration path
  - No broken references in active tooling
  - All quality checks passing on merged implementation
- **Estimated Effort:** S

Resolve the duplication between thegent-sharecli and thegent-cli-share by auditing both, deciding which to keep, merging functionality, and archiving the other. The kept implementation is migrated to use Cmdra as its CLI framework.

### Subtasks
- [ ] T050 Audit thegent-sharecli: features, code quality, dependencies, test coverage
- [ ] T051 Audit thegent-cli-share: features, code quality, dependencies, test coverage
- [ ] T052 Compare feature overlap: identify unique features in each, common functionality
- [ ] T053 Make keep/archive decision with documented rationale
- [ ] T054 Merge unique features from archived repo into kept repo
- [ ] T055 Migrate kept repo to use Cmdra CLI framework
- [ ] T056 Archive the superseded repo with migration README
- [ ] T057 Search all active repos for references to archived repo
- [ ] T058 Update references to use the kept implementation
- [ ] T059 Write tests for merged functionality (target: ≥80% coverage)
- [ ] T060 Run quality checks on merged implementation

### Dependencies
- WP-003 (Cmdra framework available for migration)

### Risks & Mitigations
- Functionality loss during merge: Comprehensive feature audit (T050-T052) before decision
- Broken references: Systematic search across all repos before archival

---

## WP-006: thegent-subprocess — Subprocess Management for thegent

- **State:** planned
- **Sequence:** 6
- **File Scope:** thegent-subprocess repository (src/, tests/, docs/), thegent main repository
- **Acceptance Criteria:**
  - Complete subprocess management library: spawn, monitor, communicate, cleanup
  - Integrated with Cmdra CLI framework (subprocess commands via Cmdra)
  - Integrated with thegent main application
  - Stream handling: stdin, stdout, stderr with buffering
  - Timeout and signal handling
  - ≥80% test coverage on subprocess core
  - All quality checks passing
- **Estimated Effort:** M

Complete thegent-subprocess as the subprocess management library for thegent. This handles spawning, monitoring, and communicating with subprocesses — essential for agent execution, tool invocation, and CLI command orchestration.

### Subtasks
- [ ] T061 Audit current thegent-subprocess: existing code, gaps, integration status
- [ ] T062 Implement subprocess spawning: configurable command, environment, working directory
- [ ] T063 Implement stream handling: stdin write, stdout/stderr read, buffering
- [ ] T064 Implement subprocess monitoring: PID tracking, exit code capture, status polling
- [ ] T065 Implement timeout handling: configurable timeouts, graceful termination
- [ ] T066 Implement signal handling: SIGTERM, SIGKILL, signal forwarding
- [ ] T067 Implement subprocess cleanup: kill on parent exit, resource cleanup
- [ ] T068 Integrate with Cmdra: register subprocess commands as Cmdra plugins
- [ ] T069 Integrate with thegent: subprocess management available to thegent core
- [ ] T070 Write unit tests for subprocess operations (target: ≥80% coverage)
- [ ] T071 Write integration tests: spawn real subprocesses, verify communication
- [ ] T072 Add documentation: subprocess configuration, stream handling guide
- [ ] T073 Run quality checks across all components

### Dependencies
- WP-003 (Cmdra framework available for integration)

### Risks & Mitigations
- Subprocess reliability: Test on macOS and Linux, handle platform-specific behaviors
- Resource leaks: Implement strict cleanup, test parent exit scenarios

---

## Dependency & Execution Summary

```
WP-001 (cliproxyapi-plusplus LLM proxy) ───── first, no deps
WP-002 (agentapi-plusplus HTTP API) ────────── depends on WP-001
WP-003 (Cmdra CLI framework) ──────────────── first, no deps (parallel with WP-001)
WP-004 (forgecode git workflows) ───────────── depends on WP-003
WP-005 (Deduplicate sharecli) ──────────────── depends on WP-003
WP-006 (thegent-subprocess) ────────────────── depends on WP-003
```

**Parallelization**: WP-001 and WP-003 can run in parallel (independent codebases). WP-004, WP-005, and WP-006 can run in parallel after WP-003. WP-002 depends on WP-001.

**MVP Scope**: WP-001 alone provides LLM proxy. WP-003 provides CLI framework. WP-001 + WP-003 + WP-002 provides the core API stack.
