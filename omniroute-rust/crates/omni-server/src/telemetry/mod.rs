//! Telemetry: tracing + (future) OpenTelemetry exporters. The body is tiny in
//! v1 — `tracing-subscriber` is initialised by `omni-server` `main.rs`. The
//! module exists so downstream crates (CLI, SDK, tests) can init their own
//! subscriber with the same configuration.

pub fn init_subscriber() {
    use tracing_subscriber::{fmt, prelude::*, EnvFilter};
    let env_filter = EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| EnvFilter::new("info,omni_server=debug,omni_core=info"));
    let layer = fmt::layer().with_target(false).compact();
    let _ = tracing_subscriber::registry()
        .with(env_filter)
        .with(layer)
        .try_init();
}
