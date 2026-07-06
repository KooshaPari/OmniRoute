// Minimal Mach-O parser. Supports 32-bit and 64-bit headers, plus the load command
// walk. We do not implement symbol table relocation; this is enough to identify
// a Mach-O file and report its target CPU / file type.
pub const MH_MAGIC: u32 = 0xfeedface;
pub const MH_CIGAM: u32 = 0xcefaedfe;
pub const MH_MAGIC_64: u32 = 0xfeedfacf;
pub const MH_CIGAM_64: u32 = 0xcffaedfe;
pub const FAT_MAGIC: u32 = 0xcafebabe;
pub const FAT_CIGAM: u32 = 0xbebafeca;
pub const FAT_MAGIC_64: u32 = 0xcafebabf;
pub const FAT_CIGAM_64: u32 = 0xbfbafeca;

#[derive(Debug, PartialEq, Eq)]
pub enum CpuType {
    X86,
    X86_64,
    Arm,
    Arm64,
    PowerPc,
    PowerPc64,
    Unknown(u32),
}
impl CpuType {
    pub fn from_u32(v: u32) -> Self {
        match v {
            7 => CpuType::X86,
            0x01000007 => CpuType::X86_64,
            12 => CpuType::Arm,
            0x0100000c => CpuType::Arm64,
            18 => CpuType::PowerPc,
            0x01000018 => CpuType::PowerPc64,
            other => CpuType::Unknown(other),
        }
    }
    pub fn as_str(&self) -> &'static str {
        match self {
            CpuType::X86 => "x86",
            CpuType::X86_64 => "x86_64",
            CpuType::Arm => "arm",
            CpuType::Arm64 => "arm64",
            CpuType::PowerPc => "ppc",
            CpuType::PowerPc64 => "ppc64",
            CpuType::Unknown(_) => "unknown",
        }
    }
}

#[derive(Debug, PartialEq, Eq)]
pub enum FileType {
    Object,
    Execute,
    Fvmlib,
    Core,
    Preload,
    Dylib,
    Dylinker,
    Bundle,
    DylibStub,
    Dsym,
    KextBundle,
    Unknown(u32),
}
impl FileType {
    pub fn from_u32(v: u32) -> Self {
        match v {
            1 => FileType::Object,
            2 => FileType::Execute,
            3 => FileType::Fvmlib,
            4 => FileType::Core,
            5 => FileType::Preload,
            6 => FileType::Dylib,
            7 => FileType::Dylinker,
            8 => FileType::Bundle,
            9 => FileType::DylibStub,
            10 => FileType::Dsym,
            11 => FileType::KextBundle,
            other => FileType::Unknown(other),
        }
    }
}

#[derive(Debug, PartialEq, Eq)]
pub struct MachoHeader {
    pub magic: u32,
    pub is_64: bool,
    pub cpu: CpuType,
    pub file_type: FileType,
    pub n_cmds: u32,
    pub size_of_cmds: u32,
    pub flags: u32,
}

#[derive(Debug, PartialEq, Eq)]
pub struct LoadCommand {
    pub cmd: u32,
    pub cmdsize: u32,
}

pub fn parse_header(input: &[u8]) -> Result<MachoHeader, String> {
    if input.len() < 28 {
        return Err("header truncated".into());
    }
    let magic = u32::from_be_bytes([input[0], input[1], input[2], input[3]]);
    let is_64 = matches!(magic, MH_MAGIC_64 | MH_CIGAM_64);
    let native_magic = if is_64 { MH_MAGIC_64 } else { MH_MAGIC };
    if magic != native_magic {
        return Err(format!("not a native-endian Mach-O (magic=0x{:08x})", magic));
    }
    let cpu = CpuType::from_u32(u32::from_be_bytes([input[4], input[5], input[6], input[7]]));
    let file_type = FileType::from_u32(u32::from_be_bytes([input[8], input[9], input[10], input[11]]));
    let n_cmds = u32::from_be_bytes([input[12], input[13], input[14], input[15]]);
    let size_of_cmds = u32::from_be_bytes([input[16], input[17], input[18], input[19]]);
    let flags = u32::from_be_bytes([input[20], input[21], input[22], input[23]]);
    Ok(MachoHeader { magic, is_64, cpu, file_type, n_cmds, size_of_cmds, flags })
}

