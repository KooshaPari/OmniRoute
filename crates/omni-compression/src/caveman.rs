//! Caveman — terse, English-as-second-language compression.
//!
//! Strips articles, auxiliaries, hedges, politeness. Target: 35–50% reduction.

use once_cell::sync::Lazy;
use regex::Regex;

use crate::preservers;

static ARTICLES: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"(?i)\b(a|an|the)\b").unwrap()
});
static AUX: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"(?i)\b(is|are|was|were|be|been|being|am|do|does|did|have|has|had|having)\b").unwrap()
});
static HEDGES: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"(?i)\b(very|really|quite|rather|somewhat|perhaps|maybe|possibly|likely|probably|seemingly|apparently|basically|essentially|literally|honestly|frankly|actually)\b").unwrap()
});
static FILLER_CAVEMAN: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"(?i)\b(that|which|who|whom|whose|where|when|while|because|since|although|though|even|also|too|just|only|still|already|yet|now|then|here|there)\b").unwrap()
});
static WS: Lazy<Regex> = Lazy::new(|| Regex::new(r"[ \t]+").unwrap());

pub fn compress(text: &str) -> String {
    let (preserved, working) = preservers::extract(text);
    let mut s = working;
    s = HEDGES.replace_all(&s, "").to_string();
    s = FILLER_CAVEMAN.replace_all(&s, "").to_string();
    s = ARTICLES.replace_all(&s, "").to_string();
    s = AUX.replace_all(&s, "").to_string();
    s = WS.replace_all(&s, " ").to_string();
    // Trim leading/trailing whitespace per line
    s = s.lines().map(str::trim).collect::<Vec<_>>().join("\n");
    // Drop empty lines
    let mut lines: Vec<&str> = s.lines().filter(|l| !l.trim().is_empty()).collect();
    lines.retain(|l| !l.trim().is_empty());
    let out = lines.join("\n");
    preservers::re_inject(&out, &preserved)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn strips_articles() {
        let s = "The quick brown fox jumps over a lazy dog.";
        let c = compress(s);
        assert!(!c.to_lowercase().contains(" the "));
        assert!(!c.to_lowercase().contains(" a "));
    }

    #[test]
    fn strips_hedges() {
        let s = "It is very important to be quite careful here.";
        let c = compress(s);
        assert!(!c.to_lowercase().contains("very"));
        assert!(!c.to_lowercase().contains("quite"));
    }
}
