//! C-ABI FFI surface for the sharecli macOS tray / desktop app.
//!
//! FFI choice: plain C ABI via `extern "C"` + `#[no_mangle]`.
//! No uniffi or cxx is needed here because the primary data path goes through
//! the IPC Unix socket (NDJSON); FFI only handles daemon lifecycle and a
//! quick synchronous health peek that Swift calls on tray activation.
//!
//! The Swift bridging header is at `desktop/ShareCLITray/sharecli_ffi.h`.
//!
//! Thread-safety: each exported fn is self-contained; the Tokio runtime is
//! created lazily inside `sharecli_ipc_start` and lives for the process lifetime.

use std::ffi::{CStr, CString};
use std::os::raw::{c_char, c_int};
use std::sync::OnceLock;

use tokio::runtime::Runtime;

static RT: OnceLock<Runtime> = OnceLock::new();

fn rt() -> &'static Runtime {
    RT.get_or_init(|| Runtime::new().expect("tokio runtime"))
}

/// Start the IPC daemon in the background (idempotent).
/// Returns 0 on success, non-zero on error.
#[no_mangle]
pub extern "C" fn sharecli_ipc_start() -> c_int {
    // The IPC server is expected to be launched as a separate process
    // (via launchd or explicit spawn from Swift AppDelegate).
    // This function is a hook so Swift can trigger that launch and verify
    // the socket is reachable.
    let sock = socket_path_str();
    if std::path::Path::new(&sock).exists() {
        return 0; // already running
    }

    // Attempt to launch sharecli-ipc as a sidecar process.
    let exe = find_sidecar("sharecli-ipc");
    match exe {
        Some(path) => {
            let _ = std::process::Command::new(path).spawn();
            // Give it a moment to bind the socket.
            std::thread::sleep(std::time::Duration::from_millis(200));
            0
        }
        None => 1,
    }
}

/// Returns the IPC socket path as a null-terminated C string.
/// Caller must free with `sharecli_free_string`.
#[no_mangle]
pub extern "C" fn sharecli_ipc_socket_path() -> *mut c_char {
    let s = socket_path_str();
    CString::new(s).map(|c| c.into_raw()).unwrap_or(std::ptr::null_mut())
}

/// Free a string allocated by this library.
#[no_mangle]
pub extern "C" fn sharecli_free_string(ptr: *mut c_char) {
    if !ptr.is_null() {
        unsafe { drop(CString::from_raw(ptr)) };
    }
}

/// Quick synchronous health snapshot over the IPC socket.
/// Returns a JSON string (must free with `sharecli_free_string`) or null on error.
#[no_mangle]
pub extern "C" fn sharecli_health_json() -> *mut c_char {
    let result = rt().block_on(async {
        use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
        use tokio::net::UnixStream;

        let sock = socket_path_str();
        let mut stream = UnixStream::connect(&sock).await?;

        let req = "{\"id\":1,\"method\":\"health.status\",\"params\":{}}\n";
        stream.write_all(req.as_bytes()).await?;

        let (r, _) = stream.into_split();
        let mut lines = BufReader::new(r).lines();
        let line = lines.next_line().await?;
        anyhow::Ok(line.unwrap_or_default())
    });

    match result {
        Ok(s) => CString::new(s).map(|c| c.into_raw()).unwrap_or(std::ptr::null_mut()),
        Err(_) => std::ptr::null_mut(),
    }
}

/// Send an arbitrary JSON-RPC request string, return the response JSON string.
/// Caller frees the returned string with `sharecli_free_string`.
#[no_mangle]
pub extern "C" fn sharecli_request(request_json: *const c_char) -> *mut c_char {
    if request_json.is_null() {
        return std::ptr::null_mut();
    }
    let req_str = unsafe {
        match CStr::from_ptr(request_json).to_str() {
            Ok(s) => s.to_owned(),
            Err(_) => return std::ptr::null_mut(),
        }
    };

    let result = rt().block_on(async {
        use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
        use tokio::net::UnixStream;

        let sock = socket_path_str();
        let mut stream = UnixStream::connect(&sock).await?;

        let mut payload = req_str.clone();
        payload.push('\n');
        stream.write_all(payload.as_bytes()).await?;

        let (r, _) = stream.into_split();
        let mut lines = BufReader::new(r).lines();
        let line = lines.next_line().await?;
        anyhow::Ok(line.unwrap_or_default())
    });

    match result {
        Ok(s) => CString::new(s).map(|c| c.into_raw()).unwrap_or(std::ptr::null_mut()),
        Err(_) => std::ptr::null_mut(),
    }
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

fn socket_path_str() -> String {
    if let Ok(v) = std::env::var("SHARECLI_IPC_SOCK") {
        return v;
    }
    dirs::data_local_dir()
        .unwrap_or_else(|| std::path::PathBuf::from("/tmp"))
        .join("sharecli")
        .join("ipc.sock")
        .to_string_lossy()
        .into_owned()
}

fn find_sidecar(name: &str) -> Option<String> {
    // 1. same directory as the current executable (app bundle Resources/bin)
    if let Ok(mut exe) = std::env::current_exe() {
        exe.pop();
        let candidate = exe.join(name);
        if candidate.exists() {
            return Some(candidate.to_string_lossy().into_owned());
        }
    }
    // 2. PATH
    if let Ok(output) = std::process::Command::new("which").arg(name).output() {
        if output.status.success() {
            let path = String::from_utf8_lossy(&output.stdout).trim().to_string();
            if !path.is_empty() {
                return Some(path);
            }
        }
    }
    None
}
