// IPv4 and IPv6 address validation + parsing into numeric components.
pub fn is_ipv4(s: &str) -> bool {
    let parts: Vec<&str> = s.split('.').collect();
    if parts.len() != 4 { return false; }
    for p in parts {
        if p.is_empty() || p.len() > 3 { return false; }
        if !p.chars().all(|c| c.is_ascii_digit()) { return false; }
        // disallow leading zeros (except "0" itself) to avoid octal ambiguity
        if p.len() > 1 && p.starts_with('0') { return false; }
        let n: u32 = match p.parse() { Ok(v) => v, Err(_) => return false };
        if n > 255 { return false; }
    }
    true
}
pub fn parse_ipv4(s: &str) -> Option<[u8; 4]> {
    if !is_ipv4(s) { return None; }
    let mut out = [0u8; 4];
    for (i, p) in s.split('.').enumerate() {
        out[i] = p.parse().unwrap();
    }
    Some(out)
}
pub fn ipv4_to_string(parts: [u8; 4]) -> String {
    format!("{}.{}.{}.{}", parts[0], parts[1], parts[2], parts[3])
}
pub fn is_ipv6(s: &str) -> bool {
    if s.is_empty() { return false; }
    // split on "::" — at most one occurrence
    let double_colon_count = s.matches("::").count();
    if double_colon_count > 1 { return false; }
    let halves: Vec<&str> = if double_colon_count == 1 {
        s.splitn(2, "::").collect()
    } else {
        vec![s]
    };
    let head = halves[0];
    let tail = if halves.len() > 1 { halves[1] } else { "" };
    let head_parts: Vec<&str> = if head.is_empty() { vec![] } else { head.split(':').collect() };
    let tail_parts: Vec<&str> = if tail.is_empty() { vec![] } else { tail.split(':').collect() };
    if head_parts.len() + tail_parts.len() > 8 { return false; }
    let mut groups = head_parts.len() + tail_parts.len();
    if double_colon_count == 1 && groups < 8 { /* ok */ } else if groups != 8 { return false; }
    let mut total = 0;
    for p in head_parts.iter().chain(tail_parts.iter()) {
        if p.is_empty() || p.len() > 4 { return false; }
        if !p.chars().all(|c| c.is_ascii_hexdigit()) { return false; }
        let n = match u32::from_str_radix(p, 16) { Ok(v) => v, Err(_) => return false };
        if n > 0xffff { return false; }
        total += 1;
    }
    if double_colon_count == 1 && total < 8 { true } else if total == 8 { true } else { false }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test] fn ipv4_valid() {
        assert!(is_ipv4("0.0.0.0"));
        assert!(is_ipv4("255.255.255.255"));
        assert!(is_ipv4("192.168.1.1"));
    }
    #[test] fn ipv4_invalid() {
        assert!(!is_ipv4("256.0.0.1"));
        assert!(!is_ipv4("1.2.3"));
        assert!(!is_ipv4("1.2.3.4.5"));
        assert!(!is_ipv4(""));
        assert!(!is_ipv4("1.2.3.a"));
        assert!(!is_ipv4("01.2.3.4"));  // leading zero
    }
    #[test] fn ipv4_parse() {
        assert_eq!(parse_ipv4("192.168.1.1"), Some([192, 168, 1, 1]));
        assert_eq!(parse_ipv4("0.0.0.0"), Some([0, 0, 0, 0]));
        assert_eq!(parse_ipv4("256.0.0.0"), None);
    }
    #[test] fn ipv4_to_string_test() {
        assert_eq!(ipv4_to_string([10, 0, 0, 1]), "10.0.0.1");
    }
    #[test] fn ipv6_valid() {
        assert!(is_ipv6("::1"));
        assert!(is_ipv6("::"));
        assert!(is_ipv6("2001:db8::1"));
        assert!(is_ipv6("2001:0db8:0000:0000:0000:0000:0000:0001"));
    }
    #[test] fn ipv6_invalid() {
        assert!(!is_ipv6("1:2:3:4:5:6:7:8:9"));  // too many groups
        assert!(!is_ipv6(""));
        assert!(!is_ipv6("1::2::3"));  // multiple ::
        assert!(!is_ipv6("gggg::1"));  // bad hex
        assert!(!is_ipv6("12345::1"));  // group too long
    }
    #[test] fn ipv6_full_address() {
        assert!(is_ipv6("2001:db8:85a3::8a2e:370:7334"));
    }
    #[test] fn ipv6_double_colon_count() {
        let s = "::1::";
        assert_eq!(s.matches("::").count(), 2);
        assert!(!is_ipv6(s));
    }
}
