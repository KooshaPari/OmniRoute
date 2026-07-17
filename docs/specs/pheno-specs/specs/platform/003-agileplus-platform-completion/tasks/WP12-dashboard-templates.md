---
work_package_id: WP12
title: Dashboard Templates
lane: "done"
dependencies: []
base_branch: main
base_commit: 1b07d982092e6204860e14ddcc1576c531ea20f2
created_at: '2026-03-02T12:16:16.588482+00:00'
subtasks: [T071, T072, T073, T074, T075, T076, T077]
shell_pid: "34847"
agent: "claude-opus"
reviewed_by: "Koosha Paridehpour"
review_status: "approved"
history:
- date: '2026-03-02'
  action: created
  by: spec-kitty
---

## Objective

Create `crates/agileplus-dashboard` and Askama HTML templates in `templates/` at repo root.

Implementation command: `spec-kitty implement WP12 --base WP11`

## Subtasks

### T071: Scaffold Crate and Template Structure

Create new crate with Askama integration:

**Cargo.toml:**
- askama = "0.12"
- axum
- agileplus-domain
- agileplus-events
- tokio
- serde / serde_json
- chrono

**Template directory structure (at repo root):**
```
templates/
├── base.html
├── partials/
│   ├── kanban.html
│   ├── feature-card.html
│   ├── wp-list.html
│   ├── event-timeline.html
│   ├── health-panel.html
│   └── agent-activity.html
├── pages/
│   ├── dashboard.html
│   ├── feature-detail.html
│   └── settings.html
└── static/
    ├── htmx.min.js (v2.0)
    ├── alpine.min.js (v3.x)
    └── style.css
```

Configure Askama in `Cargo.toml`:
```toml
[package.metadata.askama]
dirs = ["../templates"]
```

### T072: base.html

Full-page layout template with navigation and structure:

**Features:**
- Navigation bar with AgilePlus logo and main links (Dashboard, Features, Events, Settings)
- Sidebar with feature list and quick filters
- Main content area with block for page-specific content
- Footer with platform version and timestamp
- Script tags for htmx.min.js (v2.0), alpine.min.js (v3.x)
- CSS link to style.css
- Keycap palette: dark mode, monospace fonts, high-contrast borders

**Structure:**
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AgilePlus — {% block title %}Dashboard{% endblock %}</title>
  <link rel="stylesheet" href="/static/style.css">
  <script src="/static/htmx.min.js"></script>
  <script src="/static/alpine.min.js" defer></script>
</head>
<body class="bg-zinc-900 text-zinc-100">
  <nav class="border-b border-zinc-700">...</nav>
  <div class="flex">
    <aside class="w-64 border-r border-zinc-700">...</aside>
    <main class="flex-1">
      {% block content %}{% endblock %}
    </main>
  </div>
  <footer class="border-t border-zinc-700 text-sm">...</footer>
</body>
</html>
```

### T073: kanban.html

Kanban board partial for feature workflow visualization:

**Features:**
- Columns for each FeatureState (created through retrospected)
- Feature cards in each column with title, state badge, WP count, labels
- hx-get="/api/dashboard/kanban" hx-trigger="load, sse:feature_updated"
- Drag-drop ready (event handlers added in T079)

**Structure:**
```html
<div id="kanban-board"
     hx-get="/api/dashboard/kanban"
     hx-trigger="load, sse:feature_updated"
     class="flex gap-4 p-4 overflow-x-auto">
  {% for state in states %}
    <div class="kanban-column min-w-80 bg-zinc-800 rounded border border-zinc-700">
      <h3 class="px-4 py-2 font-mono font-bold border-b border-zinc-700">
        {{ state }} ({{ cards[state]|length }})
      </h3>
      <div class="p-2 space-y-2" data-state="{{ state }}">
        {% for feature in cards[state] %}
          {% include "partials/feature-card.html" %}
        {% endfor %}
      </div>
    </div>
  {% endfor %}
