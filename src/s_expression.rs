// Minimal S-expression parser. Parses Lisp-style nested lists with atoms
// (integers, floats, strings, symbols, booleans). Output is an `Sexp` enum
// that can be re-rendered with `to_string()` for round-trip fidelity.
//
// Use `parse_many` to parse a sequence of top-level expressions.

#[derive(Debug, PartialEq, Clone)]
pub enum Atom {
    Int(i64),
    Float(f64),
    Bool(bool),
    Str(String),
    Symbol(String),
}

#[derive(Debug, PartialEq, Clone)]
pub enum Sexp {
    Atom(Atom),
    List(Vec<Sexp>),
}

pub fn parse_many(input: &str) -> Result<Vec<Sexp>, String> {
    let mut out = Vec::new();
    let mut p = Parser::new(input);
    p.skip_ws();
    while !p.eof() {
        out.push(p.parse_sexp()?);
        p.skip_ws();
    }
    Ok(out)
}

pub fn parse(input: &str) -> Result<Sexp, String> {
    let v = parse_many(input)?;
    if v.is_empty() { return Err("empty input".into()); }
    if v.len() > 1 { return Err("multiple top-level expressions".into()); }
    Ok(v.into_iter().next().unwrap())
}

pub fn to_string(s: &Sexp) -> String {
    match s {
        Sexp::Atom(a) => atom_str(a),
        Sexp::List(items) => {
            let inner: Vec<String> = items.iter().map(to_string).collect();
            format!("({})", inner.join(" "))
        }
    }
}

fn atom_str(a: &Atom) -> String {
    match a {
        Atom::Int(i) => i.to_string(),
        Atom::Float(f) => f.to_string(),
        Atom::Bool(b) => if *b { "#t".into() } else { "#f".into() },
        Atom::Str(s) => format!("\"{}\"", s.replace('\\', "\\\\").replace('"', "\\\"")),
        Atom::Symbol(s) => s.clone(),
    }
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
    fn skip_ws(&mut self) {
        while let Some(c) = self.peek() {
            if c.is_whitespace() { self.advance(); }
            else if c == ';' {
                while let Some(c) = self.peek() { if c == '\n' { break; } self.advance(); }
            }
            else { break; }
        }
    }
    fn parse_sexp(&mut self) -> Result<Sexp, String> {
        self.skip_ws();
        match self.peek() {
            Some('(') => self.parse_list(),
            Some('"') => Ok(Sexp::Atom(Atom::Str(self.parse_string()?))),
            Some('#') => {
                if self.src[self.pos..].starts_with("#t") { self.pos += 2; Ok(Sexp::Atom(Atom::Bool(true))) }
                else if self.src[self.pos..].starts_with("#f") { self.pos += 2; Ok(Sexp::Atom(Atom::Bool(false))) }
                else { Err(format!("unknown # form at {}", self.pos)) }
            }
            Some(c) if c == '-' => {
                // Only treat '-' as a number sign if a digit follows.
                let next = self.src[self.pos + c.len_utf8()..].chars().next();
                if matches!(next, Some(d) if d.is_ascii_digit()) {
                    self.parse_number().map(Sexp::Atom)
                } else {
                    Ok(Sexp::Atom(Atom::Symbol(self.parse_symbol()?)))
                }
            }
            Some(c) if c.is_ascii_digit() => self.parse_number().map(Sexp::Atom),
            Some(c) if is_symbol_char(c) => Ok(Sexp::Atom(Atom::Symbol(self.parse_symbol()?))),
            Some(c) => Err(format!("unexpected '{}' at {}", c, self.pos)),
            None => Err("unexpected end".into()),
        }
    }
    fn parse_list(&mut self) -> Result<Sexp, String> {
        self.advance(); // consume '('
        let mut items = Vec::new();
        loop {
            self.skip_ws();
            match self.peek() {
                Some(')') => { self.advance(); return Ok(Sexp::List(items)); }
                None => return Err("unterminated list".into()),
                _ => items.push(self.parse_sexp()?),
            }
        }
    }
    fn parse_string(&mut self) -> Result<String, String> {
        self.advance();
        let mut out = String::new();
        loop {
            let c = self.advance().ok_or("unterminated string")?;
            if c == '"' { return Ok(out); }
            if c == '\\' {
                let esc = self.advance().ok_or("bad escape")?;
                match esc {
                    '"' => out.push('"'),
                    '\\' => out.push('\\'),
                    'n' => out.push('\n'),
                    't' => out.push('\t'),
                    'r' => out.push('\r'),
                    _ => return Err(format!("bad escape \\{}", esc)),
                }
            } else { out.push(c); }
        }
    }
    fn parse_symbol(&mut self) -> Result<String, String> {
        let start = self.pos;
        while let Some(c) = self.peek() {
            if is_symbol_char(c) { self.advance(); } else { break; }
        }
        Ok(self.src[start..self.pos].to_string())
    }
    fn parse_number(&mut self) -> Result<Atom, String> {
        let start = self.pos;
        if self.peek() == Some('-') { self.advance(); }
        while let Some(c) = self.peek() { if c.is_ascii_digit() { self.advance(); } else { break; } }
        let mut is_float = false;
        if self.peek() == Some('.') { is_float = true; self.advance(); while let Some(c) = self.peek() { if c.is_ascii_digit() { self.advance(); } else { break; } } }
        if matches!(self.peek(), Some('e') | Some('E')) { is_float = true; self.advance(); if matches!(self.peek(), Some('+') | Some('-')) { self.advance(); } while let Some(c) = self.peek() { if c.is_ascii_digit() { self.advance(); } else { break; } } }
        let s = &self.src[start..self.pos];
        if is_float { s.parse::<f64>().map(Atom::Float).map_err(|e| e.to_string()) }
        else { s.parse::<i64>().map(Atom::Int).map_err(|e| e.to_string()) }
    }
}

