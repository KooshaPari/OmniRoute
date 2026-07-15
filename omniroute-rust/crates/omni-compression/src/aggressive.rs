//! Aggressive — maximum compression. Keeps only imperative + key nouns.
//! Target: 50–65% reduction.

use once_cell::sync::Lazy;
use regex::Regex;

use crate::preservers;

static STOPWORDS: Lazy<Regex> = Lazy::new(|| {
    // Long, intentional list. Case-insensitive. Keeps the message scannable
    // at the cost of grammatical correctness.
    Regex::new(
        r"(?ix)\b(
            a|an|the|of|in|on|at|to|for|with|from|by|as|into|onto|upon|
            is|are|was|were|be|been|being|am|
            do|does|did|done|
            have|has|had|having|
            will|would|can|could|should|may|might|must|shall|
            and|or|but|if|then|else|than|so|because|since|although|though|while|
            that|which|who|whom|whose|where|when|
            this|that|these|those|
            very|really|quite|rather|somewhat|perhaps|maybe|possibly|likely|probably|
            it|its|they|them|their|we|us|our|you|your|i|me|my|
            not|no|never|none|nothing|
            just|only|also|too|even|still|already|yet|again|
            here|there|now|then|above|below|under|over|up|down|out|off|away|
            please|kindly|thanks|thank
        )\b[ ,]*",
    )
    .unwrap()
});

static WS: Lazy<Regex> = Lazy::new(|| Regex::new(r"[ \t]+").unwrap());
static PUNCT_RUN: Lazy<Regex> = Lazy::new(|| Regex::new(r"[.!?]{2,}").unwrap());
static COMMA_RUN: Lazy<Regex> = Lazy::new(|| Regex::new(r",\s*,").unwrap());

pub fn compress(text: &str) -> String {
    let (preserved, working) = preservers::extract(text);
    let mut s = working;
    s = STOPWORDS.replace_all(&s, " ").to_string();
    s = PUNCT_RUN.replace_all(&s, ".").to_string();
    s = COMMA_RUN.replace_all(&s, ",").to_string();
    s = WS.replace_all(&s, " ").to_string();
    s = s
        .lines()
        .map(str::trim)
        .filter(|l| !l.is_empty())
        .collect::<Vec<_>>()
        .join("\n");
    // Trim trailing period if it's the only char
    if s.ends_with('.') && s.len() > 1 {
        s.pop();
    }
    preservers::re_inject(&s, &preserved)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn strips_most_words() {
        let s = "In order to fully understand this, it is very important to be quite thorough and not miss anything that might be relevant due to the fact that there are many things at this point in time.";
        let c = compress(s);
        // should be very short
        assert!(c.len() < (s.len() * 3) / 5, "got len={} from {}", c.len(), s);
    }

    #[test]
    fn preserves_code() {
        let s = "intro\n```js\nconst x = 42;\n```\nend";
        let c = compress(s);
        assert!(c.contains("const x = 42;"));
    }
}
