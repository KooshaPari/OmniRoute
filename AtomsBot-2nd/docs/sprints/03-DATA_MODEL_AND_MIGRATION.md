**Entities**
- `Sprint`:
  - `id` (string, cuid/uuid)
  - `guildId` (string)
  - `name` (string, unique per guild)
  - `goal` (string?)
  - `state` (enum: planned|active|completed|canceled)
  - `startDate` (datetime)
  - `endDate` (datetime)
  - `velocityTarget` (int?)
  - `teamId` (string?) → links to `Team`
  - `githubMilestone` (string?)
  - `jiraBoardId` (string?)
  - `jiraSprintId` (string?)
  - `createdAt`/`updatedAt`
- `SprintEvent` (audit for metrics):
  - `id`
  - `sprintId`
  - `type` (created|edited|closed|assigned|unassigned|scope_added|scope_removed)
  - `entityType` (thread|github|jira)
  - `entityId`
  - `payload` (json?)
  - `createdAt`
- `Thread` (existing): add `sprintId` (nullable) as canonical assignment.

**Link Strategy**
- Canonical assignment lives on `Thread.sprintId`.
- For GitHub/Jira, use existing link tables to discover external issues and attempt syncing:
  - GitHub: set `milestone` or apply label `sprint:<name>`.
  - Jira: set sprint field via API for `jiraSprintId`/`jiraBoardId` when available.
- If a thread has multiple external issues, apply to all linked items; non‑blocking per item.

**Burndown/Velocity**
- Points sources:
  - Jira story points field (board’s configured custom field).
  - GitHub fallback: `points:<N>` label or body YAML `points: N`.
  - Default weight = 1 when not available.
- Burndown data can be synthesized from `SprintEvent` + periodic snapshots:
  - Nightly snapshot job to compute remaining points.
  - Inline computation on demand for recent activity.

**Prisma Migration (proposed)**
- `Sprint` model and `SprintEvent` model.
- Add `sprintId` field on `Thread` with relation to `Sprint`.
- Indices:
  - `Sprint (guildId, name)` unique.
  - `Thread (sprintId)` index.

**Backfill**
- Optional script to infer sprint from existing GitHub milestones or Jira sprints and assign to linked threads.
- Skips if conflicts; logs actionable report.

**Config**
- Guild settings extension:
  - `defaultSprintId` (nullable)
  - `autoAssignNewIssues` (boolean)
- External integration switches to opt‑in sprint synchronization.

