---
work_package_id: WP09
title: Code Review Adapter (agileplus-agents)
lane: "done"
dependencies: [WP08]
base_branch: 001-spec-driven-development-engine-WP08
base_commit: e9135a754657976c2bab62ddc60497cf2d50bf96
created_at: '2026-03-02T01:23:26.257094+00:00'
subtasks:
- T050
- T051
- T052
- T053
- T054
phase: Phase 2b - External Repo Adapters
assignee: ''
agent: "s1-wp09"
shell_pid: "59200"
review_status: "approved"
reviewed_by: "Koosha Paridehpour"
history:
- timestamp: '2026-02-27T00:00:00Z'
  lane: planned
  agent: system
  shell_pid: ''
  action: Prompt generated via /spec-kitty.tasks
---

# Work Package Prompt: WP09 -- Code Review Adapter

## IMPORTANT: Review Feedback Status

**Read this first if you are implementing this task!**

- **Has review feedback?**: Check the `review_status` field above. If it says `has_feedback`, scroll to the **Review Feedback** section immediately (right below this notice).
- **You must address all feedback** before your work is complete. Feedback items are your implementation TODO list.
- **Mark as acknowledged**: When you understand the feedback and begin addressing it, update `review_status: acknowledged` in the frontmatter.
- **Report progress**: As you address each feedback item, update the Activity Log explaining what you changed.

---

## Review Feedback

> **Populated by `/spec-kitty.review`** -- Reviewers add detailed feedback here when work needs changes. Implementation must address every item listed below before returning for re-review.

*[This section is empty initially. Reviewers will populate it if the work is returned from review. If you see feedback here, treat each item as a must-do before completion.]*

---

## Markdown Formatting
Wrap HTML/XML tags in backticks: `` `<div>` ``, `` `<script>` ``
Use language identifiers in code blocks: ````python`, ````bash`

---

## Implementation Command

```bash
spec-kitty implement WP09 --base WP05
```

---

## Objectives & Success Criteria

1. **ReviewAdapter struct** implementing the `ReviewPort` trait from `agileplus-domain/src/ports/review.rs` is fully functional in `crates/agileplus-agent-review/src/`.
2. **Coderabbit integration** fetches review comments from GitHub pull requests via the GitHub API, parses Coderabbit bot comments into structured actionable feedback, and distinguishes informational comments from actionable ones.
3. **Manual review fallback** provides a CLI-based approval flow where a human user can approve, reject, or request changes when Coderabbit is unavailable or times out.
4. **CI status checking** polls the GitHub Checks API for a given PR and returns a structured pass/fail/pending result.
5. **Unit tests** cover all adapter methods using mock GitHub API responses, including error conditions, rate limiting, and timeout scenarios.
6. `cargo test -p agileplus-review` passes with all tests green.
7. The adapter gracefully degrades when the GitHub API is unreachable or rate-limited.

---

## Context & Constraints

### Prerequisite Work
- **WP05 (Port Traits)** must be complete. The `ReviewPort` trait in `agileplus-domain/src/ports/review.rs` defines the interface this adapter implements.
- Review the port trait signatures carefully. All methods return `Result<T, DomainError>`.

### Key References
- **Spec**: `kitty-specs/001-spec-driven-development-engine/spec.md` -- FR-012 (review-fix loop), FR-011 (PR description with goal context)
- **Plan**: `kitty-specs/001-spec-driven-development-engine/plan.md` -- Agent dispatch section, review loop description
- **Data Model**: `kitty-specs/001-spec-driven-development-engine/data-model.md` -- Evidence entity (type: `review_approval`), WorkPackage.pr_state field
- **Contracts**: `kitty-specs/001-spec-driven-development-engine/contracts/` -- API contract for review-related endpoints

