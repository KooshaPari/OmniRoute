//! Runtime filesystem contracts for the desktop shell, mirrored from the server
//! runtime so the shell and the server it supervises cannot disagree:
//!
//! * [`resolve_data_dir`] mirrors `bin/cli/data-dir.mjs` (`resolveDataDir`).
//! * [`installed_pack_node_modules`] mirrors
//!   `open-sse/utils/optionalPacks.ts` (`installedPackNodePaths`): manifest
//!   order, existence-checked, fail-open.
//!
//! The pack names themselves come from `scripts/packs/optionalPackManifest.mjs`
//! (`OPTIONAL_PACKS`) via `build.rs`; see [`optional_pack_names`].

use std::{
    collections::HashSet,
    env,
    path::{Path, PathBuf},
    sync::OnceLock,
};

/// Pack names used when the build-side manifest was unavailable.
///
/// Values and order copied from `OPTIONAL_PACKS` in
/// `scripts/packs/optionalPackManifest.mjs`, and kept honest by
/// `build_script_injects_pack_names_from_the_manifest`, which fails when the
/// injected build-time list diverges from this one.
pub const FALLBACK_OPTIONAL_PACK_NAMES: &[&str] = &["ml-runtime", "browser-runtime"];

/// `DATA_DIR` override, then the Tauri-era alias, then the platform defaults —
/// the same precedence `bin/cli/data-dir.mjs` applies.
const DATA_DIR_ENV: &str = "DATA_DIR";
const DATA_DIR_ENV_ALIAS: &str = "OMNIROUTE_DATA_DIR";
const APP_DIR_NAME: &str = "omniroute";

/// Optional-pack names in manifest order (deterministic).
///
/// Reads the `OMNIROUTE_OPTIONAL_PACK_NAMES` value `build.rs` injected.
pub fn optional_pack_names() -> Vec<String> {
    static CACHE: OnceLock<Vec<String>> = OnceLock::new();
    CACHE
        .get_or_init(|| {
            let injected = option_env!("OMNIROUTE_OPTIONAL_PACK_NAMES").unwrap_or_default();
            let parsed: Vec<String> = injected
                .split(',')
                .map(str::trim)
                .filter(|name| !name.is_empty())
                .map(str::to_owned)
                .collect();
            if parsed.is_empty() {
                return FALLBACK_OPTIONAL_PACK_NAMES
                    .iter()
                    .map(|name| (*name).to_owned())
                    .collect();
            }
            parsed
        })
        .clone()
}

/// `${DATA_DIR}/packs` — root of installed optional packs.
pub fn packs_root_dir(data_dir: &Path) -> PathBuf {
    data_dir.join("packs")
}

/// `${DATA_DIR}/packs/<name>/node_modules` — whether or not it exists.
pub fn pack_node_modules_dir(data_dir: &Path, name: &str) -> PathBuf {
    packs_root_dir(data_dir).join(name).join("node_modules")
}

/// `node_modules` dirs of every INSTALLED pack, in manifest order.
pub fn installed_pack_node_modules(data_dir: &Path) -> Vec<PathBuf> {
    optional_pack_names()
        .into_iter()
        .map(|name| pack_node_modules_dir(data_dir, &name))
        .filter(|dir| dir.is_dir())
        .collect()
}

/// `NODE_PATH` for the supervised server.
///
/// Installed optional-pack `node_modules` dirs are PREPENDED so an installed
/// pack can never be shadowed by a stale bundled copy; the inherited entries
/// follow in their original order (they are passed through untouched — a
/// `NODE_PATH` entry that does not exist yet is harmless to Node, and dropping
/// it here would silently change resolution for callers that create it later).
pub fn resolve_node_path(data_dir: &Path, existing: Option<&str>) -> String {
    let mut entries: Vec<PathBuf> = Vec::new();
    let mut seen: HashSet<String> = HashSet::new();

    for pack_dir in installed_pack_node_modules(data_dir) {
        push_unique(&mut entries, &mut seen, pack_dir);
    }
    for entry in existing.map(env::split_paths).into_iter().flatten() {
        push_unique(&mut entries, &mut seen, entry);
    }

    join_paths(&entries)
}

