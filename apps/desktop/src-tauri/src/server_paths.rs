//! Locating the Node runtime and the OmniRoute server entry.
//!
//! Both are resolved defensively — a bundled runtime is preferred, `node` on
//! `PATH` is the fallback — and every candidate is reported when nothing
//! matches, so a packaging mistake surfaces as an actionable message instead of
//! an opaque spawn failure.

use std::path::{Path, PathBuf};

/// Explicit Node runtime override (absolute path or a bare program name).
pub const NODE_BIN_ENV: &str = "OMNIROUTE_NODE_BIN";
/// Explicit server entry override (absolute path to `server-ws.mjs`/`server.js`).
pub const SERVER_ENTRY_ENV: &str = "OMNIROUTE_SERVER_ENTRY";

/// Entry filenames in preference order.
///
/// `server-ws.mjs` installs the trusted peer-IP stamp (`scripts/dev/peer-stamp.mjs`)
/// that the authz middleware needs to admit loopback/LAN requests to LOCAL_ONLY
/// routes; the bare Next entry 403s them. Mirrors `scripts/dev/run-standalone.mjs`,
/// which prefers the wrapper and only falls back when it is absent.
pub const SERVER_ENTRY_FILENAMES: &[&str] = &["server-ws.mjs", "server.js"];

/// Where the shell looks for the Node runtime and the server entry.
#[derive(Debug, Clone, Default)]
pub struct ShellPaths {
    /// Tauri resource dir (`OmniRoute.app/Contents/Resources` on macOS).
    pub resource_dir: Option<PathBuf>,
    /// Directory holding the shell executable.
    pub exe_dir: Option<PathBuf>,
    /// Repository root of a debug build (`tauri dev` only).
    pub dev_root: Option<PathBuf>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum NodeSource {
    /// `OMNIROUTE_NODE_BIN` was set by the operator.
    EnvOverride,
    /// A Node runtime shipped inside the app bundle.
    Bundled,
    /// `node` resolved from `PATH`.
    SystemPath,
}

impl NodeSource {
    pub fn label(self) -> &'static str {
        match self {
            NodeSource::EnvOverride => "OMNIROUTE_NODE_BIN override",
            NodeSource::Bundled => "bundled runtime",
            NodeSource::SystemPath => "PATH",
        }
    }
}

#[derive(Debug, Clone)]
pub struct ResolvedNode {
    pub program: PathBuf,
    pub source: NodeSource,
}

/// Node binaries that may ship inside the bundle, in preference order; the first
/// existing one wins, so no de-duplication is needed.
pub fn bundled_node_candidates(shell: &ShellPaths) -> Vec<PathBuf> {
    let name = if cfg!(windows) { "node.exe" } else { "node" };
    let mut candidates = Vec::new();
    for root in [shell.resource_dir.as_ref(), shell.exe_dir.as_ref()]
        .into_iter()
        .flatten()
    {
        for subdir in ["bin", "runtime/bin", ""] {
            candidates.push(if subdir.is_empty() {
                root.join(name)
            } else {
                root.join(subdir).join(name)
            });
        }
    }
    candidates
}

/// Prefer an operator override, then a bundled runtime, then `node` on `PATH`.
pub fn resolve_node_binary(shell: &ShellPaths) -> ResolvedNode {
    if let Some(program) = explicit_node_override() {
        return ResolvedNode {
            program,
            source: NodeSource::EnvOverride,
        };
    }
    for candidate in bundled_node_candidates(shell) {
        if is_executable_file(&candidate) {
            return ResolvedNode {
                program: candidate,
                source: NodeSource::Bundled,
            };
        }
    }
    ResolvedNode {
        program: PathBuf::from(if cfg!(windows) { "node.exe" } else { "node" }),
        source: NodeSource::SystemPath,
    }
}

fn explicit_node_override() -> Option<PathBuf> {
    configured_path(NODE_BIN_ENV)
}

fn explicit_entry_override() -> Option<PathBuf> {
    configured_path(SERVER_ENTRY_ENV)
}

