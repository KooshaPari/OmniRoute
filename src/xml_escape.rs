pub fn escape(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    for c in s.chars() {
        match c {
            '<' => out.push_str("&lt;"),
            '>' => out.push_str("&gt;"),
            '&' => out.push_str("&amp;"),
            '"' => out.push_str("&quot;"),
            '\'' => out.push_str("&apos;"),
            _ => out.push(c),
        }
    }
    out
}
pub fn unescape(s: &str) -> String {
    s.replace("&lt;", "<").replace("&gt;", ">").replace("&quot;", "\"").replace("&apos;", "'").replace("&amp;", "&")
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test] fn escape_basic() { assert_eq!(escape("<b>hi</b>"), "&lt;b&gt;hi&lt;/b&gt;"); }
    #[test] fn escape_amp() { assert_eq!(escape("a&b"), "a&amp;b"); }
    #[test] fn escape_quote() { assert_eq!(escape(r#"""#), "&quot;"); }
    #[test] fn unescape_basic() { assert_eq!(unescape("&lt;b&gt;"), "<b>"); }
    #[test] fn roundtrip() { assert_eq!(unescape(&escape("<>\"'&")), "<>\"'&"); }
}
