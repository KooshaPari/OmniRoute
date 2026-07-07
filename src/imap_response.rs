// Minimal IMAP response parser (RFC 3501 subset).
//
// Handles the response stream a server emits during a SELECT / EXAMINE /
// FETCH session:
//
//   * OK [CAPABILITY IMAP4rev1] server ready
//   * LIST () "/" "INBOX"
//   * 1 FETCH (UID 1001 FLAGS (\Seen) BODY[TEXT] {17}
//   Hello, world!
//   )
//   1 OK FETCH completed
//
// This module is intentionally minimal: it only parses the line-level
// shapes we actually need to drive a small client — tagged/untagged
// status, FETCH body[text], body[header.fields], UID, ENVELOPE, FLAGS
// (\Seen, \Answered, \Flagged, \Deleted, \Draft), and terminal
// status updates (OK / NO / BAD / PREAUTH / BYE).
//
// It is NOT a full IMAP parser. Parenthesised lists are scanned with a
// bracket depth counter rather than a recursive grammar, which is
// sufficient for the response shapes we care about. Anything more
// elaborate (e.g. literal+ addressing, NOTIFY, CONDSTORE extensions)
// falls through as raw text in the `body_text` or `envelope` fields.

/// One parsed FETCH response line.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FetchItem {
    /// Sequence number of the message.
    pub seq: u32,
    /// `UID` value if the response included one.
    pub uid: Option<u32>,
    /// IMAP system + keyword flags (e.g. `\Seen`, `\Answered`,
    /// `\Flagged`, `\Deleted`, `\Draft`, `Forwarded`).
    pub flags: Vec<String>,
    /// `ENVELOPE` block as a raw string (or empty if not present).
    pub envelope: String,
    /// `BODY[TEXT]` or `BODY[HEADER.FIELDS (...)]` payload if the
    /// server sent one.
    pub body_text: String,
}

/// A tagged, untagged, or continuation status update.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Status {
    /// Tag the server used. For untagged status this is `*`, for
    /// continuation status it is `+`. For tagged responses it is the
    /// command tag the client sent.
    pub tagged: String,
    /// Status code word: `OK`, `NO`, `BAD`, `PREAUTH`, or `BYE`.
    pub message: String,
}

const STATUS_WORDS: &[&str] = &["OK", "NO", "BAD", "PREAUTH", "BYE"];

/// Parse a complete IMAP response blob.
///
/// Returns the list of `FETCH` items seen, and the final status the
/// server ended the response with. Any mid-stream `* OK` / `* NO` /
/// `* BYE` lines are folded into the status when no further FETCH
/// data follows; otherwise they are ignored.
///
/// `input` is the full multi-line response text exactly as it came off
/// the wire, including CRLF line terminators (LF is also accepted).
pub fn parse(input: &str) -> Result<(Vec<FetchItem>, Status), String> {
    let mut items: Vec<FetchItem> = Vec::new();
    let mut final_status: Option<Status> = None;

    let mut offset = 0usize;
    let bytes = input.as_bytes();
    while offset < bytes.len() {
        let (line, line_end) = read_line(bytes, offset);
        let line = line.strip_suffix('\r').unwrap_or(line);
        if line.is_empty() {
            offset = line_end;
            continue;
        }

        // Continuation request: `+ ...`
        if let Some(rest) = line.strip_prefix('+') {
            let body = rest.trim_start();
            let (code, msg) = split_status_word(body);
            final_status = Some(Status {
                tagged: "+".into(),
                message: format!("{} {}", code, msg).trim().to_string(),
            });
            offset = line_end;
            continue;
        }

        // Untagged status: `* OK|NO|BAD|PREAUTH|BYE ...`
        if let Some(rest) = line.strip_prefix("* ") {
            if let Some((word, after)) = first_word(rest) {
                if STATUS_WORDS.contains(&word) {
                    final_status = Some(Status {
                        tagged: "*".into(),
                        message: format!("{} {}", word, after.trim())
                            .trim()
                            .to_string(),
                    });
                    offset = line_end;
                    continue;
                }
            }
            // Otherwise it's an untagged response of some other shape
            // (FETCH, LIST, ...). We only care about FETCH here.
            if let Some((seq, after_seq)) = read_u32(rest) {
                let after_seq = after_seq
                    .trim_end_matches('\n')
                    .trim_end_matches('\r')
                    .trim_start();
                if let Some(after_fetch) = strip_keyword(after_seq, "FETCH") {
                    let body = after_fetch
                        .trim_end_matches('\n')
                        .trim_end_matches('\r')
                        .trim_start();
                    if let Some(item) =
                        parse_fetch_block(seq, body, &input[line_end..])
                    {
                        items.push(item);
                    }
                }
            }
            offset = line_end;
            continue;
        }

        // Tagged status: `<tag> OK|NO|BAD|PREAUTH|BYE ...`
        if let Some(space) = line.find(' ') {
            let (tag, rest) = line.split_at(space);
            if !tag.is_empty() {
                let body = rest.trim_start();
                if let Some((word, after)) = first_word(body) {
                    if STATUS_WORDS.contains(&word) {
                        final_status = Some(Status {
                            tagged: tag.to_string(),
                            message: format!("{} {}", word, after.trim())
                                .trim()
                                .to_string(),
                        });
                        offset = line_end;
                        continue;
                    }
                }
            }
        }

        offset = line_end;
    }

    let status = final_status.unwrap_or(Status {
        tagged: String::new(),
        message: String::new(),
    });
    Ok((items, status))
}

