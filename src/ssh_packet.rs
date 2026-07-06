// Minimal SSH binary packet parser (RFC 4253 section 6).
//
// Each SSH transport-layer packet is laid out as:
//
//     uint32 packet_length
//     byte   padding_length
//     byte[packet_length - padding_length - 1] payload
//     byte[padding_length] random padding (>= 4 bytes)
//     byte[m] mac (omitted by this module)
//
// The total length on the wire is therefore 4 + packet_length bytes
// (excluding the MAC, which is appended AFTER `packet_length` is
// consumed and is not part of the packet for parsing purposes).
//
// The `packet_length` field counts everything that follows it:
// padding_length byte + payload + padding. The minimum legal
// packet_length is 16 (a 1-byte payload + 4-byte minimum padding +
// padding_length byte) when no MAC is in use, and the maximum is
// 2^32 - 1. In practice, implementations cap it at 35000 bytes.
//
// We do NOT perform MAC verification — this is a structural parser
// only. Callers that need authenticated transport should layer a
// MAC check (hmac-sha1 / hmac-sha2) on top of the parsed packet.

/// A parsed SSH packet (without MAC).
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Packet {
    /// The packet payload (post-decryption in real use; here, raw bytes).
    pub payload: Vec<u8>,
    /// Number of padding bytes that followed the payload in the source.
    pub padding_len: u8,
}

/// Minimum legal `packet_length` value (1-byte payload + 4-byte min padding +
/// 1-byte padding_length) = 6. We require at least 5 to leave room for the
/// 4 mandatory padding bytes plus the 1-byte padding_length field.
const MIN_PACKET_LENGTH: u32 = 5;

/// Maximum packet length we'll accept. RFC 4253 leaves this open; we use
/// 256 KiB which is a common practical limit.
const MAX_PACKET_LENGTH: u32 = 256 * 1024;

/// Parse a complete SSH packet (without MAC) from the input buffer.
///
/// The input must contain at least 4 + packet_length bytes (i.e. the
/// packet_length field plus everything it counts). Returns the payload
/// and the recorded padding length.
///
/// Errors:
///
///   - input shorter than 4 bytes (cannot read packet_length)
///   - packet_length outside [MIN_PACKET_LENGTH, MAX_PACKET_LENGTH]
///   - padding_length larger than packet_length - 1 (no room for payload)
///   - padding_length < 4 (RFC 4253 requires >= 4)
///   - input shorter than 4 + packet_length bytes
pub fn parse(input: &[u8]) -> Result<Packet, String> {
    if input.len() < 4 {
        return Err(format!(
            "input too short for packet_length: {} < 4",
            input.len()
        ));
    }

    // packet_length is big-endian uint32.
    let packet_length = u32::from_be_bytes([input[0], input[1], input[2], input[3]]);

    if packet_length < MIN_PACKET_LENGTH {
        return Err(format!(
            "packet_length too small: {} < {}",
            packet_length, MIN_PACKET_LENGTH
        ));
    }
    if packet_length > MAX_PACKET_LENGTH {
        return Err(format!(
            "packet_length too large: {} > {}",
            packet_length, MAX_PACKET_LENGTH
        ));
    }

    // Need the entire packet present in the input.
    let total = (4u64 + packet_length as u64) as usize;
    if input.len() < total {
        return Err(format!(
            "truncated packet: have {} bytes, need {}",
            input.len(),
            total
        ));
    }

    let padding_length = input[4];

    // The payload size is packet_length - padding_length - 1 (the -1
    // accounts for the padding_length byte itself).
    if (padding_length as u32) + 1 > packet_length {
        return Err(format!(
            "padding_length {} too large for packet_length {}",
            padding_length, packet_length
        ));
    }
    if padding_length < 4 {
        return Err(format!(
            "padding_length {} < 4 (RFC 4253 minimum)",
            padding_length
        ));
    }

    let payload_len = (packet_length - padding_length as u32 - 1) as usize;
    let payload = input[5..5 + payload_len].to_vec();
    Ok(Packet {
        payload,
        padding_len: padding_length,
    })
}

