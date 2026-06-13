**Create Sprint (Modal)**
- Trigger: `/sprint create`.
- Flow:
  - Validate permissions.
  - Show Modal (Name, Goal, Dates, Velocity, Team, External Refs).
  - On submit: create sprint, reply with ephemeral embed + action buttons.

**Set Sprint (Dropdown/Autocomplete)**
- Trigger: `/sprint set [sprint]`.
- Without arg:
  - Reply with `StringSelectMenu` listing active sprints (≤ 25); include a “Search” button if too many.
- With arg:
  - Use autocomplete to filter by name; assign immediately on selection.
- After assign:
  - Update `Thread.sprintId`.
  - Attempt GitHub/Jira sync.
  - Reply success/partial with details.

**Unset Sprint**
- Trigger: `/sprint unset`.
- Remove `Thread.sprintId`, attempt external cleanup.

**Progress View**
- Trigger: `/sprint progress [sprint]`.
- Embed contents:
  - Header: sprint name, state, dates.
  - Counters: total, open, closed.
  - Points: total, remaining, completed (if available).
  - Burndown summary: remaining vs time (plus chart link/button).
  - Actions: View Board (external), List Items, Next/Prev page.

**List Sprints**
- Trigger: `/sprint list [state]`.
- Paged embed with actions to jump to Progress or Set as Default.

**Edit/Close (Modal)**
- `/sprint edit [sprint]`: modal prefilled; save changes.
- `/sprint close [sprint]`: optional retro notes; state → completed.

**Bug/Feature Integration**
- Add optional sprint step to existing creation flows when ≥ 1 active sprint:
  - Show a compact select after team/forum selection.
  - If `defaultSprintId` and `autoAssignNewIssues` enabled, auto‑assign silently and show notice.

**Components & Events**
- Use existing reply guard pattern and ephemeral flags.
- Autocomplete handlers for `sprint` option across subcommands.
- Buttons/SelectMenus prefixed IDs: `sprint_*` for routing.

**Progress Calculations**
- Item set = all threads with `sprintId = X`.
- For each thread, include linked GitHub/Jira issues.
- Counts: unique issues (fallback to thread) by open/closed.
- Points: sum from Jira field or GitHub label/body; fallback 1/issue.
- Burndown: compute remaining per day from `SprintEvent` + snapshots; render simple image or emoji bars in v1.

