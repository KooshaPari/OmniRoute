**Summary**
- Introduces Sprint Management across Discord issues created via bug/feature flows.
- Adds a single `/sprint` command with subcommands for creation, assignment, progress, and lifecycle.
- Integrates with GitHub/Jira links already tracked to threads for accurate progress.

**Goals**
- Create and manage sprints from Discord with minimal friction.
- Assign issues/threads to sprints via dropdown or inline search.
- Show sprint progress (counts, points, burndown) in-channel with ephemeral views.
- Keep source of truth in our DB while synchronizing to GitHub/Jira where configured.

**Non‑Goals**
- Replace GitHub Milestones or Jira Boards entirely.
- Build a full Kanban board UI inside Discord in v1.
- Migrate historical sprints automatically.

**Scope**
- Slash command: `/sprint` with subcommands:
  - `create` (modal form)
  - `set` (assign current thread/issue)
  - `unset` (remove assignment)
  - `progress` (summary view; optional sprint arg)
  - `list` (active/upcoming/completed)
  - `edit` (modal form)
  - `close` (complete sprint)
  - `current` (show default active sprint)
  - `default` (set default sprint for auto‑assignment)
- UI patterns:
  - Modal forms for create/edit.
  - Dropdown select for quick assignment.
  - Autocomplete `sprint:` option for large lists (combobox‑like search).

**User Stories**
- As a PM, I run `/sprint create`, fill modal, get a confirmation embed with management buttons.
- As a developer in a bug thread, I run `/sprint set` and pick an active sprint from a dropdown.
- As a TL, I run `/sprint progress sprint: Q3-Iteration-2` to view burndown and velocity.
- As a reporter, when submitting a bug/feature, I can optionally select an active sprint before post.

**Interactions Overview**
- Assignment source: thread context (forum thread created by bug/feature workflows) is the canonical holder of `sprintId`.
- Links: existing Thread ↔ GitHubIssue/JiraIssue links power external sync.
- Sync policy:
  - GitHub: if configured, set Milestone on linked issue; fallback to label `sprint:<name>`.
  - Jira: set the sprint field on the issue (board configured) when API access exists.
  - Failures do not block the local assignment; errors reported ephemerally.

**Permissions**
- Default: `Manage Threads` or a configurable role `SPRINT_MANAGER_ROLE` can create/edit/close/default.
- Any member can view progress and set sprint on their own thread if enabled by guild setting.

**Error Handling**
- Rate‑limit safe: use defers and guarded replies (consistent with existing patterns).
- Large sprint lists: fallback to autocomplete option instead of select menu overflow (25 options cap).
- Partial sync: log and surface external sync failures without breaking local state.

**Telemetry & Logging**
- Log sprint create/edit/close with actor and guild.
- Log assignment/unassignment with entity links (thread, GitHub, Jira).
- Aggregate metrics for progress and burndown generation.

**Rollout Phases**
- Phase 1: Core entities, `/sprint create|set|progress|list`, optional prompt during bug/feature creation.
- Phase 2: `/sprint edit|unset|close|default|current`, GitHub/Jira synchronization.
- Phase 3: Burndown images, velocity, dashboard navigation, retros notes.

