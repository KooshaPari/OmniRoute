// Minimal TACACS+ packet parser (RFC 8907 — Terminal Access Controller
// Access-Control Plus).
//
// TACACS+ uses a 12-byte fixed header followed by a variable-length
// body. The header layout (network byte order, big-endian):
//
//   +--------+--------+----------------+----------------+
//   |  ver   |  type  |     seq_no     |    session_id   |
//   | (1 B)  | (1 B)  |     (4 B)      |      (4 B)      |
//   +--------+--------+----------------+----------------+
//   |                  length                       |
//   |                  (4 B)                        |
//   +-----------------------------------------------+
//
// Where:
//   * `ver`     — protocol version. Always 0xC0 (192) for TACACS+.
//   * `type`    — packet type. 1 = Authen, 2 = Author, 3 = Acct.
//   * `seq_no`  — sequence number (high bit = encrypted flag).
//   * `session_id` — random session id chosen by the initiator.
//   * `length`  — length of the body that follows the header.
//
// The authorization body for packet type 2 is itself a small TLV
// record set where each argument is a `key=value` pair joined with
// semicolons. For example:
//
//   service=ppp;protocol=lcp;cmd=accept
//
// This module only parses the framing and the authorization argument
// string. It does not implement encryption, MD5 obfuscation of the
// shared secret, or the full TLV record walker — callers that need
// those can layer them on top of `parse_header` and the `arg` map.

use std::collections::BTreeMap;

/// Packet type. TACACS+ defines three top-level packet shapes.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PacketType {
    /// Authentication packets.
    Authentication,
    /// Authorization packets.
    Authorization,
    /// Accounting packets.
    Accounting,
    /// Unrecognised packet type.
    Unknown(u8),
}

impl PacketType {
    fn from_u8(v: u8) -> Self {
        match v {
            1 => PacketType::Authentication,
            2 => PacketType::Authorization,
            3 => PacketType::Accounting,
            other => PacketType::Unknown(other),
        }
    }

    /// Wire byte for this packet type.
    pub fn to_u8(self) -> u8 {
        match self {
            PacketType::Authentication => 1,
            PacketType::Authorization => 2,
            PacketType::Accounting => 3,
            PacketType::Unknown(v) => v,
        }
    }
}

/// Parsed TACACS+ header.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Header {
    /// Protocol version. Always 0xC0 for TACACS+ v1.
    pub version: u8,
    /// Packet type.
    pub packet_type: PacketType,
    /// Sequence number. The high bit indicates the body is encrypted.
    pub seq_no: u32,
    /// Session id (chosen by the initiator).
    pub session_id: u32,
    /// Number of body bytes that follow the header.
    pub length: u32,
}

impl Header {
    /// `true` when the high bit of `seq_no` is set, indicating that the
    /// body is encrypted. Decrypt before parsing.
    pub fn is_encrypted(&self) -> bool {
        self.seq_no & 0x8000_0000 != 0
    }

    /// Plain sequence number with the encrypted bit stripped.
    pub fn sequence(&self) -> u8 {
        (self.seq_no & 0x00FF_FFFF) as u8
    }
}

/// Parse the 12-byte TACACS+ header from the front of `bytes`.
///
/// Returns the parsed header plus the index where the body begins.
pub fn parse_header(bytes: &[u8]) -> Result<(Header, usize), String> {
    if bytes.len() < 12 {
        return Err(format!(
            "TACACS+ header is 12 bytes, got {}",
            bytes.len()
        ));
    }
    let version = bytes[0];
    let packet_type = PacketType::from_u8(bytes[1]);
    let seq_no = u32::from_be_bytes([bytes[2], bytes[3], bytes[4], bytes[5]]);
    let session_id = u32::from_be_bytes([bytes[6], bytes[7], bytes[8], bytes[9]]);
    let length = u32::from_be_bytes([bytes[10], bytes[11]]);
    Ok((
        Header {
            version,
            packet_type,
            seq_no,
            session_id,
            length,
        },
        12,
    ))
}

/// Parse an authorization argument string of the form
/// `key1=value1;key2=value2;...` into a map.
///
/// Keys are case-sensitive. Empty values are preserved. Leading and
/// trailing `;` are tolerated. Whitespace around `=` or `;` is
/// trimmed.
pub fn parse_args(body: &str) -> BTreeMap<String, String> {
    let mut out = BTreeMap::new();
    for part in body.split(';') {
        let part = part.trim();
        if part.is_empty() {
            continue;
        }
        if let Some((k, v)) = part.split_once('=') {
            out.insert(k.trim().to_string(), v.trim().to_string());
        } else {
            // Bare token — record under empty key so callers can detect.
            out.insert(String::new(), part.to_string());
        }
    }
    out
}

