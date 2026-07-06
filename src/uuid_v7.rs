//! Minimal UUID v7 generator and parser (RFC 9562 §5.7).
//!
//! UUID v7 is a time-ordered 128-bit identifier. Its layout, when written as
//! 16 raw bytes, is:
//!
//! ```text
//!  0                   1                   2                   3
//!  0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1
//! +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
//! |                           unix_ts_ms                          |
//! +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
//! |          unix_ts_ms           |  ver  |       rand_a          |
//! +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
//! |var|                        rand_b                             |
//! +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
//! |                            rand_b                             |
//! +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
//! ```
//!
//! - Bits `[0..48)` (bytes 0..6): 48-bit Unix timestamp in milliseconds.
//! - Bits `[48..52)` (high nibble of byte 6): version, must equal `0b0111` (7).
//! - Bits `[52..64)` (low nibble of byte 6 + byte 7): 12 bits of `rand_a`.
//! - Bits `[64..66)` (top two bits of byte 8): variant, must equal `0b10`.
//! - Bits `[66..128)` (bytes 8..16, lower 62 bits): 62 bits of `rand_b`.
//!
//! This module is intentionally zero-allocation and uses an injectable
//! byte-source (`FnMut() -> u8`) for `rand` so tests can be fully
//! deterministic without bringing in a heavyweight RNG crate.

/// Sentinel returned by [`parse`] when the UUID does not have version 7 set.
pub const ERR_NOT_V7: &str = "uuid is not a version 7 UUID";

/// Generate a UUID v7 byte array from a Unix-ms timestamp and a random source.
///
/// `timestamp_ms` is the 48-bit Unix epoch in milliseconds. Bits beyond bit
/// 47 are silently truncated. The random source is invoked exactly 10 times,
/// in this order: `rand_a` (byte 7), `rand_b` (bytes 8-15 inclusive of byte 8
/// but excluding its top two bits which are overwritten with the variant
/// field, plus bytes 9-15). The high nibble of byte 6 is overwritten with the
/// version (`7`), and the top two bits of byte 8 are overwritten with the
/// variant (`0b10`).
///
/// # Examples
///
/// ```
/// use crate::uuid_v7::{generate, is_v7};
///
/// let mut byte = 0u8;
/// let mut src = || -> u8 { byte = byte.wrapping_add(0xA5); byte };
/// let bytes = generate(1_700_000_000_000, &mut src);
/// assert!(is_v7(&bytes));
/// ```
pub fn generate(timestamp_ms: u64, rand: &mut impl FnMut() -> u8) -> [u8; 16] {
    let mut out = [0u8; 16];

    // Bytes 0..6: 48-bit big-endian unix_ts_ms.
    let ts = timestamp_ms & 0x0000_FFFF_FFFF_FFFFu64;
    out[0] = ((ts >> 40) & 0xFF) as u8;
    out[1] = ((ts >> 32) & 0xFF) as u8;
    out[2] = ((ts >> 24) & 0xFF) as u8;
    out[3] = ((ts >> 16) & 0xFF) as u8;
    out[4] = ((ts >> 8) & 0xFF) as u8;
    out[5] = (ts & 0xFF) as u8;

    // High nibble of byte 6 -> version (7).
    let mut byte6: u8 = 0x70;
    // Low nibble of byte 6 is the top 4 bits of rand_a.
    byte6 |= rand() & 0x0F;
    out[6] = byte6;

    // Byte 7: bottom 8 bits of rand_a.
    out[7] = rand();

    // Byte 8: variant (top two bits = 0b10) + top 6 bits of rand_b.
    let mut byte8: u8 = 0x80; // variant 0b10 -> top two bits set to 10.
    byte8 |= rand() & 0x3F;
    out[8] = byte8;

    // Bytes 9..16: rand_b (62 bits total, lower 56 fit in bytes 9..15).
    for slot in out.iter_mut().skip(9) {
        *slot = rand();
    }

    out
}

