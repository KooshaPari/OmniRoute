//! `cast` subcommand — cross-machine text injection into registered panes.
//!
//! Adds `sharecli cast register <name> <address>`, `cast unregister <name>`,
//! `cast list`, and `cast send <name> [file]`. The full terminal-control
//! surface is layered on the underlying `wezterm` / `ghostty` / `wt` casters
//! (see [`caster`]).
//!
//! FR: FR-CAST-001 … FR-CAST-008

pub mod address;
pub mod caster;
pub mod registry;

use std::path::PathBuf;

pub use address::{Host, PaneAddress};
#[allow(unused_imports)]
pub use caster::{
    Caster, ClipboardCaster, GhosttyCaster, ProcessRunner, SshWinTermCaster,
    SendOutcome, SystemRunner, WeztermCaster,
};
pub use registry::PaneRegistry;

/// Default on-disk location for the pane map.
pub fn default_registry() -> anyhow::Result<PaneRegistry> {
    PaneRegistry::new()
}

/// Resolve the on-disk path of the default pane-map file.
pub fn default_registry_path() -> Option<PathBuf> {
    default_registry().ok().map(|r| r.path().to_path_buf())
}