</div>
```

### T074: feature-detail.html

Feature detail page with full context:

**Sections:**
- Header: title, state, labels, sync status (local/remote/conflict)
- Work packages list with progress bar
- Event timeline (last 20 events)
- Audit trail section showing who did what and when
- Action buttons: transition state, sync, dispatch agent

**Example layout:**
```html
<div class="p-6">
  <div class="border-b border-zinc-700 pb-6">
    <h1 class="text-3xl font-bold">{{ feature.title }}</h1>
    <div class="flex gap-2 mt-2">
      <span class="badge badge-{{ feature.state }}">{{ feature.state }}</span>
      {% for label in feature.labels %}
        <span class="badge badge-gray">{{ label }}</span>
      {% endfor %}
    </div>
  </div>

  <div class="mt-6">
    <h2>Work Packages</h2>
    {% include "partials/wp-list.html" %}
  </div>

  <div class="mt-6">
    <h2>Event Timeline</h2>
    {% include "partials/event-timeline.html" %}
  </div>

  <div class="mt-6 flex gap-2">
    <button hx-post="/api/features/{{ feature.id }}/transition"
            hx-vals='{"target_state":"implementing"}'
            class="btn btn-primary">
      → Implementing
    </button>
    <button hx-post="/api/features/{{ feature.id }}/sync"
            class="btn btn-secondary">
      Sync with Plane
    </button>
  </div>
</div>
```

### T075: wp-list.html

Work package list partial with progress visualization:

**Table columns:** WP title, state, assignee, progress bar, task count

**Features:**
- hx-get="/api/dashboard/features/{id}/work-packages"
- Refreshes on sse:wp_updated events

**Example:**
```html
<table class="w-full border-collapse text-sm">
  <thead>
    <tr class="border-b border-zinc-700">
      <th class="text-left p-2">Title</th>
      <th class="text-left p-2">State</th>
      <th class="text-left p-2">Progress</th>
    </tr>
  </thead>
  <tbody>
    {% for wp in workpackages %}
      <tr class="border-b border-zinc-700 hover:bg-zinc-700">
        <td class="p-2"><a href="/api/dashboard/wp/{{ wp.id }}">{{ wp.title }}</a></td>
        <td class="p-2"><span class="badge badge-{{ wp.state }}">{{ wp.state }}</span></td>
        <td class="p-2">
          <div class="w-32 h-2 bg-zinc-700 rounded">
            <div class="h-2 bg-green-600 rounded" style="width: {{ wp.progress }}%"></div>
          </div>
        </td>
      </tr>
    {% endfor %}
  </tbody>
</table>
```

### T076: health-panel.html

Service health status cards:

**Features:**
- Card per service: NATS, Dragonfly, Neo4j, MinIO, SQLite, API
- Status indicator: green (healthy), yellow (degraded), red (unavailable)
- Uptime, latency, last check time
- hx-get="/api/dashboard/health" hx-trigger="every 10s"

**Example card:**
```html
<div class="health-card bg-zinc-800 rounded border border-green-700 p-4">
  <div class="flex items-center justify-between">
    <h3 class="font-mono font-bold">NATS</h3>
    <span class="w-3 h-3 rounded-full bg-green-500"></span>
  </div>
  <div class="text-xs text-zinc-400 mt-2">
    <div>Latency: 2ms</div>
    <div>Last check: 5s ago</div>
  </div>
</div>
```

### T077: Wire htmx Routes in agileplus-dashboard

Create route handlers that return correct template format:

**Routes:**
- `GET /dashboard` → render full `pages/dashboard.html` page
- `GET /api/dashboard/kanban` → return partial `kanban.html` (if HxRequest header present)
- `GET /api/dashboard/features/:id` → return full `feature-detail.html` or partial
- `GET /api/dashboard/features/:id/work-packages` → return `wp-list.html` partial
- `GET /api/dashboard/health` → return `health-panel.html` partial
- `GET /api/dashboard/events` → return `event-timeline.html` partial

**Middleware:**
Check HxRequest header: if htmx request → return partial only, else → return full page layout

**Example handler:**
```rust
pub async fn kanban_board(
    State(state): State<AppState>,
    HxRequest(is_htmx): HxRequest,
) -> impl IntoResponse {
    let features = state.repo.list_features().await;
    let grouped = group_by_state(features);

    if is_htmx {
        KanbanPartial { data: grouped }.into_response()
    } else {
        DashboardPage { kanban: grouped }.into_response()
    }
}
```

## Definition of Done

- Dashboard loads in browser at http://localhost:8080/dashboard
- Kanban board displays features grouped by state
- Health panel refreshes every 10 seconds and shows accurate service status
- All partials render correctly within full page layout
- Style.css applies keycap palette (dark, monospace, high contrast)
- htmx and Alpine.js libraries load successfully

## Activity Log

- 2026-03-02T12:16:16Z – claude-opus – shell_pid=34847 – lane=doing – Assigned agent via workflow command
- 2026-03-02T12:38:58Z – claude-opus – shell_pid=34847 – lane=for_review – Ready for review: dashboard crate with Askama templates, htmx routes, keycap dark theme (4 tests)
- 2026-03-02T23:19:34Z – claude-opus – shell_pid=34847 – lane=done – Merged to main, 516 tests passing