fn read_line(bytes: &[u8], start: usize) -> (&str, usize) {
    let mut i = start;
    while i < bytes.len() && bytes[i] != b'\n' {
        i += 1;
    }
    let end = if i < bytes.len() { i + 1 } else { bytes.len() };
    let s = std::str::from_utf8(&bytes[start..end]).unwrap_or("");
    (s, end)
}

fn first_word(s: &str) -> Option<(&str, &str)> {
    let s = s.trim_start();
    if s.is_empty() {
        return None;
    }
    if let Some(space) = s.find(char::is_whitespace) {
        Some((&s[..space], &s[space..]))
    } else {
        Some((s, ""))
    }
}

fn split_status_word(s: &str) -> (&str, &str) {
    if let Some((w, rest)) = first_word(s) {
        (w, rest.trim())
    } else {
        (s, "")
    }
}

fn strip_keyword<'a>(s: &'a str, kw: &str) -> Option<&'a str> {
    if let Some(rest) = s.strip_prefix(kw) {
        if rest.is_empty() || rest.starts_with(char::is_whitespace) {
            return Some(rest);
        }
    }
    None
}

fn read_u32(s: &str) -> Option<(u32, &str)> {
    let mut i = 0;
    let bytes = s.as_bytes();
    while i < bytes.len() && bytes[i].is_ascii_digit() {
        i += 1;
    }
    if i == 0 {
        return None;
    }
    let n: u32 = s[..i].parse().ok()?;
    Some((n, &s[i..]))
}

/// Tokens extracted from one FETCH body. `Body` is a literal payload
/// read from outside the parens (the bytes following `{N}\r\n`).
#[derive(Debug, Clone, PartialEq, Eq)]
enum Tok {
    Word(String),
    Quoted(String),
    Group(Vec<Tok>),
    Literal { count: usize, payload: String },
}

