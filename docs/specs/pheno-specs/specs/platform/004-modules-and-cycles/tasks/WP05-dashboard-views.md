---
work_package_id: WP05
title: Dashboard Module & Cycle Views
lane: planned
dependencies: []
subtasks: [T024, T025, T026, T027, T028]
phase: Phase 4 - Dashboard
estimated_lines: 400
frs: [FR-D01, FR-D02, FR-D03, FR-D04]
priority: P3
---

# WP05: Dashboard Module & Cycle Views

## Implementation Command

```bash
spec-kitty implement WP05 --base WP02
```

WP02 must be merged. WP05 can run in parallel with WP03, WP04, and WP06.

## Objectives

Add Module and Cycle views to the `agileplus-api` dashboard crate. This includes:
- REST API routes for serving Module tree and Cycle data as JSON (for programmatic access).
- Askama HTML templates for the Module tree sidebar, Cycle kanban board, and Cycle detail page.
- SSE event type extensions to push Module/Cycle change events to connected browser clients.
- Wire new routes into the axum router.

### Success Criteria

- `GET /api/modules` returns JSON array of root modules with child counts.
- `GET /api/modules/{id}/tree` returns full recursive module tree.
- `GET /api/cycles` returns all cycles (optionally filtered by `?state=active`).
- `GET /api/cycles/{id}` returns `CycleWithFeatures` as JSON.
- `GET /modules` renders the module tree sidebar HTML template.
- `GET /cycles` renders the cycle kanban board HTML template.
- `GET /cycles/{id}` renders the cycle detail HTML template with WP burndown.
- SSE stream emits `module_created`, `module_updated`, `cycle_created`, `cycle_state_changed`
  events when the corresponding operations are performed.
- `cargo check -p agileplus-api` zero errors; Askama templates compile.
- All new HTML routes return HTTP 200 with `Content-Type: text/html`.

## Context & Constraints

- **Crate**: `crates/agileplus-api` (axum + askama). Examine existing routes and templates
  in that crate to understand the pattern. The SSE infrastructure from spec003 is already
  present -- extend it rather than rewriting it.
- **Askama**: Templates live in `crates/agileplus-api/templates/`. Templates are compiled at
  build time. All template variables must have correct Rust types with `Display` impl or be
  serializable as strings.
- **SSE**: The existing SSE broadcast channel is typed (likely `tokio::sync::broadcast::Sender<SseEvent>`
  or similar). Add new event variants to the existing `SseEvent` enum rather than creating a
  new channel. Check `crates/agileplus-api/src/sse.rs` (or equivalent) for the pattern.
- **No new crate dependencies** unless absolutely necessary and justified.
- **Module tree recursion in templates**: Askama does not natively support recursive templates.
  Build a flattened list of `(Module, depth: usize)` tuples in Rust and pass that to the template.
- **Files**:
  - NEW: `crates/agileplus-api/src/routes/module.rs`
  - NEW: `crates/agileplus-api/src/routes/cycle.rs`
  - NEW: `crates/agileplus-api/templates/module_tree.html`
  - NEW: `crates/agileplus-api/templates/cycle_kanban.html`
  - NEW: `crates/agileplus-api/templates/cycle_detail.html`
  - MODIFIED: `crates/agileplus-api/src/routes/mod.rs` -- add `pub mod module; pub mod cycle;`
  - MODIFIED: `crates/agileplus-api/src/lib.rs` or router file -- wire routes
  - MODIFIED: SSE event enum file -- add new event variants

---

## Subtask Guidance

### T024 - Add Module and Cycle API Routes

**Purpose**: Expose JSON endpoints that the frontend templates (and external tooling) can consume.

**Files**: `crates/agileplus-api/src/routes/module.rs` and `cycle.rs`

**Steps**:

