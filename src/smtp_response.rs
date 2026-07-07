// Minimal SMTP reply parser (RFC 5321 §4.2 + §4.5.3.1).
//
// SMTP replies are a 3-digit code, a separator, and an optional text
// line. Multi-line replies chain a hyphen (`-`) for continuation and
// a space for the final line, e.g.:
//
//   250-PIPELINING\r\n
//   250-SIZE 10240000\r\n
//   250 AUTH PLAIN LOGIN\r\n
//
// The "text" of the reply is the concatenation of the per-line text
// in order. This module only understands the canonical RFC 5321
// shape; it does not handle multi-line replies with the 8-bit
// MIME or the ENHANCEDSTATUSCODES extension codes (which are a
// subject inside the text).
//
// Lines can be separated by either `\r\n` (canonical) or just `\n` —
// both are accepted, since some servers and clients get this wrong.

/// One parsed reply. SMTP is a request/response protocol where one
/// command typically yields one logical reply that may span several
/// lines; this struct is the *final* line of that chain, with the
/// full text assembled from the chain.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Reply {
    /// 3-digit status code.
    pub code: u16,
    /// Concatenated text of the entire multi-line chain, with one
    /// line of whitespace between the lines (mirroring how the
    /// server would have displayed it).
    pub text: String,
    /// `true` if this line terminates the chain (separator is a
    /// space). For a single-line reply this is always true.
    pub is_last: bool,
}

/// One line of a reply chain (before chain termination is known).
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ReplyLine {
    pub code: u16,
    pub sep: ReplySep,
    pub text: String,
}

/// Continuation indicator. SMTP uses `-` for "more lines follow"
/// and a space for "end of reply".
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ReplySep {
    /// Hyphen — more lines follow.
    Hyphen,
    /// Space — this is the last line.
    Space,
}

impl ReplySep {
    fn from_byte(b: u8) -> Result<Self, String> {
        match b {
            b'-' => Ok(ReplySep::Hyphen),
            b' ' => Ok(ReplySep::Space),
            other => Err(format!("expected `-` or space, got byte {other:#x}")),
        }
    }
}

/// Parse a single reply line (no chain handling).
///
/// `line` is a single line of text without the trailing CRLF.
pub fn parse_line(line: &str) -> Result<ReplyLine, String> {
    let line = line.trim_end_matches('\r');
    if line.len() < 4 {
        return Err(format!("reply line too short: {:?}", line));
    }
    let code: u16 = line[..3]
        .parse()
        .map_err(|e| format!("invalid reply code {:?}: {e}", &line[..3]))?;
    let sep = ReplySep::from_byte(line.as_bytes()[3])?;
    let text = line[4..].to_string();
    Ok(ReplyLine { code, sep, text })
}