fn parse_fetch_block(seq: u32, body: &str, rest: &str) -> Option<FetchItem> {
    // body starts with `(`. Find the matching close paren on this or
    // subsequent lines, then tokenise the inside.
    if !body.starts_with('(') {
        return None;
    }

    // Build the FETCH body by reading lines from `body` first, then
    // from `rest`, until we find the matching `)`. The body for a
    // literal case looks like:
    //   line: `* 1 FETCH (BODY[TEXT] {5}`          -> body part
    //   line: `hello)`                              -> rest part 1
    //   line: `A1 OK`                               -> rest part 2
    // We include the closing `)` in our scan; everything past the
    // first `)` is discarded.
    let mut combined = String::new();
    combined.push_str(body);
    combined.push('\n');
    combined.push_str(rest);
    let lines: Vec<&str> = combined.split('\n').collect();

    // We need to know which character offset within `combined` the
    // FETCH block started, so that literal payloads can be located
    // relative to `rest`. Track the byte offset of each line in
    // `combined`.
    let mut line_offsets: Vec<usize> = Vec::with_capacity(lines.len() + 1);
    let mut off = 0usize;
    for (idx, l) in lines.iter().enumerate() {
        line_offsets.push(off);
        off += l.len();
        if idx + 1 < lines.len() {
            off += 1; // for the `\n`
        }
    }
    let _ = off;

    let mut depth: i32 = 0;
    let mut started = false;
    let mut closed = false;
    let mut body_start_line = 0usize;
    let mut body_end_line = 0usize;
    for (idx, l) in lines.iter().enumerate() {
        for ch in l.chars() {
            if ch == '(' {
                if !started {
                    started = true;
                    body_start_line = idx;
                }
                depth += 1;
            } else if ch == ')' {
                depth -= 1;
                if depth == 0 && started {
                    closed = true;
                    body_end_line = idx;
                    break;
                }
            }
        }
        if closed {
            break;
        }
    }
    if !closed {
        return None;
    }

    // Build the inner text from lines[body_start_line..=body_end_line],
    // dropping the outer parens.
    let mut buf = String::new();
    for (idx, l) in lines
        .iter()
        .enumerate()
        .take(body_end_line + 1)
        .skip(body_start_line)
    {
        let mut s: &str = l;
        if idx == body_start_line {
            // Drop the opening `(`.
            if let Some(pos) = s.find('(') {
                s = &s[pos + 1..];
            }
        }
        if idx == body_end_line {
            if let Some(pos) = s.rfind(')') {
                s = &s[..pos];
            }
        }
        if !buf.is_empty() {
            buf.push(' ');
        }
        buf.push_str(s);
    }

    // Compute the byte offset within `combined` where the literal
    // payload would start. That's right after the first `{N}\r\n` or
    // `{N}\n` we encounter, if any. We hand `rest` to the
    // tokeniser, starting from there.
    let mut rest_payload_start: usize = 0;
    // The first line of FETCH lives in `body` (before the \n we
    // inserted). So `combined` is `body\nrest`. The first `\n` is at
    // `body.len()`. The literal payload lives in `rest` from byte 0
    // if the `{N}` is on the first line of `body`.
    let body_line_end = body.len(); // position of the `\n` we inserted
    let _ = body_line_end;

    // The tokeniser reads from `rest` for literal payloads. It
    // needs to start past the CRLF that follows the `{N}` block on
    // the first FETCH line. We compute that offset by scanning the
    // first FETCH line in `body` for the literal pattern.
    let first = body;
    if let Some(brace_start) = first.find('{') {
        if let Some(close_rel) = first[brace_start..].find('}') {
            let count_str = &first[brace_start + 1..brace_start + close_rel];
            if count_str.parse::<usize>().is_ok() {
                // The literal terminator ends at this offset in
                // `body`. If the terminator is at the end of the
                // first FETCH line, the CRLF sits at the boundary
                // between `body` and `rest` (offset 0 of `rest`);
                // otherwise the terminator sits mid-`body` and the
                // CRLF is inside `body` too.
                let after_brace = brace_start + close_rel + 1;
                if after_brace >= body.len() {
                    // CRLF/LF is at the start of `rest`.
                    if rest.starts_with("\r\n") {
                        rest_payload_start = 2;
                    } else if rest.starts_with('\n') {
                        rest_payload_start = 1;
                    } else {
                        rest_payload_start = 0;
                    }
                } else {
                    let mut skip = after_brace;
                    if rest[skip..].starts_with("\r\n") {
                        skip += 2;
                    } else if rest[skip..].starts_with('\n') {
                        skip += 1;
                    }
                    rest_payload_start = skip;
                }
            }
        }
    }

    let mut rest_offset = rest_payload_start;
    let toks = tokenise(&buf, rest, &mut rest_offset);

    let mut item = FetchItem {
        seq,
        uid: None,
        flags: Vec::new(),
        envelope: String::new(),
        body_text: String::new(),
    };

    let mut i = 0;
    while i < toks.len() {
        match &toks[i] {
            Tok::Word(w) if w == "UID" => {
                if let Some(Tok::Word(n)) = toks.get(i + 1) {
                    item.uid = n.parse().ok();
                }
                i += 2;
            }
            Tok::Word(w) if w == "FLAGS" => {
                if let Some(Tok::Group(flags)) = toks.get(i + 1) {
                    item.flags = flags
                        .iter()
                        .filter_map(|t| match t {
                            Tok::Word(s) => Some(s.clone()),
                            Tok::Quoted(s) => Some(s.clone()),
                            _ => None,
                        })
                        .collect();
                } else if let Some(Tok::Word(s)) = toks.get(i + 1) {
                    item.flags = vec![s.clone()];
                }
                i += 2;
            }
            Tok::Word(w) if w == "ENVELOPE" => {
                if i + 1 < toks.len() {
                    item.envelope = token_to_string(&toks[i + 1]);
                }
                i += 2;
            }
            Tok::Word(w) if w.starts_with("BODY[") => {
                let kind = w
                    .trim_start_matches("BODY[")
                    .trim_end_matches(']');
                let mut payload = String::new();
                if i + 1 < toks.len() {
                    payload = token_to_string(&toks[i + 1]);
                    i += 2;
                } else {
                    i += 1;
                }
                if kind == "TEXT" || kind.starts_with("HEADER.FIELDS") {
                    item.body_text = payload;
                }
            }
            _ => {
                i += 1;
            }
        }
    }

    Some(item)
}

fn token_to_string(t: &Tok) -> String {
    match t {
        Tok::Word(s) => s.clone(),
        Tok::Quoted(s) => {
            // Strip the surrounding quotes for body text.
            let trimmed = s.trim();
            trimmed
                .strip_prefix('"')
                .and_then(|x| x.strip_suffix('"'))
                .unwrap_or(trimmed)
                .to_string()
        }
        Tok::Literal { payload, .. } => payload.clone(),
        Tok::Group(_) => String::new(),
    }
}