/// Parse a UUID v7 and return its timestamp + 10-byte random payload.
///
/// On success, returns `(timestamp_ms, random_bytes)` where `random_bytes`
/// is exactly the 10 bytes following the 48-bit timestamp field (i.e. bytes
/// 6..16 of the raw UUID). On failure, returns an error string explaining
/// why the input is not a valid UUID v7.
///
/// # Examples
///
/// ```
/// use crate::uuid_v7::{generate, parse};
///
/// let mut state = 0u8;
/// let mut src = || -> u8 { state = state.wrapping_add(7); state };
/// let bytes = generate(0x0123_4567_89AB, &mut src);
/// let (ts, rand) = parse(&bytes).unwrap();
/// assert_eq!(ts, 0x0123_4567_89AB);
/// assert_eq!(rand.len(), 10);
/// ```
pub fn parse(uuid: &[u8; 16]) -> Result<(u64, [u8; 10]), String> {
    if !is_v7(uuid) {
        return Err(ERR_NOT_V7.to_string());
    }

    // Reconstruct timestamp_ms from the first 6 bytes (big-endian u48).
    let ts: u64 = (uuid[0] as u64) << 40
        | (uuid[1] as u64) << 32
        | (uuid[2] as u64) << 24
        | (uuid[3] as u64) << 16
        | (uuid[4] as u64) << 8
        | (uuid[5] as u64);

    let mut random = [0u8; 10];
    random.copy_from_slice(&uuid[6..16]);

    Ok((ts, random))
}

/// Extract the embedded Unix-ms timestamp from a UUID v7 byte array.
///
/// Does NOT validate the version or variant bits — it simply decodes the
/// first 6 bytes as a 48-bit big-endian integer. Use [`is_v7`] first if you
/// need to reject non-v7 UUIDs.
///
/// # Examples
///
/// ```
/// use crate::uuid_v7::{generate, timestamp_ms};
///
/// let mut s = 0u8;
/// let mut src = || -> u8 { s = s.wrapping_add(1); s };
/// let bytes = generate(42, &mut src);
/// assert_eq!(timestamp_ms(&bytes), 42);
/// ```
pub fn timestamp_ms(uuid: &[u8; 16]) -> u64 {
    (uuid[0] as u64) << 40
        | (uuid[1] as u64) << 32
        | (uuid[2] as u64) << 24
        | (uuid[3] as u64) << 16
        | (uuid[4] as u64) << 8
        | (uuid[5] as u64)
}

