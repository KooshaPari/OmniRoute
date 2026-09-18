//! The runtime origin — the base URL of the OmniRoute server the shell talks to.
//!
//! Defaults to `http://localhost:20128`; `OMNIROUTE_RUNTIME_ORIGIN` points the
//! shell at a server started by hand instead.

use std::{
    net::{SocketAddr, TcpStream, ToSocketAddrs},
    time::Duration,
};

/// Port the OmniRoute server listens on by default.
pub const DEFAULT_RUNTIME_PORT: u16 = 20128;
/// Origin used when nothing overrides it.
pub const DEFAULT_RUNTIME_ORIGIN: &str = "http://localhost:20128";

/// `OMNIROUTE_RUNTIME_ORIGIN`, trimmed, falling back to the default.
pub fn resolve_origin() -> String {
    normalize_origin(std::env::var("OMNIROUTE_RUNTIME_ORIGIN").ok())
}

pub fn normalize_origin(value: Option<String>) -> String {
    value
        .map(|value| value.trim().to_owned())
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| DEFAULT_RUNTIME_ORIGIN.to_owned())
}

/// Textual `host[:port]` of an `http(s)` origin.
fn authority(origin: &str) -> Result<&str, String> {
    let rest = origin
        .strip_prefix("http://")
        .or_else(|| origin.strip_prefix("https://"))
        .ok_or_else(|| "invalid runtime origin".to_string())?;
    let authority = rest.split(['/', '?', '#']).next().unwrap_or_default();
    if authority.is_empty() {
        return Err("invalid runtime origin".to_string());
    }
    Ok(authority)
}

/// Port of an origin.
///
/// A portless `http://` origin means "the default OmniRoute port" (this is a
/// loopback runtime, not a public web origin); `https://` keeps the usual 443.
pub fn port_from_origin(origin: &str) -> u16 {
    let default_port = if origin.starts_with("https://") {
        443
    } else {
        DEFAULT_RUNTIME_PORT
    };
    let Ok(authority) = authority(origin) else {
        return default_port;
    };
    if let Some(rest) = authority.strip_prefix('[') {
        // IPv6 literal: `[::1]:20128`.
        return match rest.split_once("]:") {
            Some((_, port)) => port.parse().unwrap_or(default_port),
            None => default_port,
        };
    }
    match authority.rsplit_once(':') {
        Some((_, port)) => port.parse().unwrap_or(default_port),
        None => default_port,
    }
}

/// Resolvable socket address for an origin.
pub fn runtime_addr(origin: &str) -> Result<SocketAddr, String> {
    let authority = authority(origin)?;
    let default_port = port_from_origin(origin);
    let host_port = if authority.starts_with('[') {
        let end = authority
            .find(']')
            .ok_or_else(|| "invalid runtime origin".to_string())?;
        let host = &authority[..=end];
        let port = authority[end + 1..].strip_prefix(':').unwrap_or("");
        format!(
            "{host}:{}",
            if port.is_empty() {
                default_port.to_string()
            } else {
                port.to_string()
            }
        )
    } else if authority.matches(':').count() == 1 {
        authority.to_string()
    } else {
        format!("{authority}:{default_port}")
    };
    host_port
        .to_socket_addrs()
        .map_err(|_| "invalid runtime origin".to_string())?
        .next()
        .ok_or_else(|| "invalid runtime origin".to_string())
}

/// Whether something is accepting TCP connections at the origin right now.
///
/// Loopback refuses (or accepts) immediately, so the timeout only bounds the
/// pathological filtered-packet case.
pub fn is_reachable(origin: &str, timeout: Duration) -> bool {
    match runtime_addr(origin) {
        Ok(addr) => TcpStream::connect_timeout(&addr, timeout).is_ok(),
        Err(_) => false,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn resolves_default_localhost_origin() {
        assert_eq!(
            runtime_addr("http://localhost:20128").unwrap().port(),
            20128
        );
    }

    #[test]
    fn default_runtime_origin_is_localhost() {
        assert_eq!(normalize_origin(None), "http://localhost:20128");
    }

    #[test]
    fn blank_override_falls_back_to_the_default() {
        assert_eq!(
            normalize_origin(Some("   ".to_string())),
            DEFAULT_RUNTIME_ORIGIN
        );
    }

    #[test]
    fn rejects_origin_without_scheme() {
        assert!(runtime_addr("localhost:20128").is_err());
        assert!(authority("localhost:20128").is_err());
    }

    #[test]
    fn reads_port_from_authority_forms() {
        assert_eq!(port_from_origin("http://localhost:4555"), 4555);
        assert_eq!(port_from_origin("http://localhost"), DEFAULT_RUNTIME_PORT);
        assert_eq!(port_from_origin("https://localhost"), 443);
        assert_eq!(port_from_origin("http://[::1]:20129"), 20129);
        assert_eq!(port_from_origin("http://127.0.0.1:20128/v1"), 20128);
        assert_eq!(port_from_origin("nonsense"), DEFAULT_RUNTIME_PORT);
    }

    #[test]
    fn unreachable_origin_is_not_reachable() {
        // Port 1 is reserved and never listening on loopback.
        assert!(!is_reachable(
            "http://127.0.0.1:1",
            Duration::from_millis(150)
        ));
    }
}
