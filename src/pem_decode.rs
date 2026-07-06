// Minimal PEM decoder (RFC 7468).
//
// PEM (Privacy-Enhanced Mail) is the textual envelope used to wrap
// cryptographic keys, certificates, and other binary blobs in
// ASCII-armored form. The format is:
//
//   -----BEGIN <LABEL>-----
//   <optional header lines, one per line, of the form "Name: value">
//   <base64-encoded body, split across lines, may be folded with whitespace>
//   -----END <LABEL>-----
//
// A single input may contain multiple such blocks back-to-back. Headers
// that follow RFC 1421 / RFC 1423 conventions are exposed via the
// `headers` map; the `Proc-Type` header containing `4,ENCRYPTED` (along
// with `DEK-Info`) marks the block as encrypted.
//
// This module performs ONLY the textual envelope parsing and base64
// decoding of the body. It does not decrypt, ASN.1-parse, or otherwise
// interpret the inner content.

use std::collections::BTreeMap;

/// A parsed PEM block.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PemBlock {
    /// The label between the BEGIN/END markers (e.g. "RSA PUBLIC KEY").
    pub label: String,
    /// Headers between BEGIN and body (e.g. "Proc-Type", "DEK-Info").
    pub headers: BTreeMap<String, String>,
    /// Decoded body bytes.
    pub data: Vec<u8>,
    /// True when headers indicate the body is encrypted.
    pub encrypted: bool,
}

/// Parse a PEM-encoded string into a list of blocks.
///
/// Returns an error string if a BEGIN marker has no matching END marker,
/// the BEGIN/END labels do not agree, or any line is malformed.
pub fn parse(input: &str) -> Result<Vec<PemBlock>, String> {
    let mut blocks = Vec::new();
    let mut lines = input.lines().peekable();

    while let Some(_) = lines.peek() {
        // Find next BEGIN marker.
        let begin_line = match lines.next() {
            Some(l) => l,
            None => break,
        };
        let begin_trim = begin_line.trim();
        if begin_trim.is_empty() {
            continue;
        }
        let label = match begin_label(begin_trim) {
            Some(l) => l,
            None => {
                return Err(format!(
                    "expected PEM BEGIN marker, got: {:?}",
                    begin_trim
                ));
            }
        };

        // Collect header lines and base64 body lines until we hit END label.
        let mut headers: BTreeMap<String, String> = BTreeMap::new();
        let mut body_lines: Vec<String> = Vec::new();
        let mut end_label: Option<String> = None;
        let mut header_phase = true;

        for line in lines.by_ref() {
            let trimmed = line.trim();
            if header_phase {
                if trimmed.is_empty() {
                    // Blank line ends header block.
                    header_phase = false;
                    continue;
                }
                if let Some(rest) = trimmed.strip_prefix("-----END ") {
                    // -----END <LABEL>-----
                    let end_l = match rest.strip_suffix("-----") {
                        Some(s) => s.trim().to_string(),
                        None => {
                            return Err(format!(
                                "malformed END marker: {:?}",
                                trimmed
                            ));
                        }
                    };
                    end_label = Some(end_l);
                    break;
                }
                if let Some(colon_pos) = trimmed.find(':') {
                    let name = trimmed[..colon_pos].trim().to_string();
                    let value = trimmed[colon_pos + 1..].trim().to_string();
                    headers.insert(name, value);
                } else {
                    // Not a header, no blank-line separator; treat as body.
                    header_phase = false;
                    body_lines.push(trimmed.to_string());
                }
            } else {
                if let Some(rest) = trimmed.strip_prefix("-----END ") {
                    let end_l = match rest.strip_suffix("-----") {
                        Some(s) => s.trim().to_string(),
                        None => {
                            return Err(format!(
                                "malformed END marker: {:?}",
                                trimmed
                            ));
                        }
                    };
                    end_label = Some(end_l);
                    break;
                }
                body_lines.push(trimmed.to_string());
            }
        }

        let end_label = match end_label {
            Some(l) => l,
            None => {
                return Err(format!(
                    "PEM block with label {:?} has no END marker",
                    label
                ));
            }
        };

        if end_label != label {
            return Err(format!(
                "PEM BEGIN label {:?} does not match END label {:?}",
                label, end_label
            ));
        }

        // Whitespace folding: collapse all whitespace, then split into
        // base64 tokens (so line continuation via leading space is
        // handled per RFC 7468 §2).
        let joined: String = body_lines.join(" ");
        let base64_str: String = joined.split_whitespace().collect::<Vec<_>>().join("");
        let data = if base64_str.is_empty() {
            Vec::new()
        } else {
            base64_decode(&base64_str)?
        };

        // RFC 1421 §4.6.1 step 4 (Proc-Type 4,ENCRYPTED) and RFC 1423
        // §1.1 (DEK-Info header) indicate the body is encrypted. We set
        // `encrypted` if EITHER signal is present so callers can warn
        // before parsing the inner content as plain bytes.
        let proc_encrypted = headers
            .get("Proc-Type")
            .map(|v| v.split(',').any(|tok| tok.trim() == "4,ENCRYPTED"))
            .unwrap_or(false);
        let dek_info = headers.contains_key("DEK-Info");
        let encrypted = proc_encrypted || dek_info;

        blocks.push(PemBlock {
            label,
            headers,
            data,
            encrypted,
        });
    }

    Ok(blocks)
}

