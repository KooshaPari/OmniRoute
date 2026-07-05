pub fn hamming(a: &str, b: &str) -> usize {
    let ca: Vec<char> = a.chars().collect();
    let cb: Vec<char> = b.chars().collect();
    let mut d = (ca.len() as i64 - cb.len() as i64).unsigned_abs() as usize;
    for (x, y) in ca.iter().zip(cb.iter()) {
        if x != y { d += 1; }
    }
    d
}
pub fn jaccard(a: &str, b: &str) -> f64 {
    let sa: std::collections::HashSet<char> = a.chars().collect();
    let sb: std::collections::HashSet<char> = b.chars().collect();
    let inter = sa.intersection(&sb).count() as f64;
    let union = sa.union(&sb).count() as f64;
    if union == 0.0 { 1.0 } else { inter / union }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test] fn hamming_eq() { assert_eq!(hamming("abc", "abc"), 0); }
    #[test] fn hamming_diff() { assert_eq!(hamming("abc", "abd"), 1); }
    #[test] fn hamming_len() { assert_eq!(hamming("ab", "abcde"), 3); }
    #[test] fn jaccard_same() { assert!((jaccard("abc", "abc") - 1.0).abs() < 1e-9); }
    #[test] fn jaccard_disjoint() { assert_eq!(jaccard("abc", ""), 0.0); }
    #[test] fn jaccard_partial() { let s = jaccard("abcdef", "bcdefg"); assert!(s > 0.5 && s < 0.9); }
}