/// `${DATA_DIR}/logs` — destination for captured server output.
pub fn logs_dir(data_dir: &Path) -> PathBuf {
    data_dir.join("logs")
}

fn push_unique(entries: &mut Vec<PathBuf>, seen: &mut HashSet<String>, candidate: PathBuf) {
    let key = candidate.to_string_lossy().trim().to_owned();
    if key.is_empty() {
        return;
    }
    if seen.insert(key) {
        entries.push(candidate);
    }
}

fn join_paths(entries: &[PathBuf]) -> String {
    env::join_paths(entries)
        .map(|joined| joined.to_string_lossy().into_owned())
        .unwrap_or_else(|_| {
            let separator = if cfg!(windows) { ";" } else { ":" };
            entries
                .iter()
                .map(|entry| entry.to_string_lossy().into_owned())
                .collect::<Vec<_>>()
                .join(separator)
        })
}

/// Resolve `DATA_DIR` exactly like the server runtime
/// (`bin/cli/data-dir.mjs::resolveDataDir`).
///
/// 1. `DATA_DIR` (trimmed, absolutised)
/// 2. `OMNIROUTE_DATA_DIR` (Tauri-era alias, kept for compatibility)
/// 3. `<home>/.omniroute` when it already exists as a directory
/// 4. Windows: `%APPDATA%\omniroute`
/// 5. Unix: `$XDG_CONFIG_HOME/omniroute` when set
/// 6. `<home>/.omniroute`
///
/// The server resolves packs and storage from this same directory, so the shell
/// must not invent its own: the previous `~/Library/Application Support/...`
/// macOS fallback disagreed with both `data-dir.mjs` and `optionalPacks.ts` and
/// would have made `omniroute packs install` invisible to the desktop app.
pub fn resolve_data_dir() -> Result<PathBuf, String> {
    resolve_data_dir_from(&|key: &str| env::var(key).ok(), home_dir())
}

fn resolve_data_dir_from(
    get: &dyn Fn(&str) -> Option<String>,
    home: Option<PathBuf>,
) -> Result<PathBuf, String> {
    for key in [DATA_DIR_ENV, DATA_DIR_ENV_ALIAS] {
        if let Some(configured) = configured_path(get(key)) {
            return Ok(configured);
        }
    }

    let home = home.ok_or_else(|| "application data directory unavailable".to_string())?;
    let legacy = home.join(format!(".{APP_DIR_NAME}"));
    if legacy.is_dir() {
        return Ok(legacy);
    }

    if cfg!(windows) {
        let app_data =
            configured_path(get("APPDATA")).unwrap_or_else(|| home.join("AppData").join("Roaming"));
        return Ok(app_data.join(APP_DIR_NAME));
    }

    if let Some(xdg_config_home) = configured_path(get("XDG_CONFIG_HOME")) {
        return Ok(xdg_config_home.join(APP_DIR_NAME));
    }

    Ok(legacy)
}

fn configured_path(value: Option<String>) -> Option<PathBuf> {
    let trimmed = value?;
    let trimmed = trimmed.trim();
    if trimmed.is_empty() {
        return None;
    }
    let path = PathBuf::from(trimmed);
    Some(absolute(path))
}

fn absolute(path: PathBuf) -> PathBuf {
    if path.is_absolute() {
        path
    } else {
        env::current_dir()
            .map(|cwd| cwd.join(&path))
            .unwrap_or(path)
    }
}

