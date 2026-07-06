// Minimal LDAP search filter parser (RFC 4515).
//
// An LDAP search filter is a textual Boolean expression over directory
// attribute assertions. The grammar (simplified) is:
//
//   filter     = "(" filtercomp ")"
//   filtercomp = and / or / not / item
//   and        = "&" filterlist
//   or         = "|" filterlist
//   not        = "!" filter
//   filterlist = 1*filter
//   item       = simple / present / substring
//   simple     = attr filtertype assertionvalue
//   filtertype = equal / approx / greater / less
//   equal      = "="
//   present    = attr "=*"
//   substring  = attr "=" [initial] any [final]
//   initial    = assertionvalue
//   any        = "*" *(assertionvalue "*")
//   final      = assertionvalue
//   attr       = AttributeType
//   assertionvalue = 1*valuechar
//
// This module supports the common subset: equality, presence, substring
// (initial / final / any), AND, OR, NOT. Approximate (~=), greater-or-
// equal (>=), and less-or-equal (<=) operators parse as `Equal` since
// we don't preserve the comparison type — callers that need exact
// operator semantics should re-parse.

/// A parsed LDAP search filter.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Filter {
    /// `(attr=value)` — equality assertion.
    Equal(String, String),
    /// `(attr=*)` — presence assertion.
    Present(String),
    /// `(attr=foo*)` — substring assertion. Right-hand side is the raw
    /// substring string including the `*` wildcards.
    Substring(String, String),
    /// `(&(...)(...))` — AND.
    And(Vec<Filter>),
    /// `(|(...)(...))` — OR.
    Or(Vec<Filter>),
    /// `(!(...))` — NOT.
    Not(Box<Filter>),
}

/// Parse an LDAP search filter string.
///
/// The outer parentheses are required; pass the filter exactly as it
/// would appear inside `ldapsearch -b ... '(<FILTER>)'`. Returns an
/// error for unbalanced parens, unknown operators, or empty filter
/// components.
pub fn parse(input: &str) -> Result<Filter, String> {
    let mut p = Parser::new(input);
    let f = p.parse_filter()?;
    p.skip_ws();
    if !p.is_eof() {
        return Err(format!(
            "trailing content after filter at position {}: {:?}",
            p.pos, p.input[p.pos..].chars().take(16).collect::<String>()
        ));
    }
    Ok(f)
}

/// Serialize a filter back to its canonical LDAP textual form.
///
/// Round-trips with `parse` for all variants this module supports.
pub fn to_string(f: &Filter) -> String {
    let mut out = String::new();
    write_filter(f, &mut out);
    out
}

fn write_filter(f: &Filter, out: &mut String) {
    match f {
        Filter::Equal(a, v) => {
            out.push('(');
            out.push_str(a);
            out.push('=');
            out.push_str(v);
            out.push(')');
        }
        Filter::Present(a) => {
            out.push('(');
            out.push_str(a);
            out.push_str("=*)");
        }
        Filter::Substring(a, v) => {
            out.push('(');
            out.push_str(a);
            out.push('=');
            out.push_str(v);
            out.push(')');
        }
        Filter::And(children) => {
            out.push_str("(&");
            for c in children {
                write_filter(c, out);
            }
            out.push(')');
        }
        Filter::Or(children) => {
            out.push_str("(|");
            for c in children {
                write_filter(c, out);
            }
            out.push(')');
        }
        Filter::Not(inner) => {
            out.push_str("(!");
            write_filter(inner, out);
            out.push(')');
        }
    }
}

struct Parser<'a> {
    input: &'a str,
    pos: usize,
}

impl<'a> Parser<'a> {
    fn new(input: &'a str) -> Self {
        Self { input, pos: 0 }
    }

    fn is_eof(&self) -> bool {
        self.pos >= self.input.len()
    }

    fn skip_ws(&mut self) {
        while let Some(c) = self.peek() {
            if c.is_whitespace() {
                self.pos += c.len_utf8();
            } else {
                break;
            }
        }
    }

    fn peek(&self) -> Option<char> {
        self.input[self.pos..].chars().next()
    }

    fn expect(&mut self, ch: char) -> Result<(), String> {
        self.skip_ws();
        match self.peek() {
            Some(c) if c == ch => {
                self.pos += ch.len_utf8();
                Ok(())
            }
            Some(c) => Err(format!(
                "expected {:?} at position {}, got {:?}",
                ch, self.pos, c
            )),
            None => Err(format!(
                "expected {:?} at position {}, got EOF",
                ch, self.pos
            )),
        }
    }

