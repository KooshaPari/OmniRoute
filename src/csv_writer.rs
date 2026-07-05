// Minimal CSV writer (RFC 4180): quote fields containing comma, quote, or newline; escape inner quotes by doubling.
pub fn write_row(fields: &[&str]) -> String {
    let mut out = String::new();
    for (i, field) in fields.iter().enumerate() {
        if i > 0 { out.push(','); }
        if needs_quoting(field) {
            out.push('"');
            for c in field.chars() {
                if c == '"' { out.push_str("\"\""); }
                else { out.push(c); }
            }
            out.push('"');
        } else {
            out.push_str(field);
        }
    }
    out.push('\n');
    out
}
pub fn write_rows<'a, I: IntoIterator<Item = &'a [&'a str]>>(rows: I) -> String {
    let mut out = String::new();
    for row in rows { out.push_str(&write_row(row)); }
    out
}
fn needs_quoting(s: &str) -> bool {
    s.contains(',') || s.contains('"') || s.contains('\n') || s.contains('\r')
}
pub fn escape_field(s: &str) -> String {
    let mut out = String::new();
    out.push('"');
    for c in s.chars() {
        if c == '"' { out.push_str("\"\""); }
        else { out.push(c); }
    }
    out.push('"');
    out
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn simple_row() {
        assert_eq!(write_row(&["a", "b", "c"]), "a,b,c\n");
    }
    #[test]
    fn empty_field() {
        assert_eq!(write_row(&["a", "", "c"]), "a,,c\n");
    }
    #[test]
    fn quote_with_comma() {
        assert_eq!(write_row(&["a", "b,c", "d"]), "a,\"b,c\",d\n");
    }
    #[test]
    fn quote_with_newline() {
        assert_eq!(write_row(&["a", "line1\nline2", "b"]), "a,\"line1\nline2\",b\n");
    }
    #[test]
    fn escape_inner_quotes() {
        assert_eq!(write_row(&["a", "b\"c", "d"]), "a,\"b\"\"c\",d\n");
    }
    #[test]
    fn quote_with_crlf() {
        assert_eq!(write_row(&["a", "b\rc", "d"]), "a,\"b\rc\",d\n");
    }
    #[test]
    fn multi_row() {
        let rows: Vec<&[&str]> = vec![
            &["name", "age"],
            &["alice", "30"],
            &["bob", "25"],
        ];
        let s = write_rows(rows);
        assert_eq!(s, "name,age\nalice,30\nbob,25\n");
    }
    #[test]
    fn single_field() {
        assert_eq!(write_row(&["alone"]), "alone\n");
    }
    #[test]
    fn empty_row() {
        assert_eq!(write_row(&[]), "\n");
    }
    #[test]
    fn needs_quoting_test() {
        assert!(needs_quoting("a,b"));
        assert!(!needs_quoting("abc"));
        assert!(needs_quoting("a\nb"));
        assert!(needs_quoting("a\"b"));
    }
    #[test]
    fn escape_field_test() {
        assert_eq!(escape_field("hello"), "\"hello\"");
        assert_eq!(escape_field("say \"hi\""), "\"say \"\"hi\"\"\"");
    }
}