1. In `module.rs`, define axum handlers:

   ```rust
   /// GET /api/modules
   /// Returns all root modules with feature counts. Traces to: FR-D01, FR-D04
   pub async fn list_modules(
       State(storage): State<Arc<dyn StoragePort>>,
   ) -> Result<Json<Vec<Module>>, ApiError> {
       let modules = storage.list_root_modules().await.map_err(ApiError::Domain)?;
       Ok(Json(modules))
   }

   /// GET /api/modules/:id
   pub async fn get_module(
       Path(id): Path<i64>,
       State(storage): State<Arc<dyn StoragePort>>,
   ) -> Result<Json<ModuleWithFeatures>, ApiError> {
       storage.get_module_with_features(id).await
           .map_err(ApiError::Domain)?
           .map(Json)
           .ok_or(ApiError::NotFound(format!("module {id}")))
   }

   /// GET /api/modules/:id/tree
   /// Returns flattened tree as Vec<(Module, depth)>
   pub async fn get_module_tree(
       Path(id): Path<i64>,
       State(storage): State<Arc<dyn StoragePort>>,
   ) -> Result<Json<Vec<ModuleTreeNode>>, ApiError> { ... }
   ```

2. Define `ModuleTreeNode` in `module.rs`:

   ```rust
   #[derive(Debug, Serialize)]
   pub struct ModuleTreeNode {
       pub module: Module,
       pub depth: usize,
       pub owned_count: usize,
       pub tagged_count: usize,
   }
   ```

3. Implement `get_module_tree` using a recursive async helper that builds the flattened list:

   ```rust
   async fn flatten_tree(
       module_id: i64,
       depth: usize,
       storage: &dyn StoragePort,
       out: &mut Vec<ModuleTreeNode>,
   ) -> Result<(), DomainError> {
       let mwf = storage.get_module_with_features(module_id).await?;
       if let Some(mwf) = mwf {
           out.push(ModuleTreeNode {
               owned_count: mwf.owned_features.len(),
               tagged_count: mwf.tagged_features.len(),
               depth,
               module: mwf.module,
           });
           for child in mwf.child_modules {
               Box::pin(flatten_tree(child.id, depth + 1, storage, out)).await?;
           }
       }
       Ok(())
   }
   ```

4. In `cycle.rs`, define handlers:

   ```rust
   /// GET /api/cycles?state=active
   pub async fn list_cycles(
       Query(params): Query<CycleListParams>,
       State(storage): State<Arc<dyn StoragePort>>,
   ) -> Result<Json<Vec<Cycle>>, ApiError> { ... }

   /// GET /api/cycles/:id
   pub async fn get_cycle(
       Path(id): Path<i64>,
       State(storage): State<Arc<dyn StoragePort>>,
   ) -> Result<Json<CycleWithFeatures>, ApiError> { ... }
   ```

5. Define `CycleListParams`:

   ```rust
   #[derive(Debug, Deserialize)]
   pub struct CycleListParams {
       pub state: Option<String>,
   }
   ```

**Validation**: API routes compile; manual `curl /api/modules` returns JSON.

---

### T025 - Create module_tree.html Askama Template

**Purpose**: Render the Module hierarchy as an expandable sidebar tree. Traces to FR-D01, FR-D04.

**File**: `crates/agileplus-api/templates/module_tree.html` (create new)

**Steps**:

1. Define the Askama template struct in `module.rs`:

   ```rust
   #[derive(Template)]
   #[template(path = "module_tree.html")]
   pub struct ModuleTreeTemplate {
       pub nodes: Vec<ModuleTreeNode>,
   }
   ```

2. Write the template. Since Askama does not support recursion, iterate the pre-flattened `nodes`
   list and use CSS `padding-left` based on `depth` for visual indentation:

   ```html
   <!DOCTYPE html>
   <html>
   <head><title>Modules</title></head>
   <body>
   <nav class="module-tree">
     <h2>Modules</h2>
     <ul>
     {% for node in nodes %}
       <li style="padding-left: {{ node.depth * 16 }}px">
         <a href="/modules/{{ node.module.id }}">
           {{ node.module.friendly_name }}
         </a>
         <span class="counts">
           ({{ node.owned_count }} owned, {{ node.tagged_count }} tagged)
         </span>
       </li>
     {% endfor %}
     </ul>
   </nav>
   </body>
   </html>
   ```

