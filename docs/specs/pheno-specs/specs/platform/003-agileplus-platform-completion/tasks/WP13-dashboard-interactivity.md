---
work_package_id: WP13
title: Dashboard Interactivity
lane: "done"
dependencies: []
base_branch: main
base_commit: 6c61f452547eb4071c874c4c352e6f0d1991c52a
created_at: '2026-03-02T17:31:27.245597+00:00'
subtasks: [T078, T079, T080, T081, T082, T083]
shell_pid: "6757"
agent: "claude-opus"
reviewed_by: "Koosha Paridehpour"
review_status: "approved"
history:
- date: '2026-03-02'
  action: created
  by: spec-kitty
---

## Objective

Add Alpine.js interactivity, SSE live updates, and action triggers to dashboard.

Implementation command: `spec-kitty implement WP13 --base WP12`

## Subtasks

### T078: SSE Connection in Base Template

Add Server-Sent Events connection to base.html:

**Implementation:**
```html
<div hx-ext="sse" sse-connect="/api/stream?api_key={{ api_key }}">
  <!-- Page content receives SSE events -->
</div>
```

**Behavior:**
- Kanban board subscribes to `sse:feature_updated` events
- Feature detail page subscribes to `sse:wp_updated` events
- On event received, swap the affected card/component using htmx
- Gracefully reconnect on connection loss (htmx handles retry)

**Example in kanban.html:**
```html
<div id="feature-{{ feature.id }}"
     class="feature-card"
     hx-swap="outerHTML"
     hx-trigger="sse:feature_updated[id==feature-{{ feature.id }}]">
  ...
</div>
```

### T079: Kanban Drag-Drop with Alpine.js

Implement drag-and-drop state transitions:

**Alpine component:**
```html
<div x-data="kanbanBoard()" class="kanban">
  <template x-for="column in columns" :key="column.state">
    <div class="kanban-column"
         @drop="handleDrop($event, column.state)"
         @dragover.prevent
         @dragenter="$el.classList.add('drag-over')">
      <template x-for="feature in column.features" :key="feature.id">
        <div draggable="true"
             @dragstart="startDrag($event, feature.id)"
             @dragend="$el.classList.remove('dragging')"
             class="feature-card">
          {{ feature.title }}
        </div>
      </template>
    </div>
  </template>
</div>

<script>
function kanbanBoard() {
  return {
    columns: [],
    draggedId: null,

    startDrag(e, id) {
      this.draggedId = id;
      e.target.classList.add('dragging');
    },

    handleDrop(e, targetState) {
      e.preventDefault();
      e.target.classList.remove('drag-over');

      if (this.draggedId) {
        // POST /api/features/:id/transition with target_state
        htmx.ajax('POST', `/api/features/${this.draggedId}/transition`,
          {
            target: document.body,
            values: { target_state: targetState }
          });
        this.draggedId = null;
      }
    }
  }
}
</script>
```

**Behavior:**
- Drag feature card from one column to another
- On drop: POST `/api/features/:id/transition` with `target_state`
- Server validates transition, updates state, returns 200 or error
- SSE event triggers board refresh automatically

### T080: State Transition Buttons

Add interactive transition buttons on feature cards and detail page:

**On feature cards:**
```html
<div class="feature-card-actions">
  <button hx-post="/api/features/{{ feature.id }}/transition"
          hx-vals='{"target_state": "implementing"}'
          hx-confirm="Transition to implementing?"
          hx-swap="outerHTML"
          class="btn btn-sm btn-primary">
    → Implementing
  </button>
  <button hx-post="/api/features/{{ feature.id }}/transition"
          hx-vals='{"target_state": "researched"}'
          hx-confirm="Move back to researched?"
          class="btn btn-sm btn-secondary">
    ← Researched
  </button>
</div>
```

**On detail page (expanded):**
```html
<div class="state-transitions mt-4">
  <h3 class="font-bold">Transition to:</h3>
  <div class="flex gap-2 flex-wrap">
    {% for state in available_transitions %}
      <button hx-post="/api/features/{{ feature.id }}/transition"
              hx-vals='{"target_state": "{{ state }}"}'
              hx-confirm="Transition to {{ state }}?"
              hx-swap="outerHTML swap:1s"
              class="btn btn-{{ state }}">
        {{ state }}
      </button>
    {% endfor %}
  </div>
</div>
```

**Behavior:**
- After successful transition, SSE event updates kanban board
- Failed transitions show error toast
- Confirm dialog prevents accidental transitions

### T081: Agent Activity Panel

Display real-time agent activity:

**In base.html sidebar or dedicated panel:**
```html
<div id="agent-activity"
     class="bg-zinc-800 rounded border border-zinc-700 p-4"
     hx-get="/api/dashboard/agents"
     hx-trigger="every 5s, sse:agent_updated"
     hx-swap="innerHTML swap:0.5s">
  <h3 class="font-bold mb-3">Agent Activity</h3>

  <template x-for="agent in agents">
    <div class="flex items-center gap-2 py-2">
      <span :class="`status-indicator ${agent.status}`"></span>
      <div>
        <div class="font-mono text-sm">{{ agent.name }}</div>
        <div class="text-xs text-zinc-400">{{ agent.current_task }}</div>
        <div class="text-xs text-zinc-500">{{ agent.last_action_ago }}</div>
      </div>
    </div>
  </template>
</div>
```