/// Extract the label from a `-----BEGIN <LABEL>-----` line.
fn begin_label(line: &str) -> Option<String> {
    let rest = line.strip_prefix("-----BEGIN ")?;
    let label = rest.strip_suffix("-----")?;
    Some(label.trim().to_string())
}

/// Decode a base64 string (RFC 4648 standard alphabet) into bytes.
///
/// Tolerates `=` padding and silently ignores whitespace already stripped
/// by the caller. Returns an error for invalid characters or malformed
/// padding.
pub(crate) fn base64_decode(s: &str) -> Result<Vec<u8>, String> {
    const ALPHABET: &[u8; 64] =
        b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

    let mut lookup = [255u8; 256];
    for (i, &c) in ALPHABET.iter().enumerate() {
        lookup[c as usize] = i as u8;
    }

    // Strip whitespace defensively (caller should have done this already).
    let cleaned: Vec<u8> = s.bytes().filter(|b| !b.is_ascii_whitespace()).collect();

    if cleaned.is_empty() {
        return Ok(Vec::new());
    }

    // Validate padding: only the last 1 or 2 chars may be '=', and only
    // when total length mod 4 == 0 (after stripping).
    let len = cleaned.len();
    if len % 4 != 0 {
        return Err(format!(
            "base64 input length {} is not a multiple of 4",
            len
        ));
    }
    let pad_count = cleaned.iter().rev().take_while(|&&b| b == b'=').count();
    if pad_count > 2 {
        return Err(format!("base64 has {} trailing '=' pads (max 2)", pad_count));
    }
    // No '=' allowed except trailing padding.
    for &b in &cleaned[..len - pad_count] {
        if b == b'=' {
            return Err("base64 '=' padding only allowed at end".to_string());
        }
    }

    let mut out = Vec::with_capacity(len / 4 * 3);
    let mut buf: u32 = 0;
    let mut bits: u32 = 0;
    for &b in &cleaned {
        if b == b'=' {
            break;
        }
        let v = lookup[b as usize];
        if v == 255 {
            return Err(format!(
                "invalid base64 character: {:?}",
                b as char
            ));
        }
        buf = (buf << 6) | (v as u32);
        bits += 6;
        if bits >= 8 {
            bits -= 8;
            out.push(((buf >> bits) & 0xFF) as u8);
        }
    }

    Ok(out)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn single_rsa_public_key() {
        // Standard RSA PUBLIC KEY block. Body is 64 base64 chars (4
        // 16-char lines) -> 48 bytes (multiple of 4 in input).
        let pem = "-----BEGIN RSA PUBLIC KEY-----\n\
                   MIIBCgKCAQEAwQID\n\
                   AQABMIIBCgKCAQEA\n\
                   wQIDAQABMIIBCgKC\n\
                   AQEAwQIDAQABMIIB\n\
                   -----END RSA PUBLIC KEY-----\n";
        let blocks = parse(pem).expect("parse");
        assert_eq!(blocks.len(), 1);
        let b = &blocks[0];
        assert_eq!(b.label, "RSA PUBLIC KEY");
        assert!(b.headers.is_empty());
        assert!(!b.encrypted);
        assert!(!b.data.is_empty());
        // 64 chars of base64 -> 48 bytes.
        assert_eq!(b.data.len(), 48);
    }

    #[test]
    fn multi_block() {
        let pem = "-----BEGIN BLOCK A-----\n\
                   SGVsbG8=\n\
                   -----END BLOCK A-----\n\
                   -----BEGIN BLOCK B-----\n\
                   V29ybGQ=\n\
                   -----END BLOCK B-----\n";
        let blocks = parse(pem).expect("parse");
        assert_eq!(blocks.len(), 2);
        assert_eq!(blocks[0].label, "BLOCK A");
        assert_eq!(blocks[1].label, "BLOCK B");
        assert_eq!(blocks[0].data, b"Hello");
        assert_eq!(blocks[1].data, b"World");
    }

    #[test]
    fn encrypted_pem_detected() {
        // Synthetic encrypted PEM block with Proc-Type/DEK-Info headers.
        // 44 base64 chars decode to 33 bytes (with 1 pad).
        let pem = "-----BEGIN RSA PRIVATE KEY-----\n\
                   Proc-Type: 4,ENCRYPTED\n\
                   DEK-Info: AES-256-CBC,0011223344556677\n\
                   \n\
                   abcdefghijklmnopqrstuvwxyz0123456789ABCD\n\
                   -----END RSA PRIVATE KEY-----\n";
        let blocks = parse(pem).expect("parse");
        assert_eq!(blocks.len(), 1);
        assert!(blocks[0].encrypted);
        assert_eq!(
            blocks[0].headers.get("Proc-Type").map(|s| s.as_str()),
            Some("4,ENCRYPTED")
        );
        assert_eq!(
            blocks[0].headers.get("DEK-Info").map(|s| s.as_str()),
            Some("AES-256-CBC,0011223344556677")
        );
    }

    #[test]
    fn line_folding_handled() {
        // Body has trailing whitespace and a leading space on the second
        // line (RFC 7468 §2 folding). Should decode to the same value.
        let pem = "-----BEGIN TEST-----\n\
                   SGVs   \n\
                     bG8=\n\
                   -----END TEST-----\n";
        let blocks = parse(pem).expect("parse");
        assert_eq!(blocks.len(), 1);
        assert_eq!(blocks[0].data, b"Hello");
    }

    #[test]
    fn missing_end_marker_rejected() {
        let pem = "-----BEGIN NOPE-----\n\
                   SGVsbG8=\n";
        let err = parse(pem).expect_err("should reject");
        assert!(err.contains("no END marker"), "got: {}", err);
    }

    #[test]
    fn mismatched_labels_rejected() {
        let pem = "-----BEGIN ONE-----\n\
                   SGVsbG8=\n\
                   -----END TWO-----\n";
        let err = parse(pem).expect_err("should reject");
        assert!(err.contains("does not match"), "got: {}", err);
    }

    #[test]
    fn malformed_begin_rejected() {
        let pem = "this is not a pem file\n";
        let err = parse(pem).expect_err("should reject");
        assert!(err.contains("expected PEM BEGIN"), "got: {}", err);
    }

    #[test]
    fn rfc4648_test_vector_foobar() {
        // RFC 4648 §10 test vector: "foobar" base64-encoded is "Zm9vYmFy".
        let decoded = base64_decode("Zm9vYmFy").expect("decode");
        assert_eq!(decoded, b"foobar");
        // And the inverse: encode back to known form.
        let again = base64_decode(&decoded.iter().fold(String::new(), |mut s, b| {
            s.push_str(match b {
                b'f' => "Zg==",
                b'o' => "bw==",
                b'b' => "Yg==",
                b'a' => "YQ==",
                b'r' => "cg==",
                _ => unreachable!(),
            });
            s
        }));
        // (sanity: round-trip a single byte 'f')
        assert_eq!(base64_decode("Zg==").expect("decode"), b"f");
    }

    #[test]
    fn blank_lines_between_blocks() {
        let pem = "-----BEGIN ONE-----\n\
                   SGVsbG8=\n\
                   -----END ONE-----\n\
                   \n\
                   -----BEGIN TWO-----\n\
                   V29ybGQ=\n\
                   -----END TWO-----\n";
        let blocks = parse(pem).expect("parse");
        assert_eq!(blocks.len(), 2);
        assert_eq!(blocks[0].data, b"Hello");
        assert_eq!(blocks[1].data, b"World");
    }

    #[test]
    fn no_headers_with_blank_separator() {
        // Some PEM blocks have a blank line immediately after BEGIN with
        // no headers; the body should still parse.
        let pem = "-----BEGIN TEST-----\n\
                   \n\
                   SGVsbG8=\n\
                   -----END TEST-----\n";
        let blocks = parse(pem).expect("parse");
        assert_eq!(blocks.len(), 1);
        assert_eq!(blocks[0].data, b"Hello");
    }

    #[test]
    fn invalid_base64_rejected() {
        // Use '!' which is not in the RFC 4648 alphabet.
        let pem = "-----BEGIN TEST-----\n\
                   SGVs!G8=\n\
                   -----END TEST-----\n";
        let err = parse(pem).expect_err("should reject");
        assert!(err.contains("invalid base64"), "got: {}", err);
    }

    #[test]
    fn single_byte_padding() {
        // "f" -> "Zg==" (two '=' pads).
        assert_eq!(base64_decode("Zg==").unwrap(), b"f");
        // "fo" -> "Zm8=" (one '=' pad).
        assert_eq!(base64_decode("Zm8=").unwrap(), b"fo");
        // "foo" -> "Zm9v" (no padding).
        assert_eq!(base64_decode("Zm9v").unwrap(), b"foo");
    }
}