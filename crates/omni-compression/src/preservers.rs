//! Extract code blocks, JSON, and quoted strings so compression doesn't mangle them.

#[derive(Debug, Clone, PartialEq)]
pub struct Preserved {
    pub placeholder: String,
    pub original: String,
}


/// Extract fenced code blocks (```…```), inline code (`…`), JSON objects/arrays,
/// and "double-quoted" strings. Returns a list of placeholders + originals and
/// the remaining "compressible" text with placeholders substituted in.
pub fn extract(text: &str) -> (Vec<Preserved>, String) {
    let mut preserved: Vec<Preserved> = Vec::new();
    let mut working = text.to_string();

    // 1) Fenced code blocks ```lang\n...\n```
    let fenced_re = regex::Regex::new(r"(?s)```[a-zA-Z0-9_+-]*\n.*?\n```").unwrap();
    let mut counter = 0;
    loop {
        let m = match fenced_re.find(&working) {
            Some(m) => m,
            None => break,
        };
        let original = m.as_str().to_string();
        let placeholder = format!("\x00PRESERVED_{counter}\x00");
        preserved.push(Preserved { placeholder: placeholder.clone(), original });
        working = format!("{}{}{}", &working[..m.start()], &placeholder, &working[m.end()..]);
        counter += 1;
    }

    // 2) JSON objects / arrays
    let json_re = regex::Regex::new(r"(?s)(\{[\s\S]*?\}|\[[\s\S]*?\])").unwrap();
    loop {
        let m = match json_re.find(&working) {
            Some(m) => m,
            None => break,
        };
        let original = m.as_str().to_string();
        // Sanity check: must parse as JSON
        if serde_json::from_str::<serde_json::Value>(&original).is_err() {
            // Skip — not actual JSON
            working = working.replacen(&original, "\x00_SKIP_\x00", 1);
            continue;
        }
        let placeholder = format!("\x00PRESERVED_{counter}\x00");
        working = working.replacen(&original, &placeholder, 1);
        preserved.push(Preserved { placeholder, original });
        counter += 1;
    }

    // 3) Double-quoted strings (long ones only, > 12 chars)
    let quoted_re = regex::Regex::new(r#""([^"\\]|\\.)*""#).unwrap();
    loop {
        let m = match quoted_re.find(&working) {
            Some(m) => m,
            None => break,
        };
        if m.as_str().len() < 12 {
            continue;  // skip short quotes
        }
        let original = m.as_str().to_string();
        let placeholder = format!("\x00PRESERVED_{counter}\x00");
        working = working.replacen(&original, &placeholder, 1);
        preserved.push(Preserved { placeholder, original });
        counter += 1;
    }

    (preserved, working)
}

/// Re-inject preserved blocks back into the compressed text.
pub fn re_inject(text: &str, preserved: &[Preserved]) -> String {
    let mut out = text.to_string();
    for p in preserved {
        out = out.replace(&p.placeholder, &p.original);
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;
    use unicode_segmentation::UnicodeSegmentation;

    #[test]
    fn preserves_fenced_code() {
        let text = "Hello\n```python\nprint('hi')\n```\nWorld";
        let (preserved, working) = extract(text);
        assert!(working.contains("PRESERVED_0"));
        let restored = re_inject(&working, &preserved);
        assert_eq!(restored, text);
    }

    #[test]
    fn preserves_json() {
        let text = r#"data: {"key": "value", "n": 42} end"#;
        let (preserved, working) = extract(text);
        assert!(working.contains("PRESERVED_"));
        let restored = re_inject(&working, &preserved);
        assert_eq!(restored, text);
    }

    #[test]
    fn unicode_preserved() {
        let text = "Hello \u{1F600} World";
        let (_, working) = extract(text);
        let grapheme_count = text.graphemes(true).count();
        let working_count = working.graphemes(true).count();
        assert_eq!(grapheme_count, working_count);
    }
}
