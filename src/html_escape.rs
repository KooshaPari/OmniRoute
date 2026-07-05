// HTML entity escaping for safe text insertion. Encodes &, <, >, ", ' as named entities.
pub fn escape(input: &str) -> String {
    let mut out = String::with_capacity(input.len());
    for c in input.chars() {
        match c {
            '&' => out.push_str("&amp;"),
            '<' => out.push_str("&lt;"),
            '>' => out.push_str("&gt;"),
            '"' => out.push_str("&quot;"),
            '\'' => out.push_str("&#39;"),
            _ => out.push(c),
        }
    }
    out
}
pub fn escape_attr(input: &str) -> String {
    // For attribute values: same as escape() but quote-safe.
    escape(input)
}
pub fn unescape(input: &str) -> String {
    let mut out = String::with_capacity(input.len());
    let bytes = input.as_bytes();
    let mut i = 0;
    while i < bytes.len() {
        let b = bytes[i];
        if b == b'&' {
            // try named entities first
            let rest = &bytes[i..];
            if rest.starts_with(b"&amp;") { out.push('&'); i += 5; continue; }
            if rest.starts_with(b"&lt;") { out.push('<'); i += 4; continue; }
            if rest.starts_with(b"&gt;") { out.push('>'); i += 4; continue; }
            if rest.starts_with(b"&quot;") { out.push('"'); i += 6; continue; }
            if rest.starts_with(b"&#39;") { out.push('\''); i += 5; continue; }
            if rest.starts_with(b"&#") {
                // numeric entity: &#NN; or &#xHH;
                let semi = rest.iter().position(|&c| c == b';');
                if let Some(s) = semi {
                    let num_str = &rest[2..s];
                    if let Some(s2) = rest.get(s) {
                        if *s2 == b';' {
                            if num_str.first() == Some(&b'x') || num_str.first() == Some(&b'X') {
                                if let Ok(n) = std::str::from_utf8(&num_str[1..]).unwrap_or("").parse::<u32>() {
                                    if let Some(c) = char::from_u32(n) { out.push(c); }
                                    i += 2 + num_str.len() + 1;
                                    continue;
                                }
                            } else if let Ok(n) = std::str::from_utf8(num_str).unwrap_or("").parse::<u32>() {
                                if let Some(c) = char::from_u32(n) { out.push(c); }
                                i += 2 + num_str.len() + 1;
                                continue;
                            }
                        }
                    }
                }
            }
            out.push('&');
            i += 1;
        } else {
            // safe to push byte as char (UTF-8 boundary safety: assume input is valid UTF-8)
            let s = std::str::from_utf8(&bytes[i..i+1]).unwrap_or("?");
            out.push_str(s);
            i += 1;
        }
    }
    out
}
#[cfg(test)]
mod tests {
    use super::*;
}
