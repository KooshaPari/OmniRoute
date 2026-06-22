//! End-to-end demonstration of SIGHUP-driven hot reload for
//! `pheno-config` (L33 / v22-T3).
//!
//! # What this example shows
//!
//! 1. How a long-running `pheno-*` daemon wires up the
//!    `ConfigReloader` + `watch_sighup` pair.
//! 2. How a reader (the "main loop") consumes the live config
//!    without blocking on the reloader.
//! 3. How to drive the reload from the operator's side: send
//!    `SIGHUP` to the running process to pick up a file
//!    change.
//!
//! # Running it
//!
//! ```bash
//! cargo run --example hot_reload
//! # in another shell:
//! kill -HUP $(pgrep -f "hot_reload")
//! ```
//!
//! The example prints the live config value once per second. When
//! you edit `examples/hot_reload.config.toml` and send `SIGHUP`,
//! the next tick will print the new value.
//!
//! # Output shape
//!
//! ```text
//! [pheno-config hot_reload example] pid=12345 watching examples/hot_reload.config.toml
//! [tick 0001] url=http://localhost:8080
//! [tick 0002] url=http://localhost:8080
//! [SIGHUP] received at 2026-06-22T19:35:00Z — reloading examples/hot_reload.config.toml
//! [reload] ok: url=http://localhost:9090
//! [tick 0003] url=http://localhost:9090
//! ```
//!
//! # Why both sync + tokio?
//!
//! The SIGHUP watcher thread (`watch_sighup`) is synchronous by
//! design: signal delivery is itself a synchronous kernel
//! notification, and the handler runs in a dedicated OS thread
//! that does nothing but call `read_and_install` on each
//! `SIGHUP`. The reader side, however, is what the *consumer*
//! cares about — and most `pheno-*` consumers are tokio-based
//! (per ADR-088). This example shows the canonical pattern: a
//! sync `ConfigReloader` polled by a tokio task at request-time
//! granularity. The reload itself is O(microseconds) and
//! happens off the request path.
//!
//! # Configuration
//!
//! The example looks for `examples/hot_reload.config.toml`,
//! which ships with a default value. Edit it between
//! `SIGHUP`s to see the reload take effect.

use pheno_config::hot_reload::{watch_sighup, ConfigError, ConfigReloader};
use std::path::PathBuf;
use std::sync::Arc;
use std::thread;
use std::time::{Duration, Instant};

/// Where the example looks for its config file. Relative to
/// the crate root (where `cargo run --example` runs from).
const CONFIG_PATH: &str = "examples/hot_reload.config.toml";

/// Simple shape of the on-disk config. The example deliberately
/// keeps the parse closure trivial — the parse is what makes
/// `read_and_install` flexible for real `pheno-*` consumers.
#[derive(Clone, Debug)]
struct ExampleConfig {
    url: String,
}

/// Default value if the file does not exist. The example
/// still writes the file on first run so the operator has
/// something concrete to edit.
fn default_config() -> ExampleConfig {
    ExampleConfig {
        url: "http://localhost:8080".to_string(),
    }
}

/// Parse the on-disk format. The format is just one URL per
/// line, optionally with comments. Real `pheno-*` consumers
/// would call into their own TOML/JSON parsers here.
fn parse_config(contents: &str) -> Result<ExampleConfig, ConfigError> {
    for line in contents.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() || trimmed.starts_with('#') {
            continue;
        }
        // Expect `url = http://...`
        if let Some(rest) = trimmed.strip_prefix("url") {
            let rest = rest.trim_start_matches(['=', ' '].as_ref());
            return Ok(ExampleConfig {
                url: rest.to_string(),
            });
        }
    }
    Err(ConfigError::Parse(
        "no `url = ...` line found".to_string(),
    ))
}

fn main() {
    let path = PathBuf::from(CONFIG_PATH);

    // Make sure the config file exists with a known default —
    // operators edit it between SIGHUPs.
    if !path.exists() {
        std::fs::write(&path, "# edit me, then `kill -HUP $PID`\nurl = http://localhost:8080\n")
            .expect("write default config");
        println!(
            "[pheno-config hot_reload example] wrote default config to {}",
            path.display()
        );
    }

    // Initial config: read from disk if present, else default.
    let initial: ExampleConfig = std::fs::read_to_string(&path)
        .ok()
        .and_then(|s| parse_config(&s).ok())
        .unwrap_or_else(default_config);

    let reloader: Arc<ConfigReloader<ExampleConfig>> =
        ConfigReloader::new(initial);

    // Install the SIGHUP watcher. The handle is the background
    // thread; we drop it at the end of main, which detaches
    // the thread (it runs forever).
    let _watcher = watch_sighup(Arc::clone(&reloader), path.clone(), parse_config)
        .expect("install SIGHUP watcher");

    println!(
        "[pheno-config hot_reload example] pid={} watching {}",
        std::process::id(),
        path.display()
    );
    println!(
        "[pheno-config hot_reload example] edit the file, then `kill -HUP {}`",
        std::process::id()
    );

    // Main loop: read the live config once per second. This is
    // the pattern a tokio-based daemon would use — its async
    // task holds an Arc<ConfigReloader<C>> and reads from it
    // on each request. (The tokio feature on this crate's
    // Cargo.toml is what would let a downstream consumer
    // implement a `tokio::sync::watch`-style variant; the
    // sync substrate here is the lowest common denominator
    // and works with both sync and async runtimes.)
    let start = Instant::now();
    let mut tick: u64 = 0;
    loop {
        thread::sleep(Duration::from_secs(1));
        tick += 1;
        let live_cfg = reloader.current();
        let elapsed = start.elapsed().as_secs();
        println!(
            "[tick {:04}] t={:>3}s url={}",
            tick, elapsed, live_cfg.url
        );
    }
}
