// Minimal Git pack index (v2) reader. Parses the header (8 bytes),
// the 256-entry fanout table (1024 bytes), and the SHA1 + CRC32 + pack
// offset table. Lookup is a linear scan within the bucket identified
// by the first byte of the SHA1 — O(N/256) average, O(N) worst case.
// Does NOT validate CRCs or the index/pack checksums, and does NOT
// handle large (>= 4 GiB) pack offsets.

const MAGIC: [u8; 4] = [0xff, b't', b'O', b'c'];
const VERSION: u32 = 2;

#[derive(Debug, Clone)]
pub struct PackIndex<'a> {
    fanout: [u32; 256],
    /// N * (20-byte SHA1 + 4-byte CRC32 + 4-byte pack offset), sorted by SHA1.
    sha1_table: &'a [u8],
    object_count: u32,
}

impl<'a> PackIndex<'a> {
    pub fn parse(buf: &'a [u8]) -> Result<Self, String> {
        if buf.len() < 8 + 1024 { return Err("git-pack-idx: truncated".into()); }
        if buf[0..4] != MAGIC { return Err("git-pack-idx: bad magic".into()); }
        if u32::from_be_bytes([buf[4], buf[5], buf[6], buf[7]]) != VERSION {
            return Err("git-pack-idx: unsupported version".into());
        }
        let mut fanout = [0u32; 256];
        for i in 0..256 {
            let o = 8 + i * 4;
            fanout[i] = u32::from_be_bytes([buf[o], buf[o+1], buf[o+2], buf[o+3]]);
        }
        let n = fanout[255] as usize;
        let need = 8 + 1024 + n * 24;
        if buf.len() < need { return Err("git-pack-idx: truncated".into()); }
        let sha1_table = &buf[8 + 1024..need];
        Ok(PackIndex { fanout, sha1_table, object_count: fanout[255] })
    }

    /// Lookup the pack offset for `sha1`. Returns `None` if not present.
    pub fn lookup(&self, sha1: &[u8; 20]) -> Option<u32> {
        let first = sha1[0] as usize;
        let lo = if first == 0 { 0 } else { self.fanout[first - 1] as usize };
        let hi = self.fanout[first] as usize;
        for i in lo..hi {
            let o = i * 24;
            if &self.sha1_table[o..o+20] == sha1 {
                let off = &self.sha1_table[o+24..o+28];
                return Some(u32::from_be_bytes([off[0], off[1], off[2], off[3]]));
            }
        }
        None
    }

    pub fn object_count(&self) -> u32 { self.object_count }
}

#[cfg(test)]
mod tests {
    use super::*;
    fn build(entries: &[([u8; 20], u32)]) -> Vec<u8> {
        let mut sorted: Vec<_> = entries.to_vec();
        sorted.sort_by(|a, b| a.0.cmp(&b.0));
        let n = sorted.len() as u32;
        let mut buf = Vec::new();
        buf.extend_from_slice(&MAGIC);
        buf.extend_from_slice(&VERSION.to_be_bytes());
        // Fanout: fanout[i] = #entries with first SHA1 byte < i.
        for i in 0..256usize {
            let c = sorted.iter().filter(|(s, _)| (s[0] as usize) < i).count() as u32;
            buf.extend_from_slice(&c.to_be_bytes());
        }
        // last entry must equal total count (# with first byte < 256)
        let last = 8 + 255 * 4;
        buf[last..last+4].copy_from_slice(&n.to_be_bytes());
        // SHA1 + CRC32 + offset
        for (sha1, off) in &sorted {
            buf.extend_from_slice(sha1);
            buf.extend_from_slice(&[0u8; 4]);
            buf.extend_from_slice(&off.to_be_bytes());
        }
        // trailer (not validated)
        buf.extend_from_slice(&[0u8; 40]);
        buf
    }
    #[test] fn bad_magic_rejected() {
        let mut buf = vec![0u8; 1032];
        buf[0..4].copy_from_slice(b"junk");
        assert!(PackIndex::parse(&buf).is_err());
    }
    #[test] fn empty_index() {
        let idx = PackIndex::parse(&build(&[])).unwrap();
        assert_eq!(idx.object_count(), 0);
        assert_eq!(idx.lookup(&[0u8; 20]), None);
    }
    #[test] fn lookup_finds_known() {
        let mut a = [0u8; 20]; a[0] = 0x10; a[19] = 0x01;
        let mut b = [0u8; 20]; b[0] = 0x20; b[19] = 0x02;
        let idx = PackIndex::parse(&build(&[(a, 0xdeadbeef), (b, 0xcafebabe)])).unwrap();
        assert_eq!(idx.object_count(), 2);
        assert_eq!(idx.lookup(&a), Some(0xdeadbeef));
        assert_eq!(idx.lookup(&b), Some(0xcafebabe));
        let mut miss = [0u8; 20]; miss[0] = 0x77;
        assert_eq!(idx.lookup(&miss), None);
    }
    #[test] fn truncated_rejected() {
        let buf = vec![0u8; 100];
        assert!(PackIndex::parse(&buf).is_err());
    }
}
