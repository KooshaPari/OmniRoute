// SPDX-License-Identifier: MIT OR Apache-2.0

//! SQLite-backed [`TaskStore`] impl.
//!
//! Mirrors the pattern of `audit_store`: an `Arc<tokio::sync::Mutex<Connection>>`
//! with sync impls that use `block_in_place` when called from inside a
//! tokio runtime (so callers can use `Arc<dyn TaskStore>` from both async
//! contexts and plain sync code).
//!
//! The persistent `tasks` row is minimal-query: only `user_id` and `status`
//! are indexed columns. Everything else (`duration_spec`, `deadline`,
//! `chunking`, `constraints`) is JSON blob since we never filter on them
//! and the domain types are already `Serialize + Deserialize`.
//!
//! Traces to: FR-DATA-001, FR-PLAN-001.

use anyhow::{Context, Result};
use focus_planning::{Task, TaskStatus, TaskStore};
use rusqlite::{params, Connection, OptionalExtension};
use std::sync::Arc;
use tokio::sync::Mutex;
use uuid::Uuid;

use super::{parse_rfc3339, rfc3339, SqliteAdapter};

/// SQLite-backed task store. Clone is cheap (Arc).
#[derive(Clone)]
pub struct SqliteTaskStore {
    pub(crate) conn: Arc<Mutex<Connection>>,
}

impl SqliteTaskStore {
    /// Create a new task store from a connection mutex.
    pub fn new(conn: Arc<Mutex<Connection>>) -> Self {
        Self { conn }
    }

    /// Create a new task store from a SqliteAdapter.
    pub fn from_adapter(adapter: &SqliteAdapter) -> Self {
        Self { conn: adapter.conn.clone() }
    }
}

// --- serialization helpers --------------------------------------------------

fn status_tag(status: &TaskStatus) -> &'static str {
    match status {
        TaskStatus::Pending => "pending",
        TaskStatus::Scheduled { .. } => "scheduled",
        TaskStatus::InProgress => "in_progress",
        TaskStatus::Completed => "completed",
        TaskStatus::Cancelled => "cancelled",
    }
}

type TaskRow =
    (String, String, String, String, i64, String, Option<String>, String, String, String, String);

fn task_to_row(user_id: Uuid, task: &Task) -> Result<TaskRow> {
    let duration_spec = serde_json::to_string(&task.duration).context("serialize duration_spec")?;
    let deadline = if task.deadline.when.is_some() {
        Some(serde_json::to_string(&task.deadline).context("serialize deadline")?)
    } else {
        None
    };
    let chunking = serde_json::to_string(&task.chunking).context("serialize chunking")?;
    let constraints = serde_json::to_string(&task.constraints).context("serialize constraints")?;
    // Full TaskStatus (with scheduled chunks) is stashed alongside the tag so
    // we can round-trip Scheduled { chunks } without a separate table.
    let status_json = serde_json::to_string(&task.status).context("serialize status")?;
    // Priority weight is stored scaled to i64 millibeans (3 decimal places) so
    // the column type stays INTEGER as the migration mandates.
    let priority_scaled = (task.priority.weight.clamp(0.0, 1.0) * 1000.0).round() as i64;
    // Pack the status_json into the `status` column by prefixing the tag.
    // Schema: `status` = `"<tag>|<json>"`. Queries can filter with LIKE
    // `'pending|%'` etc.; the index on `(user_id, status)` still narrows.
    let status_col = format!("{}|{}", status_tag(&task.status), status_json);
    Ok((
        task.id.to_string(),
        user_id.to_string(),
        task.title.clone(),
        status_col,
        priority_scaled,
        duration_spec,
        deadline,
        chunking,
        constraints,
        rfc3339(task.created_at),
        rfc3339(task.updated_at),
    ))
}

type TaskRowRead =
    (String, String, String, i64, String, Option<String>, String, String, String, String);

fn row_to_task(row: TaskRowRead) -> Result<Task> {
    let (
        id,
        title,
        status_col,
        priority_scaled,
        duration_spec,
        deadline,
        chunking,
        constraints,
        created_at,
        updated_at,
    ) = row;
    let (_tag, status_json) = status_col
        .split_once('|')
        .ok_or_else(|| anyhow::anyhow!("malformed status column: {status_col}"))?;
    let status: TaskStatus = serde_json::from_str(status_json).context("deserialize status")?;
    let duration = serde_json::from_str(&duration_spec).context("deserialize duration_spec")?;
    let deadline = match deadline {
        Some(s) => serde_json::from_str(&s).context("deserialize deadline")?,
        None => focus_planning::Deadline::none(),
    };
    let chunking = serde_json::from_str(&chunking).context("deserialize chunking")?;
    let constraints = serde_json::from_str(&constraints).context("deserialize constraints")?;
    let priority = focus_planning::Priority::clamped(priority_scaled as f32 / 1000.0);
    Ok(Task {
        id: Uuid::parse_str(&id).context("parse task id")?,
        title,
        duration,
        priority,
        deadline,
        chunking,
        constraints,
        status,
        created_at: parse_rfc3339(&created_at)?,
        updated_at: parse_rfc3339(&updated_at)?,
    })
}

