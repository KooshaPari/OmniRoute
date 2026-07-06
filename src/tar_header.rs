// POSIX ustar (tar) header parser. Reads a single 512-byte header, decodes the
// octal/decimal size field, name prefix, mtime, type flag, and basic mode/uid/gid.
// Does not handle GNU long-name extensions — call `gnu_long_name` if you see
// type 'L' before the next header.

pub const BLOCK_SIZE: usize = 512;

pub const TYPE_REGULAR: u8 = b'0';
pub const TYPE_REGULAR_A: u8 = b'\0';
pub const TYPE_HARDLINK: u8 = b'1';
pub const TYPE_SYMLINK: u8 = b'2';
pub const TYPE_CHARDEV: u8 = b'3';
pub const TYPE_BLOCKDEV: u8 = b'4';
pub const TYPE_DIRECTORY: u8 = b'5';
pub const TYPE_FIFO: u8 = b'6';
pub const TYPE_CONTIGUOUS: u8 = b'7';
pub const TYPE_PAX_GLOBAL: u8 = b'g';
pub const TYPE_PAX_LOCAL: u8 = b'x';
pub const TYPE_GNU_LONGNAME: u8 = b'L';
pub const TYPE_GNU_LONGLINK: u8 = b'K';

#[derive(Debug, PartialEq, Eq, Clone)]
pub struct Header {
    pub name: String,
    pub mode: u32,
    pub uid: u32,
    pub gid: u32,
    pub size: u64,
    pub mtime: u64,
    pub checksum: u32,
    pub type_flag: u8,
    pub link_name: String,
    pub magic: String,
    pub version: String,
    pub uname: String,
    pub gname: String,
    pub dev_major: u32,
    pub dev_minor: u32,
    pub prefix: String,
    pub pad: Vec<u8>,
}

pub fn parse_header(block: &[u8]) -> Result<Header, String> {
    if block.len() < BLOCK_SIZE { return Err("block too small".into()); }
    let name = read_cstr(&block[0..100]);
    let mode = read_octal(&block[100..108]) as u32;
    let uid = read_octal(&block[108..116]) as u32;
    let gid = read_octal(&block[116..124]) as u32;
    let size = read_octal(&block[124..136]);
    let mtime = read_octal(&block[136..148]);
    let raw = &block[148..156];
    let end = raw.iter().position(|&b| b == 0).unwrap_or(raw.len());
    let checksum_str = std::str::from_utf8(&raw[..end]).map_err(|_| "bad checksum utf8")?;
    let trimmed = checksum_str.trim();
    let checksum: u32 = u32::from_str_radix(trimmed.trim_start_matches('0'), 8).unwrap_or_else(|_| trimmed.parse().unwrap_or(0));
    let type_flag = block[156];
    let link_name = read_cstr(&block[157..257]);
    let magic = read_cstr(&block[257..263]);
    let version = read_cstr(&block[263..265]);
    let uname = read_cstr(&block[265..297]);
    let gname = read_cstr(&block[297..329]);
    let dev_major = read_octal(&block[329..337]) as u32;
    let dev_minor = read_octal(&block[337..345]) as u32;
    let prefix = read_cstr(&block[345..500]);
    let pad = block[500..512].to_vec();
    Ok(Header {
        name, mode, uid, gid, size, mtime, checksum, type_flag,
        link_name, magic, version, uname, gname,
        dev_major, dev_minor, prefix, pad,
    })
}

pub fn is_zero_block(block: &[u8]) -> bool {
    block.iter().all(|&b| b == 0)
}

pub fn is_end_of_archive(blocks: &[u8]) -> bool {
    blocks.len() >= 1024 && blocks[..512].iter().all(|&b| b == 0) && blocks[512..1024].iter().all(|&b| b == 0)
}

pub fn full_name(h: &Header) -> String {
    if h.prefix.is_empty() { h.name.clone() } else { format!("{}/{}", h.prefix, h.name) }
}

