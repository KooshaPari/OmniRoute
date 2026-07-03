//! `sharecli cast …` — cross-machine text injection into registered panes.

use std::fs;
use std::io::{self, Read};
use std::path::PathBuf;
use std::sync::Arc;

use anyhow::{anyhow, bail, Result};

use crate::cast::{
    caster::{Caster, ClipboardCaster, GhosttyCaster, RetryCaster, SendOutcome, SshWinTermCaster, WeztermCaster},
    PaneAddress, PaneRegistry,
};

/// Register a new pane. `cast register <name> <address>`.
pub fn register(name: &str, address: &str) -> Result<()> {
    let addr = PaneAddress::parse(address)?;
    let reg = PaneRegistry::new()?;
    reg.register(name, &addr)?;
    println!("Registered pane '{}' -> {}", name, addr);
    Ok(())
}

/// Unregister a pane. `cast unregister <name>`.
pub fn unregister(name: &str) -> Result<()> {
    let reg = PaneRegistry::new()?;
    reg.unregister(name)?;
    println!("Unregistered pane '{}'", name);
    Ok(())
}

/// List all registered panes. `cast list`.
pub fn list() -> Result<()> {
    let reg = PaneRegistry::new()?;
    let entries = reg.list()?;
    if entries.is_empty() {
        println!("No panes registered. Use 'sharecli cast register <name> <address>' to add one.");
        return Ok(());
    }
    println!("{:<24} ADDRESS", "NAME");
    println!("{}", "-".repeat(64));
    for (name, addr) in &entries {
        println!("{:<24} {}", name, addr);
    }
    Ok(())
}

/// Send text to a registered pane. `cast send <name> [file]`.
/// Reads from the named file, or stdin if `-` / omitted.
pub fn send(name: &str, file: Option<&str>) -> Result<()> {
    let reg = PaneRegistry::new()?;
    let addr = reg
        .resolve(name)?
        .ok_or_else(|| anyhow!("no pane registered as '{}'", name))?;

    let text = match file {
        Some("-") | None => read_stdin()?,
        Some(p) => fs::read_to_string(p).map_err(|e| {
            anyhow!("failed to read {}: {}", p, e)
        })?,
    };
    if text.is_empty() {
        bail!("refusing to send empty text to pane '{}'", name);
    }

    let casters: Vec<(Arc<dyn Caster>, String)> = vec![
        (
            Arc::new(RetryCaster::new(WeztermCaster::system(), 3, 200)),
            "wezterm-retry".to_string(),
        ),
        (
            Arc::new(RetryCaster::new(GhosttyCaster::system(), 3, 200)),
            "ghostty-retry".to_string(),
        ),
        (
            Arc::new(RetryCaster::new(SshWinTermCaster::system(), 2, 1000)),
            "ssh-winterm-retry".to_string(),
        ),
        (Arc::new(ClipboardCaster), "clipboard".to_string()),
    ];

    let outcome = crate::cast::caster::send_with_fallback(&casters, &addr, &text);
    report_outcome(name, &addr, &outcome);
    match outcome {
        SendOutcome::Delivered | SendOutcome::NeedsFocus => Ok(()),
        SendOutcome::Unsupported(msg) | SendOutcome::Failed(msg) => {
            Err(anyhow!("cast send failed: {}", msg))
        }
    }
}

fn read_stdin() -> Result<String> {
    let mut s = String::new();
    io::stdin().read_to_string(&mut s)?;
    Ok(s)
}

fn report_outcome(name: &str, addr: &PaneAddress, outcome: &SendOutcome) {
    match outcome {
        SendOutcome::Delivered => {
            println!("Sent to pane '{}' ({})", name, addr);
        }
        SendOutcome::NeedsFocus => {
            println!("Pane '{}' needs focus (text delivered to buffer)", name);
        }
        SendOutcome::Unsupported(msg) => {
            println!("Cast unsupported for pane '{}': {}", name, msg);
        }
        SendOutcome::Failed(msg) => {
            println!("Cast failed for pane '{}': {}", name, msg);
        }
    }
}

/// Show the resolved path of the pane-map file. `cast where`.
pub fn where_file() -> Result<()> {
    match crate::cast::default_registry_path() {
        Some(p) => {
            println!("{}", p.display());
            Ok(())
        }
        None => Err(anyhow!("could not resolve pane-map path")),
    }
}

// Silence unused-import warning for `PathBuf` in builds that don't use it.
#[allow(dead_code)]
fn _ensure_pathbuf_in_scope(_: PathBuf) {}
