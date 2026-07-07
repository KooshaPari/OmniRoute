// Minimal Mach-O header parser (stubs out just enough for test
// harnesses, embedders, and signature tools).
//
// Mach-O is the native executable format on Darwin (and on iOS /
// iPadOS / watchOS / tvOS). The file starts with a fixed header,
// then immediately a Mach-O 64-bit header if `magic == MH_MAGIC_64`,
// otherwise a Mach-O 32-bit header if `magic == MH_CIGAM` (reversed
// endianness) or `MH_MAGIC`.
//
// We do NOT implement load-command parsing, symbol tables, sections,
// or relocation here. The intent is to let a test fixture confirm
// "this blob is a 64-bit little-endian ARM64 Mach-O" without
// pulling in a full object-file parser. For richer parsing use the
// existing `macho_parse` module in the same crate.

/// Recognised Mach-O magic numbers.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Magic {
    /// 32-bit, host endian.
    Magic,
    /// 32-bit, swapped endian.
    Cigam,
    /// 64-bit, host endian.
    Magic64,
    /// 64-bit, swapped endian.
    Cigam64,
    /// Fat/universal magic.
    Fat,
    /// Fat/universal magic (swapped).
    FatCigam,
    /// Unknown magic.
    Unknown(u32),
}

impl Magic {
    fn from_u32(v: u32) -> Self {
        match v {
            0xFEEDFACE => Magic::Magic,
            0xCEFAEDFE => Magic::Cigam,
            0xFEEDFACF => Magic::Magic64,
            0xCFFAEDFE => Magic::Cigam64,
            0xCAFEBABE => Magic::Fat,
            0xBEBAFECA => Magic::FatCigam,
            other => Magic::Unknown(other),
        }
    }
}

/// Whether the Mach-O is 32-bit or 64-bit. `Fat` archives report
/// `None` here because the answer depends on each slice.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum BitWidth {
    ThirtyTwo,
    SixtyFour,
}

/// CPU type (a small subset of `mach/machine.h`).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CpuType {
    /// x86_64 (Intel Mac).
    X86_64,
    /// arm64 (Apple Silicon + iOS device).
    Arm64,
    /// x86 (32-bit, legacy).
    X86,
    /// 32-bit arm.
    Arm,
    /// PowerPC 64-bit (legacy).
    PowerPc64,
    /// PowerPC 32-bit (legacy).
    PowerPc,
    /// Unrecognised CPU type tag.
    Other(u32),
}

impl CpuType {
    fn from_u32(v: u32) -> Self {
        // CPU_TYPE values from <mach/machine.h>. CPU_ARCH_ABI64 (0x01000000)
        // is the high bit-flag that marks a 64-bit CPU.
        const CPU_TYPE_X86: u32 = 7;
        const CPU_TYPE_X86_64: u32 = CPU_TYPE_X86 | 0x01000000;
        const CPU_TYPE_ARM: u32 = 12;
        const CPU_TYPE_ARM64: u32 = CPU_TYPE_ARM | 0x01000000;
        const CPU_TYPE_POWERPC: u32 = 18;
        const CPU_TYPE_POWERPC64: u32 = CPU_TYPE_POWERPC | 0x01000000;
        match v {
            CPU_TYPE_X86 => CpuType::X86,
            CPU_TYPE_X86_64 => CpuType::X86_64,
            CPU_TYPE_ARM => CpuType::Arm,
            CPU_TYPE_ARM64 => CpuType::Arm64,
            CPU_TYPE_POWERPC => CpuType::PowerPc,
            CPU_TYPE_POWERPC64 => CpuType::PowerPc64,
            other => CpuType::Other(other),
        }
    }
}

