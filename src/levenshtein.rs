pub fn distance(a: &str, b: &str) -> usize {
    if a.is_empty() { return b.chars().count(); }
    if b.is_empty() { return a.chars().count(); }
    let a_chars: Vec<char> = a.chars().collect();
    let b_chars: Vec<char> = b.chars().collect();
    let mut prev: Vec<usize> = (0..=b_chars.len()).collect();
    let mut curr = vec![0; b_chars.len() + 1];
    for i in 1..=a_chars.len() {
        curr[0] = i;
        for j in 1..=b_chars.len() {
            let cost = if a_chars[i-1] == b_chars[j-1] { 0 } else { 1 };
            curr[j] = (prev[j] + 1).min(curr[j-1] + 1).min(prev[j-1] + cost);
        }
        std::mem::swap(&mut prev, &mut curr);
    }
    prev[b_chars.len()]
}
pub fn is_within(a: &str, b: &str, max: usize) -> bool { distance(a, b) <= max }
#[cfg(test)]
mod tests {
    use super::*;
    #[test] fn empty() { assert_eq!(distance("", ""), 0); assert_eq!(distance("abc", ""), 3); assert_eq!(distance("", "abc"), 3); }
    #[test] fn identical() { assert_eq!(distance("hello", "hello"), 0); }
    #[test] fn one_substitution() { assert_eq!(distance("cat", "bat"), 1); }
    #[test] fn one_insertion() { assert_eq!(distance("cat", "cats"), 1); }
    #[test] fn one_deletion() { assert_eq!(distance("cats", "cat"), 1); }
    #[test] fn multiple() { assert_eq!(distance("kitten", "sitting"), 3); }
    #[test] fn within() { assert!(is_within("hello", "helo", 1)); assert!(!is_within("hello", "world", 1)); }
}