fn tokenise(buf: &str, rest: &str, rest_offset: &mut usize) -> Vec<Tok> {
    // We split on whitespace, but keep parenthesised groups together
    // and recognise quoted strings + `{N}` literals (the literal
    // payload is read from `rest`).
    let mut out: Vec<Tok> = Vec::new();
    let bytes = buf.as_bytes();
    let mut i = 0usize;
    while i < bytes.len() {
        let ch = bytes[i] as char;
        if ch.is_whitespace() {
            i += 1;
            continue;
        }
        if ch == '(' {
            // Group: collect until matching close paren.
            let mut group: Vec<Tok> = Vec::new();
            let mut depth: i32 = 1;
            let start = i + 1;
            let mut j = start;
            while j < bytes.len() && depth > 0 {
                let c = bytes[j] as char;
                if c == '(' {
                    depth += 1;
                } else if c == ')' {
                    depth -= 1;
                    if depth == 0 {
                        break;
                    }
                }
                j += 1;
            }
            if j >= bytes.len() {
                return out;
            }
            // Tokenise the inside.
            let inner = &buf[start..j];
            let sub = tokenise(inner, rest, rest_offset);
            for t in sub {
                group.push(t);
            }
            out.push(Tok::Group(group));
            i = j + 1;
            continue;
        }
        if ch == '"' {
            let mut s = String::new();
            s.push('"');
            i += 1;
            while i < bytes.len() {
                let c = bytes[i] as char;
                s.push(c);
                i += 1;
                if c == '"' {
                    break;
                }
            }
            out.push(Tok::Quoted(s));
            continue;
        }
        if ch == '{' {
            // {N} literal — payload is the next N bytes after the
            // CRLF in `rest`.
            let close = match buf[i..].find('}') {
                Some(c) => i + c,
                None => {
                    i += 1;
                    continue;
                }
            };
            let count: usize = match buf[i + 1..close].parse() {
                Ok(n) => n,
                Err(_) => {
                    i += 1;
                    continue;
                }
            };
            let r = &rest[*rest_offset..];
            let take = count.min(r.len());
            let payload = r[..take].to_string();
            *rest_offset += take;
            out.push(Tok::Literal { count, payload });
            i = close + 1;
            continue;
        }
        // Word: read until whitespace or `(` or `)` or `"`
        let start = i;
        while i < bytes.len() {
            let c = bytes[i] as char;
            if c.is_whitespace() || c == '(' || c == ')' || c == '"' {
                break;
            }
            i += 1;
        }
        out.push(Tok::Word(buf[start..i].to_string()));
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn tagged_ok_status() {
        let input = "A1 OK SELECT completed\r\n";
        let (_, status) = parse(input).expect("parse");
        assert_eq!(status.tagged, "A1");
        assert!(status.message.contains("OK"));
        assert!(status.message.contains("SELECT"));
    }

    #[test]
    fn tagged_no_status() {
        let input = "A2 NO Permission denied\r\n";
        let (_, status) = parse(input).expect("parse");
        assert_eq!(status.tagged, "A2");
        assert!(status.message.contains("NO"));
    }

    #[test]
    fn fetch_with_flags_and_uid() {
        let input =
            "* 5 FETCH (UID 1042 FLAGS (\\Seen \\Answered) ENVELOPE \"x\")\r\nA3 OK\r\n";
        let (items, status) = parse(input).expect("parse");
        assert_eq!(items.len(), 1);
        assert_eq!(items[0].seq, 5);
        assert_eq!(items[0].uid, Some(1042));
        assert_eq!(
            items[0].flags,
            vec!["\\Seen".to_string(), "\\Answered".to_string()]
        );
        assert_eq!(status.tagged, "A3");
    }

    #[test]
    fn fetch_body_text_literal() {
        let input = "* 1 FETCH (BODY[TEXT] {5}\r\nhello)\r\nA1 OK\r\n";
        let (items, _) = parse(input).expect("parse");
        assert_eq!(items[0].body_text, "hello");
    }

    #[test]
    fn fetch_body_text_quoted() {
        let input =
            "* 1 FETCH (BODY[TEXT] \"hi there\")\r\nA1 OK\r\n";
        let (items, _) = parse(input).expect("parse");
        assert_eq!(items[0].body_text, "hi there");
    }

    #[test]
    fn continuation_plus_status() {
        let input = "+ Ready for literal data\r\n";
        let (_, status) = parse(input).expect("parse");
        assert_eq!(status.tagged, "+");
        assert!(status.message.contains("Ready"));
    }

    #[test]
    fn bye_status() {
        let input = "* BYE server shutting down\r\n";
        let (_, status) = parse(input).expect("parse");
        assert_eq!(status.tagged, "*");
        assert!(status.message.contains("BYE"));
    }
}