/// Build a packet with random padding that aligns the total length
/// (4-byte length field + packet_length bytes) to `block_size`.
///
/// The padding is generated from a simple LCG seeded with a constant,
/// so the output is deterministic across calls — fine for test
/// fixtures, NOT suitable for a real SSH transport (where the padding
/// must come from a CSPRNG to prevent traffic-analysis side channels).
///
/// Errors:
///
///   - `block_size` is 0 (would cause division by zero in alignment)
///   - the resulting `packet_length` would exceed MAX_PACKET_LENGTH
pub fn build(payload: &[u8], block_size: u8) -> Result<Vec<u8>, String> {
    if block_size == 0 {
        return Err("block_size must be non-zero".into());
    }
    if payload.is_empty() {
        return Err("payload must be non-empty".into());
    }

    // The on-wire frame is 4 bytes of length + packet_length bytes of
    // body. We align the on-wire total to block_size so the cipher
    // (AES etc.) sees a multiple of its block size on the wire, which
    // is what OpenSSH does. This is equivalent to: with
    //   body = padding_length_byte + payload + padding
    // require (4 + body) % block_size == 0 and padding >= 4.
    let bs = block_size as usize;
    let body_fixed = 1 + payload.len();
    let on_wire_fixed = 4 + body_fixed;
    let rem = on_wire_fixed % bs;
    // Smallest p >= 0 with (on_wire_fixed + p) % bs == 0.
    let p0 = if rem == 0 { 0 } else { bs - rem };
    // If p0 < 4, the minimum padding rule forces us to round up by one
    // full block.
    let padding = if p0 < 4 { p0 + bs } else { p0 };
    let packet_length = (body_fixed + padding) as u32;
    if packet_length > MAX_PACKET_LENGTH {
        return Err(format!(
            "packet_length {} > {}",
            packet_length, MAX_PACKET_LENGTH
        ));
    }

    // Deterministic LCG for padding bytes.
    let mut state: u32 = 0x9E3779B9;
    let mut next_byte = || -> u8 {
        state = state
            .wrapping_mul(1664525)
            .wrapping_add(1013904223);
        (state >> 16) as u8
    };

    let mut out = Vec::with_capacity(4 + packet_length as usize);
    out.extend_from_slice(&packet_length.to_be_bytes());
    out.push(padding as u8);
    out.extend_from_slice(payload);
    for _ in 0..padding {
        out.push(next_byte());
    }
    Ok(out)
}

#[cfg(test)]
mod tests {
    use super::*;

    // ---------- parse tests ----------

    #[test]
    fn parse_known_packet() {
        // Hand-built packet:
        //   packet_length = 1 + 5 + 4 = 10
        //   padding_length = 4
        //   payload = b"hello" (5 bytes)
        //   padding = [0xAA, 0xBB, 0xCC, 0xDD]
        let mut buf = Vec::new();
        buf.extend_from_slice(&10u32.to_be_bytes());
        buf.push(4); // padding_length
        buf.extend_from_slice(b"hello");
        buf.extend_from_slice(&[0xAA, 0xBB, 0xCC, 0xDD]);

        let p = parse(&buf).expect("parse");
        assert_eq!(p.payload, b"hello");
        assert_eq!(p.padding_len, 4);
    }

    #[test]
    fn parse_handles_exact_4_padding() {
        // Smallest legal payload: 1 byte + 4 padding = 6 total.
        let mut buf = Vec::new();
        buf.extend_from_slice(&6u32.to_be_bytes());
        buf.push(4);
        buf.push(0x42);
        buf.extend_from_slice(&[1, 2, 3, 4]);

        let p = parse(&buf).expect("parse");
        assert_eq!(p.payload, &[0x42]);
        assert_eq!(p.padding_len, 4);
    }