// --- sync helpers -----------------------------------------------------------

fn list_sync(conn: &Connection, user_id: Uuid) -> Result<Vec<Task>> {
    let mut stmt = conn
        .prepare(
            "SELECT id, title, status, priority, duration_spec, deadline, \
             chunking, constraints, created_at, updated_at \
             FROM tasks WHERE user_id = ?1 ORDER BY created_at ASC, id ASC",
        )
        .context("prepare tasks.list")?;
    let rows = stmt
        .query_map(params![user_id.to_string()], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, i64>(3)?,
                row.get::<_, String>(4)?,
                row.get::<_, Option<String>>(5)?,
                row.get::<_, String>(6)?,
                row.get::<_, String>(7)?,
                row.get::<_, String>(8)?,
                row.get::<_, String>(9)?,
            ))
        })
        .context("query tasks.list")?;
    let mut out = Vec::new();
    for row in rows {
        out.push(row_to_task(row.context("tasks row")?)?);
    }
    Ok(out)
}

fn get_sync(conn: &Connection, id: Uuid) -> Result<Option<Task>> {
    let row = conn
        .query_row(
            "SELECT id, title, status, priority, duration_spec, deadline, \
             chunking, constraints, created_at, updated_at \
             FROM tasks WHERE id = ?1",
            params![id.to_string()],
            |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, String>(2)?,
                    row.get::<_, i64>(3)?,
                    row.get::<_, String>(4)?,
                    row.get::<_, Option<String>>(5)?,
                    row.get::<_, String>(6)?,
                    row.get::<_, String>(7)?,
                    row.get::<_, String>(8)?,
                    row.get::<_, String>(9)?,
                ))
            },
        )
        .optional()
        .context("query tasks.get")?;
    row.map(row_to_task).transpose()
}

fn upsert_sync(conn: &Connection, user_id: Uuid, task: &Task) -> Result<()> {
    let (
        id,
        user_id_s,
        title,
        status_col,
        priority_scaled,
        duration_spec,
        deadline,
        chunking,
        constraints,
        created_at,
        updated_at,
    ) = task_to_row(user_id, task)?;
    conn.execute(
        "INSERT INTO tasks \
           (id, user_id, title, status, priority, duration_spec, deadline, \
            chunking, constraints, created_at, updated_at) \
         VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11) \
         ON CONFLICT(id) DO UPDATE SET \
            user_id=excluded.user_id, \
            title=excluded.title, \
            status=excluded.status, \
            priority=excluded.priority, \
            duration_spec=excluded.duration_spec, \
            deadline=excluded.deadline, \
            chunking=excluded.chunking, \
            constraints=excluded.constraints, \
            updated_at=excluded.updated_at",
        params![
            id,
            user_id_s,
            title,
            status_col,
            priority_scaled,
            duration_spec,
            deadline,
            chunking,
            constraints,
            created_at,
            updated_at,
        ],
    )
    .context("upsert tasks")?;
    Ok(())
}

fn delete_sync(conn: &Connection, id: Uuid) -> Result<bool> {
    let n = conn
        .execute("DELETE FROM tasks WHERE id = ?1", params![id.to_string()])
        .context("delete tasks")?;
    Ok(n > 0)
}

fn with_locked<F, R>(conn: &Arc<Mutex<Connection>>, f: F) -> R
where
    F: FnOnce(&Connection) -> R,
{
    if tokio::runtime::Handle::try_current().is_ok() {
        tokio::task::block_in_place(|| {
            let guard = conn.blocking_lock();
            f(&guard)
        })
    } else {
        let guard = conn.blocking_lock();
        f(&guard)
    }
}

impl TaskStore for SqliteTaskStore {
    fn list(&self, user_id: Uuid) -> Result<Vec<Task>> {
        with_locked(&self.conn, |c| list_sync(c, user_id))
    }

    fn get(&self, id: Uuid) -> Result<Option<Task>> {
        with_locked(&self.conn, |c| get_sync(c, id))
    }

    fn upsert(&self, user_id: Uuid, task: &Task) -> Result<()> {
        with_locked(&self.conn, |c| upsert_sync(c, user_id, task))
    }

    fn delete(&self, id: Uuid) -> Result<bool> {
        with_locked(&self.conn, |c| delete_sync(c, id))
    }
}

// Blanket impl so callers can pass the adapter directly like the other
// storage ports (`WalletStore for SqliteAdapter`, etc.).
impl TaskStore for SqliteAdapter {
    fn list(&self, user_id: Uuid) -> Result<Vec<Task>> {
        with_locked(&self.conn, |c| list_sync(c, user_id))
    }