fn home_dir() -> Option<PathBuf> {
    ["HOME", "USERPROFILE"]
        .iter()
        .find_map(|key| env::var_os(key).filter(|value| !value.is_empty()))
        .map(PathBuf::from)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn scratch(tag: &str) -> PathBuf {
        let dir = env::temp_dir().join(format!(
            "omniroute-desktop-paths-{tag}-{}",
            std::process::id()
        ));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).expect("scratch dir");
        dir
    }

    /// Guards the build-time manifest hand-off: this fails (with the fix) when
    /// `build.rs` could not parse `scripts/packs/optionalPackManifest.mjs` or
    /// when the manifest and [`FALLBACK_OPTIONAL_PACK_NAMES`] drifted apart.
    #[test]
    fn build_script_injects_pack_names_from_the_manifest() {
        let injected = option_env!("OMNIROUTE_OPTIONAL_PACK_NAMES").unwrap_or("");
        assert_eq!(
            injected,
            FALLBACK_OPTIONAL_PACK_NAMES.join(","),
            "build.rs must inject the OPTIONAL_PACKS names from \
             scripts/packs/optionalPackManifest.mjs; update \
             FALLBACK_OPTIONAL_PACK_NAMES in src/paths.rs when the manifest changes"
        );
    }

    #[test]
    fn pack_names_keep_manifest_order() {
        assert_eq!(
            optional_pack_names(),
            vec!["ml-runtime".to_string(), "browser-runtime".to_string()]
        );
    }

    #[test]
    fn only_installed_packs_contribute_node_path_entries() {
        let data_dir = scratch("one-pack");
        let installed = pack_node_modules_dir(&data_dir, "ml-runtime");
        std::fs::create_dir_all(&installed).expect("install pack");

        assert_eq!(
            installed_pack_node_modules(&data_dir),
            vec![installed.clone()]
        );
        assert_eq!(
            resolve_node_path(&data_dir, None),
            installed.to_string_lossy().into_owned()
        );
    }

    #[test]
    fn installed_packs_are_prepended_to_existing_entries() {
        let data_dir = scratch("prepend");
        let ml = pack_node_modules_dir(&data_dir, "ml-runtime");
        let browser = pack_node_modules_dir(&data_dir, "browser-runtime");
        std::fs::create_dir_all(&ml).expect("install ml-runtime");
        std::fs::create_dir_all(&browser).expect("install browser-runtime");

        // Manifest order (ml-runtime first), then the inherited entry.
        assert_eq!(
            resolve_node_path(&data_dir, Some("/existing/one")),
            format!(
                "{}:{}:/existing/one",
                ml.to_string_lossy(),
                browser.to_string_lossy()
            )
        );
    }

    #[test]
    fn duplicate_entries_are_kept_once() {
        let data_dir = scratch("dedupe");
        let ml = pack_node_modules_dir(&data_dir, "ml-runtime");
        std::fs::create_dir_all(&ml).expect("install pack");
        let existing = ml.to_string_lossy().into_owned();

        assert_eq!(resolve_node_path(&data_dir, Some(&existing)), existing);
    }

    #[test]
    fn missing_packs_directory_yields_no_entries() {
        let data_dir = scratch("no-packs");
        assert!(installed_pack_node_modules(&data_dir).is_empty());
        assert_eq!(resolve_node_path(&data_dir, None), "");
    }

    #[test]
    fn configured_data_dir_wins_over_platform_defaults() {
        let lookup = |key: &str| match key {
            DATA_DIR_ENV => Some("  /configured/data  ".to_string()),
            _ => Some("/home/tester".to_string()),
        };
        assert_eq!(
            resolve_data_dir_from(&lookup, Some(PathBuf::from("/home/tester")))
                .expect("configured dir"),
            PathBuf::from("/configured/data")
        );
    }

    #[test]
    fn partial_pack_install_is_ignored() {
        let data_dir = scratch("partial");
        // A file where a pack's node_modules should be must not count as installed.
        std::fs::create_dir_all(
            pack_node_modules_dir(&data_dir, "ml-runtime")
                .parent()
                .unwrap(),
        )
        .expect("pack dir");
        std::fs::write(pack_node_modules_dir(&data_dir, "ml-runtime"), b"").expect("file");
        assert!(installed_pack_node_modules(&data_dir).is_empty());
    }
}
