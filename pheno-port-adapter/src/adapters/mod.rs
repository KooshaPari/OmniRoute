//! Concrete adapter implementations for the hexagonal ports.
//!
//! ## Transport adapters (sync [`PortAdapter`] trait)
//!
//! - [`tcp::TcpAdapter`] — connects to a `host:port` endpoint via
//!   [`std::net::TcpStream`].
//! - [`unix::UnixAdapter`] — connects to a filesystem path endpoint via
//!   [`std::os::unix::net::UnixStream`] (Unix-only; the module is gated on
//!   `cfg(unix)` and compiles to an empty module on other targets so the
//!   crate stays buildable on every platform).
//!
//! Both transport adapters follow the same pattern: the active stream is
//! held in an interior `Mutex<Option<…>>` so the synchronous
//! [`PortAdapter`] methods (which take `&self`, not `&mut self`) can
//! mutate the connection state safely. The [`Connection`] handle returned
//! to callers only carries the endpoint string as an opaque id; the
//! concrete stream lives inside the adapter and is dropped on
//! [`PortAdapter::disconnect`].
//!
//! ## Hex-port adapters (async [`crate::ports::HexCachePort`] etc.)
//!
//! - [`in_memory_cache::InMemoryCache`] — process-local cache, default
//!   for tests and single-node binaries.
//! - [`redis_cache::RedisAdapter`] — RESP-wire-protocol cache, used for
//!   cross-process / multi-node deployments.
//! - [`system_clock::SystemClock`] — real wall-clock + monotonic
//!   adapter for [`crate::ports::HexTimePort`]. Use in production.
//! - [`mock_clock::MockClock`] — frozen clock for tests; the
//!   monotonic instant and the wall-clock unix nanos are decoupled so
//!   tests can assert "wall-clock-equals-X" without sleeping.
//!
//! These adapters back the hexagonal ports in `crate::ports`. Each one
//! implements its port trait via `#[async_trait]` to stay object-safe.

pub mod in_memory_cache;
pub mod mock_clock;
pub mod redis_cache;
pub mod system_clock;

pub mod tcp;

#[cfg(unix)]
pub mod unix;

pub use in_memory_cache::InMemoryCache;
pub use mock_clock::MockClock;
pub use redis_cache::RedisAdapter;
pub use system_clock::SystemClock;
