pub fn parse(s: &str) -> Vec<Vec<String>> {
    s.lines().filter(|l| !l.is_empty()).map(parse_line).collect()
}

pub fn parse_line(line: &str) -> Vec<String> {
    let mut result = Vec::new();
    let mut current = String::new();
    let mut in_quotes = false;
    let mut chars = line.chars().peekable();
    while let Some(c) = chars.next() {
        if c == '"' {
            if in_quotes && chars.peek() == Some(&'"') { current.push('"'); chars.next(); }
            else { in_quotes = !in_quotes; }
        } else if c == ',' && !in_quotes {
            result.push(std::mem::take(&mut current));
        } else { current.push(c); }
    }
    result.push(current);
    result
}

pub fn escape(s: &str) -> String {
    if s.contains(',') || s.contains('"') || s.contains('\n') {
        format!("\"{}\"", s.replace('"', "\"\""))
    } else { s.to_string() }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test] fn test_simple() { assert_eq!(parse_line("a,b,c"), vec!["a".to_string(), "b".to_string(), "c".to_string()]); }
    #[test] fn test_quoted() { assert_eq!(parse_line(r#""a,b",c"#), vec!["a,b".to_string(), "c".to_string()]); }
    #[test] fn test_escaped_quote() { assert_eq!(parse_line(r#""a""b",c"#), vec!["a\"b".to_string(), "c".to_string()]); }
    #[test] fn test_empty() { assert_eq!(parse_line(""), vec!["".to_string()]); }
    #[test] fn test_full() { let r: Vec<Vec<String>> = parse("a,b\nc,d"); assert_eq!(r, vec![vec!["a".to_string(), "b".to_string()], vec!["c".to_string(), "d".to_string()]]); }
    #[test] fn test_escape() { assert_eq!(escape("hello"), "hello"); assert_eq!(escape("a,b"), r#""a,b""#); }
    #[test] fn test_escape_quote() { assert_eq!(escape(r#"a"b"#), r#""a""b""#); }
}
