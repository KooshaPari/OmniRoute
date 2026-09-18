//! The command surface the web layer calls.
//!
//! Nine commands, all pre-declared here: the webview cannot ask this shell to
//! run anything else (no shell plugin, no dynamic command names). The
//! `runtime_*` commands own a real child process; `window_*` and `open_external`
//! are the small window/OS affordances the SPA needs.

use std::{
    path::PathBuf,
    sync::{Mutex, MutexGuard},
    time::Duration,
};

use tauri::{AppHandle, Manager, State};
use tauri_plugin_opener::OpenerExt;

use crate::{
    lifecycle::RuntimeStatus,
    origin, paths,
    server_paths::{self, ShellPaths},
    supervisor::{LaunchPlan, Supervisor, STOP_GRACE},
};

/// Probe budget for `runtime_*`. Loopback answers immediately, so this only
/// bounds the pathological filtered-packet case.
const PROBE_TIMEOUT: Duration = Duration::from_millis(150);
/// Env var carrying `NODE_PATH` into the child.
const NODE_PATH_ENV: &str = "NODE_PATH";
/// Env var the removed launcher honoured for an explicit V8 heap ceiling.
const MEMORY_MB_ENV: &str = "OMNIROUTE_MEMORY_MB";
/// Name of the captured server log inside `${DATA_DIR}/logs`.
const SERVER_LOG_FILE: &str = "desktop-server.log";
/// Accepted schemes for `open_external`.
const EXTERNAL_SCHEMES: &[&str] = &["http", "https"];

/// What the shell knows about the server it supervises.
struct Runtime {
    status: RuntimeStatus,
    supervisor: Supervisor,
}

pub struct AppState {
    runtime: Mutex<Runtime>,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            runtime: Mutex::new(Runtime {
                status: RuntimeStatus::stopped(origin::resolve_origin()),
                supervisor: Supervisor::default(),
            }),
        }
    }
}

/// Poison-tolerant locking: a panicking command must not brick the shell.
fn runtime_lock(state: &AppState) -> MutexGuard<'_, Runtime> {
    state
        .runtime
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner())
}

/// Start the server, if nothing answers at the origin yet.
///
/// `async` (thread-pool execution) so the TCP probe and the spawn never block
/// the UI thread; the observable signature is unchanged.
#[tauri::command(async)]
pub fn runtime_start(app: AppHandle, state: State<'_, AppState>) -> Result<RuntimeStatus, String> {
    let mut runtime = runtime_lock(&state);

    if origin::is_reachable(&runtime.status.origin, PROBE_TIMEOUT) {
        let pid = runtime.supervisor.pid();
        runtime.status.mark_running(pid);
        return Ok(runtime.status.clone());
    }

    // Reap first: a child that already exited must not be mistaken for a
    // server that is merely slow to come up.
    runtime.supervisor.reap();

    if runtime.supervisor.is_running() {
        let pid = runtime.supervisor.pid();
        runtime.status.mark_starting(pid);
        return Ok(runtime.status.clone());
    }

    let plan = launch_plan(&app, &runtime.status.origin).inspect_err(|error| {
        runtime.status.mark_stopped(Some(error.clone()));
    })?;

    match runtime.supervisor.spawn(&plan) {
        Ok(pid) => {
            runtime.status.mark_starting(Some(pid));
            Ok(runtime.status.clone())
        }
        Err(error) => {
            runtime.status.mark_stopped(Some(error.clone()));
            Err(error)
        }
    }
}

/// Stop the supervised child. Idempotent.
#[tauri::command(async)]
pub fn runtime_stop(state: State<'_, AppState>) -> Result<RuntimeStatus, String> {
    let mut runtime = runtime_lock(&state);
    let detail = match runtime.supervisor.terminate(STOP_GRACE) {
        Ok(detail) => detail,
        Err(error) => {
            runtime.status.mark_stopped(Some(error.clone()));
            return Err(error);
        }
    };
    // Report what is actually true now: if something else still answers on the
    // origin (a server started by hand), the state is `running`, not `stopped`,
    // so the badge does not flip back on the next poll.
    if origin::is_reachable(&runtime.status.origin, PROBE_TIMEOUT) {
        runtime.status.mark_running(None);
    } else {
        runtime.status.mark_stopped(detail);
    }
    Ok(runtime.status.clone())
}

/// Re-probe the origin and the child, refreshing the reported state.
#[tauri::command(async)]
pub fn runtime_readiness(state: State<'_, AppState>) -> Result<RuntimeStatus, String> {
    let mut runtime = runtime_lock(&state);
    let exit_note = runtime.supervisor.reap();
    let pid = runtime.supervisor.pid();
    let supervised = runtime.supervisor.is_running();

    if origin::is_reachable(&runtime.status.origin, PROBE_TIMEOUT) {
        runtime.status.mark_running(pid);
    } else if supervised {
        runtime.status.mark_starting(pid);
    } else {
        runtime.status.mark_stopped(exit_note);
    }

    Ok(runtime.status.clone())
}

/// `${DATA_DIR}` — where packs, storage and logs live.
#[tauri::command]
pub fn runtime_data_dir() -> Result<String, String> {
    paths::resolve_data_dir().map(|path| path.to_string_lossy().into_owned())
}

/// Origin the web layer should talk to (`RuntimeStatus.origin`).
#[tauri::command]
pub fn dashboard_origin(state: State<'_, AppState>) -> Result<String, String> {
    Ok(runtime_lock(&state).status.origin.clone())
}

