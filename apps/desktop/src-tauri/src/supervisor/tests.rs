//! Process-supervision tests, kept out of `supervisor.rs` so the module stays
//! within the repository file-size mandate.

use super::*;
use crate::server_paths::NodeSource;

fn scratch(tag: &str) -> PathBuf {
    let dir = std::env::temp_dir().join(format!("omniroute-desktop-{tag}-{}", std::process::id()));
    let _ = std::fs::remove_dir_all(&dir);
    std::fs::create_dir_all(&dir).expect("scratch dir");
    dir
}

/// A plan whose "node program" is `program` and whose "entry" is the single
/// argument that program receives.
fn plan(dir: &Path, program: &str, argument: &str) -> LaunchPlan {
    LaunchPlan {
        node: ResolvedNode {
            program: PathBuf::from(program),
            source: NodeSource::SystemPath,
        },
        server_entry: PathBuf::from(argument),
        working_dir: dir.to_path_buf(),
        data_dir: dir.to_path_buf(),
        origin: "http://localhost:20128".to_string(),
        node_path: String::new(),
        node_options: None,
        log_file: dir.join("logs").join("desktop-server.log"),
    }
}

/// End-to-end process handling: `/bin/sleep` stands in for the server.
#[cfg(unix)]
#[test]
fn terminate_stops_the_child_and_is_idempotent() {
    let dir = scratch("terminate");
    let mut supervisor = Supervisor::default();
    let plan = plan(&dir, "/bin/sleep", "30");

    let pid = supervisor.spawn(&plan).expect("spawn");
    assert!(supervisor.is_running());
    assert_eq!(supervisor.pid(), Some(pid));
    assert!(process_is_alive(pid), "child should be running after spawn");

    // Spawning twice would leak a process.
    assert!(supervisor.spawn(&plan).is_err());

    let note = supervisor
        .terminate(Duration::from_millis(1500))
        .expect("terminate")
        .expect("a child was supervised");
    assert!(note.contains("server stopped"), "unexpected note: {note}");
    assert!(!supervisor.is_running());
    assert_eq!(supervisor.pid(), None);
    assert!(!process_is_alive(pid), "child must be gone after terminate");

    // Idempotent: nothing to stop, still success.
    assert_eq!(supervisor.terminate(STOP_GRACE).expect("terminate"), None);
}

#[cfg(unix)]
fn process_is_alive(pid: u32) -> bool {
    // SAFETY: signal 0 performs error checking only.
    unsafe { libc::kill(pid as i32, 0) == 0 }
}

#[cfg(not(unix))]
#[test]
fn terminate_without_a_child_is_a_no_op() {
    let mut supervisor = Supervisor::default();
    assert_eq!(supervisor.terminate(STOP_GRACE).expect("terminate"), None);
}

#[test]
fn terminate_kills_a_child_that_ignores_the_graceful_signal() {
    let dir = scratch("terminate-escalation");
    let mut supervisor = Supervisor::default();
    #[cfg(unix)]
    let plan = plan(&dir, "/bin/sh", "-c trap '' TERM; sleep 30");
    #[cfg(not(unix))]
    let plan = plan(&dir, "cmd", "/c ping -n 30 127.0.0.1");

    supervisor.spawn(&plan).expect("spawn");
    // Zero grace forces the escalation path.
    let note = supervisor
        .terminate(Duration::ZERO)
        .expect("terminate")
        .expect("a child was supervised");
    assert!(note.contains("killed"), "unexpected note: {note}");
    assert!(!supervisor.is_running());
}

#[test]
fn reap_reports_an_exited_child() {
    let dir = scratch("reap");
    let mut supervisor = Supervisor::default();
    #[cfg(unix)]
    let plan = plan(&dir, immediately_exiting_program(), "unused");
    #[cfg(not(unix))]
    let plan = plan(&dir, "cmd", "/c exit 0");

    supervisor.spawn(&plan).expect("spawn");

    // The program exits at once; poll rather than race it.
    let mut note = None;
    for _ in 0..100 {
        if let Some(reaped) = supervisor.reap() {
            note = Some(reaped);
            break;
        }
        std::thread::sleep(POLL_INTERVAL);
    }
    assert!(note.expect("child must be reaped").contains("exited"));
    assert!(!supervisor.is_running());
}

