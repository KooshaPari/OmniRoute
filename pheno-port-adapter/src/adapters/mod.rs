//! Concrete [`PortAdapter`] implementations for the most common transports.
//!
//! Two transport adapters are shipped in-tree:
//!
//! - [`tcp::TcpAdapter`] — connects to a `host:port` endpoint via
//!   [`std::net::TcpStream`].
//! - [`unix::UnixAdapter`] — connects to a filesystem path endpoint via
//!   [`std::os::unix::net::UnixStream`] (Unix-only; the module is gated on
//!   `cfg(unix)` and compiles to an empty module on other targets so the crate
//!   stays buildable on every platform).
//!
//! Both transport adapters follow the same pattern: the active stream is
//! held in an interior `Mutex<Option<…>>` so the synchronous [`PortAdapter`]
//! methods (which take `&self`, not `&mut self`) can mutate the connection
//! state safely. The [`Connection`] handle returned to callers only carries
//! the endpoint string as an opaque id; the concrete stream lives inside the
//! adapter and is dropped on [`PortAdapter::disconnect`].
//!
//! In addition to the transport adapters above, this module exposes
//! [`TimePort`](crate::ports::time::TimePort) adapters:
//!
//! - [`system_clock::SystemClock`] — wall-clock-backed, for production.
//! - [`mock_clock::MockClock`] — caller-driven, for deterministic tests.

pub mod tcp;

#[cfg(unix)]
pub mod unix;

/// [`TimePort`](crate::ports::time::TimePort) adapters — concrete clocks
/// injected at the composition root.
pub mod mock_clock;
pub mod system_clock;
