**Command Matrix**
- `/sprint create`: Opens modal to create a sprint.
- `/sprint set [sprint]`: Assigns current thread/linked issue to a sprint.
- `/sprint unset`: Removes sprint from current thread/linked issue.
- `/sprint progress [sprint]`: Shows progress (counts, points, burndown).
- `/sprint list [state]`: Lists sprints (active/upcoming/completed).
- `/sprint edit [sprint]`: Opens modal to edit a sprint.
- `/sprint close [sprint]`: Marks sprint completed.
- `/sprint current`: Shows default active sprint.
- `/sprint default [sprint]`: Sets default sprint for auto‑assignment.

**Notes**
- Use `/sprint set` for assignment. Do not create a separate `/set-sprint` command.
- Inline search is provided via `sprint` string option with autocomplete.
- Without args, `/sprint set` shows a dropdown of active sprints.

**/sprint create**
- Modal fields:
  - Name: short, unique per guild.
  - Goal: short description.
  - Start date: ISO or friendly parse.
  - End date: ISO or friendly parse.
  - Velocity target (optional): number.
  - Team (optional): maps to existing Team model.
  - External refs (optional): GitHub Milestone name; Jira Sprint/Board.
- Response:
  - Ephemeral confirmation embed with quick actions: Set Default, Edit, Close, View Progress.

**/sprint set [sprint]**
- Context: in a forum thread or with a linked issue reference.
- Options:
  - `sprint` (string, autocomplete): fuzzy search by name.
- Behaviors:
  - No option provided: present a `StringSelectMenu` of active sprints.
  - With option: immediately assign and confirm.
  - On success: update thread’s `sprintId`, attempt external sync (GitHub/Jira).
  - On failure: show partial success with details.

**/sprint unset**
- Removes sprint from the current thread and attempts to clear external mappings.

**/sprint progress [sprint]**
- Options:
  - `sprint` (string, autocomplete): defaults to current thread’s sprint or default active if omitted.
- Output embed:
  - State: planned/active/completed.
  - Dates: start/end.
  - Counts: total issues, open/closed.
  - Points (if available): total, remaining, completed.
  - Burndown summary + link/button to detailed view.

**/sprint list [state]**
- Options:
  - `state` (choice): active, upcoming, completed (default active).
- Output: paginated list with buttons; supports select to jump to `/sprint progress`.

**/sprint edit [sprint]**
- Opens modal with current values; supports changing name, dates, goal, velocity target, external refs.

**/sprint close [sprint]**
- Marks sprint completed; optional modal for retro notes.

**/sprint current**
- Displays the default sprint for the guild and whether auto‑assignment is enabled for bug/feature flows.

**/sprint default [sprint]**
- Sets default sprint; toggle auto‑assignment for newly created bug/feature threads.

**Autocomplete**
- Implemented for `sprint` option on: `set`, `progress`, `edit`, `close`, `default`.
- Fuzzy matching with top N results, respecting Discord suggestion caps.

**Permissions**
- `create|edit|close|default`: restricted to `Manage Threads` or configured manager role.
- `set|unset|progress|list|current`: open; can be configured to restrict `set|unset`.

