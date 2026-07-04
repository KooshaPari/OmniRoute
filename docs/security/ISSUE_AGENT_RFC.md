# Issue Agent Security Boundary RFC

Status: proposed
Tracker: [#5620](https://github.com/diegosouzapw/OmniRoute/issues/5620)
Related PR: #5867

## Problem

The issue-agent workflow can create high-impact automation: read a GitHub issue,
triage it, modify code, run checks, and prepare a pull request. That is useful only
if the security boundary is explicit before implementation resumes.

The previous implementation work should remain parked until the maintainer accepts
what the agent may read, write, execute, and publish.

## Goals

- Define the trust boundary for issue-to-PR automation.
- Make repository writes opt-in and auditable.
- Keep generated code changes behind local validation before any PR is opened.
- Prevent issue text, comments, or labels from becoming unsandboxed instructions.
- Reuse existing guardrail, credential, and error-sanitization patterns.

## Non-Goals

- Do not run untrusted issue text as shell instructions.
- Do not grant production credentials to issue-agent runs.
- Do not auto-merge or auto-release agent-created PRs.
- Do not allow issue labels alone to bypass maintainer approval.
- Do not expose raw secrets, tokens, stack traces, or local paths in issue comments.

## Current Source Anchors

- Security guardrail documentation exists in `docs/security/GUARDRAILS.md`.
- CLI token authentication is documented in `docs/security/CLI_TOKEN_AUTH.md`.
- Secret and public credential handling is documented in `docs/security/PUBLIC_CREDS.md`.
- Error response sanitization is documented in `docs/security/ERROR_SANITIZATION.md`.
- Workflow state modeling exists in `open-sse/services/workflowFSM.ts`.
- GitHub/token redaction patterns are present in `scripts/sre/redact-logs.mjs`.
- Local-only and management route classification lives in
  `src/server/authz/routeGuard.ts`.
- Spawn-capable route prefixes are centralized in
  `src/shared/constants/spawnCapablePrefixes.ts`.
- Settings validation rejects unsafe local-only bypasses in
  `src/shared/validation/settingsSchemas.ts`.
- Shared log redaction helpers live in `src/shared/utils/logRedaction.ts`.
- Outbound URL guarding lives in `src/shared/network/outboundUrlGuard.ts`.

## Threat Model

### Assets

- Repository write access.
- GitHub tokens and local credentials.
- Maintainer identity and review trust.
- Local workspace files and environment variables.
- CI minutes and release automation.

### Attackers

- External issue author attempting prompt injection.
- Contributor with comment access attempting workflow escalation.
- Compromised dependency or generated code path.
- Malicious or malformed issue payload causing unsafe shell execution.

### Trust Boundaries

- GitHub issue content is untrusted input.
- Repository contents are trusted only at the checked-out revision.
- Local secrets are never part of agent context.
- Generated patches are untrusted until tests and review pass.
- CI/release automation is out of scope for the issue agent.
- Any route that can spawn `git`, `gh`, package-manager checks, model CLIs, or
  Docker workers is a local-only execution boundary.
- Diagnostic bundles cross a redaction boundary before persistence and before any
  model/provider request.

## Permission Model

The issue agent should operate in four modes:

| mode       | allowed                                               | forbidden                      |
| ---------- | ----------------------------------------------------- | ------------------------------ |
| `recorded` | store issue context and proposed next steps           | subprocesses, checkout writes  |
| `triage`   | summarize issue, classify area, identify likely files | edit files, run network writes |
| `patch`    | edit local files, run local checks, produce diff      | push, post comments, open PR   |
| `publish`  | push branch, open draft PR, post bounded summary      | merge, release, modify secrets |

Mode escalation requires an explicit maintainer action. The agent must record:

- issue URL and revision timestamp;
- selected mode;
- files changed;
- commands run;
- tests passed or failed;
- whether network write actions were used.

## Workflow

### Stage 0: RFC and Audit Contract

- Land this RFC before reviving #5867.
- Add an audit envelope for every issue-agent run.
- Define the exact GitHub permissions required for each mode.
- Keep the feature default-off and add an emergency kill switch that short-circuits
  new runs before enqueue or worker dispatch.

Exit criteria:

- Maintainer can review what the agent is allowed to do before any code path lands.
- The audit record is generated even when the run fails.

### Stage 1: Triage-Only Agent

- Add route-guard tests before any execution route exists.
- Read issue title/body/comments.
- Classify affected area from repository search.
- Produce a no-edit report with suspected files and test entrypoints.

Exit criteria:

- No file writes.
- No push/comment/PR side effects.
- No subprocess execution.
- Prompt-injection fixtures prove issue text cannot override system policy.

### Stage 2: Patch Agent

- Apply local edits on an isolated branch or worktree.
- Run targeted checks.
- Produce a diff and validation report.

Exit criteria:

- Dirty workspace is detected before edits.
- Commands are allowlisted.
- Secrets are redacted from logs before summaries are generated.
- Host checkout mutation is impossible outside the explicit patch mode.

### Stage 2.5: Worker Isolation

- Run fix-capable work in a Docker worker or equivalent isolated process boundary.
- Do not mount the host Docker socket.
- Mount source read-only unless the run is explicitly in patch mode.
- Pass only scoped GitHub credentials and required environment variables.
- Apply outbound URL guards before any issue-agent fetches untrusted URLs.

Exit criteria:

- Tests prove `recorded`, `triage`, and planning modes cannot mutate the host checkout.
- Tests prove command allow-list denial is logged and fails closed.
- A worker failure cannot leak raw environment variables in the API response.

### Stage 3: Draft PR Publisher

- Push only the prepared branch.
- Open a draft PR with the audit summary.
- Link back to the originating issue.

Exit criteria:

- PR remains draft by default.
- No auto-merge path exists.
- Failed checks are surfaced instead of hidden.

## Acceptance Gates

- Unit tests cover prompt injection in issue body, comments, and labels.
- Tests cover mode escalation denial.
- Tests cover dirty-workspace refusal or isolation.
- Tests cover redaction of GitHub tokens and generic secret patterns.
- Documentation states exactly which mode can post comments or open PRs.
- The eventual issue-agent route prefix is local-only for every endpoint that can
  enqueue or execute work.
- Spawn-capable issue-agent routes cannot be added to manage-scope bypass
  prefixes.
- Request bodies are schema-validated and size-bounded before route execution.
- Run storage is retention-pruned and never stores raw tokens or environment
  variables.
- Audit records include actor, mode, issue/PR URL, run ID, branch, redaction
  counts, command outcomes, and final status.
- Draft PR creation is impossible from `recorded`, `triage`, or planning modes.

## Open Questions

- Should publish mode require a label, a slash command, or both?
- Should patch mode run in an isolated worktree by default?
- Should comments be posted only on success, or should failures also be reported?
- What retention period should audit records use?

## Recommended Next PR Order

1. RFC-only PR for this document.
2. Triage-only implementation with prompt-injection fixtures.
3. Patch mode with dirty-workspace isolation and allowlisted commands.
4. Draft PR publisher with explicit maintainer-gated escalation.
