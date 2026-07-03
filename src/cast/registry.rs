//! Pane registry — a TOML-backed name → `PaneAddress` map.
//!
//! Persisted to `~/.config/sharecli/cast/pane-map.toml` by default; tests
//! use `PaneRegistry::new_in(path)` for hermeticity.
//!
//! FR: FR-CAST-002

use std::collections::BTreeMap;
use std::fs;
use std::path::{Path, PathBuf};

use anyhow::{Context, Result};

use super::address::PaneAddress;

const FILENAME: &str = "pane-map.toml";

/// On-disk representation: `name = "machine:host:window:pane"`.
#[derive(Debug, Default, Clone, serde::Serialize, serde::Deserialize)]
struct PaneMap {
    #[serde(flatten)]
    entries: BTreeMap<String, String>,
}

/// A handle to the pane registry.
#[derive(Debug, Clone)]
pub struct PaneRegistry {
    path: PathBuf,
}

impl PaneRegistry {
    /// Open the default registry at `~/.config/sharecli/cast/pane-map.toml`.
    pub fn new() -> Result<Self> {
        let base = dirs::config_dir()
            .ok_or_else(|| anyhow::anyhow!("could not resolve user config dir"))?;
        Ok(Self::new_in(base.join("sharecli").join("cast"))?)
    }

    /// Open (or create) a registry whose file lives in `dir/pane-map.toml`.
    pub fn new_in<P: AsRef<Path>>(dir: P) -> Result<Self> {
        let dir = dir.as_ref().to_path_buf();
        if !dir.exists() {
            fs::create_dir_all(&dir)
                .with_context(|| format!("create registry dir {}", dir.display()))?;
        }
        Ok(Self { path: dir.join(FILENAME) })
    }

    /// Path to the backing file.
    pub fn path(&self) -> &Path {
        &self.path
    }

    /// Add or replace a `name → address` entry. Replaces silently on conflict.
    pub fn register(&self, name: &str, addr: &PaneAddress) -> Result<()> {
        validate_name(name)?;
        let mut map = self.load()?;
        map.entries.insert(name.to_string(), addr.to_string());
        self.save(&map)
    }

    /// Remove an entry. A no-op if the name is absent.
    pub fn unregister(&self, name: &str) -> Result<()> {
        let mut map = self.load()?;
        map.entries.remove(name);
        self.save(&map)
    }

    /// Return all entries, sorted by name.
    pub fn list(&self) -> Result<Vec<(String, PaneAddress)>> {
        let map = self.load()?;
        let mut out = Vec::with_capacity(map.entries.len());
        for (name, raw) in &map.entries {
            let addr = PaneAddress::parse(raw).with_context(|| {
                format!("malformed address for pane '{}': {}", name, raw)
            })?;
            out.push((name.clone(), addr));
        }
        Ok(out)
    }

    /// Resolve a name to its address, or `None` if absent.
    pub fn resolve(&self, name: &str) -> Result<Option<PaneAddress>> {
        let map = self.load()?;
        match map.entries.get(name) {
            Some(raw) => Ok(Some(PaneAddress::parse(raw).with_context(|| {
                format!("malformed address for pane '{}': {}", name, raw)
            })?)),
            None => Ok(None),
        }
    }

    // -- io --

    fn load(&self) -> Result<PaneMap> {
        if !self.path.exists() {
            return Ok(PaneMap::default());
        }
        let body = fs::read_to_string(&self.path)
            .with_context(|| format!("read registry {}", self.path.display()))?;
        let map: PaneMap = toml::from_str(&body)
            .with_context(|| format!("parse registry {}", self.path.display()))?;
        Ok(map)
    }

    fn save(&self, map: &PaneMap) -> Result<()> {
        let body = toml::to_string_pretty(map)
            .context("serialise registry")?;
        fs::write(&self.path, body)
            .with_context(|| format!("write registry {}", self.path.display()))?;
        Ok(())
    }
}

/// Name policy: non-empty, no whitespace, no path separators, no control chars.
/// Pane names appear as TOML keys and shell arguments.
fn validate_name(name: &str) -> Result<()> {
    if name.is_empty() {
        anyhow::bail!("pane name must not be empty");
    }
    for c in name.chars() {
        if c.is_control() || c.is_whitespace() || c == ':' || c == '/' || c == '\\' {
            anyhow::bail!(
                "invalid pane name {:?}: contains forbidden character {:?}",
                name,
                c
            );
        }
    }
    Ok(())
}

// ---------------------------------------------------------------------------
// unit tests (whitebox, complement the blackbox tests in tests/cast_registry.rs)
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn validate_name_accepts_typical() {
        assert!(validate_name("civis-1").is_ok());
        assert!(validate_name("spine_protocol").is_ok());
        assert!(validate_name("civis.platform").is_ok());
    }

    #[test]
    fn validate_name_rejects_empty() {
        assert!(validate_name("").is_err());
    }

    #[test]
    fn validate_name_rejects_whitespace() {
        assert!(validate_name("civis 1").is_err());
        assert!(validate_name("civis\t1").is_err());
        assert!(validate_name("civis\n1").is_err());
    }

    #[test]
    fn validate_name_rejects_path_separators() {
        assert!(validate_name("civis/1").is_err());
        assert!(validate_name("civis\\1").is_err());
        assert!(validate_name("civis:1").is_err());
    }

    #[test]
    fn round_trip_via_toml() {
        let map = PaneMap {
            entries: BTreeMap::from([("a".to_string(), "mbp:local:0:2".to_string())]),
        };
        let s = toml::to_string(&map).expect("serialise");
        let back: PaneMap = toml::from_str(&s).expect("parse");
        assert_eq!(back.entries.get("a").map(String::as_str), Some("mbp:local:0:2"));
    }
}
