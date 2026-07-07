// Minimal FLAC metadata block parser.
// Spec: https://xiph.org/flac/format.html#metadata_block
//
// Block header layout (4 bytes, big-endian):
//   bit 0 (MSB)    : is_last
//   bits 1-7       : block_type (7 bits)
//   bits 8-31      : length in bytes (24 bits, big-endian)
//
// Block types:
//   0  STREAMINFO    (34 bytes payload)
//   1  PADDING
//   2  APPLICATION   (4-byte registered application ID + payload)
//   3  SEEKTABLE
//   4  VORBIS_COMMENT
//   5  CUESHEET
//   6  PICTURE
//   7-126 reserved
//   127 invalid
//
// STREAMINFO payload (34 bytes total):
//   16 bits  minimum block size (samples)
//   16 bits  maximum block size (samples)
//   24 bits  minimum frame size (bytes)
//   24 bits  maximum frame size (bytes)
//   20 bits  sample rate (Hz)
//   3  bits  number of channels - 1
//   5  bits  bits per sample - 1
//   36 bits  total samples in stream
//   128 bits MD5 signature (unencoded)
//
// Total: 16+16+24+24+20+3+5+36+128 = 272 bits = 34 bytes.

pub const BLOCK_TYPE_STREAMINFO: u8 = 0;
pub const BLOCK_TYPE_PADDING: u8 = 1;
pub const BLOCK_TYPE_APPLICATION: u8 = 2;
pub const BLOCK_TYPE_SEEKTABLE: u8 = 3;
pub const BLOCK_TYPE_VORBIS_COMMENT: u8 = 4;
pub const BLOCK_TYPE_CUESHEET: u8 = 5;
pub const BLOCK_TYPE_PICTURE: u8 = 6;
pub const BLOCK_TYPE_RESERVED_MIN: u8 = 7;
pub const BLOCK_TYPE_RESERVED_MAX: u8 = 126;
pub const BLOCK_TYPE_INVALID: u8 = 127;