    fn get(&self, id: Uuid) -> Result<Option<Task>> {
        with_locked(&self.conn, |c| get_sync(c, id))
    }

    fn upsert(&self, user_id: Uuid, task: &Task) -> Result<()> {
        with_locked(&self.conn, |c| upsert_sync(c, user_id, task))
    }

    fn delete(&self, id: Uuid) -> Result<bool> {
        with_locked(&self.conn, |c| delete_sync(c, id))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::{Duration as ChronoDuration, TimeZone, Utc};
    use focus_planning::{Constraint, Deadline, DurationSpec, EnergyTier, Priority, TaskStatus};

    fn t0() -> chrono::DateTime<chrono::Utc> {
        Utc.with_ymd_and_hms(2026, 5, 1, 9, 0, 0).unwrap()
    }

    fn mk_task(title: &str) -> Task {
        let mut t = Task::new(
            title,
            DurationSpec::estimated(ChronoDuration::minutes(30), ChronoDuration::minutes(60)),
            t0(),
        );
        t.priority = Priority::new(0.7);
        t.deadline = Deadline::hard(t0() + ChronoDuration::days(2));
        t.constraints = vec![
            Constraint::Buffer(ChronoDuration::minutes(10)),
            Constraint::EnergyTier(EnergyTier::DeepFocus),
        ];
        t
    }

    // Traces to: FR-DATA-001, FR-PLAN-001
    #[tokio::test(flavor = "multi_thread", worker_threads = 2)]
    async fn upsert_list_get_delete_round_trip() {
        let adapter = SqliteAdapter::open_in_memory().expect("open");
        let store = SqliteTaskStore::from_adapter(&adapter);
        let user = Uuid::new_v4();
        let t = mk_task("write test");
        store.upsert(user, &t).expect("upsert");
        let listed = store.list(user).expect("list");
        assert_eq!(listed.len(), 1);
        assert_eq!(listed[0], t);
        let got = store.get(t.id).expect("get").expect("some");
        assert_eq!(got, t);
        assert!(store.delete(t.id).expect("delete"));
        assert!(!store.delete(t.id).expect("delete-again"));
        assert!(store.list(user).expect("list-2").is_empty());
    }

    // Traces to: FR-DATA-001, FR-PLAN-001
    #[tokio::test(flavor = "multi_thread", worker_threads = 2)]
    async fn tasks_survive_db_reopen() {
        let tmp = tempfile::NamedTempFile::new().unwrap();
        let path = tmp.path().to_path_buf();
        let user = Uuid::new_v4();
        let t = mk_task("persistent task");
        {
            let adapter = SqliteAdapter::open(&path).expect("open");
            let store = SqliteTaskStore::from_adapter(&adapter);
            store.upsert(user, &t).expect("upsert");
        }
        let adapter2 = SqliteAdapter::open(&path).expect("reopen");
        let store2 = SqliteTaskStore::from_adapter(&adapter2);
        let listed = store2.list(user).expect("list");
        assert_eq!(listed.len(), 1);
        assert_eq!(listed[0], t);
    }

    // Traces to: FR-DATA-001
    #[tokio::test(flavor = "multi_thread", worker_threads = 2)]
    async fn scheduled_status_with_chunks_round_trips() {
        use focus_planning::TimeBlock;
        let adapter = SqliteAdapter::open_in_memory().expect("open");
        let store = SqliteTaskStore::from_adapter(&adapter);
        let user = Uuid::new_v4();
        let mut t = mk_task("scheduled task");
        t.status = TaskStatus::Scheduled {
            chunks: vec![TimeBlock {
                task_id: t.id,
                starts_at: t0(),
                ends_at: t0() + ChronoDuration::hours(1),
                rigidity: focus_domain::Rigidity::Soft,
            }],
        };
        store.upsert(user, &t).expect("upsert");
        let got = store.get(t.id).expect("get").expect("some");
        match got.status {
            TaskStatus::Scheduled { chunks } => {
                assert_eq!(chunks.len(), 1);
                assert_eq!(chunks[0].task_id, t.id);
            }
            other => panic!("expected Scheduled, got {other:?}"),
        }
    }

    // Traces to: FR-DATA-001
    #[tokio::test(flavor = "multi_thread", worker_threads = 2)]
    async fn list_scopes_by_user() {
        let adapter = SqliteAdapter::open_in_memory().expect("open");
        let store = SqliteTaskStore::from_adapter(&adapter);
        let a = Uuid::new_v4();
        let b = Uuid::new_v4();
        store.upsert(a, &mk_task("a-1")).unwrap();
        store.upsert(a, &mk_task("a-2")).unwrap();
        store.upsert(b, &mk_task("b-1")).unwrap();
        assert_eq!(store.list(a).unwrap().len(), 2);
        assert_eq!(store.list(b).unwrap().len(), 1);
    }
}