/// Parse a complete multi-line SMTP reply blob into a single
/// `Reply` struct. All lines in the chain must share the same
/// 3-digit code; a code change mid-chain is reported as an error.
///
/// Accepts both `\r\n` and `\n` line endings.
pub fn parse_reply(blob: &str) -> Result<Reply, String> {
    // Normalize line endings: split on \n, then strip trailing \r.
    let lines: Vec<&str> = blob.split('\n').collect();
    if lines.is_empty() || (lines.len() == 1 && lines[0].is_empty()) {
        return Err("empty reply".to_string());
    }
    let mut code: Option<u16> = None;
    let mut texts: Vec<String> = Vec::with_capacity(lines.len());
    let mut last_sep = ReplySep::Space;
    for raw in lines {
        let line = raw.trim_end_matches('\r');
        if line.is_empty() {
            // tolerate trailing blank line
            continue;
        }
        let parsed = parse_line(line)?;
        match code {
            None => code = Some(parsed.code),
            Some(c) if c != parsed.code => {
                return Err(format!(
                    "reply code changed mid-chain: {c} then {}",
                    parsed.code
                ))
            }
            _ => {}
        }
        texts.push(parsed.text);
        last_sep = parsed.sep;
    }
    let code = code.ok_or_else(|| "no reply code found".to_string())?;
    Ok(Reply {
        code,
        text: texts.join("\n"),
        is_last: last_sep == ReplySep::Space,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_single_line_ok() {
        let r = parse_reply("250 OK").unwrap();
        assert_eq!(r.code, 250);
        assert_eq!(r.text, "OK");
        assert!(r.is_last);
    }

    #[test]
    fn parses_crlf_terminated() {
        let r = parse_reply("250 OK\r\n").unwrap();
        assert_eq!(r.code, 250);
        assert!(r.is_last);
    }

    #[test]
    fn parses_multi_line_chain() {
        let blob = "250-PIPELINING\r\n250-SIZE 10240000\r\n250 AUTH PLAIN LOGIN\r\n";
        let r = parse_reply(blob).unwrap();
        assert_eq!(r.code, 250);
        assert!(r.is_last);
        assert_eq!(r.text, "PIPELINING\nSIZE 10240000\nAUTH PLAIN LOGIN");
    }

    #[test]
    fn unfinished_chain_marks_not_last() {
        let blob = "250-FIRST\r\n250-SECOND\r\n";
        let r = parse_reply(blob).unwrap();
        assert!(!r.is_last);
        assert_eq!(r.text, "FIRST\nSECOND");
    }

    #[test]
    fn rejects_code_change() {
        let blob = "250-OK\r\n221 BYE\r\n";
        let err = parse_reply(blob).unwrap_err();
        assert!(err.contains("changed mid-chain"), "got: {err}");
    }

    #[test]
    fn rejects_garbage_separator() {
        let err = parse_line("250X hi").unwrap_err();
        assert!(err.contains("expected"), "got: {err}");
    }

    #[test]
    fn rejects_short_line() {
        let err = parse_line("25").unwrap_err();
        assert!(err.contains("too short"), "got: {err}");
    }

    #[test]
    fn rejects_non_digit_code() {
        let err = parse_line("2X0 hi").unwrap_err();
        assert!(err.contains("invalid reply code"), "got: {err}");
    }

    #[test]
    fn empty_blob_is_error() {
        assert!(parse_reply("").is_err());
        assert!(parse_reply("\r\n").is_err());
    }

    #[test]
    fn tolerates_lf_only() {
        let r = parse_reply("354 End data with <CR><LF>.<CR><LF>\n").unwrap();
        assert_eq!(r.code, 354);
        assert!(r.is_last);
    }

    #[test]
    fn parses_4xx_transient() {
        let r = parse_reply("421 Service not available, closing transmission channel").unwrap();
        assert_eq!(r.code, 421);
        assert!(r.is_last);
    }

    #[test]
    fn parses_5yz_permanent() {
        let r = parse_reply("550 User not found").unwrap();
        assert_eq!(r.code, 550);
    }

    #[test]
    fn parses_3yz_data_terminator() {
        let r = parse_reply("354 End data with <CR><LF>.<CR><LF>").unwrap();
        assert_eq!(r.code, 354);
        assert!(r.is_last);
    }

    #[test]
    fn long_chain_preserves_order() {
        let blob = "250-A\r\n250-B\r\n250-C\r\n250-D\r\n250 E\r\n";
        let r = parse_reply(blob).unwrap();
        assert_eq!(r.text, "A\nB\nC\nD\nE");
        assert!(r.is_last);
    }

    #[test]
    fn parse_line_round_trip() {
        let l = parse_line("250 OK").unwrap();
        assert_eq!(l.code, 250);
        assert_eq!(l.sep, ReplySep::Space);
        assert_eq!(l.text, "OK");
    }

    #[test]
    fn parse_line_hyphen_sep() {
        let l = parse_line("250-NEXT").unwrap();
        assert_eq!(l.sep, ReplySep::Hyphen);
        assert_eq!(l.text, "NEXT");
    }

    #[test]
    fn empty_text_after_code_is_ok() {
        let r = parse_reply("250 ").unwrap();
        assert_eq!(r.code, 250);
        assert_eq!(r.text, "");
        assert!(r.is_last);
    }
}
