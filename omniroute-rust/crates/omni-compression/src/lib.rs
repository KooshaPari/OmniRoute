//! OmniRoute prompt compression.
//!
//! Engines: RTK (mild), Caveman (terse), Aggressive (max), Adaptive (per-segment).
//! Code blocks, JSON, and long quoted strings are preserved via placeholder substitution.

#![forbid(unsafe_code)]
#![warn(clippy::all, clippy::pedantic)]
#![allow(clippy::module_name_repetitions)]

pub mod adaptive;
pub mod aggressive;
pub mod caveman;
pub mod error;
pub mod pipeline;
pub mod preservers;
pub mod rtk;
pub mod tokenizer;

pub use error::{Error, Result};

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Engine {
    /// Mild: collapse whitespace, strip filler phrases. 15-25% reduction.
    Rtk,
    /// Terse: drop articles, auxiliaries, hedges. 35-50% reduction.
    Caveman,
    /// Maximum: keep only key nouns + imperatives. 50-65% reduction.
    Aggressive,
    /// Adaptive: per-message engine choice.
    Adaptive,
}

#[derive(Debug, Clone)]
pub struct CompressRequest<'a> {
    pub text: &'a str,
    pub engine: Engine,
    /// Optional target ratio in (0, 1]. The pipeline will retry with a more
    /// aggressive engine if the result exceeds this.
    pub target_ratio: Option<f32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CompressOutput {
    pub text: String,
    pub original_tokens: u32,
    pub compressed_tokens: u32,
    pub ratio: f32,
}

pub fn count_tokens(text: &str, model: &str) -> u32 {
    tokenizer::count_tokens(text, model)
}

pub async fn compress(req: CompressRequest<'_>) -> Result<CompressOutput> {
    pipeline::run(&req.text, req.engine, req.target_ratio, "default").await
}

#[cfg(test)]
mod tests {
    use super::*;

    fn paragraph() -> &'static str {
        "The user is asking us to please be very careful and pay close attention to the fact \
         that this is a really important matter. We should be quite thorough and not miss \
         anything that might be relevant. The quick brown fox jumps over a lazy dog. \
         Please note that in order to fully understand this, we need to consider all the \
         various perspectives and possibilities. It is important to note that the system \
         might be slow due to the fact that there are many users at this point in time."
    }

    #[tokio::test]
    async fn rtk_compresses_mildly() {
        let out = compress(CompressRequest {
            text: paragraph(),
            engine: Engine::Rtk,
            target_ratio: None,
        })
        .await
        .unwrap();
        assert!(out.ratio < 1.0);
        assert!(out.ratio > 0.6, "rtk should compress ~15-25%, got ratio={}", out.ratio);
    }

    #[tokio::test]
    async fn caveman_compresses_more() {
        let out = compress(CompressRequest {
            text: paragraph(),
            engine: Engine::Caveman,
            target_ratio: None,
        })
        .await
        .unwrap();
        assert!(out.ratio < 0.8, "caveman should compress more, got ratio={}", out.ratio);
    }

    #[tokio::test]
    async fn aggressive_compresses_most() {
        let out = compress(CompressRequest {
            text: paragraph(),
            engine: Engine::Aggressive,
            target_ratio: None,
        })
        .await
        .unwrap();
        assert!(out.ratio < 0.6, "aggressive should compress ~50%+, got ratio={}", out.ratio);
    }

    #[tokio::test]
    async fn preserves_code_block() {
        let text = "intro paragraph\n```python\ndef hello():\n    print('hi')\n```\noutro";
        let out = compress(CompressRequest {
            text,
            engine: Engine::Caveman,
            target_ratio: None,
        })
        .await
        .unwrap();
        assert!(out.text.contains("def hello():"));
        assert!(out.text.contains("print('hi')"));
    }
}
