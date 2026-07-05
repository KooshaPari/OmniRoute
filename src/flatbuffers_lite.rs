pub struct FbBuilder {
    buf: Vec<u8>,
}
impl FbBuilder {
    pub fn new() -> Self { Self { buf: vec![] } }
    pub fn prep(&mut self, additional_bytes: usize, additional_objects: usize) -> usize {
        let target_len = self.buf.len() + additional_bytes;
        let align = (target_len + 3) & !3usize;
        while self.buf.len() < align { self.buf.push(0); }
        let off = self.buf.len();
        for _ in 0..(4 + additional_objects * 4) { self.buf.push(0); }
        off
    }
    pub fn place_u8(&mut self, value: u8) { self.buf.push(value); }
    pub fn place_u16(&mut self, value: u16) {
        self.buf.push(value as u8);
        self.buf.push((value >> 8) as u8);
    }
    pub fn place_u32(&mut self, value: u32) {
        self.buf.push(value as u8);
        self.buf.push((value >> 8) as u8);
        self.buf.push((value >> 16) as u8);
        self.buf.push((value >> 24) as u8);
    }
    pub fn place_str(&mut self, s: &str) {
        let len = s.len() as u32;
        self.buf.push(len as u8);
        self.buf.push((len >> 8) as u8);
        self.buf.push((len >> 16) as u8);
        self.buf.push((len >> 24) as u8);
        self.buf.extend_from_slice(s.as_bytes());
    }
    pub fn place_offset(&mut self, target: usize) {
        let here = self.buf.len();
        let delta = (here - target) as u32;
        self.buf.push(delta as u8);
        self.buf.push((delta >> 8) as u8);
        self.buf.push((delta >> 16) as u8);
        self.buf.push((delta >> 24) as u8);
    }
    pub fn finish(self) -> Vec<u8> {
        let mut out = self.buf;
        let n = out.len() as u32;
        out.push(n as u8);
        out.push((n >> 8) as u8);
        out.push((n >> 16) as u8);
        out.push((n >> 24) as u8);
        out
    }
    pub fn len(&self) -> usize { self.buf.len() }
}
pub fn read_u8(buf: &[u8], pos: usize) -> u8 { buf[pos] }
pub fn read_u16(buf: &[u8], pos: usize) -> u16 { u16::from_le_bytes([buf[pos], buf[pos + 1]]) }
pub fn read_u32(buf: &[u8], pos: usize) -> u32 {
    u32::from_le_bytes([buf[pos], buf[pos + 1], buf[pos + 2], buf[pos + 3]])
}
pub fn read_str<'a>(buf: &'a [u8], pos: usize) -> &'a str {
    let len = read_u32(buf, pos) as usize;
    unsafe { std::str::from_utf8_unchecked(&buf[pos + 4..pos + 4 + len]) }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test] fn empty() {
        let b = FbBuilder::new();
        assert_eq!(b.len(), 0);
    }
    #[test] fn place_u8_u16_u32() {
        let mut b = FbBuilder::new();
        b.place_u8(0x42);
        b.place_u16(0x1234);
        b.place_u32(0xdeadbeef);
        let buf = b.finish();
        assert_eq!(buf[0], 0x42);
        assert_eq!(buf[1], 0x34);
        assert_eq!(buf[2], 0x12);
        assert_eq!(buf[3], 0xef);
        assert_eq!(buf[4], 0xbe);
        assert_eq!(buf[5], 0xad);
        assert_eq!(buf[6], 0xde);
    }
    #[test] fn round_trip_u32() {
        let mut b = FbBuilder::new();
        b.place_u32(0xcafebabe);
        let buf = b.finish();
        assert_eq!(read_u32(&buf, 0), 0xcafebabe);
    }
    #[test] fn prep_aligns() {
        let mut b = FbBuilder::new();
        let target = b.prep(0, 0);
        assert_eq!(target, 0);
        assert_eq!(b.len(), 4);
    }
    #[test] fn offset_place() {
        let mut b = FbBuilder::new();
        let target = b.prep(0, 0);
        b.place_u32(99);
        b.place_offset(target);
        let buf = b.finish();
        // buf layout: 4 padding bytes (from prep) ... 99 (4 bytes) ... delta (4 bytes) ... root_size (4 bytes)
        let delta = read_u32(&buf, 8);
        assert_eq!(delta, (buf.len() - 4 - 4 - target) as u32);
    }
    #[test] fn place_str_basic() {
        let mut b = FbBuilder::new();
        b.place_str("hi");
        let buf = b.finish();
        assert_eq!(read_str(&buf, 0), "hi");
    }
    #[test] fn finish_appends_root_offset() {
        let mut b = FbBuilder::new();
        b.place_u32(42);
        let buf = b.finish();
        assert_eq!(buf.len(), 8);
        assert_eq!(read_u32(&buf, 4), 4);
    }
}
