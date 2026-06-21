// SPDX-License-Identifier: MIT OR Apache-2.0

//! focus-mcp-server library exports for testing and integration.

pub mod server;
pub mod tools;
pub mod transport;

pub use server::run_stdio;
pub use tools::FocalPointToolsImpl;
