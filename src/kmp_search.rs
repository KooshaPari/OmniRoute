pub fn build_lps(pat: &[u8]) -> Vec<usize> {
    let mut lps = vec![0usize; pat.len()];
    let mut len = 0usize;
    let mut i = 1usize;
    while i < pat.len() {
        if pat[i] == pat[len] {
            len += 1;
            lps[i] = len;
            i += 1;
        } else if len > 0 {
            len = lps[len - 1];
        } else {
            lps[i] = 0;
            i += 1;
        }
    }
    lps
}
pub fn find(haystack: &[u8], pat: &[u8]) -> Vec<usize> {
    if pat.is_empty() { return vec![0]; }
    if pat.len() > haystack.len() { return Vec::<usize>::new(); }
    let lps = build_lps(pat);
    let mut out = Vec::new();
    let mut i = 0usize;
    let mut j = 0usize;
    while i < haystack.len() {
        if haystack[i] == pat[j] {
            i += 1;
            j += 1;
            if j == pat.len() {
                out.push(i - j);
                j = lps[j - 1];
            }
        } else if j > 0 {
            j = lps[j - 1];
        } else {
            i += 1;
        }
    }
    out
}
pub fn find_str(haystack: &str, pat: &str) -> Vec<usize> {
    find(haystack.as_bytes(), pat.as_bytes())
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test] fn basic_find() { assert_eq!(find_str("hello world", "world"), vec![6]); }
    #[test] fn multiple_occurrences() { assert_eq!(find_str("ababab", "ab"), vec![0, 2, 4]); }
    #[test] fn no_match() { assert_eq!(find_str("hello", "xyz"), Vec::<usize>::new()); }
    #[test] fn empty_pattern() { assert_eq!(find_str("hello", ""), vec![0]); }
    #[test] fn at_start() { assert_eq!(find_str("hello", "hello"), vec![0]); }
    #[test] fn overlap() { assert_eq!(find_str("aaaaa", "aa"), vec![0, 1, 2, 3]); }
    #[test] fn lps_basic() {
        assert_eq!(build_lps(b"aab"), vec![0, 1, 0]);
        assert_eq!(build_lps(b"abcdabc"), vec![0, 0, 0, 0, 1, 2, 3]);
    }
    #[test] fn pattern_longer_than_haystack() { assert_eq!(find_str("ab", "abc"), Vec::<usize>::new()); }
    #[test] fn bytes_api() { assert_eq!(find(b"hello", b"ll"), vec![2]); }
}
