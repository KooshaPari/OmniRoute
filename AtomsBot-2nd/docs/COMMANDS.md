# Slash Commands

Below are typical commands implemented or expected. Consult `src/discord/commands` for the exact current set and behavior; tests in `src/discord/commands/__tests__` are the spec.

## /assign
Assign a GitHub issue to a user.

Behavior:
- Must be run in a forum thread linked to a GitHub issue
- Uses `github-username` override when provided; empty string falls back to Discord username, whitespace-only is used as-is
- Validates GitHub user existence via Octokit
- Assigns via `octokit.rest.issues.update({ assignees: [...] })`
- Replies with a success confirmation and follows up to the thread with details
- Logs success and handles errors with clear messages

## /unassign
Unassign a GitHub issue.
- Similar validation to assign
- Removes assignee(s) via GitHub API

## /priority
Set issue priority.
- Adjusts GitHub labels or Jira fields depending on configuration

## /status
Update status (Open/In Progress/Blocked/Done).
- Uses labels, projects, or Jira transitions

## /label
Add or remove labels.

## /issue
Create a new GitHub issue, optionally linking the thread.

## /link
Bind the current thread to an existing GitHub issue.
- Uses auto-linker logic when possible

## Notes
- All long-running commands should use deferReply + editReply
- Prefer `getRepoCredentialsForThread` to resolve repo context
- Error and edge-case behavior is covered by tests; keep changes aligned

