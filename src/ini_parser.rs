// Minimal INI parser. Supports sections, key=value pairs, comments starting with ';'
// or '#', and quoted values. Output is a flat Vec<(Option<String>, String, String)>
// of (section, key, value). Use `group_by_section` to pivot into a HashMap-style view.
use std::collections::BTreeMap;

#[derive(Debug, PartialEq, Eq)]
pub struct Entry {
    pub section: Option<String>,
    pub key: String,
    pub value: String,
}

pub fn parse(input: &str) -> Result<Vec<Entry>, String> {
    let mut out = Vec::new();
    let mut section: Option<String> = None;
    for (i, raw_line) in input.lines().enumerate() {
        let line = raw_line.trim();
        if line.is_empty() || line.starts_with(';') || line.starts_with('#') {
            continue;
        }
        if let Some(rest) = line.strip_prefix('[') {
            let name = rest.strip_suffix(']').ok_or_else(|| {
                format!("line {}: section header missing ']'", i + 1)
            })?;
            let name = name.trim().to_string();
            if name.is_empty() {
                return Err(format!("line {}: empty section name", i + 1));
            }
            section = Some(name);
            continue;
        }
        let eq_pos = line.find('=').ok_or_else(|| {
            format!("line {}: missing '='", i + 1)
        })?;
        let key = line[..eq_pos].trim().to_string();
        let value_raw = line[eq_pos+1..].trim();
        let value = strip_inline_comment(value_raw).trim().to_string();
        if key.is_empty() {
            return Err(format!("line {}: empty key", i + 1));
        }
        out.push(Entry { section: section.clone(), key, value });
    }
    Ok(out)
}

fn strip_inline_comment(s: &str) -> &str {
    if s.starts_with('"') {
        if let Some(end) = s[1..].find('"') {
            return &s[..end+2];
        }
    }
    if let Some(idx) = s.find(" ;").or_else(|| s.find(" #")) {
        return &s[..idx];
    }
    s
}

pub fn group_by_section(entries: &[Entry]) -> BTreeMap<String, BTreeMap<String, String>> {
    let mut map: BTreeMap<String, BTreeMap<String, String>> = BTreeMap::new();
    for e in entries {
        let sec = e.section.clone().unwrap_or_default();
        map.entry(sec).or_default().insert(e.key.clone(), e.value.clone());
    }
    map
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test] fn empty() {
        assert_eq!(parse(""), Ok(vec![]));
    }
    #[test] fn single_kv_no_section() {
        let v = parse("foo = bar").unwrap();
        assert_eq!(v, vec![Entry { section: None, key: "foo".into(), value: "bar".into() }]);
    }
    #[test] fn section_and_kv() {
        let v = parse("[s]\nfoo=bar\n").unwrap();
        assert_eq!(v, vec![Entry { section: Some("s".into()), key: "foo".into(), value: "bar".into() }]);
    }
    #[test] fn multiple_sections() {
        let v = parse("[a]\nx=1\n[b]\ny=2\n").unwrap();
        assert_eq!(v.len(), 2);
        assert_eq!(v[0].section.as_deref(), Some("a"));
        assert_eq!(v[1].section.as_deref(), Some("b"));
    }
    #[test] fn comments_skipped() {
        let v = parse("; comment\n# also\nfoo=1\n").unwrap();
        assert_eq!(v.len(), 1);
    }
    #[test] fn inline_comment_stripped() {
        let v = parse("foo=bar ; trailing\n").unwrap();
        assert_eq!(v[0].value, "bar");
    }
    #[test] fn quoted_value_with_comment_inside() {
        let v = parse("foo=\"a;b;c\" ; ignored\n").unwrap();
        assert_eq!(v[0].value, "\"a;b;c\"");
    }
    #[test] fn missing_equals() {
        assert!(parse("foo\n").is_err());
    }
    #[test] fn section_without_close() {
        assert!(parse("[unterminated\n").is_err());
    }
    #[test] fn group_view() {
        let v = parse("[s]\na=1\nb=2\n[s]\nc=3\n").unwrap();
        let g = group_by_section(&v);
        assert_eq!(g.get("s").unwrap().get("a").unwrap(), "1");
        assert_eq!(g.get("s").unwrap().get("c").unwrap(), "3");
    }
    #[test] fn whitespace_trimmed() {
        let v = parse("  key  =  value  \n").unwrap();
        assert_eq!(v[0].key, "key");
        assert_eq!(v[0].value, "value");
    }
    #[test] fn empty_key() {
        assert!(parse("=novalue\n").is_err());
    }
}