/// Parsed Mach-O header stub. Captures only the four fields a
/// consumer needs to route the rest of the file: magic, CPU, bit
/// width, and endianness.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct HeaderStub {
    /// Raw magic number.
    pub magic: Magic,
    /// 32 vs 64-bit, or `None` for fat archives.
    pub bits: Option<BitWidth>,
    /// CPU the binary targets.
    pub cpu: CpuType,
    /// `true` if the binary is big-endian on disk.
    pub big_endian: bool,
}

impl HeaderStub {
    /// Parse a header stub from the leading bytes of a Mach-O file.
    ///
    /// `bytes` must contain at least 8 bytes for a 32-bit file or 8
    /// bytes for a 64-bit file (the leading `magic` and `cputype`
    /// fields are read in both cases; the file width is inferred
    /// from the magic).
    pub fn parse(bytes: &[u8]) -> Result<HeaderStub, String> {
        if bytes.len() < 8 {
            return Err(format!("Mach-O header needs >=8 bytes, got {}", bytes.len()));
        }
        let raw = u32::from_le_bytes([bytes[0], bytes[1], bytes[2], bytes[3]]);
        let magic = Magic::from_u32(raw);
        let big_endian = matches!(magic, Magic::Cigam | Magic::Cigam64 | Magic::FatCigam);

        if matches!(magic, Magic::Fat | Magic::FatCigam) {
            // Fat archives contain a header + per-slice Mach-O blobs.
            // We surface the magic but cannot answer `bits` or `cpu`
            // until the caller walks the slice table.
            return Ok(HeaderStub {
                magic,
                bits: None,
                cpu: CpuType::Other(0),
                big_endian,
            });
        }

        let cpu_raw = if big_endian {
            u32::from_be_bytes([bytes[4], bytes[5], bytes[6], bytes[7]])
        } else {
            u32::from_le_bytes([bytes[4], bytes[5], bytes[6], bytes[7]])
        };
        let bits = match magic {
            Magic::Magic | Magic::Cigam => Some(BitWidth::ThirtyTwo),
            Magic::Magic64 | Magic::Cigam64 => Some(BitWidth::SixtyFour),
            _ => None,
        };
        Ok(HeaderStub {
            magic,
            bits,
            cpu: CpuType::from_u32(cpu_raw),
            big_endian,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn le32(v: u32) -> [u8; 4] {
        v.to_le_bytes()
    }
    fn be32(v: u32) -> [u8; 4] {
        v.to_be_bytes()
    }

    #[test]
    fn parses_le_64_arm64() {
        // magic + cputype, other fields zeroed.
        let bytes = [
            le32(0xFEEDFACF),  // MH_MAGIC_64
            le32(0x0100_000C), // CPU_TYPE_ARM64
            0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        ];
        let h = HeaderStub::parse(&bytes).unwrap();
        assert_eq!(h.magic, Magic::Magic64);
        assert_eq!(h.bits, Some(BitWidth::SixtyFour));
        assert_eq!(h.cpu, CpuType::Arm64);
        assert!(!h.big_endian);
    }

    #[test]
    fn parses_le_32_x86() {
        let bytes = [
            le32(0xFEEDFACE),  // MH_MAGIC
            le32(0x0000_0007), // CPU_TYPE_X86
            0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        ];
        let h = HeaderStub::parse(&bytes).unwrap();
        assert_eq!(h.magic, Magic::Magic);
        assert_eq!(h.bits, Some(BitWidth::ThirtyTwo));
        assert_eq!(h.cpu, CpuType::X86);
        assert!(!h.big_endian);
    }

    #[test]
    fn parses_le_64_x86_64() {
        let bytes = [
            le32(0xFEEDFACF),  // MH_MAGIC_64
            le32(0x0100_0007), // CPU_TYPE_X86_64
            0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        ];
        let h = HeaderStub::parse(&bytes).unwrap();
        assert_eq!(h.cpu, CpuType::X86_64);
    }

    #[test]
    fn parses_be_arm() {
        let bytes = [
            be32(0xCEFAEDFE),  // MH_CIGAM
            be32(0x0000_000C), // CPU_TYPE_ARM
            0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        ];
        let h = HeaderStub::parse(&bytes).unwrap();
        assert_eq!(h.magic, Magic::Cigam);
        assert_eq!(h.bits, Some(BitWidth::ThirtyTwo));
        assert_eq!(h.cpu, CpuType::Arm);
        assert!(h.big_endian);
    }

    #[test]
    fn fat_magic_returns_no_bits() {
        let bytes = [
            le32(0xCAFEBABE), // FAT_MAGIC
            le32(0),          // ignored
            0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        ];
        let h = HeaderStub::parse(&bytes).unwrap();
        assert_eq!(h.magic, Magic::Fat);
        assert_eq!(h.bits, None);
    }

    #[test]
    fn fat_cigam_sets_big_endian() {
        let bytes = [
            be32(0xBEBAFECA), // FAT_CIGAM
            be32(0),
            0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        ];
        let h = HeaderStub::parse(&bytes).unwrap();
        assert_eq!(h.magic, Magic::FatCigam);
        assert!(h.big_endian);
    }

    #[test]
    fn unknown_magic_surfaces_raw() {
        let bytes = [0, 0, 0, 0, 0, 0, 0, 0];
        let h = HeaderStub::parse(&bytes).unwrap();
        assert_eq!(h.magic, Magic::Unknown(0));
        assert_eq!(h.bits, None);
    }

    #[test]
    fn rejects_truncated_input() {
        let err = HeaderStub::parse(&[0, 0, 0]).unwrap_err();
        assert!(err.contains(">=8 bytes"), "got: {err}");
    }

    #[test]
    fn parses_be_64_powerpc() {
        let bytes = [
            be32(0xCFFAEDFE),  // MH_CIGAM_64
            be32(0x0100_0012), // CPU_TYPE_POWERPC64
            0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        ];
        let h = HeaderStub::parse(&bytes).unwrap();
        assert_eq!(h.magic, Magic::Cigam64);
        assert_eq!(h.bits, Some(BitWidth::SixtyFour));
        assert_eq!(h.cpu, CpuType::PowerPc64);
        assert!(h.big_endian);
    }

    #[test]
    fn parses_le_32_powerpc() {
        let bytes = [
            le32(0xFEEDFACE),  // MH_MAGIC
            le32(0x0000_0012), // CPU_TYPE_POWERPC
            0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        ];
        let h = HeaderStub::parse(&bytes).unwrap();
        assert_eq!(h.cpu, CpuType::PowerPc);
    }

    #[test]
    fn unknown_cpu_surfaces_raw() {
        let bytes = [
            le32(0xFEEDFACF),
            le32(0xDEAD_BEEF),
            0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        ];
        let h = HeaderStub::parse(&bytes).unwrap();
        assert_eq!(h.cpu, CpuType::Other(0xDEAD_BEEF));
    }

    #[test]
    fn magic_round_trip() {
        for v in [
            0xFEEDFACE, 0xCEFAEDFE, 0xFEEDFACF, 0xCFFAEDFE, 0xCAFEBABE, 0xBEBAFECA,
        ] {
            assert_eq!(Magic::from_u32(v).to_u32_round_trip_check(), v);
        }
    }

    // Helper trait extension used by the round-trip test above.
    trait RoundTrip {
        fn to_u32_round_trip_check(self) -> u32;
    }
    impl RoundTrip for Magic {
        fn to_u32_round_trip_check(self) -> u32 {
            match self {
                Magic::Magic => 0xFEEDFACE,
                Magic::Cigam => 0xCEFAEDFE,
                Magic::Magic64 => 0xFEEDFACF,
                Magic::Cigam64 => 0xCFFAEDFE,
                Magic::Fat => 0xCAFEBABE,
                Magic::FatCigam => 0xBEBAFECA,
                Magic::Unknown(v) => v,
            }
        }
    }
}