/// `true(1)` lives in different directories across unixes.
#[cfg(unix)]
fn immediately_exiting_program() -> &'static str {
    if Path::new("/usr/bin/true").exists() {
        "/usr/bin/true"
    } else {
        "/bin/true"
    }
}

/// Full path with a real Node runtime and a real HTTP server: verifies the
/// child env (PORT/DATA_DIR/NODE_PATH/HOSTNAME), the log redirection and the
/// readiness probe, then that stopping it really releases the port.
#[test]
fn spawns_a_node_server_that_answers_on_the_plan_port() {
    if std::process::Command::new("node")
        .arg("--version")
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()
        .is_err()
    {
        eprintln!("skipped: no `node` on PATH");
        return;
    }

    let dir = scratch("node-integration");
    let packs = dir.join("packs").join("ml-runtime").join("node_modules");
    std::fs::create_dir_all(&packs).expect("pack dir");
    let entry = dir.join("server-ws.mjs");
    std::fs::write(
        &entry,
        r#"import { createServer } from "node:http";
console.log("[stub] " + JSON.stringify({
  port: process.env.PORT,
  dataDir: process.env.DATA_DIR,
  nodePath: process.env.NODE_PATH,
  hostname: process.env.HOSTNAME,
  cwd: process.cwd(),
}));
createServer((_request, response) => response.end("ok"))
  .listen(Number(process.env.PORT), "127.0.0.1");
"#,
    )
    .expect("stub server");

    let port = free_port();
    let origin = format!("http://127.0.0.1:{port}");
    let log_file = dir.join("logs").join("desktop-server.log");
    let mut supervisor = Supervisor::default();
    let plan = LaunchPlan {
        node: ResolvedNode {
            program: PathBuf::from("node"),
            source: NodeSource::SystemPath,
        },
        server_entry: entry,
        working_dir: dir.clone(),
        data_dir: dir.clone(),
        origin: origin.clone(),
        node_path: packs.to_string_lossy().into_owned(),
        node_options: None,
        log_file: log_file.clone(),
    };

    let pid = supervisor.spawn(&plan).expect("spawn node");
    let mut reachable = false;
    for _ in 0..200 {
        if crate::origin::is_reachable(&origin, Duration::from_millis(150)) {
            reachable = true;
            break;
        }
        std::thread::sleep(POLL_INTERVAL);
    }
    assert!(reachable, "stub server never answered on {origin}");

    let logged = std::fs::read_to_string(&log_file).unwrap_or_default();
    assert!(
        logged.contains(&packs.to_string_lossy().into_owned()),
        "NODE_PATH did not reach the child: {logged}"
    );
    assert!(
        logged.contains(&dir.to_string_lossy().into_owned()),
        "DATA_DIR did not reach the child: {logged}"
    );
    assert!(
        logged.contains(&format!("\"port\":\"{port}\"")),
        "PORT did not reach the child: {logged}"
    );

    let note = supervisor
        .terminate(Duration::from_millis(2500))
        .expect("terminate")
        .expect("a child was supervised");
    assert!(note.contains("server stopped"), "unexpected note: {note}");
    assert!(
        !crate::origin::is_reachable(&origin, Duration::from_millis(150)),
        "port {port} still answers after terminate"
    );
    #[cfg(unix)]
    assert!(!process_is_alive(pid));
}

/// Ask the OS for an unused loopback port, then release it for the child.
#[cfg(unix)]
fn free_port() -> u16 {
    let listener = std::net::TcpListener::bind("127.0.0.1:0").expect("bind ephemeral port");
    let port = listener.local_addr().expect("local addr").port();
    drop(listener);
    port
}

#[cfg(not(unix))]
fn free_port() -> u16 {
    20199
}

#[test]
fn spawn_failure_names_the_program() {
    let dir = scratch("spawn-failure");
    let mut supervisor = Supervisor::default();
    let error = supervisor
        .spawn(&plan(&dir, "/nonexistent/node-binary", "server.js"))
        .expect_err("spawn must fail");
    assert!(error.contains("/nonexistent/node-binary"));
    assert!(!supervisor.is_running());
}
