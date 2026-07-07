// Minimal SMTP envelope parser (RFC 5321 + common extensions).
//
// Parses the two pieces of an SMTP transaction a server or proxy
// actually cares about: addresses from `MAIL FROM:` / `RCPT TO:`
// commands, and the multi-line `250-` reply to `EHLO`.
//
// MAIL FROM:<user@example.com> SIZE=12345 SMTPUTF8 BODY=8BITMIME
//   - `<user@example.com>` is the address
//   - `SIZE=`, `SMTPUTF8`, `BODY=8BITMIME` are ESMTP extensions
//
// RCPT TO:<bob@example.org>
//
// EHLO reply (one line per extension):
//   250-server.example Hello
//   250-SIZE 10240000
//   250-8BITMIME
//   250 SMTPUTF8
//
// Source routes (the deprecated `<@a,@b:user@d>` form) are preserved
// in the `source_route` field as the original `a,b` portion.

/// A parsed SMTP address (`MAIL FROM` / `RCPT TO`).
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Address {
    /// Local-part (the bit before the `@`).
    pub local: String,
    /// Domain (the bit after the `@`). Lower-cased.
    pub domain: String,
    /// Source route, if present, as the comma-separated list of
    /// relay domains. The outer `@` and trailing `:` are not
    /// included; pass `None` for direct addressing.
    pub source_route: Option<String>,
}

/// Reply-code buckets for SMTP status lines.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ReplyCode {
    /// `2yz` — positive completion, intermediate.
    Ready(String),
    /// `2yz` — positive completion, final.
    Ok(String),
    /// `3yz` — positive intermediate, more input needed.
    Data(String),
    /// `4yz` / `5yz` — transient or permanent failure. We collapse
    /// both into `Quit` because the envelope parser is concerned
    /// with closing the session, not the exact code.
    Quit,
}

/// Parse an SMTP address.
///
/// Accepts the angle-bracketed form (`<user@dom>`), the bare form
/// (`user@dom`), the source-routed form (`<@a,@b:user@dom>`), and
/// the empty sender (`<>`).
pub fn parse_address(s: &str) -> Result<Address, String> {
    let s = s.trim();
    if s.is_empty() {
        return Err("empty address".to_string());
    }
    let inner = if let Some(stripped) = s.strip_prefix('<') {
        let end = stripped
            .find('>')
            .ok_or_else(|| "missing closing '>'".to_string())?;
        &stripped[..end]
    } else if s.ends_with('>') {
        return Err("address has '>' but no '<'".to_string());
    } else {
        s
    };

    if inner.is_empty() {
        // Empty sender.
        return Ok(Address {
            local: String::new(),
            domain: String::new(),
            source_route: None,
        });
    }

    // Source route: `@a,@b:user@dom`
    let (source_route, addr_part) = if let Some(colon) = inner.find(':') {
        if inner.starts_with('@') {
            let route = &inner[..colon];
            (Some(route.to_string()), &inner[colon + 1..])
        } else {
            (None, inner)
        }
    } else {
        (None, inner)
    };

    let at = addr_part
        .rfind('@')
        .ok_or_else(|| "address has no '@'".to_string())?;
    let local = addr_part[..at].to_string();
    let domain = addr_part[at + 1..].to_ascii_lowercase();
    if local.is_empty() {
        return Err("empty local-part".to_string());
    }
    if domain.is_empty() {
        return Err("empty domain".to_string());
    }
    Ok(Address {
        local,
        domain,
        source_route,
    })
}

/// Parse an EHLO/HELO response.
///
/// Returns the list of `(keyword, parameter)` pairs in server order.
/// A line with no parameter (e.g. `250-8BITMIME`) yields `("8BITMIME",
/// "")`. The reply code and continuation dashes are stripped.
pub fn parse_ehlo_response(s: &str) -> Result<Vec<(String, String)>, String> {
    let mut out: Vec<(String, String)> = Vec::new();
    for raw in s.split('\n') {
        let line = raw.strip_suffix('\r').unwrap_or(raw).trim();
        if line.is_empty() {
            continue;
        }
        // Format is `NNN-text` or `NNN text`. Strip the first three
        // chars (the code) and an optional dash / space.
        if line.len() < 4 {
            return Err(format!("line too short: {:?}", line));
        }
        let (code, rest) = line.split_at(3);
        if !code.chars().all(|c| c.is_ascii_digit()) {
            return Err(format!("non-numeric reply code: {:?}", code));
        }
        let body = rest.trim_start();
        let body = body
            .strip_prefix('-')
            .unwrap_or(body)
            .trim_start();
        if body.is_empty() {
            continue;
        }
        let (kw, param) = match body.find(' ') {
            Some(idx) => (body[..idx].to_string(), body[idx + 1..].trim().to_string()),
            None => (body.to_string(), String::new()),
        };
        // Greet line uses the keyword `server`; preserve it as-is.
        out.push((kw, param));
    }
    Ok(out)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn simple_address() {
        let a = parse_address("<user@example.com>").expect("parse");
        assert_eq!(a.local, "user");
        assert_eq!(a.domain, "example.com");
        assert_eq!(a.source_route, None);
    }

    #[test]
    fn bare_address() {
        let a = parse_address("bob@example.org").expect("parse");
        assert_eq!(a.local, "bob");
        assert_eq!(a.domain, "example.org");
    }

    #[test]
    fn source_routed_address() {
        let a = parse_address("<@relay1,@relay2:carol@dest.example>")
            .expect("parse");
        assert_eq!(a.local, "carol");
        assert_eq!(a.domain, "dest.example");
        assert_eq!(a.source_route.as_deref(), Some("@relay1,@relay2"));
    }

    #[test]
    fn empty_sender() {
        let a = parse_address("<>").expect("parse");
        assert_eq!(a.local, "");
        assert_eq!(a.domain, "");
    }

    #[test]
    fn domain_lowercased() {
        let a = parse_address("<A@EXAMPLE.COM>").expect("parse");
        assert_eq!(a.domain, "example.com");
    }

    #[test]
    fn ehlo_response_parsed() {
        let input = "250-server.example Hello\r\n250-SIZE 10240000\r\n250-8BITMIME\r\n250 SMTPUTF8\r\n";
        let v = parse_ehlo_response(input).expect("parse");
        assert_eq!(v.len(), 4);
        assert_eq!(v[0], ("server.example".to_string(), "Hello".to_string()));
        assert_eq!(v[1], ("SIZE".to_string(), "10240000".to_string()));
        assert_eq!(v[2], ("8BITMIME".to_string(), String::new()));
        assert_eq!(v[3], ("SMTPUTF8".to_string(), String::new()));
    }

    #[test]
    fn ehlo_single_line() {
        let input = "250 OK\r\n";
        let v = parse_ehlo_response(input).expect("parse");
        assert_eq!(v, vec![("OK".to_string(), String::new())]);
    }

    #[test]
    fn ehlo_rejects_bad_code() {
        let r = parse_ehlo_response("abc foo\r\n");
        assert!(r.is_err());
    }

    #[test]
    fn mail_from_with_extensions() {
        // Sanity: parse_address only takes the bracketed address,
        // not the extensions, so we extract the address manually.
        let line = "MAIL FROM:<a@b.com> SIZE=12345 SMTPUTF8";
        let start = line.find('<').unwrap();
        let end = line.find('>').unwrap();
        let a = parse_address(&line[start..=end]).expect("parse");
        assert_eq!(a.local, "a");
        assert_eq!(a.domain, "b.com");
    }
}