**Data structure (from /api/dashboard/agents):**
```json
{
  "agents": [
    {
      "name": "spec-kitty",
      "status": "working",
      "current_task": "T046: State mapping",
      "last_action": "2026-03-02T12:34:56Z"
    },
    {
      "name": "sync-oracle",
      "status": "idle",
      "current_task": null,
      "last_action": "2026-03-02T12:30:00Z"
    }
  ]
}
```

**Status colors:**
- `idle`: gray
- `working`: blue
- `error`: red

### T082: Audit Timeline Drill-Down

Implement interactive event timeline with expandable details:

**Template:**
```html
<div id="event-timeline" class="space-y-2">
  <div x-data="{ expanded: null }">
    <template x-for="event in events" :key="event.id">
      <div class="border-l-2 border-zinc-700 pl-4 py-2"
           @click="expanded = expanded === event.id ? null : event.id"
           class="cursor-pointer hover:bg-zinc-800 p-2 rounded">
        <div class="flex justify-between text-sm">
          <span class="font-mono font-bold">{{ event.event_type }}</span>
          <span class="text-zinc-500">{{ event.relative_time }}</span>
        </div>
        <div class="text-xs text-zinc-400">{{ event.actor }} • {{ event.summary }}</div>

        <div x-show="expanded === event.id"
             x-transition
             class="mt-2 bg-zinc-800 p-3 rounded font-mono text-xs overflow-x-auto">
          <pre>{{ event.payload_json }}</pre>
        </div>
      </div>
    </template>
  </div>
</div>
```

**Behavior:**
- Click event row to expand/collapse payload JSON
- Smooth transition animation
- Color-code event types (state_changed=blue, feature_created=green, error=red, etc.)

### T083: Settings Page

Implement settings interface for configuration:

**Page structure:**
```html
<div class="p-6">
  <h1 class="text-3xl font-bold mb-6">Settings</h1>

  <div class="space-y-8">
    <!-- API Key Section -->
    <div class="border-b border-zinc-700 pb-6">
      <h2 class="font-bold mb-3">API Key</h2>
      <div class="bg-zinc-800 p-3 rounded font-mono text-sm flex justify-between">
        <span id="api-key-display">••••••••••••••••••••••••••••</span>
        <button hx-post="/api/settings/reveal-key"
                class="text-blue-500 hover:text-blue-400"
                onclick="revealKey()">Reveal</button>
        <button onclick="copyToClipboard('api-key-display')"
                class="text-blue-500 hover:text-blue-400">Copy</button>
      </div>
    </div>

    <!-- Sync Configuration -->
    <div class="border-b border-zinc-700 pb-6">
      <h2 class="font-bold mb-3">Plane.so Sync</h2>
      <div class="space-y-3">
        <label class="block">
          <span class="text-sm">Workspace Slug</span>
          <input type="text" id="plane-workspace"
                 value="{{ config.plane_workspace }}"
                 class="input mt-1">
        </label>
        <label class="block">
          <span class="text-sm">Project ID</span>
          <input type="text" id="plane-project"
                 value="{{ config.plane_project }}"
                 class="input mt-1">
        </label>
        <label class="flex items-center gap-2">
          <input type="checkbox" id="auto-sync" {% if config.auto_sync %}checked{% endif %}>
          <span class="text-sm">Auto-sync enabled</span>
        </label>
      </div>
    </div>

    <!-- Service URLs -->
    <div class="border-b border-zinc-700 pb-6">
      <h2 class="font-bold mb-3">Service URLs</h2>
      <div class="space-y-3 text-xs">
        <div>NATS: {{ config.nats_url }}</div>
        <div>Dragonfly: {{ config.dragonfly_url }}</div>
        <div>Neo4j: {{ config.neo4j_url }}</div>
        <div>MinIO: {{ config.minio_url }}</div>
      </div>
    </div>

    <!-- Save Button -->
    <button hx-post="/api/settings"
            hx-include="[id='plane-workspace'], [id='plane-project'], [id='auto-sync']"
            class="btn btn-primary">
      Save Settings
    </button>
  </div>
</div>
```

**Behavior:**
- Display current API key (masked by default, reveal on click)
- Copy API key to clipboard
- Edit Plane.so workspace/project
- Toggle auto-sync
- Display read-only service URLs for debugging
- POST /api/settings to persist changes

## Definition of Done

- Drag-drop kanban transitions work and trigger SSE updates
- State transition buttons work with confirm dialogs
- Agent activity panel updates every 5s and via SSE
- Event timeline expands/collapses with detail payload
- Settings page saves and displays configuration
- SSE reconnects automatically on connection loss
- All interactive elements show loading/error states appropriately

## Activity Log

- 2026-03-02T17:31:27Z – claude-opus – shell_pid=6757 – lane=doing – Assigned agent via workflow command
- 2026-03-02T20:46:51Z – claude-opus – shell_pid=6757 – lane=for_review – Ready for review: SSE, drag-drop kanban, transition buttons, agent activity, timeline drill-down, toast notifications
- 2026-03-02T23:19:36Z – claude-opus – shell_pid=6757 – lane=done – Merged to main, 516 tests passing