    fn parse_filter(&mut self) -> Result<Filter, String> {
        self.expect('(')?;
        self.skip_ws();
        let f = self.parse_filter_comp()?;
        self.skip_ws();
        self.expect(')')?;
        Ok(f)
    }

    fn parse_filter_comp(&mut self) -> Result<Filter, String> {
        self.skip_ws();
        match self.peek() {
            Some('&') => {
                self.pos += 1;
                let mut children = Vec::new();
                loop {
                    self.skip_ws();
                    if self.peek() == Some(')') {
                        break;
                    }
                    children.push(self.parse_filter()?);
                }
                if children.is_empty() {
                    return Err("AND filter has no children".to_string());
                }
                Ok(Filter::And(children))
            }
            Some('|') => {
                self.pos += 1;
                let mut children = Vec::new();
                loop {
                    self.skip_ws();
                    if self.peek() == Some(')') {
                        break;
                    }
                    children.push(self.parse_filter()?);
                }
                if children.is_empty() {
                    return Err("OR filter has no children".to_string());
                }
                Ok(Filter::Or(children))
            }
            Some('!') => {
                self.pos += 1;
                let inner = self.parse_filter()?;
                Ok(Filter::Not(Box::new(inner)))
            }
            Some('(') | Some(_) => self.parse_item(),
            None => Err("unexpected EOF in filter".to_string()),
        }
    }

    fn parse_item(&mut self) -> Result<Filter, String> {
        let attr = self.parse_attr()?;
        self.skip_ws();
        // Operator char: =, ~=, >=, <= — but per RFC 4515, the operator
        // is followed by an assertionvalue. For our minimal subset, only
        // '=' is meaningfully distinguished (present/substring/equal).
        // We still accept the other chars so the parser doesn't choke.
        let op = match self.peek() {
            Some('=') => '=',
            Some('~') => '~',
            Some('>') => '>',
            Some('<') => '<',
            Some(c) => {
                return Err(format!(
                    "expected filter operator at position {}, got {:?}",
                    self.pos, c
                ));
            }
            None => {
                return Err(format!(
                    "expected filter operator at position {}, got EOF",
                    self.pos
                ));
            }
        };
        self.pos += op.len_utf8();
        // Skip the second char of two-char operators (>=, <=, ~=).
        if op != '=' {
            self.expect('=')?;
        }
        let value = self.parse_assertion_value()?;
        if op == '=' && value == "*" {
            return Ok(Filter::Present(attr));
        }
        if op == '=' && value.contains('*') {
            return Ok(Filter::Substring(attr, value));
        }
        // For non-equality operators, we represent as Equal with the
        // original assertion value (the operator is not preserved).
        Ok(Filter::Equal(attr, value))
    }

    fn parse_attr(&mut self) -> Result<String, String> {
        let start = self.pos;
        while let Some(c) = self.peek() {
            if c == '=' || c == '~' || c == '>' || c == '<' || c == '(' || c == ')' {
                break;
            }
            self.pos += c.len_utf8();
        }
        if self.pos == start {
            return Err(format!(
                "expected attribute name at position {}",
                self.pos
            ));
        }
        Ok(self.input[start..self.pos].trim().to_string())
    }