3. Add a `GET /modules` route handler that builds the full tree starting from all root modules,
   flattens it using `flatten_tree`, and renders `ModuleTreeTemplate`:

   ```rust
   pub async fn module_tree_page(
       State(storage): State<Arc<dyn StoragePort>>,
   ) -> Result<Html<String>, ApiError> {
       let roots = storage.list_root_modules().await.map_err(ApiError::Domain)?;
       let mut nodes = Vec::new();
       for root in &roots {
           flatten_tree(root.id, 0, storage.as_ref(), &mut nodes).await
               .map_err(ApiError::Domain)?;
       }
       let tmpl = ModuleTreeTemplate { nodes };
       Ok(Html(tmpl.render().map_err(|e| ApiError::Template(e.to_string()))?))
   }
   ```

**Validation**: `cargo check -p agileplus-api` compiles; `curl /modules` returns HTML with module list.

---

### T026 - Create cycle_kanban.html Template

**Purpose**: Render Cycles as a kanban board with state columns and Feature cards. Traces to FR-D02.

**File**: `crates/agileplus-api/templates/cycle_kanban.html`

**Steps**:

1. Define the template struct in `cycle.rs`:

   ```rust
   #[derive(Debug)]
   pub struct CycleColumnEntry {
       pub cycle: Cycle,
       pub feature_count: usize,
   }

   #[derive(Template)]
   #[template(path = "cycle_kanban.html")]
   pub struct CycleKanbanTemplate {
       pub draft:    Vec<CycleColumnEntry>,
       pub active:   Vec<CycleColumnEntry>,
       pub review:   Vec<CycleColumnEntry>,
       pub shipped:  Vec<CycleColumnEntry>,
       pub archived: Vec<CycleColumnEntry>,
   }
   ```

2. Add `GET /cycles` page handler that:
   - Fetches all cycles via `storage.list_cycles(None).await?`.
   - For each cycle, fetches `get_cycle_with_features` to get the feature count.
   - Partitions into state buckets.
   - Renders `CycleKanbanTemplate`.

3. Write the HTML template with 5 state columns:

   ```html
   <!DOCTYPE html>
   <html>
   <head><title>Cycles</title></head>
   <body>
   <div class="kanban">
     <div class="column">
       <h3>Draft ({{ draft|length }})</h3>
       {% for entry in draft %}
         <div class="card">
           <a href="/cycles/{{ entry.cycle.id }}">{{ entry.cycle.name }}</a>
           <div>{{ entry.cycle.start_date }} - {{ entry.cycle.end_date }}</div>
           <div>{{ entry.feature_count }} features</div>
         </div>
       {% endfor %}
     </div>
     {# Repeat for active, review, shipped, archived #}
   </div>
   </body>
   </html>
   ```

   Note: Askama uses `{{ value|length }}` filter syntax. Verify with the Askama version in use.
   If `|length` is not available, pass the length pre-computed in the struct.

**Validation**: `GET /cycles` returns HTML with 5 columns; cycles appear in correct column.

---

### T027 - Create cycle_detail.html Template

**Purpose**: Show a Cycle's full detail with feature progress table and WP burndown. Traces to FR-D03.

**File**: `crates/agileplus-api/templates/cycle_detail.html`

**Steps**:

1. Define the template struct:

   ```rust
   #[derive(Template)]
   #[template(path = "cycle_detail.html")]
   pub struct CycleDetailTemplate {
       pub cwf: CycleWithFeatures,
       pub scope_module_name: Option<String>,
       pub days_remaining: i64,
   }
   ```

2. Add `GET /cycles/:id` page handler:
   - Fetch `CycleWithFeatures`.
   - Compute `days_remaining = (cwf.cycle.end_date - today).num_days()`.
   - If `module_scope_id` is set, fetch module name for display.
   - Render template.

