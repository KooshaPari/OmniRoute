**Sprint Operations**
- Create: `/sprint create` → modal for name, dates, goal.
- Activate: `/sprint activate sprint:<id>` → sets state to active regardless of dates.
- Default: `/sprint default sprint:<id> auto:true|false` → sets default and auto-assign behavior.
- Refs: `/sprint refs sprint:<id> github_milestone:"Name" jira_sprint_id:<id>` → optional sync targets.
- Assign thread: `/sprint set [sprint]` → dropdown or autocomplete.
- Progress: `/sprint progress [sprint]` → shows counts and points.
- List: `/sprint list state:active|planned|completed|canceled`.
- Close: `/sprint close sprint:<id>` → marks completed.

**Behavior Notes**
- Creation de-dupes by `(guildId, name)` to avoid duplicates.
- “Active sprints” include state=active (not planned). Use `/sprint activate` if you need immediate activation.
- Auto-assign: when enabled, new bug/feature threads are assigned to default sprint.
- Forum flow: shows sprint picker when active sprints exist and auto-assign is off.

**External Sync**
- GitHub: adds `sprint:<name>` label on assignment; if milestone is configured via refs, sets/creates it automatically.
- Jira: if `JIRA_SPRINT_FIELD` is set and `jira_sprint_id` is configured via refs, sets the sprint custom field on assignment.

**Cleanup**
- Legacy `/github-manage` and `/jira-manage` commands are removed from registration. Use `/link` and `/forum-report` flows.

