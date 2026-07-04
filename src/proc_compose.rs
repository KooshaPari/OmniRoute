//! process-compose.yaml integration for sharecli
//!
//! Parses `process-compose.yaml` files and exposes their service definitions
//! as sharecli-managed process descriptors.

use std::collections::HashMap;
use std::path::{Path, PathBuf};

use anyhow::Result;
use serde::{Deserialize, Serialize};

// ---------------------------------------------------------------------------
// YAML schema structs
// ---------------------------------------------------------------------------

/// Top-level process-compose.yaml document.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ProcComposeConfig {
    /// Map of service name → service definition.
    #[serde(default)]
    pub processes: HashMap<String, ProcessEntry>,

    /// Optional log location (informational only).
    #[serde(default)]
    pub log_location: Option<String>,

    /// Optional global environment variables.
    #[serde(default)]
    pub environment: Option<Vec<String>>,
}

/// A single service entry inside `processes:`.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ProcessEntry {
    /// Shell command to run (maps to `command`).
    #[serde(default)]
    pub command: Option<String>,

    /// Working directory override.
    #[serde(default)]
    pub working_dir: Option<String>,

    /// Services this one depends on.
    #[serde(default)]
    pub depends_on: Option<DependsOn>,

    /// Restart policy (e.g. "on_failure", "always", "no").
    #[serde(default)]
    pub availability: Option<Availability>,

    /// Environment variables for this process.
    #[serde(default)]
    pub environment: Option<Vec<String>>,
}

/// `depends_on` can be a list of names OR a map of name → condition.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(untagged)]
pub enum DependsOn {
    List(Vec<String>),
    Map(HashMap<String, DependsOnCondition>),
}

/// Condition inside a map-style `depends_on`.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct DependsOnCondition {
    pub condition: Option<String>,
}

/// Availability / restart policy block.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct Availability {
    pub restart: Option<String>,
    pub exit_on_end: Option<bool>,
    pub max_restarts: Option<u32>,
}

// ---------------------------------------------------------------------------
// Normalised view that sharecli exposes
// ---------------------------------------------------------------------------

/// Flat, normalised definition consumed by sharecli commands.
#[derive(Debug, Clone)]
pub struct ProcessDef {
    pub name: String,
    pub command: String,
    pub working_dir: Option<String>,
    pub depends_on: Vec<String>,
    pub restart_policy: String,
}

impl ProcComposeConfig {
    /// Return all processes as normalised `ProcessDef`s.
    pub fn to_process_defs(&self) -> Vec<ProcessDef> {
        let mut defs: Vec<ProcessDef> = self
            .processes
            .iter()
            .map(|(name, entry)| {
                let depends_on = match &entry.depends_on {
                    None => vec![],
                    Some(DependsOn::List(v)) => v.clone(),
                    Some(DependsOn::Map(m)) => m.keys().cloned().collect(),
                };
                let restart_policy = entry
                    .availability
                    .as_ref()
                    .and_then(|a| a.restart.clone())
                    .unwrap_or_else(|| "no".to_string());

                ProcessDef {
                    name: name.clone(),
                    command: entry.command.clone().unwrap_or_default(),
                    working_dir: entry.working_dir.clone(),
                    depends_on,
                    restart_policy,
                }
            })
            .collect();

        // Stable ordering: alphabetical by name.
        defs.sort_by(|a, b| a.name.cmp(&b.name));
        defs
    }
}

// ---------------------------------------------------------------------------
// I/O helpers
// ---------------------------------------------------------------------------

/// Load and parse a `process-compose.yaml` (or `.yml`) file.
pub fn load_config(path: &Path) -> Result<ProcComposeConfig> {
    let content = std::fs::read_to_string(path)
        .map_err(|e| anyhow::anyhow!("Cannot read {}: {}", path.display(), e))?;
    let cfg: ProcComposeConfig = serde_yaml::from_str(&content)
        .map_err(|e| anyhow::anyhow!("YAML parse error in {}: {}", path.display(), e))?;
    Ok(cfg)
}

/// Walk parent directories from `start`, returning the first
/// `process-compose.yaml` or `process-compose.yml` found.
pub fn find_config(start: &Path) -> Option<PathBuf> {
    let mut dir = if start.is_dir() { start.to_path_buf() } else { start.parent()?.to_path_buf() };

    loop {
        for name in &["process-compose.yaml", "process-compose.yml"] {
            let candidate = dir.join(name);
            if candidate.exists() {
                return Some(candidate);
            }
        }
        match dir.parent() {
            Some(parent) => dir = parent.to_path_buf(),
            None => return None,
        }
    }
}

