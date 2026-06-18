use std::cell::RefCell;
use std::io;

/// Encoding / decoding abstraction.
pub trait Codec {
    /// Encode raw bytes into a wire representation.
    fn encode(&self, input: &[u8]) -> io::Result<Vec<u8>>;
    /// Decode wire bytes back into raw bytes.
    fn decode(&self, input: &[u8]) -> io::Result<Vec<u8>>;
    /// Return the codec name (e.g. "base64", "hex", "identity").
    fn name(&self) -> &'static str;
}

/// Mock codec that records calls and returns configurable results.
#[derive(Debug, Clone)]
pub struct MockCodecAdapter {
    pub encode_calls: RefCell<usize>,
    pub decode_calls: RefCell<usize>,
    pub encode_result: Vec<u8>,
    pub decode_result: Vec<u8>,
    pub name: &'static str,
}

impl Default for MockCodecAdapter {
    fn default() -> Self {
        Self {
            encode_calls: RefCell::new(0),
            decode_calls: RefCell::new(0),
            encode_result: Vec::new(),
            decode_result: Vec::new(),
            name: "mock",
        }
    }
}

impl MockCodecAdapter {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn with_encode_result(mut self, data: Vec<u8>) -> Self {
        self.encode_result = data;
        self
    }

    pub fn with_decode_result(mut self, data: Vec<u8>) -> Self {
        self.decode_result = data;
        self
    }
}

impl Codec for MockCodecAdapter {
    fn encode(&self, _input: &[u8]) -> io::Result<Vec<u8>> {
        *self.encode_calls.borrow_mut() += 1;
        Ok(self.encode_result.clone())
    }

    fn decode(&self, _input: &[u8]) -> io::Result<Vec<u8>> {
        *self.decode_calls.borrow_mut() += 1;
        Ok(self.decode_result.clone())
    }

    fn name(&self) -> &'static str {
        self.name
    }
}

/// Wire codec that performs real encoding/decoding.
/// This implementation uses a simple hex codec as the wire format.
#[derive(Debug, Clone, Default)]
pub struct WireCodecAdapter;

impl WireCodecAdapter {
    pub fn new() -> Self {
        Self
    }
}

impl Codec for WireCodecAdapter {
    fn encode(&self, input: &[u8]) -> io::Result<Vec<u8>> {
        let mut out = Vec::with_capacity(input.len() * 2);
        for b in input {
            out.push(hex_nibble(b >> 4));
            out.push(hex_nibble(b & 0x0F));
        }
        Ok(out)
    }

    fn decode(&self, input: &[u8]) -> io::Result<Vec<u8>> {
        if input.len() % 2 != 0 {
            return Err(io::Error::new(
                io::ErrorKind::InvalidData,
                "hex input length must be even",
            ));
        }
        let mut out = Vec::with_capacity(input.len() / 2);
        for chunk in input.chunks(2) {
            let hi = parse_hex_nibble(chunk[0])?;
            let lo = parse_hex_nibble(chunk[1])?;
            out.push((hi << 4) | lo);
        }
        Ok(out)
    }

    fn name(&self) -> &'static str {
        "hex"
    }
}

fn hex_nibble(n: u8) -> u8 {
    match n {
        0x0..=0x9 => b'0' + n,
        0xA..=0xF => b'a' + (n - 0xA),
        _ => b'?',
    }
}

fn parse_hex_nibble(c: u8) -> io::Result<u8> {
    match c {
        b'0'..=b'9' => Ok(c - b'0'),
        b'a'..=b'f' => Ok(c - b'a' + 10),
        b'A'..=b'F' => Ok(c - b'A' + 10),
        _ => Err(io::Error::new(
            io::ErrorKind::InvalidData,
            format!("invalid hex character: {c}"),
        )),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn mock_codec_returns_configured_results() {
        let codec = MockCodecAdapter::new()
            .with_encode_result(vec![0x01, 0x02])
            .with_decode_result(vec![0x03, 0x04]);
        assert_eq!(codec.encode(b"any").unwrap(), vec![0x01, 0x02]);
        assert_eq!(codec.decode(b"any").unwrap(), vec![0x03, 0x04]);
        assert_eq!(codec.name(), "mock");
    }

    #[test]
    fn wire_codec_hex_round_trip() {
        let codec = WireCodecAdapter::new();
        let original = b"hello";
        let encoded = codec.encode(original).unwrap();
        assert_eq!(encoded, b"68656c6c6f");
        let decoded = codec.decode(&encoded).unwrap();
        assert_eq!(decoded, original);
    }

    #[test]
    fn wire_codec_hex_decode_uppercase() {
        let codec = WireCodecAdapter::new();
        let decoded = codec.decode(b"48656C6C6F").unwrap();
        assert_eq!(decoded, b"Hello");
    }

    #[test]
    fn wire_codec_hex_decode_invalid_length_fails() {
        let codec = WireCodecAdapter::new();
        let result = codec.decode(b"abc");
        assert!(result.is_err());
    }

    #[test]
    fn wire_codec_hex_decode_invalid_char_fails() {
        let codec = WireCodecAdapter::new();
        let result = codec.decode(b"zz");
        assert!(result.is_err());
    }

    #[test]
    fn wire_codec_encode_empty() {
        let codec = WireCodecAdapter::new();
        let encoded = codec.encode(b"").unwrap();
        assert_eq!(encoded, b"");
    }
}
