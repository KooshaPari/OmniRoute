//! Minimal DNS zone file parser.
//!
//! Supports the most common record types (`SOA`, `NS`, `A`, `AAAA`, `CNAME`,
//! `MX`, `TXT`) plus `$ORIGIN` and `$TTL` directives. Comments start with `;`
//! and run to end of line; parenthesized multi-line TXT records are unfolded
//! across lines.
//!
//! ## Format
//!
//! ```text
//! $TTL 86400
//! $ORIGIN example.com.
//! @   IN  SOA ns1.example.com. hostmaster.example.com. (
//!     2024010101  ; serial
//!     3600        ; refresh
//!     1800        ; retry
//!     604800      ; expire
//!     86400       ; minimum
//! )
//! @   IN  NS    ns1.example.com.
//! @   IN  A     192.0.2.1
//! mail IN MX 10 mail.example.com.
//! ```
//!
//! ## Example
//!
//! ```
//! use sharecli::dns_zone::{parse, RecordType};
//!
//! let zone = "$TTL 60\n@ IN A 192.0.2.1\n";
//! let records = parse(zone).unwrap();
//! assert_eq!(records[0].rdata, "192.0.2.1");
//! assert_eq!(records[0].ttl, 60);
//! assert_eq!(records[0].record_type, RecordType::A);
//! ```

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum RecordType {
    SOA,
    NS,
    A,
    AAAA,
    CNAME,
    MX,
    TXT,
    /// Unknown / unparsed record type — preserved as a string.
    Unknown(String),
}