3. Write the template:

   ```html
   <!DOCTYPE html>
   <html>
   <head><title>Cycle: {{ cwf.cycle.name }}</title></head>
   <body>
   <h1>{{ cwf.cycle.name }}</h1>
   <p>State: {{ cwf.cycle.state }}</p>
   <p>{{ cwf.cycle.start_date }} to {{ cwf.cycle.end_date }}
      ({{ days_remaining }} days remaining)</p>
   {% if let Some(scope) = scope_module_name %}
   <p>Scope: {{ scope }}</p>
   {% endif %}

   <h2>WP Burndown</h2>
   <table>
     <tr><th>State</th><th>Count</th></tr>
     <tr><td>Done</td><td>{{ cwf.wp_progress.done }}</td></tr>
     <tr><td>In Progress</td><td>{{ cwf.wp_progress.in_progress }}</td></tr>
     <tr><td>Planned</td><td>{{ cwf.wp_progress.planned }}</td></tr>
     <tr><td>Blocked</td><td>{{ cwf.wp_progress.blocked }}</td></tr>
     <tr><td>Total</td><td>{{ cwf.wp_progress.total }}</td></tr>
   </table>

   <h2>Features ({{ cwf.features|length }})</h2>
   <table>
     <tr><th>Slug</th><th>State</th></tr>
     {% for f in cwf.features %}
     <tr><td>{{ f.slug }}</td><td>{{ f.state }}</td></tr>
     {% endfor %}
   </table>
   </body>
   </html>
   ```

   Note: Askama `{% if let Some(...) %}` syntax -- verify with crate version. If unavailable, use
   `{% if scope_module_name.is_some() %}{{ scope_module_name.as_deref().unwrap_or("") }}{% endif %}`.

**Validation**: `GET /cycles/{id}` renders full detail with burndown table.

---

### T028 - Wire Routes into API Router and Add SSE Event Types

**Purpose**: Register all new routes with the axum router and extend the SSE event stream with
Module/Cycle events. Traces to FR-D01, FR-D02, FR-D03, FR-D04.

**Files**: router file, SSE event enum file

**Steps**:

1. Locate the axum router definition (likely in `crates/agileplus-api/src/lib.rs` or `router.rs`).
   Add new routes:

   ```rust
   // Module routes
   .route("/api/modules",          get(routes::module::list_modules))
   .route("/api/modules/:id",      get(routes::module::get_module))
   .route("/api/modules/:id/tree", get(routes::module::get_module_tree))
   .route("/modules",              get(routes::module::module_tree_page))
   // Cycle routes
   .route("/api/cycles",    get(routes::cycle::list_cycles))
   .route("/api/cycles/:id", get(routes::cycle::get_cycle))
   .route("/cycles",        get(routes::cycle::cycle_kanban_page))
   .route("/cycles/:id",    get(routes::cycle::cycle_detail_page))
   ```

2. Find the SSE event enum (likely `SseEvent` or `DashboardEvent`). Add new variants:

   ```rust
   ModuleCreated { id: i64, slug: String },
   ModuleUpdated { id: i64, slug: String },
   ModuleDeleted { id: i64 },
   CycleCreated  { id: i64, name: String },
   CycleStateChanged { id: i64, name: String, new_state: String },
   CycleDeleted  { id: i64 },
   ```

3. Ensure the SSE serialization (JSON event data) includes the new variants. Check how existing
   events are serialised to SSE wire format (`data: {...}\n\n`).

4. Add `pub mod module; pub mod cycle;` to `crates/agileplus-api/src/routes/mod.rs`.

5. Add any necessary `ApiError` variants for new error cases (e.g., `ApiError::Template(String)`
   if not already present).

**Validation**: `cargo check -p agileplus-api` zero errors; Askama templates compile. Integration test:
start the API server, navigate to `/modules` and `/cycles`, verify HTML is rendered.
