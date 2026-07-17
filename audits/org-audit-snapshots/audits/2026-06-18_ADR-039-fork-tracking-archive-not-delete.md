# ADR-039: Fork tracking — archive-not-delete for upstream forks

For repos that are forks of upstream projects (e.g. `Planify`, `portage`, `phenotype-ops-mcp`), the fleet policy is **archive, not delete**. Archive = GitHub's read-only marker that preserves the git history; delete = irreversible destruction of the git history (modulo 90-day GitHub retention).

**Status:** Accepted
**Date:** 2026-06-18
**Author:** orchestrator (claude opus 4.7)
**Track:** v8 T14 (governance backlog)
**L8-019** (T14.10)

## Context

The fleet contains a small set of repos that are forks of upstream projects:

| Fleet repo | Upstream | Reason for fork |
|---|---|---|
| `KooshaPari/Planify` | upstream `planify-org/planify` | Fleet-specific patches that have not been upstreamed |
| `KooshaPari/portage` | upstream `gentoo/portage` | Same |
| `KooshaPari/phenotype-ops-mcp` | upstream `mcp-org/ops-mcp` | Same |

These forks are tracked in the kilo audit at row #144 (P2 priority). The audit note: *"fork repos that diverge from upstream; archive-not-delete to preserve the divergent history."*

Until 2026-06-18 the policy was implicit (each operator used their own judgement). Codifying the policy as ADR-039 ensures the next operator doesn't accidentally `gh repo delete` a fork that has fleet-specific divergent history.

## Decision

**For repos that are forks of upstream projects, the fleet policy is archive-not-delete.**

### Archive (the default)

`gh api -X PATCH repos/<owner>/<repo> -f archived=true` (or UI: Settings → General → Archive this repository). Effects:

- The repo becomes **read-only** (no new commits, issues, or PRs).
- The git history is **preserved** indefinitely.
- The repo is **hidden** from the main repo list (visible only via the Archived filter).
- The repo can be **unarchived** at any time (Settings → General → Unarchive).

### Delete (the exception)

`gh repo delete <owner>/<repo>` (requires `delete_repo` scope) or UI: Settings → General → Danger Zone → Delete this repository. Effects:

- The git history is **destroyed** after the 90-day GitHub retention window.
- The repo is **unsearchable** and **un-recoverable** after the window.
- The deletion is **irreversible** past the 90-day window.

Delete is reserved for repos that are 100% internal to the fleet with no upstream tie. **No fork of an upstream project is ever deleted** without an explicit, in-writing user directive that names the fork by full path.

### CLI vs UI for delete

The active `KooshaPari` token (as of 2026-06-18) has scopes `'gist', 'read:org', 'repo', 'workflow'`. **`delete_repo` is not in this set.** Therefore:

- The `gh repo delete` CLI is unavailable for the `KooshaPari` account.
- The only way to delete a repo under the `KooshaPari` account is via the GitHub UI (Settings → General → Danger Zone → Delete this repository).
- This is a **safety property**, not a bug: an operator with a stolen / leaked token cannot mass-delete repos via CLI.

This policy is ratified in the "Stale / warnings" section of AGENTS.md (under the 4-repo retirement § 2026-06-18) and is the underlying rationale for ADR-040 (the deletion recipe).

### What "explicit user directive" means

A user directive to delete a fork is valid only if it:

1. Names the fork by full path (`github.com/KooshaPari/Planify` or similar).
2. Is in a session message (not a stale note in AGENTS.md or a comment in a PR).
3. Is followed by an audit artifact per ADR-040 (deletion recipe).

## Consequences

*Positive:*
- Fork git history is preserved indefinitely. Fleet-specific divergent commits can always be referenced, cherry-picked, or upstreamed later.
- The CLI-vs-UI distinction is a safety property: token leaks cannot mass-delete.
- The "explicit user directive" gate prevents accidental fork deletion by an inattentive operator.

*Negative / Risks:*
- Archived repos clutter the GitHub org's "Archived" filter. Mitigation: archived repos are excluded from the 71-pillar audit (ADR-024) by default; they re-enter the audit if unarchived.
- The "explicit user directive" gate requires a session message; if the user is unavailable for an extended period, a fork that genuinely should be deleted cannot be. Mitigation: the 90-day GitHub retention window applies to delete, not archive; the worst case is that a fork sits archived for a quarter until the user returns.
- The fleet's small fork set (`Planify`, `portage`, `phenotype-ops-mcp`) is not actively maintained; the policy is a safety net, not an active work item. Mitigation: ADR-037's 4-repo retirement template is a separate (active) process; this ADR is a passive policy.

## Refs

- Kilo audit row #144 (P2 priority; source of this ADR's fork list)
- AGENTS.md § "Stale / warnings" (4-repo retirement § 2026-06-18; CLI-vs-UI token scope note)
- ADR-037 (4-repo retirement template — distinct but related; this ADR is the **fork-specific** slice)
- ADR-040 (deletion recipe — the underlying deletion policy; this ADR is the **fork-specific** slice)
- v8 plan § 3.6 Track T14 (ADR backlog)