/// An explicit override wins even when the path looks wrong: silently ignoring
/// it would make the operator's intent untraceable.
fn configured_path(key: &str) -> Option<PathBuf> {
    let raw = std::env::var(key).ok()?;
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return None;
    }
    Some(PathBuf::from(trimmed))
}

fn is_executable_file(path: &Path) -> bool {
    let Ok(metadata) = path.metadata() else {
        return false;
    };
    if !metadata.is_file() {
        return false;
    }
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        metadata.permissions().mode() & 0o111 != 0
    }
    #[cfg(not(unix))]
    {
        true
    }
}

/// Directories searched for the server entry, in preference order.
///
/// * `<resources>/app` — layout of the previous desktop bundle
///   (`extraResources: ../.build/electron-standalone -> app`).
/// * `<resources>` — flat resource bundling.
/// * `<resources>/standalone` — explicit nested bundle.
/// * `<repo>/dist` — `tauri dev` against a checkout, where
///   `scripts/build/assembleStandalone.mjs` writes the standalone tree.
/// * `<repo>` — `tauri dev` against a checkout that stages at the root.
pub fn server_entry_dirs(shell: &ShellPaths) -> Vec<PathBuf> {
    let mut dirs = Vec::new();
    if let Some(resource_dir) = &shell.resource_dir {
        dirs.push(resource_dir.join("app"));
        dirs.push(resource_dir.clone());
        dirs.push(resource_dir.join("standalone"));
    }
    if let Some(dev_root) = &shell.dev_root {
        dirs.push(dev_root.join("dist"));
        dirs.push(dev_root.clone());
    }
    dirs
}

/// Every candidate server entry, in resolution order.
pub fn server_entry_candidates(shell: &ShellPaths) -> Vec<PathBuf> {
    let mut candidates = Vec::new();
    for dir in server_entry_dirs(shell) {
        for name in SERVER_ENTRY_FILENAMES {
            candidates.push(dir.join(name));
        }
    }
    candidates
}