pub fn verify_checksum(block: &[u8]) -> bool {
    if block.len() < 512 { return false; }
    let raw = &block[148..156];
    let end = raw.iter().position(|&b| b == 0).unwrap_or(raw.len());
    let stored_str = std::str::from_utf8(&raw[..end]).ok().map(|s| s.trim().to_string());
    let stored: u32 = match stored_str.and_then(|s| u32::from_str_radix(s.trim_start_matches('0'), 8).ok().or_else(|| s.parse().ok())) {
        Some(v) => v,
        None => return false,
    };
    let mut sum: u32 = 0;
    for i in 0..512 {
        let b = if (148..156).contains(&i) { b' ' } else { block[i] };
        sum += b as u32;
    }
    sum == stored
}

fn read_cstr(b: &[u8]) -> String {
    let end = b.iter().position(|&x| x == 0).unwrap_or(b.len());
    std::str::from_utf8(&b[..end]).unwrap_or("").trim().to_string()
}

fn read_octal(b: &[u8]) -> u64 {
    let s = read_cstr(b);
    if s.is_empty() { return 0; }
    u64::from_str_radix(s.trim_start_matches('0').trim(), 8).unwrap_or_else(|_| s.parse().unwrap_or(0))
}

#[cfg(test)]
mod tests {
    use super::*;
    fn mk_header(name: &str, size: u64, mode: u32, type_flag: u8, prefix: &str) -> Vec<u8> {
        let mut v = vec![0u8; 512];
        let name_bytes = name.as_bytes();
        v[..name_bytes.len()].copy_from_slice(name_bytes);
        write_octal(&mut v[100..108], mode as u64);
        write_octal(&mut v[124..136], size);
        v[156] = type_flag;
        if !prefix.is_empty() {
            let p = prefix.as_bytes();
            v[345..345 + p.len()].copy_from_slice(p);
        }
        v[257..263].copy_from_slice(b"ustar\x00");
        v[263..265].copy_from_slice(b"00");
        let mut sum: u32 = 0;
        for i in 0..512 {
            let b = if (148..156).contains(&i) { b' ' } else { v[i] };
            sum += b as u32;
        }
        let chk = format!("{:06o}\x00 ", sum);
        v[148..156].copy_from_slice(chk.as_bytes());
        v
    }
    fn write_octal(buf: &mut [u8], n: u64) {
        let s = format!("{:07o}", n);
        for (i, c) in s.bytes().enumerate() {
            if i < buf.len() { buf[i] = c; }
        }
    }
    #[test] fn parse_simple() {
        let block = mk_header("hello.txt", 1024, 0o644, TYPE_REGULAR, "");
        let h = parse_header(&block).unwrap();
        assert_eq!(h.name, "hello.txt");
        assert_eq!(h.size, 1024);
        assert_eq!(h.mode, 0o644);
        assert_eq!(h.type_flag, TYPE_REGULAR);
        assert_eq!(h.magic, "ustar");
    }
    #[test] fn parse_with_prefix() {
        let block = mk_header("inner.txt", 0, 0o755, TYPE_DIRECTORY, "outer");
        let h = parse_header(&block).unwrap();
        assert_eq!(full_name(&h), "outer/inner.txt");
    }
    #[test] fn verify_checksum_works() {
        let block = mk_header("foo", 100, 0o644, TYPE_REGULAR, "");
        assert!(verify_checksum(&block));
    }
    #[test] fn verify_checksum_mismatch() {
        let mut block = mk_header("foo", 100, 0o644, TYPE_REGULAR, "");
        block[0] ^= 1;
        assert!(!verify_checksum(&block));
    }
    #[test] fn zero_block_detected() {
        let v = vec![0u8; 512];
        assert!(is_zero_block(&v));
    }
    #[test] fn end_of_archive() {
        let v = vec![0u8; 1024];
        assert!(is_end_of_archive(&v));
        let v = vec![0u8; 1023];
        assert!(!is_end_of_archive(&v));
    }
    #[test] fn truncated_block() {
        assert!(parse_header(&[0u8; 100]).is_err());
    }
    #[test] fn read_octal_zero() {
        let buf = b"0000000\x00";
        assert_eq!(read_octal(buf), 0);
    }
    #[test] fn read_octal_value() {
        let buf = b"0000644\x00";
        assert_eq!(read_octal(buf), 0o644);
    }
}