pub fn parse_load_commands(input: &[u8]) -> Result<Vec<LoadCommand>, String> {
    let header = parse_header(input)?;
    let header_size = if header.is_64 { 32 } else { 28 };
    if input.len() < header_size {
        return Err("load commands start past end".into());
    }
    let mut pos = header_size;
    let mut out = Vec::with_capacity(header.n_cmds as usize);
    for _ in 0..header.n_cmds {
        if pos + 8 > input.len() {
            return Err("load command truncated".into());
        }
        let cmd = u32::from_be_bytes([input[pos], input[pos+1], input[pos+2], input[pos+3]]);
        let cmdsize = u32::from_be_bytes([input[pos+4], input[pos+5], input[pos+6], input[pos+7]]);
        out.push(LoadCommand { cmd, cmdsize });
        if cmdsize < 8 {
            return Err(format!("bad cmdsize={}", cmdsize));
        }
        pos += cmdsize as usize;
    }
    Ok(out)
}

#[cfg(test)]
mod tests {
    use super::*;
    fn mk_header(magic: u32, cpu: u32, ft: u32, n_cmds: u32, size_of_cmds: u32, flags: u32, is_64: bool) -> Vec<u8> {
        let mut v = Vec::new();
        v.extend_from_slice(&magic.to_be_bytes());
        v.extend_from_slice(&cpu.to_be_bytes());
        v.extend_from_slice(&ft.to_be_bytes());
        v.extend_from_slice(&n_cmds.to_be_bytes());
        v.extend_from_slice(&size_of_cmds.to_be_bytes());
        v.extend_from_slice(&flags.to_be_bytes());
        v.extend_from_slice(&0u32.to_be_bytes());
        if is_64 { v.extend_from_slice(&0u32.to_be_bytes()); }
        v
    }
    #[test] fn parse_32bit_x86() {
        let buf = mk_header(MH_MAGIC, 7, 2, 3, 100, 0, false);
        let h = parse_header(&buf).unwrap();
        assert_eq!(h.cpu, CpuType::X86);
        assert_eq!(h.file_type, FileType::Execute);
        assert_eq!(h.n_cmds, 3);
        assert_eq!(h.size_of_cmds, 100);
        assert!(!h.is_64);
    }
    #[test] fn parse_64bit_arm64() {
        let buf = mk_header(MH_MAGIC_64, 0x0100000c, 6, 1, 50, 0x85, true);
        let h = parse_header(&buf).unwrap();
        assert_eq!(h.cpu, CpuType::Arm64);
        assert_eq!(h.file_type, FileType::Dylib);
        assert!(h.is_64);
        assert_eq!(h.flags, 0x85);
    }
    #[test] fn truncated_header() {
        assert!(parse_header(&[0u8; 20]).is_err());
    }
    #[test] fn bad_magic() {
        let mut buf = mk_header(MH_MAGIC, 7, 2, 0, 0, 0, false);
        buf[0] = 0xAB;
        assert!(parse_header(&buf).is_err());
    }
    #[test] fn load_commands_walk() {
        let mut buf = mk_header(MH_MAGIC, 7, 2, 2, 48, 0, false);
        buf.extend_from_slice(&0x19u32.to_be_bytes());
        buf.extend_from_slice(&24u32.to_be_bytes());
        buf.extend_from_slice(&[0u8; 16]);
        buf.extend_from_slice(&0x80000028u32.to_be_bytes());
        buf.extend_from_slice(&24u32.to_be_bytes());
        buf.extend_from_slice(&[0u8; 16]);
        let cmds = parse_load_commands(&buf).unwrap();
        assert_eq!(cmds.len(), 2);
        assert_eq!(cmds[0].cmd, 0x19);
        assert_eq!(cmds[1].cmd, 0x80000028);
    }
    #[test] fn load_commands_truncated() {
        let mut buf = mk_header(MH_MAGIC, 7, 2, 1, 16, 0, false);
        buf.extend_from_slice(&[0u8; 4]);
        assert!(parse_load_commands(&buf).is_err());
    }
    #[test] fn cpu_type_strings() {
        assert_eq!(CpuType::X86_64.as_str(), "x86_64");
        assert_eq!(CpuType::Arm64.as_str(), "arm64");
        assert_eq!(CpuType::Unknown(0).as_str(), "unknown");
    }
}