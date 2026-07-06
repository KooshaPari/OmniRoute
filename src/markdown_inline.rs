// Inline markdown formatting: bold/italic/code detection and basic parser.
pub enum Inline {
    Text(String),
    Bold(Vec<Inline>),
    Italic(Vec<Inline>),
    Code(String),
    Link { text: Vec<Inline>, url: String },
}

pub fn parse_inline(input: &str) -> Vec<Inline> {
    let mut out = Vec::new();
    let mut i = 0;
    let bytes = input.as_bytes();
    while i < bytes.len() {
        if bytes[i] == b'`' {
            // code span
            if let Some(end) = input[i+1..].find('`') {
                let end = i + 1 + end;
                out.push(Inline::Code(input[i+1..end].to_string()));
                i = end + 1;
                continue;
            }
        }
        if i + 1 < bytes.len() && bytes[i] == b'*' && bytes[i+1] == b'*' {
            // bold
            if let Some(end) = input[i+2..].find("**") {
                let end = i + 2 + end;
                out.push(Inline::Bold(parse_inline(&input[i+2..end])));
                i = end + 2;
                continue;
            }
        }
        if bytes[i] == b'*' {
            // italic
            if let Some(end) = input[i+1..].find('*') {
                let end = i + 1 + end;
                out.push(Inline::Italic(parse_inline(&input[i+1..end])));
                i = end + 1;
                continue;
            }
        }
        if bytes[i] == b'[' {
            // link [text](url)
            if let Some(close_text) = input[i+1..].find(']') {
                let close_text = i + 1 + close_text;
                if close_text + 1 < bytes.len() && bytes[close_text + 1] == b'(' {
                    if let Some(close_url) = input[close_text+2..].find(')') {
                        let close_url = close_text + 2 + close_url;
                        out.push(Inline::Link {
                            text: parse_inline(&input[i+1..close_text]),
                            url: input[close_text+2..close_url].to_string(),
                        });
                        i = close_url + 1;
                        continue;
                    }
                }
            }
        }
        // plain text run
        let start = i;
        while i < bytes.len() && !matches!(bytes[i], b'`' | b'*' | b'[') {
            i += 1;
        }
        out.push(Inline::Text(input[start..i].to_string()));
    }
    out
}
pub fn render_inline(nodes: &[Inline]) -> String {
    let mut out = String::new();
    for n in nodes {
        match n {
            Inline::Text(s) => out.push_str(s),
            Inline::Bold(c) => { out.push_str("**"); out.push_str(&render_inline(c)); out.push_str("**"); }
            Inline::Italic(c) => { out.push('*'); out.push_str(&render_inline(c)); out.push('*'); }
            Inline::Code(s) => { out.push('`'); out.push_str(s); out.push('`'); }
            Inline::Link { text, url } => { out.push('['); out.push_str(&render_inline(text)); out.push_str("]("); out.push_str(url); out.push(')'); }
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test] fn parse_text_only() {
        let r = parse_inline("hello world");
        assert_eq!(r.len(), 1);
        assert!(matches!(r[0], Inline::Text(_)));
    }
    #[test] fn parse_bold() {
        let r = parse_inline("hello **bold** end");
        assert_eq!(r.len(), 3);
        assert!(matches!(r[1], Inline::Bold(_)));
    }
    #[test] fn parse_italic() {
        let r = parse_inline("a *b* c");
        assert_eq!(r.len(), 3);
        assert!(matches!(r[1], Inline::Italic(_)));
    }
    #[test] fn parse_code() {
        let r = parse_inline("a `code` b");
        assert_eq!(r.len(), 3);
        assert!(matches!(r[1], Inline::Code(_)));
    }
    #[test] fn parse_link() {
        let r = parse_inline("[click](https://example.com)");
        assert_eq!(r.len(), 1);
        match &r[0] {
            Inline::Link { text, url } => {
                assert_eq!(text.len(), 1);
                assert_eq!(url, "https://example.com");
            }
            _ => panic!(),
        }
    }
    #[test] fn render_roundtrip() {
        let input = "a **b** c *d* e `f` [g](h)";
        let parsed = parse_inline(input);
        let rendered = render_inline(&parsed);
        assert_eq!(rendered, input);
    }
    #[test] fn empty() {
        let r = parse_inline("");
        assert!(r.is_empty());
    }
    #[test] fn unclosed_delim() {
        let r = parse_inline("hello **world");
        // unclosed bold → plain text
        assert!(matches!(r[0], Inline::Text(_)));
    }
    #[test] fn nested_bold_italic() {
        let r = parse_inline("**a *b* c**");
        assert_eq!(r.len(), 1);
        if let Inline::Bold(c) = &r[0] {
            assert_eq!(c.len(), 3);
            assert!(matches!(c[1], Inline::Italic(_)));
        } else { panic!(); }
    }
}
