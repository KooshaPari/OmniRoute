//! Compression pipeline: tokenize → engine → tokenize → optionally retry.

use crate::{aggressive, caveman, count_tokens, rtk, CompressOutput, Engine, Error, Result};

/// Run the compression pipeline. If `target_ratio` is set and the result is
/// still too large, retry with progressively more aggressive engines.
pub async fn run(
    text: &str,
    engine: Engine,
    target_ratio: Option<f32>,
    model: &str,
) -> Result<CompressOutput> {
    let original_tokens = count_tokens(text, model);
    if original_tokens == 0 {
        return Ok(CompressOutput {
            text: text.to_string(),
            original_tokens: 0,
            compressed_tokens: 0,
            ratio: 1.0,
        });
    }

    let mut chosen = engine;
    let mut compressed = apply(text, chosen);
    let mut compressed_tokens = count_tokens(&compressed, model);
    let mut ratio = compressed_tokens as f32 / original_tokens as f32;

    if let Some(target) = target_ratio {
        let ladder = [Engine::Rtk, Engine::Caveman, Engine::Aggressive];
        let mut idx = ladder.iter().position(|e| *e == chosen).unwrap_or(0);
        while ratio > target && idx + 1 < ladder.len() {
            idx += 1;
            chosen = ladder[idx];
            compressed = apply(text, chosen);
            compressed_tokens = count_tokens(&compressed, model);
            ratio = compressed_tokens as f32 / original_tokens as f32;
        }
    }

    // Adaptive: per-segment compression
    if matches!(engine, Engine::Adaptive) {
        // Caller is expected to have called adaptive::compress_message on each
        // message. For a single text we just fall through to Aggressive.
        compressed = aggressive::compress(text);
        compressed_tokens = count_tokens(&compressed, model);
        ratio = compressed_tokens as f32 / original_tokens as f32;
    }

    // Sanity: if ratio > 1, something went wrong
    if compressed_tokens > original_tokens {
        // Compressor added tokens; use original
        return Ok(CompressOutput {
            text: text.to_string(),
            original_tokens,
            compressed_tokens: original_tokens,
            ratio: 1.0,
        });
    }

    Ok(CompressOutput {
        text: compressed,
        original_tokens,
        compressed_tokens,
        ratio,
    })
}

fn apply(text: &str, engine: Engine) -> String {
    match engine {
        Engine::Rtk => rtk::compress(text),
        Engine::Caveman => caveman::compress(text),
        Engine::Aggressive => aggressive::compress(text),
        Engine::Adaptive => aggressive::compress(text),
    }
}

impl From<String> for Error {
    fn from(s: String) -> Self {
        Self::Pipeline(s)
    }
}
