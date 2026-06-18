//! Integration tests for the `pheno-cli-base` public API.
//!
//! These exercise the same patterns a downstream CLI would:
//! `#[command(flatten)]` both args on a single top-level struct and
//! call `setup_tracing` from `main`.

use clap::Parser;
use pheno_cli_base::{ConfigArg, Verbosity, setup_tracing, setup_tracing_from_count};
use std::path::PathBuf;
use std::sync::Mutex;

/// Serialise tests that mutate `PHENOTYPE_CONFIG`. `std::env`
/// functions are not thread-safe and Rust runs tests in parallel
/// by default within a single integration test binary.
static ENV_LOCK: Mutex<()> = Mutex::new(());

/// Mirrors the typical `main` CLI struct of a Phenotype CLI.
#[derive(Debug, Parser)]
#[command(name = "demo", about = "Demonstrates pheno-cli-base usage")]
struct Cli {
    #[command(flatten)]
    config: ConfigArg,

    #[command(flatten)]
    verbosity: Verbosity,
}

#[test]
fn full_cli_parses_with_no_args() {
    let _guard = ENV_LOCK.lock().unwrap_or_else(|e| e.into_inner());
    // SAFETY: serialised by ENV_LOCK above.
    unsafe {
        std::env::remove_var("PHENOTYPE_CONFIG");
    }
    let cli = Cli::parse_from(["demo"]);
    assert!(!cli.config.is_set());
    assert!(cli.config.path().is_none());
    assert_eq!(cli.verbosity.verbose_count(), 0);
    assert!(!cli.verbosity.is_quiet());
}

#[test]
fn full_cli_parses_with_config_and_verbose() {
    let _guard = ENV_LOCK.lock().unwrap_or_else(|e| e.into_inner());
    let cli = Cli::parse_from(["demo", "-c", "/etc/app.yaml", "-vv"]);
    assert_eq!(
        cli.config.path().map(|p| p.to_path_buf()),
        Some(PathBuf::from("/etc/app.yaml"))
    );
    assert_eq!(cli.verbosity.verbose_count(), 2);
    assert!(!cli.verbosity.is_quiet());
}

#[test]
fn full_cli_parses_with_quiet() {
    let _guard = ENV_LOCK.lock().unwrap_or_else(|e| e.into_inner());
    let cli = Cli::parse_from(["demo", "--quiet"]);
    assert!(cli.verbosity.is_quiet());
    assert_eq!(cli.verbosity.verbose_count(), 0);
}

#[test]
fn env_var_fills_config() {
    let _guard = ENV_LOCK.lock().unwrap_or_else(|e| e.into_inner());
    // SAFETY: serialised by ENV_LOCK above.
    unsafe {
        std::env::set_var("PHENOTYPE_CONFIG", "/from/env.toml");
    }
    let cli = Cli::parse_from(["demo"]);
    assert!(cli.config.is_set());
    assert_eq!(
        cli.config.path().map(|p| p.to_path_buf()),
        Some(PathBuf::from("/from/env.toml"))
    );
    // SAFETY: serialised by ENV_LOCK above.
    unsafe {
        std::env::remove_var("PHENOTYPE_CONFIG");
    }
}

#[test]
fn flag_overrides_env_var() {
    let _guard = ENV_LOCK.lock().unwrap_or_else(|e| e.into_inner());
    // SAFETY: serialised by ENV_LOCK above.
    unsafe {
        std::env::set_var("PHENOTYPE_CONFIG", "/from/env.toml");
    }
    let cli = Cli::parse_from(["demo", "--config", "/from/flag.toml"]);
    assert_eq!(
        cli.config.path().map(|p| p.to_path_buf()),
        Some(PathBuf::from("/from/flag.toml"))
    );
    // SAFETY: serialised by ENV_LOCK above.
    unsafe {
        std::env::remove_var("PHENOTYPE_CONFIG");
    }
}

#[test]
fn verbosity_filter_levels_match_documented_table() {
    // (verbose_count, quiet) -> expected LevelFilter
    let cases: &[(u8, bool, tracing_subscriber::filter::LevelFilter)] = &[
        (
            0,
            false,
            tracing_subscriber::filter::LevelFilter::INFO,
        ),
        (
            1,
            false,
            tracing_subscriber::filter::LevelFilter::DEBUG,
        ),
        (
            2,
            false,
            tracing_subscriber::filter::LevelFilter::TRACE,
        ),
        (
            7,
            false,
            tracing_subscriber::filter::LevelFilter::TRACE,
        ),
        (
            0,
            true,
            tracing_subscriber::filter::LevelFilter::ERROR,
        ),
        (
            5,
            true,
            tracing_subscriber::filter::LevelFilter::ERROR,
        ),
    ];

    for &(count, quiet, expected) in cases {
        let v = Verbosity {
            verbose: count,
            quiet,
        };
        assert_eq!(
            v.to_filter(),
            expected,
            "verbosity (count={count}, quiet={quiet}) -> wrong filter",
        );
    }
}

#[test]
fn setup_tracing_does_not_panic() {
    // Both code paths must be safe to call.
    setup_tracing(tracing_subscriber::filter::LevelFilter::INFO);
    setup_tracing(tracing_subscriber::filter::LevelFilter::DEBUG);
    setup_tracing(tracing_subscriber::filter::LevelFilter::TRACE);
}

#[test]
fn setup_tracing_from_count_does_not_panic() {
    setup_tracing_from_count(0, false);
    setup_tracing_from_count(1, false);
    setup_tracing_from_count(2, false);
    setup_tracing_from_count(0, true);
}

#[test]
fn config_arg_default_is_unset() {
    let cfg = ConfigArg::default();
    assert!(!cfg.is_set());
    assert!(cfg.path().is_none());
}

#[test]
fn verbosity_default_is_zero_zero() {
    let v = Verbosity::default();
    assert_eq!(v.verbose_count(), 0);
    assert!(!v.is_quiet());
}
