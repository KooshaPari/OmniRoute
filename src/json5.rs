// Minimal JSON5 parser. JSON5 is a superset of JSON that allows:
//   - comments (// and /* ... */)
//   - trailing commas in arrays and objects
//   - single-quoted strings
//   - unquoted object keys (identifier-style)
//   - hexadecimal numbers (0xFF)
//   - special numbers (Infinity, -Infinity, NaN)
//   - multi-line strings
//
// This is NOT a full JSON5 implementation — use the `json5` crate for that.

use std::collections::BTreeMap;

#[derive(Debug, PartialEq, Clone)]
pub enum Value {
    Null,
    Bool(bool),
    Number(f64),
    String(String),
    Array(Vec<Value>),
    Object(BTreeMap<String, Value>),
}

struct Parser<'a> { src: &'a str, pos: usize }
impl<'a> Parser<'a> {
    fn new(s: &'a str) -> Self { Self { src: s, pos: 0 } }
    fn eof(&self) -> bool { self.pos >= self.src.len() }
    fn peek(&self) -> Option<char> { self.src[self.pos..].chars().next() }
    fn advance(&mut self) -> Option<char> {
        let c = self.peek()?;
        self.pos += c.len_utf8();
        Some(c)
    }
    fn skip_ws_and_comments(&mut self) {
        loop {
            while let Some(c) = self.peek() {
                if c.is_whitespace() { self.advance(); } else { break; }
            }
            if self.src[self.pos..].starts_with("//") {
                self.pos += 2;
                while let Some(c) = self.peek() { if c == '\n' { break; } self.advance(); }
                continue;
            }
            if self.src[self.pos..].starts_with("/*") {
                self.pos += 2;
                while !self.src[self.pos..].starts_with("*/") {
                    if self.eof() { break; }
                    self.advance();
                }
                if self.src[self.pos..].starts_with("*/") { self.pos += 2; }
                continue;
            }
            break;
        }
    }
    fn expect(&mut self, ch: char) -> Result<(), String> {
        self.skip_ws_and_comments();
        if self.peek() == Some(ch) { self.advance(); Ok(()) }
        else { Err(format!("expected '{}' at pos {}", ch, self.pos)) }
    }
    fn parse_value(&mut self) -> Result<Value, String> {
        self.skip_ws_and_comments();
        let c = self.peek().ok_or("unexpected end")?;
        match c {
            'n' => { self.expect_keyword("null")?; Ok(Value::Null) }
            't' => { self.expect_keyword("true")?; Ok(Value::Bool(true)) }
            'f' => { self.expect_keyword("false")?; Ok(Value::Bool(false)) }
            '"' | '\'' => Ok(Value::String(self.parse_string()?)),
            '[' => self.parse_array(),
            '{' => self.parse_object(),
            'I' => {
                if self.src[self.pos..].starts_with("Infinity") {
                    self.pos += 8;
                    Ok(Value::Number(f64::INFINITY))
                } else { Err(format!("unexpected I at {}", self.pos)) }
            }
            '-' => {
                if self.src[self.pos..].starts_with("-Infinity") {
                    self.pos += 9;
                    Ok(Value::Number(f64::NEG_INFINITY))
                } else {
                    self.parse_number()
                }
            }
            'N' => {
                if self.src[self.pos..].starts_with("NaN") {
                    self.pos += 3;
                    Ok(Value::Number(f64::NAN))
                } else { Err(format!("unexpected N at {}", self.pos)) }
            }
            '+' | '0'..='9' => self.parse_number(),
            _ => Err(format!("unexpected character '{}' at pos {}", c, self.pos)),
        }
    }
    fn expect_keyword(&mut self, kw: &str) -> Result<(), String> {
        self.skip_ws_and_comments();
        if self.src[self.pos..].starts_with(kw) {
            let after = self.pos + kw.len();
            if after >= self.src.len() || !self.src.as_bytes()[after].is_ascii_alphanumeric() {
                self.pos = after;
                return Ok(());
            }
        }
        Err(format!("expected keyword '{}' at pos {}", kw, self.pos))
    }
    fn parse_string(&mut self) -> Result<String, String> {
        let quote = self.advance().ok_or("expected quote")?;
        let mut out = String::new();
        loop {
            let c = self.advance().ok_or("unterminated string")?;
            if c == quote { return Ok(out); }
            if c == '\\' {
                let esc = self.advance().ok_or("bad escape")?;
                match esc {
                    '"' => out.push('"'),
                    '\'' => out.push('\''),
                    '\\' => out.push('\\'),
                    '/' => out.push('/'),
                    'n' => out.push('\n'),
                    't' => out.push('\t'),
                    'r' => out.push('\r'),
                    'b' => out.push('\u{0008}'),
                    'f' => out.push('\u{000C}'),
                    '\n' => {},
                    '\r' => { if self.peek() == Some('\n') { self.advance(); } },
                    'u' => {
                        let hex: String = (0..4).map(|_| self.advance().unwrap_or('\0')).collect();
                        let cp = u32::from_str_radix(&hex, 16).map_err(|_| "bad unicode")?;
                        if let Some(ch) = char::from_u32(cp) { out.push(ch); }
                    }
                    _ => return Err(format!("bad escape \\{}", esc)),
                }
            } else if c == '\n' || c == '\r' {
                // multi-line strings allowed
                out.push(c);
            } else { out.push(c); }
        }
    }
    fn parse_number(&mut self) -> Result<Value, String> {
        let start = self.pos;
        if matches!(self.peek(), Some('-') | Some('+')) { self.advance(); }
        if self.src[self.pos..].starts_with("0x") || self.src[self.pos..].starts_with("0X") {
            self.pos += 2;
            let hstart = self.pos;
            while let Some(c) = self.peek() { if c.is_ascii_hexdigit() { self.advance(); } else { break; } }
            let s = &self.src[hstart..self.pos];
            if s.is_empty() { return Err("bad hex".into()); }
            let n = u64::from_str_radix(s, 16).map_err(|_| "bad hex")?;
            return Ok(Value::Number(n as f64));
        }
        if self.peek() == Some('0') { self.advance(); }
        while let Some(c) = self.peek() { if c.is_ascii_digit() { self.advance(); } else { break; } }
        let mut is_float = false;
        if self.peek() == Some('.') { is_float = true; self.advance(); while let Some(c) = self.peek() { if c.is_ascii_digit() { self.advance(); } else { break; } } }
        if matches!(self.peek(), Some('e') | Some('E')) { is_float = true; self.advance(); if matches!(self.peek(), Some('+') | Some('-')) { self.advance(); } while let Some(c) = self.peek() { if c.is_ascii_digit() { self.advance(); } else { break; } } }
        let s = &self.src[start..self.pos];
        if is_float { s.parse::<f64>().map(Value::Number).map_err(|e| e.to_string()) }
        else { s.parse::<i64>().map(|i| Value::Number(i as f64)).map_err(|e| e.to_string()) }
    }
    fn parse_array(&mut self) -> Result<Value, String> {
        self.expect('[')?;
        let mut items = Vec::new();
        loop {
            self.skip_ws_and_comments();
            if self.peek() == Some(']') { self.advance(); return Ok(Value::Array(items)); }
            items.push(self.parse_value()?);
            self.skip_ws_and_comments();
            if self.peek() == Some(',') { self.advance(); continue; }
            if self.peek() == Some(']') { self.advance(); return Ok(Value::Array(items)); }
            return Err(format!("expected , or ] at pos {}", self.pos));
        }
    }
    fn parse_object(&mut self) -> Result<Value, String> {
        self.expect('{')?;
        let mut map: BTreeMap<String, Value> = BTreeMap::new();
        loop {
            self.skip_ws_and_comments();
            if self.peek() == Some('}') { self.advance(); return Ok(Value::Object(map)); }
            let key = self.parse_key()?;
            self.skip_ws_and_comments();
            self.expect(':')?;
            let v = self.parse_value()?;
            map.insert(key, v);
            self.skip_ws_and_comments();
            if self.peek() == Some(',') { self.advance(); continue; }
            if self.peek() == Some('}') { self.advance(); return Ok(Value::Object(map)); }
            return Err(format!("expected , or }} at pos {}", self.pos));
        }
    }
    fn parse_implicit_object(&mut self) -> Result<Value, String> {
        let mut map: BTreeMap<String, Value> = BTreeMap::new();
        loop {
            self.skip_ws_and_comments();
            if self.eof() { return Ok(Value::Object(map)); }
            if self.peek() == Some(',') { self.advance(); continue; }
            let key = self.parse_key()?;
            self.skip_ws_and_comments();
            self.expect(':')?;
            let v = self.parse_value()?;
            map.insert(key, v);
            self.skip_ws_and_comments();
            if self.peek() == Some(',') { self.advance(); continue; }
            if self.eof() { return Ok(Value::Object(map)); }
            return Err(format!("expected , or eof at pos {}", self.pos));
        }
    }
fn parse_key(&mut self) -> Result<String, String> {
        self.skip_ws_and_comments();
        match self.peek() {
            Some('"') | Some('\'') => self.parse_string(),
            Some(c) if c.is_ascii_alphabetic() || c == '_' || c == '$' => {
                let start = self.pos;
                while let Some(c) = self.peek() {
                    if c.is_ascii_alphanumeric() || c == '_' || c == '$' { self.advance(); } else { break; }
                }
                Ok(self.src[start..self.pos].to_string())
            }
            _ => Err(format!("expected key at pos {}", self.pos)),
        }
    }
}

pub fn parse(input: &str) -> Result<Value, String> {
    let mut p = Parser::new(input);
    p.skip_ws_and_comments();
    // If the first non-ws char looks like an object key (identifier),
    // treat the top level as an implicit object.
    if let Some(c) = p.peek() {
        if c.is_ascii_alphabetic() || c == '_' || c == '$' {
            let v = p.parse_implicit_object()?;
            p.skip_ws_and_comments();
            if !p.eof() { return Err(format!("trailing content at pos {}", p.pos)); }
            return Ok(v);
        }
    }
    let v = p.parse_value()?;
    p.skip_ws_and_comments();
    if !p.eof() { return Err(format!("trailing content at pos {}", p.pos)); }
    Ok(v)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test] fn parses_basic_object() {
        let v = parse(r#"{"a":1}"#).unwrap();
        if let Value::Object(m) = v { assert_eq!(m.get("a").unwrap(), &Value::Number(1.0)); } else { panic!(); }
    }
    #[test] fn single_quoted_keys() {
        let v = parse("{'a': 1}").unwrap();
        if let Value::Object(m) = v { assert!(m.contains_key("a")); } else { panic!(); }
    }
    #[test] fn unquoted_keys() {
        let v = parse("{a: 1, b: 2}").unwrap();
        if let Value::Object(m) = v {
            assert_eq!(m.get("a").unwrap(), &Value::Number(1.0));
            assert_eq!(m.get("b").unwrap(), &Value::Number(2.0));
        } else { panic!(); }
    }
    #[test] fn line_comments() {
        let v = parse("// hello\na: 1").unwrap();
        if let Value::Object(m) = v { assert_eq!(m.get("a").unwrap(), &Value::Number(1.0)); } else { panic!(); }
    }
    #[test] fn block_comments() {
        let v = parse("/* block */ a: 1").unwrap();
        if let Value::Object(m) = v { assert_eq!(m.get("a").unwrap(), &Value::Number(1.0)); } else { panic!(); }
    }
    #[test] fn trailing_comma_array() {
        let v = parse("[1, 2, 3,]").unwrap();
        if let Value::Array(a) = v { assert_eq!(a.len(), 3); } else { panic!(); }
    }
    #[test] fn trailing_comma_object() {
        let v = parse("{a: 1, b: 2,}").unwrap();
        if let Value::Object(m) = v { assert_eq!(m.len(), 2); } else { panic!(); }
    }
    #[test] fn hex_number() {
        let v = parse("{a: 0xFF}").unwrap();
        if let Value::Object(m) = v { assert_eq!(m.get("a").unwrap(), &Value::Number(255.0)); } else { panic!(); }
    }
    #[test] fn special_numbers() {
        let v = parse("[Infinity, -Infinity, NaN]").unwrap();
        if let Value::Array(a) = v {
            assert_eq!(a.len(), 3);
        } else { panic!(); }
    }
    #[test] fn multi_line_string() {
        let v = parse(r#"{a: "hello\nworld"}"#).unwrap();
        if let Value::Object(m) = v {
            assert_eq!(m.get("a").unwrap(), &Value::String("hello\nworld".into()));
        } else { panic!(); }
    }
    #[test] fn nested() {
        let v = parse("{a: [1, {b: 2}]}").unwrap();
        if let Value::Object(m) = v {
            if let Value::Array(a) = m.get("a").unwrap() {
                assert_eq!(a.len(), 2);
            } else { panic!(); }
        } else { panic!(); }
    }
    #[test] fn rejects_trailing() {
        assert!(parse("{a: 1} garbage").is_err());
    }
    #[test] fn empty_object() {
        let v = parse("{}").unwrap();
        if let Value::Object(m) = v { assert!(m.is_empty()); } else { panic!(); }
    }
    #[test] fn empty_array() {
        let v = parse("[]").unwrap();
        if let Value::Array(a) = v { assert!(a.is_empty()); } else { panic!(); }
    }
}