/// Convenience: parse a header followed by an authorization body.
///
/// `bytes` must contain the 12-byte header and the entire body. The
/// body is interpreted as UTF-8 and split into `key=value` pairs by
/// the `;` separator. Use `parse_header` for the raw framing when
/// the body is encrypted or not UTF-8.
pub fn parse_author_packet(bytes: &[u8]) -> Result<(Header, BTreeMap<String, String>), String> {
    let (hdr, body_off) = parse_header(bytes)?;
    if hdr.packet_type != PacketType::Authorization {
        return Err(format!(
            "expected authorization packet, got type {}",
            hdr.packet_type.to_u8()
        ));
    }
    if hdr.length as usize + body_off > bytes.len() {
        return Err(format!(
            "header says body is {} bytes but only {} available",
            hdr.length,
            bytes.len() - body_off
        ));
    }
    let body_bytes = &bytes[body_off..body_off + hdr.length as usize];
    let body = std::str::from_utf8(body_bytes)
        .map_err(|e| format!("body is not valid UTF-8: {e}"))?;
    Ok((hdr, parse_args(body)))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn authz_packet(seq: u32, body: &str) -> Vec<u8> {
        let body_bytes = body.as_bytes();
        let mut out = Vec::with_capacity(12 + body_bytes.len());
        out.push(0xC0); // version
        out.push(2); // authorization
        out.extend_from_slice(&seq.to_be_bytes());
        out.extend_from_slice(&0x1122_3344u32.to_be_bytes());
        out.extend_from_slice(&(body_bytes.len() as u32).to_be_bytes());
        out.extend_from_slice(body_bytes);
        out
    }

    #[test]
    fn parses_known_header() {
        let bytes = authz_packet(1, "service=ppp");
        let (hdr, off) = parse_header(&bytes).unwrap();
        assert_eq!(hdr.version, 0xC0);
        assert_eq!(hdr.packet_type, PacketType::Authorization);
        assert_eq!(hdr.session_id, 0x1122_3344);
        assert_eq!(hdr.length, 11);
        assert_eq!(off, 12);
    }

    #[test]
    fn rejects_truncated_header() {
        let err = parse_header(&[0xC0, 2, 0, 0, 0, 1]).unwrap_err();
        assert!(err.contains("12 bytes"), "got: {err}");
    }

    #[test]
    fn encrypted_flag_detected() {
        let bytes = authz_packet(0x8000_0001, "service=ppp");
        let (hdr, _) = parse_header(&bytes).unwrap();
        assert!(hdr.is_encrypted());
        assert_eq!(hdr.sequence(), 1);
    }

    #[test]
    fn unencrypted_flag_clean() {
        let bytes = authz_packet(1, "service=ppp");
        let (hdr, _) = parse_header(&bytes).unwrap();
        assert!(!hdr.is_encrypted());
        assert_eq!(hdr.sequence(), 1);
    }

    #[test]
    fn packet_type_round_trip() {
        for v in 0u8..=3 {
            let pt = PacketType::from_u8(v);
            assert_eq!(pt.to_u8(), v);
        }
        assert_eq!(PacketType::from_u8(7).to_u8(), 7);
    }

    #[test]
    fn parses_simple_args() {
        let m = parse_args("service=ppp;protocol=lcp;cmd=accept");
        assert_eq!(m.get("service").unwrap(), "ppp");
        assert_eq!(m.get("protocol").unwrap(), "lcp");
        assert_eq!(m.get("cmd").unwrap(), "accept");
    }

    #[test]
    fn parses_args_with_whitespace() {
        let m = parse_args("  service = ppp ; cmd = accept  ");
        assert_eq!(m.get("service").unwrap(), "ppp");
        assert_eq!(m.get("cmd").unwrap(), "accept");
    }

    #[test]
    fn parses_empty_value() {
        let m = parse_args("foo=;bar=baz");
        assert_eq!(m.get("foo").unwrap(), "");
        assert_eq!(m.get("bar").unwrap(), "baz");
    }

    #[test]
    fn tolerates_trailing_semicolons() {
        let m = parse_args("a=1;b=2;");
        assert_eq!(m.len(), 2);
        assert_eq!(m.get("a").unwrap(), "1");
    }

    #[test]
    fn bare_token_recorded() {
        let m = parse_args("standalone");
        assert_eq!(m.get("").unwrap(), "standalone");
    }

    #[test]
    fn empty_input_yields_empty_map() {
        assert!(parse_args("").is_empty());
        assert!(parse_args(";;;").is_empty());
    }

    #[test]
    fn parses_full_author_packet() {
        let bytes = authz_packet(
            1,
            "service=ppp;protocol=lcp;cmd=accept;addr=10.0.0.1",
        );
        let (hdr, args) = parse_author_packet(&bytes).unwrap();
        assert_eq!(hdr.packet_type, PacketType::Authorization);
        assert_eq!(args.get("service").unwrap(), "ppp");
        assert_eq!(args.get("addr").unwrap(), "10.0.0.1");
    }

    #[test]
    fn rejects_non_author_packet() {
        let mut bytes = authz_packet(1, "x");
        bytes[1] = 1; // authentication, not authorization
        let err = parse_author_packet(&bytes).unwrap_err();
        assert!(err.contains("authorization"), "got: {err}");
    }

    #[test]
    fn rejects_oversize_length() {
        let mut bytes = authz_packet(1, "x=1");
        // rewrite length to claim a 99-byte body, but only supply 3.
        let bogus_len = 99u32.to_be_bytes();
        bytes[10..14].copy_from_slice(&bogus_len);
        let err = parse_author_packet(&bytes).unwrap_err();
        assert!(err.contains("only 3 available"), "got: {err}");
    }
}