/// Locate the server entry, or explain exactly what was looked for.
///
/// The standalone tree is staged into the bundle by the packaging pipeline; when
/// it is missing, the error has to name the expected locations rather than
/// failing opaquely at spawn time.
pub fn resolve_server_entry(shell: &ShellPaths) -> Result<PathBuf, String> {
    if let Some(override_path) = explicit_entry_override() {
        if override_path.is_file() {
            return Ok(override_path);
        }
        return Err(format!(
            "{SERVER_ENTRY_ENV} points at {} which is not a file",
            override_path.display()
        ));
    }
    let candidates = server_entry_candidates(shell);
    if let Some(found) = candidates.iter().find(|candidate| candidate.is_file()) {
        return Ok(found.clone());
    }
    Err(format!(
        "could not locate the OmniRoute server entry; looked for {}. \
         Stage the standalone server into the bundle or set {SERVER_ENTRY_ENV}.",
        candidates
            .iter()
            .map(|candidate| candidate.display().to_string())
            .collect::<Vec<_>>()
            .join(", ")
    ))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn scratch(tag: &str) -> PathBuf {
        let dir =
            std::env::temp_dir().join(format!("omniroute-desktop-{tag}-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).expect("scratch dir");
        dir
    }

    fn shell_with(resource_dir: Option<PathBuf>, dev_root: Option<PathBuf>) -> ShellPaths {
        ShellPaths {
            resource_dir,
            exe_dir: None,
            dev_root,
        }
    }

    #[test]
    fn bundled_runtime_is_preferred_over_path() {
        let dir = scratch("bundled-node");
        let node = dir.join("bin").join("node");
        std::fs::create_dir_all(node.parent().unwrap()).expect("bin dir");
        std::fs::write(&node, b"#!/bin/sh\n").expect("write node");
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            std::fs::set_permissions(&node, std::fs::Permissions::from_mode(0o755)).expect("chmod");
        }

        let resolved = resolve_node_binary(&shell_with(Some(dir), None));
        assert_eq!(resolved.program, node);
        assert_eq!(resolved.source, NodeSource::Bundled);
    }

    #[cfg(unix)]
    #[test]
    fn non_executable_bundle_member_is_not_a_runtime() {
        let dir = scratch("non-executable-node");
        let node = dir.join("node");
        std::fs::write(&node, b"not a program").expect("write node");
        let resolved = resolve_node_binary(&shell_with(Some(dir), None));
        assert_eq!(resolved.source, NodeSource::SystemPath);
    }

    #[test]
    fn falls_back_to_node_on_path() {
        let dir = scratch("no-bundled-node");
        let resolved = resolve_node_binary(&shell_with(Some(dir), None));
        assert_eq!(resolved.program, PathBuf::from("node"));
        assert_eq!(resolved.source, NodeSource::SystemPath);
    }

    #[test]
    fn server_entry_prefers_the_websocket_wrapper() {
        let dir = scratch("entry-order");
        let app = dir.join("app");
        std::fs::create_dir_all(&app).expect("app dir");
        std::fs::write(app.join("server.js"), b"// bare next entry").expect("server.js");
        std::fs::write(app.join("server-ws.mjs"), b"// ws wrapper").expect("server-ws.mjs");

        let shell = shell_with(Some(dir.clone()), None);
        assert_eq!(
            resolve_server_entry(&shell).expect("entry"),
            app.join("server-ws.mjs")
        );

        std::fs::remove_file(app.join("server-ws.mjs")).expect("remove wrapper");
        assert_eq!(
            resolve_server_entry(&shell).expect("entry"),
            app.join("server.js")
        );
    }

    #[test]
    fn missing_server_entry_names_every_candidate() {
        let dir = scratch("entry-missing");
        let error = resolve_server_entry(&shell_with(Some(dir.clone()), None))
            .expect_err("must fail without a server tree");
        assert!(error.contains(&dir.join("app").join("server-ws.mjs").display().to_string()));
        assert!(error.contains(&dir.join("server.js").display().to_string()));
    }

    #[test]
    fn dev_root_is_searched_after_resources() {
        let dir = scratch("entry-dev-root");
        let dev_root = dir.join("repo");
        std::fs::create_dir_all(&dev_root).expect("dev root");
        std::fs::write(dev_root.join("server-ws.mjs"), b"// wrapper").expect("entry");

        let shell = shell_with(Some(dir.join("resources")), Some(dev_root.clone()));
        assert_eq!(
            resolve_server_entry(&shell).expect("entry"),
            dev_root.join("server-ws.mjs")
        );
    }

    #[test]
    fn the_assembly_output_wins_over_the_repository_root() {
        let dir = scratch("entry-dev-dist");
        let dev_root = dir.join("repo");
        let dist = dev_root.join("dist");
        std::fs::create_dir_all(&dist).expect("dist dir");
        std::fs::write(dist.join("server-ws.mjs"), b"// assembled").expect("dist entry");
        std::fs::write(dev_root.join("server-ws.mjs"), b"// stray").expect("root entry");

        let shell = shell_with(None, Some(dev_root));
        assert_eq!(
            resolve_server_entry(&shell).expect("entry"),
            dist.join("server-ws.mjs")
        );
    }

    #[test]
    fn bundled_resources_win_over_the_dev_checkout() {
        let dir = scratch("entry-resources-first");
        let resources = dir.join("resources");
        let app = resources.join("app");
        std::fs::create_dir_all(&app).expect("app dir");
        std::fs::write(app.join("server.js"), b"// bundled").expect("bundled entry");
        let dev_root = dir.join("repo");
        std::fs::create_dir_all(&dev_root).expect("dev root");
        std::fs::write(dev_root.join("server-ws.mjs"), b"// dev").expect("dev entry");

        let shell = shell_with(Some(resources), Some(dev_root.clone()));
        assert_eq!(
            resolve_server_entry(&shell).expect("entry"),
            app.join("server.js")
        );
    }
}