    #[test]
    fn parse_rejects_truncated_length_field() {
        let buf = [0u8, 0, 1]; // 3 bytes — can't even read packet_length
        let err = parse(&buf).expect_err("should reject");
        assert!(err.contains("too short for packet_length"), "got: {}", err);
    }

    #[test]
    fn parse_rejects_length_mismatch() {
        // packet_length = 100, but actual input is only 4+10 = 14 bytes
        // so the rest of the 100-byte body is missing.
        let mut buf = Vec::new();
        buf.extend_from_slice(&100u32.to_be_bytes());
        buf.push(4);
        buf.extend_from_slice(b"hi");
        buf.extend_from_slice(&[0, 0, 0, 0]);

        let err = parse(&buf).expect_err("should reject");
        assert!(err.contains("truncated"), "got: {}", err);
    }

    #[test]
    fn parse_rejects_padding_overflow() {
        // packet_length = 5, padding_length = 5 -> 1 (padding_length byte)
        // + 5 (padding) = 6 > 5, so no room for payload.
        let mut buf = Vec::new();
        buf.extend_from_slice(&5u32.to_be_bytes());
        buf.push(5);
        buf.extend_from_slice(&[1, 2, 3, 4]);

        let err = parse(&buf).expect_err("should reject");
        assert!(err.contains("padding_length"), "got: {}", err);
    }

    #[test]
    fn parse_rejects_padding_below_minimum() {
        // padding_length = 3 violates the RFC 4253 minimum of 4.
        // Use packet_length = 1 (padding_length byte) + 3 (padding) = 4
        // is below MIN_PACKET_LENGTH=5 anyway, so bump to 5 with
        // padding=3: 1 + 1 (payload) + 3 (padding) = 5, payload = "x".
        let mut buf = Vec::new();
        buf.extend_from_slice(&5u32.to_be_bytes());
        buf.push(3);
        buf.extend_from_slice(&[0x78, 1, 2, 3]);

        let err = parse(&buf).expect_err("should reject");
        assert!(err.contains("< 4"), "got: {}", err);
    }

    // ---------- build tests ----------

    #[test]
    fn build_creates_valid_packet() {
        let packet = build(b"hello", 8).expect("build");
        // Total on-wire size must be a multiple of 8.
        assert_eq!(packet.len() % 8, 0);
        // Parse should round-trip.
        let p = parse(&packet).expect("parse");
        assert_eq!(p.payload, b"hello");
    }

    #[test]
    fn build_alignment_math() {
        // 4-byte length + 1-byte padding_length + 5-byte payload = 10
        // -> need 6 padding to reach on-wire 16, a multiple of 8.
        let packet = build(b"hello", 8).expect("build");
        let p = parse(&packet).expect("parse");
        assert_eq!(p.payload, b"hello");
        assert_eq!(p.padding_len, 6);
        assert_eq!(packet.len(), 16);
    }

    #[test]
    fn build_rejects_zero_block_size() {
        let err = build(b"x", 0).expect_err("should reject");
        assert!(err.contains("non-zero"), "got: {}", err);
    }

    #[test]
    fn build_rejects_empty_payload() {
        let err = build(b"", 8).expect_err("should reject");
        assert!(err.contains("non-empty"), "got: {}", err);
    }

    // ---------- round-trip ----------

    #[test]
    fn round_trip_various_block_sizes() {
        for &bs in &[4u8, 8, 16, 32, 64] {
            for payload_len in &[1usize, 3, 7, 15, 31] {
                let payload: Vec<u8> =
                    (0..*payload_len).map(|i| (i as u8).wrapping_mul(37)).collect();
                let packet = build(&payload, bs).expect("build");
                assert_eq!(packet.len() % bs as usize, 0);
                let p = parse(&packet).expect("parse");
                assert_eq!(p.payload, payload, "bs={} len={}", bs, payload_len);
            }
        }
    }
}