/// Pretty-print the process list as a status table.
pub fn print_status(defs: &[ProcessDef]) {
    if defs.is_empty() {
        println!("No processes defined in process-compose.yaml.");
        return;
    }
    println!("{:<25} {:<12} {:<20} {:<20} COMMAND", "NAME", "RESTART", "WORKING_DIR", "DEPENDS_ON");
    println!("{}", "-".repeat(100));
    for d in defs {
        let deps = if d.depends_on.is_empty() { "-".to_string() } else { d.depends_on.join(", ") };
        let cmd = if d.command.len() > 40 {
            format!("{}…", &d.command[..39])
        } else {
            d.command.clone()
        };
        let wd = d.working_dir.as_deref().unwrap_or("-");
        println!("{:<25} {:<12} {:<20} {:<20} {}", d.name, d.restart_policy, wd, deps, cmd);
    }
}

// ---------------------------------------------------------------------------
// Unit tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write as _;
    use tempfile::NamedTempFile;

    fn write_yaml(content: &str) -> NamedTempFile {
        let mut f = NamedTempFile::new().unwrap();
        f.write_all(content.as_bytes()).unwrap();
        f
    }

    #[test]
    fn parse_minimal_config() {
        let yaml = r#"
processes:
  web:
    command: "node server.js"
"#;
        let f = write_yaml(yaml);
        let cfg = load_config(f.path()).unwrap();
        assert_eq!(cfg.processes.len(), 1);
        let web = &cfg.processes["web"];
        assert_eq!(web.command.as_deref(), Some("node server.js"));
    }

    #[test]
    fn parse_multiple_processes() {
        let yaml = r#"
processes:
  api:
    command: "cargo run --bin api"
    working_dir: "./api"
  worker:
    command: "cargo run --bin worker"
    working_dir: "./worker"
    depends_on:
      - api
"#;
        let f = write_yaml(yaml);
        let cfg = load_config(f.path()).unwrap();
        assert_eq!(cfg.processes.len(), 2);

        let worker = &cfg.processes["worker"];
        match worker.depends_on.as_ref().unwrap() {
            DependsOn::List(v) => assert_eq!(v, &["api"]),
            _ => panic!("expected list depends_on"),
        }
    }

    #[test]
    fn parse_depends_on_map_form() {
        let yaml = r#"
processes:
  frontend:
    command: "bun dev"
    depends_on:
      backend:
        condition: process_healthy
"#;
        let f = write_yaml(yaml);
        let cfg = load_config(f.path()).unwrap();
        let fe = &cfg.processes["frontend"];
        match fe.depends_on.as_ref().unwrap() {
            DependsOn::Map(m) => assert!(m.contains_key("backend")),
            _ => panic!("expected map depends_on"),
        }
    }

    #[test]
    fn parse_restart_policy() {
        let yaml = r#"
processes:
  daemon:
    command: "my-daemon"
    availability:
      restart: on_failure
      max_restarts: 5
"#;
        let f = write_yaml(yaml);
        let cfg = load_config(f.path()).unwrap();
        let defs = cfg.to_process_defs();
        assert_eq!(defs.len(), 1);
        assert_eq!(defs[0].restart_policy, "on_failure");
    }

    #[test]
    fn to_process_defs_stable_order() {
        let yaml = r#"
processes:
  zebra:
    command: "z"
  alpha:
    command: "a"
  middle:
    command: "m"
"#;
        let f = write_yaml(yaml);
        let cfg = load_config(f.path()).unwrap();
        let defs = cfg.to_process_defs();
        let names: Vec<&str> = defs.iter().map(|d| d.name.as_str()).collect();
        assert_eq!(names, vec!["alpha", "middle", "zebra"]);
    }

    #[test]
    fn find_config_locates_yaml_in_tempdir() {
        let dir = tempfile::tempdir().unwrap();
        let yaml_path = dir.path().join("process-compose.yaml");
        std::fs::write(&yaml_path, "processes: {}").unwrap();

        // Starting from the directory itself.
        let found = find_config(dir.path()).unwrap();
        assert_eq!(found, yaml_path);
    }

    #[test]
    fn find_config_walks_parent() {
        let root = tempfile::tempdir().unwrap();
        let sub = root.path().join("sub/project");
        std::fs::create_dir_all(&sub).unwrap();
        let yaml_path = root.path().join("process-compose.yaml");
        std::fs::write(&yaml_path, "processes: {}").unwrap();

        let found = find_config(&sub).unwrap();
        assert_eq!(found, yaml_path);
    }

    #[test]
    fn find_config_returns_none_when_absent() {
        let dir = tempfile::tempdir().unwrap();
        assert!(find_config(dir.path()).is_none());
    }

    #[test]
    fn missing_file_returns_error() {
        let result = load_config(Path::new("/nonexistent/process-compose.yaml"));
        assert!(result.is_err());
    }

    #[test]
    fn empty_processes_block() {
        let yaml = "processes: {}\n";
        let f = write_yaml(yaml);
        let cfg = load_config(f.path()).unwrap();
        assert!(cfg.to_process_defs().is_empty());
    }
}
