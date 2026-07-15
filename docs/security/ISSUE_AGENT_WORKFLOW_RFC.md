---
title: "Issue Agent Workflow RFC"
version: 3.9-draft
lastUpdated: 2026-07-03
relatedIssue: "https://github.com/diegosouzapw/OmniRoute/issues/5620"
---

# Issue Agent Workflow RFC

## Summary

Issue-agent automation should ship as a controlled maintainer workflow, not as an
autonomous write-capable bot. The current repository has mature authentication,
policy, audit, webhook, and workflow concepts, but this RFC does not assume a
first-class GitHub issue-agent endpoint already exists.

The first implementation should ingest issue/PR context, produce a bounded plan or
draft patch, and require explicit maintainer approval before posting, branching, or
opening PRs.

## Source Anchors

- `server-init.ts` initializes the compliance audit log at startup and records a
  server-start audit event.
- `src/server/authz/routeGuard.ts` defines local-only, always-protected, and
  management route tiers, including local-only prefixes for spawn-capable
  surfaces.
- `src/server/authz/policies/management.ts` blocks local-only routes from
  non-loopback/non-LAN callers before normal management auth, and only allows the
  narrow manage-scope bypass when the route is explicitly bypassable.
- `src/shared/constants/spawnCapablePrefixes.ts` lists route prefixes that can spawn
  local subprocesses and must never be remotely bypassable.
- `src/shared/validation/settingsSchemas.ts` rejects settings changes that try to add
  spawn-capable prefixes to the manage-scope bypass list.
- `open-sse/handlers/chatCore.ts` and `open-sse/handlers/chatCore/attemptLogging.ts`
  already record compliance/audit events around chat execution.
- `docs/reference/API_REFERENCE.md` documents management-auth guarded resilience and
  cooldown endpoints.
- `docs/reference/ENVIRONMENT.md` documents environment configuration, including
  provider cooldown toggles and CLI sidecar discovery settings.
- `.github/ISSUE_TEMPLATE/bug_report.yml` defines the current issue intake format.

## Goals

1. Give maintainers an AI-assisted path from issue report to triage, reproduction
   plan, draft patch, and optional PR.
2. Preserve maintainer control over all write actions.
3. Ensure every issue-agent action is permissioned, rate-limited, and auditable.
4. Prevent prompt injection from issue bodies, comments, logs, and external links.
5. Keep secrets, provider credentials, and private runtime state out of generated
   comments and artifacts.

## Non-Goals

- Auto-merging PRs.
- Posting comments without maintainer approval.
- Running untrusted issue-provided commands.
- Granting broad repository write tokens to the model runtime.
- Using issue-agent output as a replacement for tests or code review.

## Security Boundary

The workflow must separate four actors:

1. GitHub event source: issue, PR, comment, or maintainer command.
2. OmniRoute coordinator: validates permissions, rate limits, and audit metadata.
3. Model runner: receives sanitized, least-privilege task context.
4. Maintainer approval step: authorizes comments, branches, and PR creation.

The model runner must not hold direct GitHub write credentials. It should return a
structured proposal that the coordinator can validate before any write action.

## Execution Boundary

Any issue-agent route that can enqueue work, spawn `git`, spawn `gh`, call package
managers, launch a model CLI, start Docker, mutate a checkout, or publish a GitHub
write must be treated as spawn-capable. It should be local-only from its first PR and
must not be eligible for the manage-scope bypass list.

Read-only dashboard routes may exist separately, but they must not share handlers with
execution routes. A leaked dashboard session, API key, or URL token must never be enough
to trigger a local subprocess through a tunneled OmniRoute instance.

## Proposed Stages

### Stage 1: Read-Only Triage

Build a maintainer-triggered command that summarizes an issue and produces:

- suspected subsystem
- missing reproduction data
- proposed test target
- risk classification
- recommended next maintainer action

Acceptance criteria:

- Only maintainers can trigger the workflow.
- Execution-capable endpoints are local-only.
- Issue body/comments are treated as untrusted input.
- Output is stored as an internal draft or local artifact before posting.
- Audit log records trigger, actor, repository, issue/PR number, and result status.

### Stage 2: Reproduction Plan

Allow the workflow to inspect repository source and test names, then draft a
reproduction checklist.

Acceptance criteria:

- No shell command from an issue is executed unless it matches an allowlisted command
  class and maintainer explicitly approves it.
- The checklist cites existing files/tests rather than invented APIs.
- External links are summarized as untrusted references.

### Stage 3: Draft Patch

Let the workflow prepare a local branch or patch file, but keep publication manual.

Acceptance criteria:

- Patch generation runs in an isolated worktree.
- Generated diffs are secret-scanned before publication.
- Tests selected by the workflow are run and attached to the draft result.
- Maintainer approval is required before branch push or PR creation.

### Stage 4: Controlled Posting and PR Creation

Add a narrow write path for approved comments or PRs.

Acceptance criteria:

- GitHub token scopes are minimal.
- Writes require a maintainer approval event with a stable idempotency key.
- All outgoing comments are sanitized for secrets and raw stack traces.
- Rate limits prevent repeated comments on noisy issues.
- The audit trail links trigger, generated artifact, approval, and write result.

## Abuse Cases

- Prompt injection in issue text requests secret exfiltration.
- Reporter provides a malicious reproduction command.
- External log contains credentials.
- Agent repeatedly posts low-value updates.
- Model opens a PR that silently changes unrelated files.
- Maintainer approval is replayed after the underlying draft changed.

Each abuse case must have an automated test or documented manual verification before
the write path ships.

## GitHub Comment Summary

Recommended issue comment:

> I converted this into a security-boundary-first RFC draft. The staged path is
> read-only triage, reproduction planning, isolated draft patching, then narrowly
> approved posting/PR creation. The important constraint is that the model runner
> never owns GitHub write credentials; it returns structured proposals, while the
> coordinator enforces maintainer authorization, rate limits, secret scanning, and
> audit logging. First PR should be read-only triage plus audit records, not an
> autonomous write bot.