/// Return `true` iff the UUID byte array has version `7` and variant `0b10`.
///
/// # Examples
///
/// ```
/// use crate::uuid_v7::{generate, is_v7};
///
/// let mut s = 0u8;
/// let mut src = || -> u8 { s = s.wrapping_add(1); s };
/// let bytes = generate(1, &mut src);
/// assert!(is_v7(&bytes));
///
/// let mut bad = bytes;
/// bad[6] = 0x10; // -> version 1, not 7
/// assert!(!is_v7(&bad));
/// ```
pub fn is_v7(uuid: &[u8; 16]) -> bool {
    // Version nibble = high 4 bits of byte 6 -> must equal 0b0111.
    if (uuid[6] >> 4) != 0x7 {
        return false;
    }
    // Variant byte 8: top two bits must equal 0b10.
    if (uuid[8] >> 6) != 0b10 {
        return false;
    }
    true
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Deterministic linear-congruential RNG used in tests for reproducibility.
    struct TestRng {
        state: u32,
    }
    impl TestRng {
        fn new(seed: u32) -> Self {
            Self { state: seed }
        }
        fn next_byte(&mut self) -> u8 {
            // Numerical Recipes LCG constants; deterministic and well-distributed.
            self.state = self.state
                .wrapping_mul(1_664_525)
                .wrapping_add(1_013_904_223);
            (self.state >> 16) as u8
        }
    }

    // 1. Round-trip generate + parse yields the timestamp and 10 random bytes.
    #[test]
    fn round_trip_generate_parse() {
        let mut rng = TestRng::new(1);
        let timestamp = 1_700_000_000_123u64;
        let bytes = generate(timestamp, &mut || rng.next_byte());
        let (ts, rand) = parse(&bytes).unwrap();
        assert_eq!(ts, timestamp);
        assert_eq!(rand.len(), 10);
    }

    // 2. timestamp_ms extraction is independent of version/variant bits.
    #[test]
    fn timestamp_ms_extraction() {
        let mut rng = TestRng::new(7);
        let bytes = generate(0xDEAD_BEEF_CAFEu64, &mut || rng.next_byte());
        assert_eq!(timestamp_ms(&bytes), 0xDEAD_BEEF_CAFE);
    }

    // 3. Version nibble is always 7 in any generated UUID.
    #[test]
    fn version_bit_is_seven() {
        let mut rng = TestRng::new(42);
        for ts in [0u64, 1, 1_000, 1_700_000_000_000, u64::MAX] {
            let bytes = generate(ts, &mut || rng.next_byte());
            assert_eq!(bytes[6] >> 4, 0x7, "version nibble should be 0x7");
            assert!(is_v7(&bytes));
        }
    }

    // 4. Variant bits are always 0b10 (top two bits of byte 8).
    #[test]
    fn variant_bit_is_ten() {
        let mut rng = TestRng::new(99);
        for ts in [0u64, 1, 1_000, 1_700_000_000_000] {
            let bytes = generate(ts, &mut || rng.next_byte());
            assert_eq!(bytes[8] >> 6, 0b10, "variant top two bits should be 0b10");
        }
    }

    // 5. Fixing both timestamp and RNG yields a fully deterministic UUID.
    #[test]
    fn fixed_timestamp_and_rng_is_deterministic() {
        let bytes_a = {
            let mut rng = TestRng::new(123);
            generate(1_700_000_000_000, &mut || rng.next_byte())
        };
        let bytes_b = {
            let mut rng = TestRng::new(123);
            generate(1_700_000_000_000, &mut || rng.next_byte())
        };
        assert_eq!(bytes_a, bytes_b);
    }

    // 6. Distinct RNG streams produce distinct random payloads.
    #[test]
    fn random_payload_diffs_across_calls() {
        let bytes_a = {
            let mut rng = TestRng::new(1);
            generate(1_700_000_000_000, &mut || rng.next_byte())
        };
        let bytes_b = {
            let mut rng = TestRng::new(2);
            generate(1_700_000_000_000, &mut || rng.next_byte())
        };
        // Same timestamp -> first 6 bytes match.
        assert_eq!(&bytes_a[0..6], &bytes_b[0..6]);
        // Random payload differs.
        assert_ne!(&bytes_a[6..16], &bytes_b[6..16]);
    }

    // 7. UUIDs generated with monotonically increasing timestamps sort earlier.
    #[test]
    fn monotonic_increasing_timestamps_sort() {
        let mut rng1 = TestRng::new(1);
        let mut rng2 = TestRng::new(1);
        let mut rng3 = TestRng::new(1);

        let a = generate(1_000, &mut || rng1.next_byte());
        let b = generate(2_000, &mut || rng2.next_byte());
        let c = generate(3_000, &mut || rng3.next_byte());

        // Compare first 6 bytes as a single u48 little-endian-ish sequence
        // by treating the byte array as a lexicographic key.
        let ka: Vec<u8> = a[0..6].to_vec();
        let kb: Vec<u8> = b[0..6].to_vec();
        let kc: Vec<u8> = c[0..6].to_vec();
        assert!(ka < kb);
        assert!(kb < kc);
    }

    // 8. parse rejects a UUID whose version nibble is not 7.
    #[test]
    fn parse_rejects_non_v7() {
        let mut rng = TestRng::new(5);
        let mut bytes = generate(42, &mut || rng.next_byte());
        bytes[6] = 0x10; // version 1, not 7
        let err = parse(&bytes).unwrap_err();
        assert!(err.contains("version 7"), "error message: {err}");
        assert!(!is_v7(&bytes));
    }

    // 9. parse rejects a UUID whose variant bits are not 0b10.
    #[test]
    fn parse_rejects_bad_variant() {
        let mut rng = TestRng::new(6);
        let mut bytes = generate(42, &mut || rng.next_byte());
        // Clear the variant bits so the top two bits of byte 8 become 00.
        bytes[8] &= 0b0011_1111;
        let err = parse(&bytes).unwrap_err();
        assert!(err.contains("version 7"), "error message: {err}");
        assert!(!is_v7(&bytes));
    }

    // 10. Timestamp bits beyond bit 47 are masked on generation.
    #[test]
    fn timestamp_bits_above_48_masked() {
        let mut rng = TestRng::new(11);
        // u64::MAX has bits above 48 set; they must be silently truncated.
        let bytes = generate(u64::MAX, &mut || rng.next_byte());
        let ts = timestamp_ms(&bytes);
        // The encoded timestamp is bounded to its low 48 bits, all 1s.
        assert_eq!(ts, 0x0000_FFFF_FFFF_FFFFu64);
    }
}
