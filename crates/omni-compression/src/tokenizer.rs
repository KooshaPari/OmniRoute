//! Token counting via `tiktoken-rs`. Default encoding is `cl100k_base` (GPT-4/3.5).

use once_cell::sync::Lazy;
use tiktoken_rs::{cl100k_base, p50k_base, CoreBPE};

use crate::error::{Error, Result};

/// Cache of BPE encodings. Each is expensive to construct (loads mergeable_ranks
/// from disk) so we share one instance per encoding name.
static CL100K: Lazy<Result<CoreBPE>> = Lazy::new(|| {
    cl100k_base().map_err(|e| Error::Tokenizer(e.to_string()))
});

static P50K: Lazy<Result<CoreBPE>> = Lazy::new(|| {
    p50k_base().map_err(|e| Error::Tokenizer(e.to_string()))
});

/// Map a model name to a token-counting function. The current implementation
/// is conservative — Claude/Gemini use cl100k as a best-effort approximation.
pub fn count_tokens(text: &str, model: &str) -> u32 {
    if model.is_empty() {
        return count_cl100k(text);
    }
    let m = model.to_ascii_lowercase();
    if m.starts_with("gpt-3") || m.starts_with("gpt-4") || m.starts_with("text-embedding") {
        count_cl100k(text)
    } else if m.starts_with("code-davinci") || m.starts_with("text-davinci") {
        count_p50k(text)
    } else {
        // Claude, Gemini, Llama, Mistral, etc. — use cl100k as a best-effort approximation.
        count_cl100k(text)
    }
}

fn count_cl100k(text: &str) -> u32 {
    match CL100K.as_ref() {
        Ok(bpe) => bpe.encode_with_special_tokens(text).len() as u32,
        Err(_) => approx_count(text),
    }
}

fn count_p50k(text: &str) -> u32 {
    match P50K.as_ref() {
        Ok(bpe) => bpe.encode_with_special_tokens(text).len() as u32,
        Err(_) => approx_count(text),
    }
}

/// Fallback: ~1 token per 4 chars (English), rounding up.
fn approx_count(text: &str) -> u32 {
    let chars = text.chars().count() as u32;
    (chars + 3) / 4
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn empty_text_is_zero() {
        assert_eq!(count_tokens("", "gpt-4o"), 0);
    }

    #[test]
    fn short_english_phrase() {
        let n = count_tokens("Hello, world!", "gpt-4o");
        assert!(n >= 3 && n <= 6);
    }

    #[test]
    fn longer_paragraph_scales() {
        let short = count_tokens("The quick brown fox.", "gpt-4o");
        let long = count_tokens(&"The quick brown fox. ".repeat(50), "gpt-4o");
        assert!(long > short * 30);
    }

    #[test]
    fn empty_model_uses_default() {
        let n = count_tokens("Test", "");
        assert!(n > 0);
    }
}
