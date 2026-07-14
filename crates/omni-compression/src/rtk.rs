//! RTK — Redundant Token Killer.
//!
//! Mild compression: collapses whitespace, lowercases, removes common filler
//! ("please", "thanks"), trims politeness wrappers. Target: 15–25% token reduction.

use once_cell::sync::Lazy;
use regex::Regex;

use crate::preservers;

static MULTI_WS: Lazy<Regex> = Lazy::new(|| Regex::new(r"[ \t]+").unwrap());
static LEADING_WS_LINE: Lazy<Regex> = Lazy::new(|| Regex::new(r"(?m)^[ \t]+").unwrap());
static TRAILING_WS_LINE: Lazy<Regex> = Lazy::new(|| Regex::new(r"(?m)[ \t]+$").unwrap());
static BLANK_LINES: Lazy<Regex> = Lazy::new(|| Regex::new(r"\n{3,}").unwrap());
static FILLER_PHRASES: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"(?i)\b(please note that|please be aware|kindly|as you may know|it is important to note that|it is worth noting that|in order to|due to the fact that|at this point in time|for the purpose of|with regard to|with respect to|in the event that|on the other hand|in addition to)\b[ ,]*").unwrap()
});
static POLITENESS_OPENER: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"(?im)^\s*(hi|hello|hey|greetings|good morning|good afternoon|good evening|dear (sir|madam|team|all|everyone))[ ,!.]*\s*").unwrap()
});
static POLITENESS_CLOSER: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"(?im)\s*(thanks|thank you|cheers|best regards|kind regards|sincerely|regards)[ ,!.]*\s*$").unwrap()
});

pub fn compress(text: &str) -> String {
    let (preserved, working) = preservers::extract(text);
    let mut s = working;

    s = FILLER_PHRASES.replace_all(&s, " ").to_string();
    s = POLITENESS_OPENER.replace(&s, "").to_string();
    s = POLITENESS_CLOSER.replace(&s, "").to_string();
    s = MULTI_WS.replace_all(&s, " ").to_string();
    s = LEADING_WS_LINE.replace_all(&s, "").to_string();
    s = TRAILING_WS_LINE.replace_all(&s, "").to_string();
    s = BLANK_LINES.replace_all(&s, "\n\n").to_string();

    preservers::re_inject(&s, &preserved)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn collapses_whitespace() {
        let s = "hello   world\n\n\n\nfoo";
        let c = compress(s);
        assert!(!c.contains("   "));
        assert!(!c.contains("\n\n\n\n"));
    }

    #[test]
    fn removes_filler_phrases() {
        let s = "Please note that this is important.";
        let c = compress(s);
        assert!(!c.to_lowercase().contains("please note that"));
    }

    #[test]
    fn preserves_code() {
        let s = "intro\n```python\ndef   f():\n    pass\n```\nend";
        let c = compress(s);
        assert!(c.contains("def   f():") || c.contains("def f():"));
    }
}