    fn parse_assertion_value(&mut self) -> Result<String, String> {
        let mut out = String::new();
        loop {
            match self.peek() {
                Some(')') | None => break,
                Some('(') => {
                    return Err(format!(
                        "unexpected '(' in assertion value at position {}",
                        self.pos
                    ));
                }
                Some(c) => {
                    out.push(c);
                    self.pos += c.len_utf8();
                }
            }
        }
        // Trim surrounding whitespace from the captured value (RFC 4515
        // assertion values may have surrounding spaces which are not
        // significant inside the filter grammar).
        Ok(out.trim().to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn simple_equality() {
        let f = parse("(cn=Alice)").expect("parse");
        assert_eq!(f, Filter::Equal("cn".into(), "Alice".into()));
        assert_eq!(to_string(&f), "(cn=Alice)");
    }

    #[test]
    fn presence() {
        let f = parse("(objectClass=*)").expect("parse");
        assert_eq!(f, Filter::Present("objectClass".into()));
        assert_eq!(to_string(&f), "(objectClass=*)");
    }

    #[test]
    fn substring_prefix() {
        let f = parse("(cn=foo*)").expect("parse");
        assert_eq!(f, Filter::Substring("cn".into(), "foo*".into()));
        assert_eq!(to_string(&f), "(cn=foo*)");
    }

    #[test]
    fn substring_suffix() {
        let f = parse("(cn=*bar)").expect("parse");
        assert_eq!(f, Filter::Substring("cn".into(), "*bar".into()));
    }

    #[test]
    fn substring_middle() {
        let f = parse("(cn=foo*bar)").expect("parse");
        assert_eq!(f, Filter::Substring("cn".into(), "foo*bar".into()));
    }

    #[test]
    fn and_filter() {
        let f = parse("(&(cn=Alice)(sn=Smith))").expect("parse");
        match &f {
            Filter::And(children) => {
                assert_eq!(children.len(), 2);
                assert_eq!(children[0], Filter::Equal("cn".into(), "Alice".into()));
                assert_eq!(children[1], Filter::Equal("sn".into(), "Smith".into()));
            }
            _ => panic!("expected And, got {:?}", f),
        }
        assert_eq!(to_string(&f), "(&(cn=Alice)(sn=Smith))");
    }

    #[test]
    fn or_filter() {
        let f = parse("(|(cn=Alice)(cn=Bob))").expect("parse");
        match &f {
            Filter::Or(children) => {
                assert_eq!(children.len(), 2);
                assert_eq!(children[0], Filter::Equal("cn".into(), "Alice".into()));
                assert_eq!(children[1], Filter::Equal("cn".into(), "Bob".into()));
            }
            _ => panic!("expected Or, got {:?}", f),
        }
        assert_eq!(to_string(&f), "(|(cn=Alice)(cn=Bob))");
    }

    #[test]
    fn not_filter() {
        let f = parse("(!(cn=Admin))").expect("parse");
        assert_eq!(
            f,
            Filter::Not(Box::new(Filter::Equal("cn".into(), "Admin".into())))
        );
        assert_eq!(to_string(&f), "(!(cn=Admin))");
    }

    #[test]
    fn nested_not_and_or() {
        // !(|(cn=A)(&(sn=B)(!(uid=C))))
        let f =
            parse("(!(|(cn=A)(&(sn=B)(!(uid=C)))))").expect("parse");
        let expected = Filter::Not(Box::new(Filter::Or(vec![
            Filter::Equal("cn".into(), "A".into()),
            Filter::And(vec![
                Filter::Equal("sn".into(), "B".into()),
                Filter::Not(Box::new(Filter::Equal("uid".into(), "C".into()))),
            ]),
        ])));
        assert_eq!(f, expected);
        assert_eq!(to_string(&f), "(!(|(cn=A)(&(sn=B)(!(uid=C)))))");
    }

    #[test]
    fn malformed_parens_rejected() {
        // Missing closing paren.
        assert!(parse("(cn=Alice").is_err());
        // Missing opening paren.
        assert!(parse("cn=Alice)").is_err());
        // Double close.
        assert!(parse("(cn=Alice))").is_err());
    }

    #[test]
    fn empty_filter_rejected() {
        // Empty parens.
        assert!(parse("()").is_err());
        // Empty AND.
        assert!(parse("(&)").is_err());
        // Empty OR.
        assert!(parse("(|)").is_err());
    }

    #[test]
    fn round_trip_complex() {
        // (&(objectClass=*)(cn=A*)(|(sn=B)(!(uid=C))))
        let original =
            "(&(objectClass=*)(cn=A*)(|(sn=B)(!(uid=C))))";
        let f = parse(original).expect("parse");
        assert_eq!(to_string(&f), original);
    }

    #[test]
    fn whitespace_tolerated() {
        let f = parse("( cn = Alice )").expect("parse");
        assert_eq!(f, Filter::Equal("cn".into(), "Alice".into()));
    }

    #[test]
    fn approx_operator_parsed_as_equal() {
        // ~= is the approximate-match operator. Our minimal subset
        // accepts it but stores the assertion as Equal.
        let f = parse("(cn~=Alice)").expect("parse");
        assert_eq!(f, Filter::Equal("cn".into(), "Alice".into()));
    }
}