pub const HEADER_SIZE: usize = 4;
pub const STREAMINFO_SIZE: usize = 34;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct MetaBlock {
    pub is_last: bool,
    pub block_type: u8,
    pub data: Vec<u8>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct StreamInfo {
    pub min_block_size: u16,
    pub max_block_size: u16,
    pub min_frame_size: u32, // 24 bits stored; we widen to u32
    pub max_frame_size: u32, // 24 bits stored; we widen to u32
    pub sample_rate: u32,    // 20 bits stored
    pub channels: u8,        // stored as N-1
    pub bits_per_sample: u8, // stored as N-1
    pub total_samples: u64,  // 36 bits stored; widened to u64
    pub md5: [u8; 16],
}

/// Parse a sequence of FLAC metadata blocks from `input`. The parser walks the
/// input byte-by-byte until the is_last flag is set or until input is
/// exhausted. Stops cleanly at the end of the last block (does NOT consume any
/// audio frame bytes that follow).
pub fn parse_blocks(input: &[u8]) -> Result<Vec<MetaBlock>, String> {
    let mut out = Vec::new();
    let mut offset = 0usize;

    loop {
        if offset + HEADER_SIZE > input.len() {
            return Err(format!(
                "truncated FLAC header at offset {} (have {} bytes)",
                offset,
                input.len()
            ));
        }
        let header = &input[offset..offset + HEADER_SIZE];
        let header_u32 = u32::from_be_bytes([header[0], header[1], header[2], header[3]]);
        let is_last = (header_u32 & 0x8000_0000) != 0;
        let block_type = ((header_u32 >> 24) & 0x7F) as u8;
        let length = (header_u32 & 0x00FF_FFFF) as usize;

        if block_type == BLOCK_TYPE_INVALID {
            return Err(format!("invalid block type 127 at offset {}", offset));
        }
        if block_type >= BLOCK_TYPE_RESERVED_MIN && block_type <= BLOCK_TYPE_RESERVED_MAX {
            return Err(format!(
                "reserved block type {} at offset {}",
                block_type, offset
            ));
        }

        let data_start = offset + HEADER_SIZE;
        let data_end = data_start
            .checked_add(length)
            .ok_or_else(|| format!("block length overflow at offset {}", offset))?;
        if data_end > input.len() {
            return Err(format!(
                "block payload overflow at offset {} (need {} bytes, have {})",
                offset,
                data_end,
                input.len()
            ));
        }
        let data = input[data_start..data_end].to_vec();

        out.push(MetaBlock {
            is_last,
            block_type,
            data,
        });
        offset = data_end;

        if is_last {
            break;
        }
    }

    Ok(out)
}

/// Parse a STREAMINFO payload (exactly 34 bytes).
pub fn parse_streaminfo(data: &[u8]) -> Result<StreamInfo, String> {
    if data.len() != STREAMINFO_SIZE {
        return Err(format!(
            "STREAMINFO must be {} bytes, got {}",
            STREAMINFO_SIZE,
            data.len()
        ));
    }
    let min_block_size = u16::from_be_bytes([data[0], data[1]]);
    let max_block_size = u16::from_be_bytes([data[2], data[3]]);
    // bytes 4..=6 are min_frame_size (24 bits, big-endian)
    let min_frame_size = ((data[4] as u32) << 16) | ((data[5] as u32) << 8) | (data[6] as u32);
    // bytes 7..=9 are max_frame_size (24 bits, big-endian)
    let max_frame_size = ((data[7] as u32) << 16) | ((data[8] as u32) << 8) | (data[9] as u32);

    // bytes 10..=13 hold sample_rate(20) | channels-1(3) | bps-1(5) | total_samples_high(4)
    let packed = u32::from_be_bytes([data[10], data[11], data[12], data[13]]);
    let sample_rate = (packed >> 12) & 0x000F_FFFF;
    let channels = (((packed >> 9) & 0x07) as u8) + 1;
    let bits_per_sample = (((packed >> 4) & 0x1F) as u8) + 1;
    let total_high = ((packed & 0x0F) as u64) << 32;
    // bytes 14..=17 are total_samples low 32 bits
    let total_low = u32::from_be_bytes([data[14], data[15], data[16], data[17]]) as u64;
    let total_samples = total_high | total_low;

    // bytes 18..=33 are the MD5 signature
    let mut md5 = [0u8; 16];
    md5.copy_from_slice(&data[18..34]);

    Ok(StreamInfo {
        min_block_size,
        max_block_size,
        min_frame_size,
        max_frame_size,
        sample_rate,
        channels,
        bits_per_sample,
        total_samples,
        md5,
    })
}

/// Build a 4-byte FLAC metadata block header.
pub fn build_header(is_last: bool, block_type: u8, length: usize) -> [u8; HEADER_SIZE] {
    let length_u32 = (length & 0x00FF_FFFF) as u32;
    let last_bit: u32 = if is_last { 0x8000_0000 } else { 0 };
    let type_bits: u32 = ((block_type as u32) & 0x7F) << 24;
    let header_u32 = last_bit | type_bits | length_u32;
    header_u32.to_be_bytes()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn streaminfo_bytes() -> Vec<u8> {
        // 34 bytes: min/max block 4096; min/max frame 0; rate 44100; 2 ch; 16 bps;
        // 0 total samples; 16 zero bytes md5.
        //
        // Layout (34 bytes):
        //   bytes  0..=1   min_block_size (16)
        //   bytes  2..=3   max_block_size (16)
        //   bytes  4..=6   min_frame_size (24)
        //   bytes  7..=9   max_frame_size (24)
        //   bytes 10..=13  sample_rate(20) | channels-1(3) | bps-1(5) | total_high(4)  (32 bits)
        //   bytes 14..=17  total_samples low 32 bits
        //   bytes 18..=33  md5 (128 bits)
        let mut v = Vec::new();
        v.extend_from_slice(&4096u16.to_be_bytes()); // min block
        v.extend_from_slice(&4096u16.to_be_bytes()); // max block
        v.extend_from_slice(&0u32.to_be_bytes()[1..4]); // min frame 24 bits
        v.extend_from_slice(&0u32.to_be_bytes()[1..4]); // max frame 24 bits
        let mut packed: u32 = 0;
        packed |= (44100u32 & 0x000F_FFFF) << 12; // sample_rate in top 20 bits
        packed |= (1u32 & 0x07) << 9; // channels-1 in next 3 bits
        packed |= (15u32 & 0x1F) << 4; // bps-1 in next 5 bits
        // total_samples high 4 bits = 0
        v.extend_from_slice(&packed.to_be_bytes()); // 4 bytes
        v.extend_from_slice(&0u32.to_be_bytes()); // total_low 4 bytes
        v.extend_from_slice(&[0u8; 16]); // md5
        assert_eq!(v.len(), 34);
        v
    }

    #[test]
    fn parse_empty_input_errors() {
        assert!(parse_blocks(&[]).is_err());
    }

    #[test]
    fn parse_truncated_header_errors() {
        let bytes = vec![0x80u8, 0x00, 0x00]; // only 3 bytes
        assert!(parse_blocks(&bytes).is_err());
    }

    #[test]
    fn parse_single_padding_block() {
        // is_last=1, type=1 (PADDING), length=4, data=[0,0,0,0]
        let mut bytes = vec![0x81, 0x00, 0x00, 0x04, 0, 0, 0, 0];
        let blocks = parse_blocks(&bytes).unwrap();
        assert_eq!(blocks.len(), 1);
        assert!(blocks[0].is_last);
        assert_eq!(blocks[0].block_type, BLOCK_TYPE_PADDING);
        assert_eq!(blocks[0].data, vec![0, 0, 0, 0]);

        // Without is_last, parser should error out at EOF after the block.
        bytes[0] = 0x01; // not last
        assert!(parse_blocks(&bytes).is_err());
    }

    #[test]
    fn parse_multiple_blocks_chains() {
        // Block 1: STREAMINFO is_last=0, length=34
        // Block 2: PADDING is_last=1, length=2
        let mut bytes = Vec::new();
        bytes.extend_from_slice(&build_header(false, BLOCK_TYPE_STREAMINFO, 34));
        bytes.extend_from_slice(&streaminfo_bytes());
        bytes.extend_from_slice(&build_header(true, BLOCK_TYPE_PADDING, 2));
        bytes.extend_from_slice(&[0xAA, 0xBB]);

        let blocks = parse_blocks(&bytes).unwrap();
        assert_eq!(blocks.len(), 2);
        assert_eq!(blocks[0].block_type, BLOCK_TYPE_STREAMINFO);
        assert!(!blocks[0].is_last);
        assert_eq!(blocks[0].data.len(), 34);
        assert_eq!(blocks[1].block_type, BLOCK_TYPE_PADDING);
        assert!(blocks[1].is_last);
        assert_eq!(blocks[1].data, vec![0xAA, 0xBB]);
    }

    #[test]
    fn parse_streaminfo_decodes_fields() {
        let info = parse_streaminfo(&streaminfo_bytes()).unwrap();
        assert_eq!(info.min_block_size, 4096);
        assert_eq!(info.max_block_size, 4096);
        assert_eq!(info.min_frame_size, 0);
        assert_eq!(info.max_frame_size, 0);
        assert_eq!(info.sample_rate, 44100);
        assert_eq!(info.channels, 2);
        assert_eq!(info.bits_per_sample, 16);
        assert_eq!(info.total_samples, 0);
        assert_eq!(info.md5, [0u8; 16]);
    }

    #[test]
    fn parse_streaminfo_total_samples_36bit() {
        // total_samples = (4 high bits = 5) << 32 | 0xDEADBEEF = 0x5_DEADBEEF.
        // Bytes 10..=13 carry packed (sample_rate|ch|bps|total_high). The
        // low nibble of byte 13 is total_high.
        let mut bytes = streaminfo_bytes();
        bytes[13] = (bytes[13] & 0xF0) | 0x05;
        // bytes 14..=17 are total_low (32 bits, big-endian).
        bytes[14] = 0xDE;
        bytes[15] = 0xAD;
        bytes[16] = 0xBE;
        bytes[17] = 0xEF;
        let info = parse_streaminfo(&bytes).unwrap();
        assert_eq!(info.total_samples, 0x5_DEAD_BEEF);
    }

    #[test]
    fn parse_streaminfo_wrong_size_errors() {
        assert!(parse_streaminfo(&[0u8; 10]).is_err());
        assert!(parse_streaminfo(&[0u8; 33]).is_err());
        assert!(parse_streaminfo(&[0u8; 35]).is_err());
    }

    #[test]
    fn parse_reserved_block_type_errors() {
        let mut bytes = build_header(true, 7, 0).to_vec();
        assert!(parse_blocks(&bytes).is_err());
        bytes = build_header(true, 126, 0).to_vec();
        assert!(parse_blocks(&bytes).is_err());
    }

    #[test]
    fn parse_invalid_block_type_127_errors() {
        let bytes = build_header(true, 127, 0).to_vec();
        assert!(parse_blocks(&bytes).is_err());
    }

    #[test]
    fn parse_truncated_payload_errors() {
        // Header claims 10 bytes of payload but only 4 follow.
        let mut bytes = build_header(true, BLOCK_TYPE_PADDING, 10).to_vec();
        bytes.extend_from_slice(&[0u8; 4]);
        assert!(parse_blocks(&bytes).is_err());
    }

    #[test]
    fn build_header_round_trip() {
        let h = build_header(true, BLOCK_TYPE_VORBIS_COMMENT, 0x001234);
        let u = u32::from_be_bytes(h);
        assert_eq!(u & 0x8000_0000, 0x8000_0000);
        assert_eq!((u >> 24) & 0x7F, BLOCK_TYPE_VORBIS_COMMENT as u32);
        assert_eq!(u & 0x00FF_FFFF, 0x001234);

        let h2 = build_header(false, BLOCK_TYPE_PICTURE, 0);
        let u2 = u32::from_be_bytes(h2);
        assert_eq!(u2 & 0x8000_0000, 0);
        assert_eq!((u2 >> 24) & 0x7F, BLOCK_TYPE_PICTURE as u32);
    }

    #[test]
    fn parse_streaminfo_known_example() {
        // 48 kHz, 1 ch, 24 bps, total = 48000 samples, md5 = 0x01..0x10.
        let mut bytes = Vec::new();
        bytes.extend_from_slice(&4608u16.to_be_bytes()); // min block
        bytes.extend_from_slice(&4608u16.to_be_bytes()); // max block
        bytes.extend_from_slice(&0u32.to_be_bytes()[1..4]); // min frame 24b
        bytes.extend_from_slice(&0u32.to_be_bytes()[1..4]); // max frame 24b
        let mut packed: u32 = 0;
        packed |= (48000u32 & 0x000F_FFFF) << 12; // sample_rate (top 20)
        packed |= (0u32 & 0x07) << 9; // channels-1
        packed |= (23u32 & 0x1F) << 4; // bps-1
        // total_samples high nibble = 0 (48000 fits in 36 bits)
        bytes.extend_from_slice(&packed.to_be_bytes()); // bytes 10..=13
        bytes.extend_from_slice(&48000u32.to_be_bytes()); // bytes 14..=17 total_low
        for i in 1..=16u8 {
            bytes.push(i);
        }
        let info = parse_streaminfo(&bytes).unwrap();
        assert_eq!(info.sample_rate, 48000);
        assert_eq!(info.channels, 1);
        assert_eq!(info.bits_per_sample, 24);
        assert_eq!(info.total_samples, 48000);
        assert_eq!(info.md5[0], 1);
        assert_eq!(info.md5[15], 16);
    }
}