#[tauri::command]
pub fn window_minimize(window: tauri::Window) {
    report_window_result("window_minimize", window.minimize());
}

#[tauri::command]
pub fn window_toggle_maximize(window: tauri::Window) {
    // Tauri exposes maximize/unmaximize on the Rust side; the toggle is the
    // current state plus the opposite call.
    let maximized = window.is_maximized().unwrap_or(false);
    let result = if maximized {
        window.unmaximize()
    } else {
        window.maximize()
    };
    report_window_result("window_toggle_maximize", result);
}

#[tauri::command]
pub fn window_close(window: tauri::Window) {
    report_window_result("window_close", window.close());
}

/// Open an `http(s)` URL in the OS browser.
///
/// The scheme allow-list is the whole authorization story: the web layer cannot
/// hand this command a `file://`, `javascript:` or vendor-scheme URL, and no
/// other command reaches the opener plugin (it is registered without a
/// capability permission, so `window.__TAURI__.opener` is not callable).
#[tauri::command]
pub fn open_external(app: AppHandle, url: String) -> Result<(), String> {
    if !is_openable_url(&url) {
        return Err(format!("refusing to open non-http(s) url: {url}"));
    }
    app.opener()
        .open_url(url, None::<&str>)
        .map_err(|error| format!("could not open the external browser: {error}"))
}

/// `http`/`https` only — the single rule behind [`EXTERNAL_SCHEMES`].
fn is_openable_url(url: &str) -> bool {
    let Some((scheme, _)) = url.split_once(':') else {
        return false;
    };
    EXTERNAL_SCHEMES.contains(&scheme.to_ascii_lowercase().as_str())
}

/// Stop the supervised child on app exit so no orphan keeps the port (and, on
/// Windows, the executable lock).
pub fn shutdown(app: &AppHandle) {
    let Some(state) = app.try_state::<AppState>() else {
        return;
    };
    let mut runtime = runtime_lock(&state);
    if let Err(error) = runtime.supervisor.terminate(STOP_GRACE) {
        eprintln!("[omniroute-desktop] could not stop the OmniRoute server: {error}");
    }
    runtime.status.mark_stopped(None);
}

fn report_window_result(operation: &str, result: Result<(), tauri::Error>) {
    if let Err(error) = result {
        eprintln!("[omniroute-desktop] {operation} failed: {error}");
    }
}

/// Assemble the child's launch description from paths, packs and env.
fn launch_plan(app: &AppHandle, origin: &str) -> Result<LaunchPlan, String> {
    let data_dir = paths::resolve_data_dir()?;
    let shell = ShellPaths {
        resource_dir: app.path().resource_dir().ok(),
        exe_dir: std::env::current_exe()
            .ok()
            .and_then(|exe| exe.parent().map(PathBuf::from)),
        dev_root: dev_root(),
    };

    let node = server_paths::resolve_node_binary(&shell);
    let server_entry = server_paths::resolve_server_entry(&shell)?;
    let working_dir = server_entry
        .parent()
        .map(PathBuf::from)
        .unwrap_or_else(|| data_dir.clone());

    Ok(LaunchPlan {
        node,
        server_entry,
        working_dir,
        node_path: paths::resolve_node_path(
            &data_dir,
            std::env::var(NODE_PATH_ENV).ok().as_deref(),
        ),
        node_options: node_options(),
        log_file: paths::logs_dir(&data_dir).join(SERVER_LOG_FILE),
        data_dir,
        origin: origin.to_string(),
    })
}

/// Repository root this build was compiled from — debug builds only, where
/// `tauri dev` runs against a checkout that has no staged resource tree yet.
fn dev_root() -> Option<PathBuf> {
    if !cfg!(debug_assertions) {
        return None;
    }
    let root = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("../../..")
        .canonicalize()
        .ok()?;
    root.is_dir().then_some(root)
}

/// `NODE_OPTIONS` for the child.
///
/// An inherited `NODE_OPTIONS` is passed through untouched, and an explicit
/// `OMNIROUTE_MEMORY_MB` still raises the V8 heap ceiling. The removed
/// launcher's *derived* default (35% of physical RAM, clamped 512-4096 MiB) is
/// deliberately not reproduced: it needs a total-RAM source this crate does not
/// depend on, and inventing one here would be a silent behaviour claim.
fn node_options() -> Option<String> {
    node_options_from(
        std::env::var("NODE_OPTIONS").ok(),
        std::env::var(MEMORY_MB_ENV).ok(),
    )
}

fn node_options_from(inherited: Option<String>, requested: Option<String>) -> Option<String> {
    let inherited = inherited
        .map(|value| value.trim().to_owned())
        .filter(|value| !value.is_empty());
    if let Some(existing) = &inherited {
        if existing.contains("--max-old-space-size") {
            return Some(existing.clone());
        }
    }
    let requested = requested
        .map(|value| value.trim().to_owned())
        .and_then(|value| value.parse::<u32>().ok())
        .filter(|megabytes| (64..=16384).contains(megabytes));

    match (inherited, requested) {
        (Some(existing), Some(megabytes)) => {
            Some(format!("{existing} --max-old-space-size={megabytes}"))
        }
        (Some(existing), None) => Some(existing),
        (None, Some(megabytes)) => Some(format!("--max-old-space-size={megabytes}")),
        (None, None) => None,
    }
}

#[cfg(test)]
mod tests;
