//! # phenotype-deps
//!
//! Batteries-included shared dependency veneer for Phenotype workspace crates.
//!
//! ## Usage
//!
//! ```rust
//! use phenotype_deps::prelude::*;
//! ```
//!
//! This single import brings in all commonly shared dependencies
//! (tokio, serde, anyhow, chrono, clap, uuid, etc.) so you never
//! need to coordinate version bumps across Tasken, AgilePlus, and
//! sibling crates manually.

pub use anyhow;
pub use async_trait;
pub use chrono;
pub use clap;
pub use futures;
pub use serde;
pub use serde_json;
pub use tempfile;
pub use thiserror;
pub use tokio;
pub use uuid;

pub mod prelude;

#[cfg(test)]
#[allow(dead_code)]
mod tests {
    /// Smoke test: verify all re-exported deps are accessible
    /// via the prelude.
    #[test]
    fn prelude_smoke() {
        use crate::prelude::*;

        // serde
        #[derive(Serialize, Deserialize)]
        struct Foo {
            bar: String,
        }

        // anyhow
        fn _fallible() -> AnyhowResult<()> {
            Ok(())
        }

        // chrono
        let _now = Utc::now();

        // uuid
        let _id = Uuid::new_v4();

        // clap
        const _: fn() = || {
            #[derive(Parser)]
            struct Cli;
        };

        // thiserror
        #[derive(Error, Debug)]
        enum MyError {
            #[error("boom")]
            Boom,
        }

        // serde_json
        let _val: Value = json!({"ok": true});
        let _ = _val;

        // tokio (just check the re-export compiles)
        fn _tokio_ok() {
            let _ = tokio::spawn(async {});
        }

        // futures
        fn _futures_ok() {
            use futures::future::FutureExt;
            let _ = futures::future::ready(()).map(|_| ());
        }

        // async-trait
        #[async_trait]
        trait MyTrait {
            async fn do_thing(&self);
        }

        // tempfile
        let _dir = TempDir::new().unwrap();
        let _file = NamedTempFile::new().unwrap();
    }
}