impl RecordType {
    fn parse(s: &str) -> Self {
        // Some types are case-insensitive (RFC 3597), but conventionally upper.
        let upper = s.to_ascii_uppercase();
        match upper.as_str() {
            "SOA" => RecordType::SOA,
            "NS" => RecordType::NS,
            "A" => RecordType::A,
            "AAAA" => RecordType::AAAA,
            "CNAME" => RecordType::CNAME,
            "MX" => RecordType::MX,
            "TXT" => RecordType::TXT,
            _ => RecordType::Unknown(upper),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Record {
    /// Owner name. May be a relative name (no trailing dot) when `$ORIGIN` applies.
    pub name: String,
    pub ttl: u32,
    /// Class — defaults to `IN` when absent.
    pub class: String,
    pub record_type: RecordType,
    /// Unparsed RDATA string (whitespace-joined). SOA records are emitted as a
    /// single space-joined string with all 7 fields.
    pub rdata: String,
}

/// Parsed zone with global `$ORIGIN` and `$TTL` defaults applied.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Zone {
    pub origin: String,
    pub default_ttl: u32,
    pub records: Vec<Record>,
}

/// Parse a zone file body. Returns the parsed [`Zone`] on success.
///
/// Errors are reported as `Err(line, message)` — `line` is 1-indexed for human
/// display. The parser is permissive about whitespace and tolerates missing
/// TTL/class fields by deferring to the global defaults.
pub fn parse(input: &str) -> Result<Zone, (usize, String)> {
    let mut origin = ".".to_string();
    let mut default_ttl: u32 = 86400; // RFC 2308 default if no $TTL is present.
    let mut records: Vec<Record> = Vec::new();
    // Phase 1: pre-process — strip comments, fold parenthesized continuations.
    let lines = unfold(input);
    for (line_no, raw) in lines.iter().enumerate() {
        let line = raw.trim();
        if line.is_empty() {
            continue;
        }
        if let Some(rest) = line.strip_prefix('$') {
            // Directive.
            let mut parts = rest.split_whitespace();
            let directive = parts
                .next()
                .ok_or((line_no + 1, "empty directive after $".to_string()))?;
            let value = parts
                .next()
                .ok_or((line_no + 1, format!("$ {} missing value", directive)))?;
            // Tolerate stray tokens after the value.
            match directive.to_ascii_uppercase().as_str() {
                "ORIGIN" => origin = value.to_string(),
                "TTL" => {
                    default_ttl = parse_ttl(value).map_err(|e| (line_no + 1, e))?;
                }
                other => {
                    return Err((
                        line_no + 1,
                        format!("unknown directive: ${}", other),
                    ));
                }
            }
            continue;
        }
        // Resource record. Tokenize.
        // Format:
        //   [<name>] [<ttl>] [<class>] <TYPE> <rdata...>
        // Name defaults to "@" if missing. Class defaults to "IN".
        let tokens: Vec<&str> = line.split_whitespace().collect();
        if tokens.is_empty() {
            continue;
        }
        let mut idx = 0usize;
        let name_token = tokens[idx];
        let name_owned;
        if is_type_token(name_token) {
            // No explicit owner — treat as inherited.
            name_owned = String::from(if records.is_empty() { "@" } else { &records.last().unwrap().name });
            // Don't consume the token; it's the type.
        } else {
            name_owned = name_token.to_string();
            idx += 1;
        }
        // Now we may have TTL + CLASS + TYPE, or CLASS + TYPE, or TYPE only.
        let mut ttl = default_ttl;
        let mut class = "IN".to_string();
        let type_token;
        if idx >= tokens.len() {
            return Err((line_no + 1, "missing record type".to_string()));
        }
        let t = tokens[idx];
        if is_type_token(t) {
            // owner only, type follows immediately.
            type_token = t;
            idx += 1;
        } else if let Ok(possible_ttl) = parse_ttl(t) {
            ttl = possible_ttl;
            idx += 1;
            if idx >= tokens.len() {
                return Err((line_no + 1, "missing record type".to_string()));
            }
            let next = tokens[idx];
            // Is the next token a class or the type?
            if is_type_token(next) {
                type_token = next;
                idx += 1;
            } else {
                // Treat as class.
                class = next.to_string();
                idx += 1;
                if idx >= tokens.len() {
                    return Err((line_no + 1, "missing record type".to_string()));
                }
                type_token = tokens[idx];
                idx += 1;
            }
        } else {
            // Treat as class.
            class = t.to_string();
            idx += 1;
            if idx >= tokens.len() {
                return Err((line_no + 1, "missing record type".to_string()));
            }
            type_token = tokens[idx];
            idx += 1;
        }
        let rdata_tokens = &tokens[idx..];
        if rdata_tokens.is_empty() {
            return Err((
                line_no + 1,
                format!("missing rdata for {}", type_token),
            ));
        }
        let record_type = RecordType::parse(type_token);
        // Drop standalone '(' and ')' tokens (RFC 1035 paren-grouping);
        // real SOA mname/rname entries that need parentheses don't appear
        // inside the data.
        let rdata = rdata_tokens
            .iter()
            .filter(|t| **t != "(" && **t != ")")
            .copied()
            .collect::<Vec<_>>()
            .join(" ");
        if rdata.is_empty() {
            return Err((
                line_no + 1,
                format!("missing rdata for {}", type_token),
            ));
        }
        records.push(Record {
            name: name_owned,
            ttl,
            class,
            record_type,
            rdata,
        });
    }
    Ok(Zone {
        origin,
        default_ttl,
        records,
    })
}

/// Returns true iff `s` looks like a record TYPE field (uppercase alphabetic,
/// lengths typical of DNS types).
fn is_type_token(s: &str) -> bool {
    if s.is_empty() || s.len() > 10 {
        return false;
    }
    if !s.chars().all(|c| c.is_ascii_alphabetic()) {
        return false;
    }
    let upper = s.to_ascii_uppercase();
    matches!(
        upper.as_str(),
        "A"
            | "AAAA"
            | "NS"
            | "CNAME"
            | "MX"
            | "TXT"
            | "SOA"
            | "PTR"
            | "SRV"
            | "CAA"
            | "DS"
            | "DNSKEY"
            | "TLSA"
            | "NAPTR"
            | "HINFO"
            | "LOC"
            | "RP"
            | "AFSDB"
    )
}

/// Parse a TTL value (a non-negative integer) with optional unit suffix.
fn parse_ttl(s: &str) -> Result<u32, String> {
    let mut digits = String::new();
    let mut unit: u32 = 1;
    let mut chars = s.chars().peekable();
    let mut saw_unit = false;
    while let Some(&c) = chars.peek() {
        if c.is_ascii_digit() {
            digits.push(c);
            chars.next();
        } else {
            // Take the rest as a unit suffix.
            let rest: String = chars.collect();
            let rest_upper = rest.to_ascii_uppercase();
            unit = match rest_upper.as_str() {
                "" | "S" => 1,
                "M" => 60,
                "H" => 3600,
                "D" => 86_400,
                "W" => 604_800,
                _ => {
                    return Err(format!("unknown TTL unit: {}", rest));
                }
            };
            saw_unit = true;
            break;
        }
    }
    if digits.is_empty() {
        return Err(format!("invalid TTL: {}", s));
    }
    if !saw_unit {
        // Consume the remainder of chars (empty in this case).
    }
    let v: u64 = digits
        .parse()
        .map_err(|e| format!("invalid TTL {}: {}", s, e))?;
    let total = v
        .checked_mul(unit as u64)
        .ok_or_else(|| format!("TTL overflow: {}", s))?;
    if total > u32::MAX as u64 {
        return Err(format!("TTL overflow: {}", s));
    }
    Ok(total as u32)
}

/// Unfold parenthesized continuations and strip comments.
/// TXT strings may themselves contain `( )` inside quoted spans (RFC 6763
/// recommends parens NOT appear in TXT, so we keep this simple).
fn unfold(input: &str) -> Vec<String> {
    let mut out: Vec<String> = Vec::new();
    let mut current = String::new();
    let mut in_paren = 0usize;
    for raw in input.lines() {
        // Strip " ; ... " comments (kept naive — strips inline ';' in TXT).
        let stripped = strip_comment(raw);
        if in_paren > 0 {
            // Inside a parenthesized span: append the trimmed line.
            current.push(' ');
            current.push_str(stripped.trim());
            for c in stripped.chars() {
                match c {
                    '(' => in_paren += 1,
                    ')' if in_paren > 0 => {
                        in_paren -= 1;
                        if in_paren == 0 {
                            // Drop the now-tail ')' from the accumulator.
                            while current.ends_with(')') {
                                current.pop();
                            }
                            current = current.trim_end().to_string();
                        }
                    }
                    _ => {}
                }
            }
            if in_paren == 0 {
                // Drop the opening '(' if it landed at a whitespace boundary.
                strip_first_paren(&mut current);
                out.push(std::mem::take(&mut current));
            }
        } else {
            current.push_str(stripped);
            for c in stripped.chars() {
                if c == '(' {
                    in_paren += 1;
                } else if c == ')' && in_paren > 0 {
                    in_paren -= 1;
                    if in_paren == 0 {
                        while current.ends_with(')') {
                            current.pop();
                        }
                        current = current.trim_end().to_string();
                    }
                }
            }
            if in_paren == 0 {
                strip_first_paren(&mut current);
                out.push(std::mem::take(&mut current));
            }
        }
    }
    if !current.trim().is_empty() {
        strip_first_paren(&mut current);
        out.push(current);
    }
    out
}

/// Strip a leading '(' followed by whitespace, if present at the start of
/// the buffer. Used after unfolding a parenthesized continuation.
fn strip_first_paren(buf: &mut String) {
    let bytes = buf.as_bytes();
    if bytes.first() == Some(&b'(') {
        // Drop the '('.
        buf.remove(0);
        // Drop any whitespace that immediately follows.
        while buf.starts_with(' ') || buf.starts_with('\t') {
            buf.remove(0);
        }
    }
}

/// Strip a `;`-style comment off the end of a line. Comments start at the
/// first `;` that is NOT inside a parenthesized span (the caller is expected
/// to have already folded such spans).
fn strip_comment(line: &str) -> &str {
    // We only handle comments outside of parens here; caller has unfolded
    // the paren-spans.
    if let Some(pos) = line.find(';') {
        // We assume unfold() has already concatenated parenthesized lines.
        &line[..pos]
    } else {
        line
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_small_zone() {
        let zone = "$TTL 3600\n\
                    @   IN  SOA ns.example.com. hostmaster.example.com. (\n\
                    ; comment line\n\
                    2024010101 3600 1800 604800 86400 )\n\
                    @   IN  NS   ns.example.com.\n\
                    www IN  A    192.0.2.10\n";
        let z = parse(zone).expect("parse");
        assert_eq!(z.default_ttl, 3600);
        assert_eq!(z.origin, ".");
        assert_eq!(z.records.len(), 3);
        assert_eq!(z.records[0].record_type, RecordType::SOA);
        assert_eq!(z.records[1].record_type, RecordType::NS);
        assert_eq!(z.records[1].ttl, 3600);
        assert_eq!(z.records[2].record_type, RecordType::A);
        assert_eq!(z.records[2].rdata, "192.0.2.10");
    }

    #[test]
    fn mx_with_priority() {
        let zone = "@ IN MX 10 mail.example.com.\n\
                    @ IN MX 20 backup.example.com.\n";
        let z = parse(zone).unwrap();
        assert_eq!(z.records.len(), 2);
        assert_eq!(z.records[0].record_type, RecordType::MX);
        assert_eq!(z.records[0].rdata, "10 mail.example.com.");
        assert_eq!(z.records[1].rdata, "20 backup.example.com.");
    }

    #[test]
    fn txt_multiline_quoted() {
        // TXT records frequently span multiple strings inside ONE record.
        let zone = "$TTL 60\n\
                    @ IN TXT \"hello\" \"world\"\n\
                    @ IN TXT \"spf include:_spf.example.com -all\"\n";
        let z = parse(zone).unwrap();
        assert_eq!(z.records.len(), 2);
        assert_eq!(z.records[0].record_type, RecordType::TXT);
        // We just collapse to space-joined; the strings are preserved verbatim.
        assert_eq!(z.records[0].rdata, "\"hello\" \"world\"");
        assert!(z.records[1].rdata.contains("spf"));
    }

    #[test]
    fn comments_with_semicolons() {
        let zone = "; leading comment\n\
                    $TTL 60 ; trailing comment on TTL\n\
                    @ IN A 192.0.2.1 ; trailing comment on record\n";
        let z = parse(zone).expect("parse");
        assert_eq!(z.default_ttl, 60);
        assert_eq!(z.records.len(), 1);
        assert_eq!(z.records[0].rdata, "192.0.2.1");
    }

    #[test]
    fn dollar_origin_and_ttl_directives() {
        let zone = "$ORIGIN example.com.\n\
                    $TTL 1h\n\
                    @   IN NS ns1\n\
                    ns1 IN A  192.0.2.1\n";
        let z = parse(zone).unwrap();
        assert_eq!(z.origin, "example.com.");
        assert_eq!(z.default_ttl, 3600);
        assert_eq!(z.records.len(), 2);
        assert_eq!(z.records[0].record_type, RecordType::NS);
        assert_eq!(z.records[0].ttl, 3600);
        assert_eq!(z.records[1].record_type, RecordType::A);
        assert_eq!(z.records[1].ttl, 3600);
    }

    #[test]
    fn cname_and_aaaa() {
        let zone = "www IN CNAME host1.example.com.\n\
                    host1 IN AAAA 2001:db8::1\n";
        let z = parse(zone).unwrap();
        assert_eq!(z.records[0].record_type, RecordType::CNAME);
        assert_eq!(z.records[0].rdata, "host1.example.com.");
        assert_eq!(z.records[1].record_type, RecordType::AAAA);
        assert_eq!(z.records[1].rdata, "2001:db8::1");
    }

    #[test]
    fn soa_with_paren_continuation() {
        let zone = "$TTL 86400\n\
                    @ IN SOA ns.example.com. hostmaster.example.com. (\n\
                    2024010101 ; serial\n\
                    10800      ; refresh\n\
                    1800       ; retry\n\
                    1209600    ; expire\n\
                    3600       ; minimum\n\
                    )\n";
        let z = parse(zone).expect("parse should fold parens");
        assert_eq!(z.records.len(), 1);
        let r = &z.records[0];
        assert_eq!(r.record_type, RecordType::SOA);
        assert_eq!(r.rdata, "ns.example.com. hostmaster.example.com. 2024010101 10800 1800 1209600 3600");
    }

    #[test]
    fn ttl_units_s_m_h_d_w() {
        assert_eq!(parse_ttl("60").unwrap(), 60);
        assert_eq!(parse_ttl("60s").unwrap(), 60);
        assert_eq!(parse_ttl("1m").unwrap(), 60);
        assert_eq!(parse_ttl("1h").unwrap(), 3600);
        assert_eq!(parse_ttl("1d").unwrap(), 86_400);
        assert_eq!(parse_ttl("1w").unwrap(), 604_800);
        // Invalid:
        assert!(parse_ttl("abc").is_err());
        assert!(parse_ttl("60x").is_err());
    }

    #[test]
    fn parse_minimal_record() {
        let zone = "$TTL 30\n\
                    host IN A 10.0.0.1\n";
        let z = parse(zone).unwrap();
        assert_eq!(z.records[0].ttl, 30);
        assert_eq!(z.records[0].record_type, RecordType::A);
        assert_eq!(z.records[0].name, "host");
        assert_eq!(z.records[0].rdata, "10.0.0.1");
    }

    #[test]
    fn typo_record_type_preserved_as_unknown() {
        let zone = "@ IN WKS 10.0.0.1 tcp http\n";
        let z = parse(zone).expect("parse");
        assert_eq!(z.records[0].record_type, RecordType::Unknown("WKS".to_string()));
    }
}
