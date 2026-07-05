pub struct IpAddr { pub octets: [u8; 4] }
impl IpAddr {
    pub fn new(a: u8, b: u8, c: u8, d: u8) -> Self { Self { octets: [a, b, c, d] } }
    pub fn to_u32(&self) -> u32 { u32::from_be_bytes(self.octets) }
    pub fn from_u32(v: u32) -> Self { Self { octets: v.to_be_bytes() } }
    pub fn as_string(&self) -> String { format!("{}.{}.{}.{}", self.octets[0], self.octets[1], self.octets[2], self.octets[3]) }
    pub fn is_loopback(&self) -> bool { self.octets[0] == 127 }
    pub fn is_private(&self) -> bool {
        if self.octets[0] == 10 { return true; }
        if self.octets[0] == 172 && (16..=31).contains(&self.octets[1]) { return true; }
        if self.octets[0] == 192 && self.octets[1] == 168 { return true; }
        false
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test] fn roundtrip() { let ip = IpAddr::new(192, 168, 1, 1); assert_eq!(ip.as_string(), "192.168.1.1"); }
    #[test] fn to_from_u32() { let ip = IpAddr::new(10, 0, 0, 1); let back = IpAddr::from_u32(ip.to_u32()); assert_eq!(back.octets, [10, 0, 0, 1]); }
    #[test] fn loopback() { assert!(IpAddr::new(127, 0, 0, 1).is_loopback()); assert!(!IpAddr::new(8, 8, 8, 8).is_loopback()); }
    #[test] fn private() { assert!(IpAddr::new(10, 0, 0, 1).is_private()); assert!(IpAddr::new(192, 168, 0, 1).is_private()); assert!(!IpAddr::new(8, 8, 8, 8).is_private()); }
}