fn is_symbol_char(c: char) -> bool {
    !c.is_whitespace() && !matches!(c, '(' | ')' | '"' | ';')
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test] fn parse_atom() {
        let v = parse("foo").unwrap();
        assert_eq!(v, Sexp::Atom(Atom::Symbol("foo".into())));
    }
    #[test] fn parse_int() {
        let v = parse("42").unwrap();
        assert_eq!(v, Sexp::Atom(Atom::Int(42)));
    }
    #[test] fn parse_neg_int() {
        let v = parse("-7").unwrap();
        assert_eq!(v, Sexp::Atom(Atom::Int(-7)));
    }
    #[test] fn parse_float() {
        let v = parse("3.14").unwrap();
        assert_eq!(v, Sexp::Atom(Atom::Float(3.14)));
    }
    #[test] fn parse_bool() {
        assert_eq!(parse("#t").unwrap(), Sexp::Atom(Atom::Bool(true)));
        assert_eq!(parse("#f").unwrap(), Sexp::Atom(Atom::Bool(false)));
    }
    #[test] fn parse_string() {
        let v = parse(r#""hello world""#).unwrap();
        assert_eq!(v, Sexp::Atom(Atom::Str("hello world".into())));
    }
    #[test] fn parse_list() {
        let v = parse("(a b c)").unwrap();
        assert_eq!(v, Sexp::List(vec![
            Sexp::Atom(Atom::Symbol("a".into())),
            Sexp::Atom(Atom::Symbol("b".into())),
            Sexp::Atom(Atom::Symbol("c".into())),
        ]));
    }
    #[test] fn nested_lists() {
        let v = parse("(a (b c) d)").unwrap();
        if let Sexp::List(items) = v {
            assert_eq!(items.len(), 3);
            assert_eq!(items[1], Sexp::List(vec![Sexp::Atom(Atom::Symbol("b".into())), Sexp::Atom(Atom::Symbol("c".into()))]));
        } else { panic!(); }
    }
    #[test] fn comments_skipped() {
        let v = parse("; comment\nfoo").unwrap();
        assert_eq!(v, Sexp::Atom(Atom::Symbol("foo".into())));
    }
    #[test] fn round_trip() {
        let input = "(define (fact n) (if (= n 0) 1 (* n (fact (- n 1)))))";
        let v = parse(input).unwrap();
        assert_eq!(to_string(&v), input);
    }
    #[test] fn parse_many_two_exprs() {
        let v = parse_many("foo bar").unwrap();
        assert_eq!(v.len(), 2);
    }
    #[test] fn empty_input_err() {
        assert!(parse("").is_err());
    }
    #[test] fn unterminated_list_err() {
        assert!(parse("(a b c").is_err());
    }
    #[test] fn mixed_types() {
        let v = parse("(list 1 2.5 \"three\" #t)").unwrap();
        if let Sexp::List(items) = v {
            assert_eq!(items[0], Sexp::Atom(Atom::Symbol("list".into())));
            assert_eq!(items[1], Sexp::Atom(Atom::Int(1)));
            assert_eq!(items[2], Sexp::Atom(Atom::Float(2.5)));
            assert_eq!(items[3], Sexp::Atom(Atom::Str("three".into())));
            assert_eq!(items[4], Sexp::Atom(Atom::Bool(true)));
        } else { panic!(); }
    }
}