### Architectural Constraints
- This crate implements the `ReviewPort` trait defined in `agileplus-core`. It must not depend on other adapter crates.
- Use `octocrab` or raw `reqwest` for GitHub API calls. Prefer `octocrab` for type safety unless it lacks needed endpoints.
- Credentials (GitHub token) are retrieved from the credential store via configuration -- do not hardcode tokens or read environment variables directly in the adapter. Accept a config struct at construction time.
- All API calls must use parameterized requests. Never interpolate user input into URLs without validation.
- The adapter must be `Send + Sync` for use in async contexts with tokio.

### Crate Dependencies
```toml
[dependencies]
agileplus-core = { path = "../agileplus-core" }
tokio = { workspace = true }
reqwest = { version = "0.12", features = ["json"] }
serde = { workspace = true, features = ["derive"] }
serde_json = { workspace = true }
thiserror = { workspace = true }
tracing = { workspace = true }
chrono = { workspace = true }

[dev-dependencies]
tokio = { workspace = true, features = ["test-util", "macros"] }
wiremock = "0.6"
```

---

## Subtasks & Detailed Guidance

### Subtask T050 -- Implement `ReviewAdapter` struct implementing `ReviewPort`

- **Purpose**: Create the top-level adapter struct that wires together Coderabbit, manual fallback, and CI status checking behind the `ReviewPort` trait from core.
- **Steps**:
  1. Create `crates/agileplus-agent-review/src/lib.rs` with the module declarations (`mod coderabbit; mod fallback; mod ci_status;`) and the public `ReviewAdapter` struct.
  2. The `ReviewAdapter` struct holds:
     - `http_client: reqwest::Client` (shared, connection-pooled)
     - `github_token: String` (from config)
     - `github_owner: String` and `github_repo: String` (from config or per-call)
     - `coderabbit_bot_username: String` (default: `"coderabbitai[bot]"`)
     - `fallback_timeout: Duration` (default: 5 minutes)
  3. Implement a `ReviewAdapterConfig` struct with builder pattern or `Default` impl for configuration.
  4. Implement `ReviewPort` for `ReviewAdapter`. Each trait method delegates to the appropriate submodule:
     - `await_review()` -> tries Coderabbit, falls back to manual after timeout
     - `read_comments()` -> `coderabbit::fetch_comments()`
     - `check_ci_status()` -> `ci_status::check()`
  5. Add `tracing::instrument` to all public methods for observability.
- **Files**:
  - `crates/agileplus-agent-review/src/lib.rs` (create/replace)
  - `crates/agileplus-agent-review/Cargo.toml` (update dependencies)
- **Parallel?**: No -- this is the foundation for T051-T053.
- **Notes**: The `ReviewPort` trait is async. Use `#[async_trait]` or native async traits depending on what WP05 established. Match the pattern exactly.

### Subtask T051 -- Implement `coderabbit.rs`: Coderabbit review via GitHub API

