- **feat(dashboard):** new "History" tab on `/dashboard/orchestration` — an Airflow-style grid of
  finished runs over a 24h/7d/30d preset window, one row per (source, identity), clicking a cell
  opens the existing detail drawer. It is backed by real persistence: A2A task lifecycle
  transitions are now written to the `a2a_tasks` table (purged after 30 days, configurable via
  `OMNIROUTE_A2A_HISTORY_RETENTION_DAYS`) and served by the new
  `GET /api/a2a/tasks/history` listing endpoint, with the task-detail route falling back to
  persisted history once a run leaves the in-memory snapshot. Conductor runs stay remote and are
  not persisted locally — the tab says so instead of silently omitting them.
