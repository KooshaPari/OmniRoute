{
  "id": "L5-104.11",
  "title": "phenotype-monorepo-state deletion schedule (ADR-034)",
  "date": "2026-06-17",
  "device": "macbook",
  "category": "governance",
  "status": "wip",
  "author": "claude opus 4.7",
  "notes": "Schedule deletion of KooshaPari/phenotype-monorepo-state per ADR-034.",
  "tasks": [
    {"id": "T21.0", "title": "ADR-034 authored (30-day grace period)", "status": "done"},
    {"id": "T21.1", "title": "Repo already archived (verified 2026-06-17 22:42 PDT)", "status": "done"},
    {"id": "T21.2", "title": "Open PRs: 0 (verified 2026-06-17 22:42 PDT)", "status": "done"},
    {"id": "T21.3", "title": "Branches: only chore/2026-06-17-governance-fleet-updates (verified 2026-06-17 22:42 PDT)", "status": "done"},
    {"id": "T21.4", "title": "ADR-022 cherry-picked to monorepo docs/adr/2026-06-15/", "status": "done"},
    {"id": "T21.5", "title": "ADR-033 + ADR-034 cross-referenced in AGENTS.md + STATUS.md", "status": "done"},
    {"id": "T21.6", "title": "Pre-deletion checklist (2026-07-17 morning)", "status": "pending", "depends_on": ["T21.0-T21.5"]},
    {"id": "T21.7", "title": "gh repo delete KooshaPari/phenotype-monorepo-state --yes", "status": "pending", "scheduled": "2026-07-17"}
  ],
  "refs": {
    "ADR-033": "docs/adr/2026-06-17/ADR-033-phenotype-monorepo-state-deletion.md",
    "ADR-034": "docs/adr/2026-06-17/ADR-034-monorepo-state-deletion-schedule.md"
  }
}