- **Purpose**: Fetch and parse Coderabbit bot review comments from GitHub pull requests into structured, actionable feedback items.
- **Steps**:
  1. Create `crates/agileplus-agent-review/src/coderabbit.rs`.
  2. Define a `CoderabbitComment` struct:
     ```rust
     pub struct CoderabbitComment {
         pub id: u64,
         pub body: String,
         pub path: Option<String>,       // file path if inline comment
         pub line: Option<u32>,          // line number if inline
         pub is_actionable: bool,        // true if requires code change
         pub severity: CommentSeverity,  // info, warning, error
         pub created_at: DateTime<Utc>,
     }
     ```
  3. Define `CommentSeverity` enum: `Info`, `Warning`, `Error`.
  4. Implement `fetch_review_comments(client, owner, repo, pr_number) -> Result<Vec<CoderabbitComment>>`:
     - Call GitHub API: `GET /repos/{owner}/{repo}/pulls/{pr}/comments` for inline comments.
     - Call GitHub API: `GET /repos/{owner}/{repo}/issues/{pr}/comments` for top-level review comments.
     - Filter by `user.login == coderabbit_bot_username`.
     - Parse comment bodies to classify actionable vs informational:
       - Lines starting with keywords like "suggestion:", "fix:", "error:", "warning:" are actionable.
       - Lines with code block suggestions (` ```suggestion `) are actionable.
       - Summary/praise comments are informational.
     - Sort by creation time ascending.
  5. Implement `parse_review_status(client, owner, repo, pr_number) -> Result<ReviewStatus>`:
     - Check PR reviews via `GET /repos/{owner}/{repo}/pulls/{pr}/reviews`.
     - Look for Coderabbit review with state `APPROVED`, `CHANGES_REQUESTED`, or `COMMENTED`.
     - Return a `ReviewStatus` enum: `Approved`, `ChangesRequested(Vec<CoderabbitComment>)`, `Pending`, `NotFound`.
  6. Handle pagination: GitHub returns max 100 items per page. Follow `Link` header for additional pages.
  7. Implement conditional requests using ETags to reduce API consumption on repeated polls.
- **Files**: `crates/agileplus-agent-review/src/coderabbit.rs`
- **Parallel?**: Yes, independent of T052 and T053 after T050.
- **Notes**:
  - Coderabbit sometimes posts a summary comment and separate inline comments. Capture both.
  - Rate limit handling: if HTTP 403 with `X-RateLimit-Remaining: 0`, return a `RateLimited` error with the reset timestamp from `X-RateLimit-Reset`. The caller (WP08 review loop) handles backoff.
  - Use `tracing::debug!` to log raw API responses in debug mode for troubleshooting.

### Subtask T052 -- Implement `fallback.rs`: Manual review approval flow

- **Purpose**: Provide a fallback review mechanism when Coderabbit is unavailable, allowing human users to approve or reject via CLI interaction.
- **Steps**:
  1. Create `crates/agileplus-agent-review/src/fallback.rs`.
  2. Define a `ManualReviewResult` enum: `Approved { reviewer: String }`, `Rejected { reviewer: String, reason: String }`, `ChangesRequested { reviewer: String, comments: Vec<String> }`.
  3. Implement `prompt_manual_review(pr_url: &str, wp_title: &str) -> Result<ManualReviewResult>`:
     - Print the PR URL and WP context to stdout.
     - Use `dialoguer` or raw stdin to prompt: "Review PR at {url}. Enter [a]pprove / [r]eject / [c]hanges requested:".
     - If rejected or changes requested, prompt for reason/comments (multi-line input terminated by empty line).
     - Return the structured result.
  4. Implement `should_fallback(last_coderabbit_check: Option<DateTime<Utc>>, timeout: Duration) -> bool`:
     - Returns true if Coderabbit has not responded within the timeout window.
     - Returns true if `last_coderabbit_check` is None (never checked).
  5. The fallback module should be usable both in interactive CLI mode and in a non-interactive mode where it returns `Err(NonInteractive)` if stdin is not a TTY. Check with `atty::is(atty::Stream::Stdin)` or `std::io::stdin().is_terminal()`.
- **Files**: `crates/agileplus-agent-review/src/fallback.rs`
- **Parallel?**: Yes, independent of T051 and T053 after T050.
- **Notes**:
  - The fallback is intentionally simple. It does not parse code -- it just captures human judgment.
  - In non-interactive contexts (CI, background agent), the adapter should propagate a clear error rather than hanging on stdin.
  - Consider adding a `--non-interactive` flag path where fallback auto-rejects with "no reviewer available".

### Subtask T053 -- Implement CI status checking via GitHub Checks API

- **Purpose**: Poll the GitHub Checks API to determine whether a PR's CI pipeline has passed, failed, or is still pending.
- **Steps**:
  1. Create `crates/agileplus-agent-review/src/ci_status.rs`.
  2. Define `CiStatus` enum:
     ```rust
     pub enum CiStatus {
         Passed,
         Failed { failed_checks: Vec<CheckResult> },
         Pending { pending_checks: Vec<String> },
         Unknown,
     }

     pub struct CheckResult {
         pub name: String,
         pub status: String,       // "completed", "in_progress", "queued"
         pub conclusion: Option<String>,  // "success", "failure", "neutral", etc.
         pub details_url: Option<String>,
         pub started_at: Option<DateTime<Utc>>,
         pub completed_at: Option<DateTime<Utc>>,
     }
     ```
  3. Implement `check_ci_status(client, owner, repo, pr_number) -> Result<CiStatus>`:
     - Get the PR's head SHA via `GET /repos/{owner}/{repo}/pulls/{pr}` -> `head.sha`.
     - Fetch check runs: `GET /repos/{owner}/{repo}/commits/{sha}/check-runs`.
     - Also fetch commit statuses: `GET /repos/{owner}/{repo}/commits/{sha}/status` (for legacy status API).
     - Combine results: all checks must be `completed` with `conclusion: success` for `Passed`.
     - Any `failure` or `cancelled` -> `Failed`.
     - Any `in_progress` or `queued` -> `Pending`.
  4. Implement `poll_until_complete(client, owner, repo, pr_number, interval, max_wait) -> Result<CiStatus>`:
     - Poll `check_ci_status` at the given interval.
     - Return as soon as status is `Passed` or `Failed`.
     - Return `Pending` if max_wait exceeded.
     - Use exponential backoff starting from `interval` up to 2x interval.
  5. Handle the case where a PR has no check runs (some repos have no CI). Return `Unknown` and log a warning.
- **Files**: `crates/agileplus-agent-review/src/ci_status.rs`
- **Parallel?**: Yes, independent of T051 and T052 after T050.
- **Notes**:
  - The GitHub Checks API and Status API are separate systems. Some CI providers use one, some the other. Check both.
  - Rate limit handling follows the same pattern as T051.
  - The `poll_until_complete` function should accept a `tokio::sync::CancellationToken` to allow the caller to abort polling.

### Subtask T054 -- Write unit tests with mock GitHub API responses

- **Purpose**: Verify all adapter methods work correctly against realistic but mocked GitHub API responses, including error conditions.
- **Steps**:
  1. Create `crates/agileplus-agent-review/tests/` directory.
  2. Create `crates/agileplus-agent-review/tests/mock_responses/` with JSON fixture files:
     - `pr_comments_coderabbit.json` -- realistic Coderabbit comment payload
     - `pr_comments_mixed.json` -- mix of Coderabbit and human comments
     - `pr_reviews.json` -- PR review objects with various states
     - `check_runs_passing.json` -- all checks green
     - `check_runs_failing.json` -- one check failed
     - `check_runs_pending.json` -- checks still running
     - `commit_status.json` -- legacy status API response
     - `rate_limited.json` -- 403 response with rate limit headers
  3. Create `crates/agileplus-agent-review/tests/coderabbit_tests.rs`:
     - Use `wiremock` to spin up a mock HTTP server.
     - Test `fetch_review_comments` returns correct count and classification of actionable vs informational.
     - Test pagination: mock returns `Link` header pointing to page 2.
     - Test rate limit: mock returns 403, verify `RateLimited` error with correct reset time.
     - Test empty response: no Coderabbit comments on PR.
  4. Create `crates/agileplus-agent-review/tests/ci_status_tests.rs`:
     - Test all CI passed scenario.
     - Test CI failed scenario with correct failed check names.
     - Test CI pending scenario.
     - Test combined Checks API + Status API (both present).
     - Test no checks at all -> `Unknown`.
  5. Create `crates/agileplus-agent-review/tests/fallback_tests.rs`:
     - Test `should_fallback` with various timeout conditions.
     - Non-interactive detection test (may need to mock `is_terminal`).
  6. Create `crates/agileplus-agent-review/tests/integration.rs`:
     - Test the full `ReviewAdapter` flow: poll -> Coderabbit comments -> classify -> return structured result.
     - Test fallback trigger: no Coderabbit response after timeout -> fallback error in non-interactive mode.
- **Files**:
  - `crates/agileplus-agent-review/tests/` (multiple files)
  - `crates/agileplus-agent-review/tests/mock_responses/` (fixture JSON files)
- **Parallel?**: No -- depends on T050-T053 being implemented.
- **Notes**:
  - Use `wiremock::MockServer` for all HTTP mocking. It provides a real HTTP server on a random port, which is more realistic than mocking the reqwest client.
  - Configure the `ReviewAdapter` to point at the mock server URL instead of `https://api.github.com`.
  - Test timeouts by configuring very short timeouts (100ms) in tests.

---

## Test Strategy

### Unit Tests
- Location: `crates/agileplus-agent-review/tests/`
- Run: `cargo test -p agileplus-review`
- All GitHub API interactions are mocked with `wiremock`.
- Test coverage target: >85% for all modules.

### Mock Fixtures
- Realistic GitHub API JSON responses stored in `tests/mock_responses/`.
- Fixtures should be derived from actual GitHub API documentation examples.

### Edge Cases to Cover
- Empty PR (no comments, no checks)
- Coderabbit comment with malformed body
- GitHub API returns 500 (server error)
- Network timeout
- Pagination with 3+ pages
- Mixed Coderabbit versions (comment format changes)

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| GitHub API rate limits (5000/hr authenticated) | Polling loops exhaust quota | Cache responses with ETags, exponential backoff, configurable poll interval |
| Coderabbit comment format changes | Parser breaks silently | Log unparseable comments as warnings, return raw body as fallback |
| GitHub Checks API vs Status API inconsistency | Miss CI results | Query both APIs, merge results, log discrepancies |
| Non-interactive environments hang on fallback | Agent dispatch blocks forever | TTY detection, configurable timeout, non-interactive error path |
| `octocrab` vs `reqwest` maintenance | Dependency risk | Start with `reqwest` (more stable), consider `octocrab` only if needed |

---

## Review Guidance

1. **Port compliance**: Verify `ReviewAdapter` implements every method of `ReviewPort` with correct signatures and error types.
2. **Error handling**: All GitHub API errors must be converted to `DomainError` variants, never unwrapped or panicked.
3. **Rate limit respect**: Confirm ETags and backoff are implemented, not just documented.
4. **TTY safety**: Confirm the fallback module does not block in non-interactive mode.
5. **Test realism**: Mock responses should match actual GitHub API shape, not simplified stubs.
6. **No hardcoded secrets**: Token comes from config, not env vars or literals.
7. **Async safety**: All public types must be `Send + Sync`.

---

## Activity Log

> **CRITICAL**: Activity log entries MUST be in chronological order (oldest first, newest last).

### How to Add Activity Log Entries

**When adding an entry**:
1. Scroll to the bottom of this file (Activity Log section below "Valid lanes")
2. **APPEND the new entry at the END** (do NOT prepend or insert in middle)
3. Use exact format: `- YYYY-MM-DDTHH:MM:SSZ -- agent_id -- lane=<lane> -- <action>`
4. Timestamp MUST be current time in UTC (check with `date -u "+%Y-%m-%dT%H:%M:%SZ"`)
5. Lane MUST match the frontmatter `lane:` field exactly
6. Agent ID should identify who made the change (claude-sonnet-4-5, codex, etc.)

**Format**:
```
- YYYY-MM-DDTHH:MM:SSZ -- <agent_id> -- lane=<lane> -- <brief action description>
```

**Valid lanes**: `planned`, `doing`, `for_review`, `done`

### Updating Lane Status

To change a work package's lane, either:

1. **Edit directly**: Change the `lane:` field in frontmatter AND append activity log entry (at the end)
2. **Use CLI**: `spec-kitty agent tasks move-task WP09 --to <lane> --note "message"` (recommended)

**Initial entry**:
- 2026-02-27T00:00:00Z -- system -- lane=planned -- Prompt created.
- 2026-03-02T01:23:26Z – s1-wp09 – shell_pid=59200 – lane=doing – Assigned agent via workflow command
- 2026-03-02T02:27:13Z – s1-wp09 – shell_pid=59200 – lane=for_review – Ready: code review adapter
- 2026-03-02T02:27:39Z – s1-wp09 – shell_pid=59200 – lane=done – Code review adapter with Coderabbit integration complete
