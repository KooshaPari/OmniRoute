// SPDX-License-Identifier: MIT OR Apache-2.0

//! Sync-to-async bridge for MCP tool calls within a tokio runtime.
//!
//! MCP tools expose a sync interface (`call(&self, input) -> Result<CallToolResponse>`);
//! FocalPoint storage is async. This module bridges that gap via `tokio::task::block_in_place`.
//!
//! Usage:
//! ```ignore
//! let result = async_bridge::run_async(async {
//!     self.adapter.rule_store().get(rule_id).await
//! })?;
//! ```

use anyhow::Result;

/// Run an async future from a sync context using the current tokio runtime.
///
/// Requires that the caller is executing within a tokio runtime (e.g., `#[tokio::main]`).
/// Uses `tokio::task::block_in_place` to yield the thread while blocking, allowing the
/// executor to schedule other tasks.
///
/// # Errors
///
/// Returns `Err` if:
/// - No tokio runtime is active (should not happen in MCP server context).
/// - The future returns an error (propagated).
pub fn run_async<F, T>(f: F) -> Result<T>
where
    F: std::future::Future<Output = Result<T>>,
{
    match tokio::runtime::Handle::try_current() {
        Ok(handle) => {
            // Inside tokio runtime; use block_in_place to yield the thread.
            tokio::task::block_in_place(|| handle.block_on(f))
        }
        Err(_) => {
            // No current runtime; should not happen in MCP server context.
            anyhow::bail!(
                "no tokio runtime available; MCP tools must be called from tokio context"
            )
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_run_async_success() {
        let result = run_async(async { Ok::<i32, anyhow::Error>(42) });
        assert_eq!(result.unwrap(), 42);
    }

    #[tokio::test]
    async fn test_run_async_error() {
        let result: Result<i32> = run_async(async { anyhow::bail!("test error") });
        assert!(result.is_err());
    }
}
