//! Classic Levenshtein edit-distance utilities.
//!
//! Provides:
//! - [`distance`]: pure dynamic-programming edit distance between two strings.
//! - [`distance_with_cap`]: early-termination variant that returns
//!   `cap + 1` whenever the true distance is known to exceed `cap`.
//! - [`suggest_within`]: filter and rank candidates by distance from a target.
//!
//! The classic algorithm considers three single-character operations —
//! insertion, deletion, and substitution — each with unit cost. A pure
//! transposition therefore costs `2`, not `1`: at minimum one character must
//! be deleted and one inserted. If you need Damerau-style transposition-aware
//! distance, layer that on top of [`distance`].
//!
//! Distances operate on Unicode scalar values (`char`). The cap-aware
//! variant returns `cap + 1` as a sentinel for "too far" without committing
//! to an exact integer.
//!
//! # Examples
//!
//! ```
//! use crate::levenshtein::{distance, distance_with_cap, suggest_within};
//!
//! assert_eq!(distance("kitten", "sitting"), 3);
//! assert_eq!(distance("ab", "ba"), 2); // pure transpose, classic Levenshtein
//! assert_eq!(distance_with_cap("hello", "world", 4), 4);
//! assert_eq!(distance_with_cap("abc", "abc", 0), 0);
//!
//! let mut sugg = suggest_within("apple", &["apply", "aple", "banana"], 2);
//! assert_eq!(sugg.first().map(|(s, _)| s.as_str()), Some("aple"));
//! ```

/// Compute the classic Levenshtein edit distance between two strings.
///
/// Returns the minimum number of single-character insertions, deletions, or
/// substitutions required to transform `a` into `b`. Symmetric in its
/// arguments; treats Unicode scalar values as the atomic unit.
///
/// # Complexity
///
/// Time and space both `O(|a| * |b|)` in the lengths of the inputs, using
/// two rolling rows of `b.len() + 1` cells.
///
/// # Examples
///
/// ```
/// use crate::levenshtein::distance;
///
/// assert_eq!(distance("", ""), 0);
/// assert_eq!(distance("abc", ""), 3);
/// assert_eq!(distance("", "abc"), 3);
/// assert_eq!(distance("cat", "bat"), 1);  // single substitution
/// assert_eq!(distance("cat", "cats"), 1); // single insertion
/// assert_eq!(distance("cats", "cat"), 1); // single deletion
/// ```
pub fn distance(a: &str, b: &str) -> usize {
    let a_chars: Vec<char> = a.chars().collect();
    let b_chars: Vec<char> = b.chars().collect();

    if a_chars.is_empty() {
        return b_chars.len();
    }
    if b_chars.is_empty() {
        return a_chars.len();
    }

    let n = b_chars.len();

    // Row 0: cost of inserting each prefix of b into the empty string.
    let mut prev: Vec<usize> = (0..=n).collect();
    let mut curr: Vec<usize> = vec![0; n + 1];

    for i in 1..=a_chars.len() {
        curr[0] = i; // cost of deleting a's first i chars to reach empty b
        for j in 1..=n {
            let cost = if a_chars[i - 1] == b_chars[j - 1] { 0 } else { 1 };
            curr[j] = (prev[j] + 1)          // deletion
                .min(curr[j - 1] + 1)         // insertion
                .min(prev[j - 1] + cost);     // substitution
        }
        std::mem::swap(&mut prev, &mut curr);
    }

    prev[n]
}

/// Cap-aware Levenshtein distance with early termination.
///
/// Returns the true distance if it does not exceed `cap`; otherwise returns
/// `cap + 1` (a sentinel meaning "exceeds cap"). Two early-termination
/// strategies are layered:
///
/// 1. **Length-difference lower bound.** The distance between two strings is
///    at least `|len(a) - len(b)|`, so any string whose length differs by more
///    than `cap` is immediately returned as `cap + 1` without any DP work.
/// 2. **Ukkonen-style row invariant.** Within a DP row `i`, cell `(i, j)`
///    satisfies `dp[i][j] >= max(|j - i|, |len(b) - (j - i) - len(a)|) - h`,
///    so any value `> cap + (|b| - i)` provably exceeds `cap`. We restrict
///    each row to the band `[max(1, i - cap) ..= min(n, i + cap)]` and abort
///    the function as soon as the row's minimum exceeds `cap`.
///
/// The function is symmetric in its arguments and treats Unicode scalar
/// values as the atomic unit.
///
/// # Examples
///
/// ```
/// use crate::levenshtein::distance_with_cap;
///
/// assert_eq!(distance_with_cap("abc", "abc", 0), 0); // identical, cap 0
/// assert_eq!(distance_with_cap("abc", "abd", 1), 1); // within cap
/// assert_eq!(distance_with_cap("abc", "xyz", 2), 3); // exceeds cap 2
/// ```
pub fn distance_with_cap(a: &str, b: &str, cap: usize) -> usize {
    let a_chars: Vec<char> = a.chars().collect();
    let b_chars: Vec<char> = b.chars().collect();

    if a_chars.is_empty() {
        return b_chars.len().min(cap + 1);
    }
    if b_chars.is_empty() {
        return a_chars.len().min(cap + 1);
    }

    let alen = a_chars.len();
    let blen = b_chars.len();

    // Length-difference lower bound: distance >= |alen - blen|.
    let len_lb = if alen > blen { alen - blen } else { blen - alen };
    if len_lb > cap {
        return cap + 1;
    }

    // Ensure `a` is the shorter one so the DP band stays narrow.
    let (a_chars, b_chars) = if alen <= blen {
        (a_chars, b_chars)
    } else {
        (b_chars, a_chars)
    };
    let (m, n) = (a_chars.len(), b_chars.len());

    // Sentinel for "this cell already exceeds cap".
    let inf = cap + 1;

    // Row 0: cost of inserting each prefix of b into the empty string,
    // but clamped to `inf` once it exceeds `cap` (we only care if the
    // row's minimum is <= cap).
    let mut prev: Vec<usize> = (0..=n)
        .map(|j| if j > cap { inf } else { j })
        .collect();
    let mut curr: Vec<usize> = vec![inf; n + 1];

    for i in 1..=m {
        // Cost of deleting a's first `i` chars to reach empty b.
        curr[0] = if i > cap { inf } else { i };

        // Ukkonen band: cells outside [i - cap, i + cap] can't beat `cap`.
        let j_lo: usize = if i > cap { i - cap } else { 1 };
        let j_hi: usize = {
            let upper = i + cap;
            if upper < n { upper } else { n }
        };

        let mut row_min = curr[0];
        for j in 1..j_lo {
            curr[j] = inf;
        }
        for j in j_lo..=j_hi {
            let cost = if a_chars[i - 1] == b_chars[j - 1] { 0 } else { 1 };
            let sub = prev[j - 1].saturating_add(cost);
            let del = prev[j] + 1;
            let ins = curr[j - 1] + 1;
            let v = sub.min(del).min(ins);
            let v = if v > inf { inf } else { v };
            curr[j] = v;
            if v < row_min {
                row_min = v;
            }
        }
        for j in (j_hi + 1)..=n {
            curr[j] = inf;
        }

        if row_min > cap {
            return cap + 1;
        }

        std::mem::swap(&mut prev, &mut curr);
    }

    let result = prev[n];
    if result > cap {
        cap + 1
    } else {
        result
    }
}

/// Filter and rank candidates by Levenshtein distance from `target`.
///
/// Returns `(candidate, distance)` pairs for every candidate whose distance
/// from `target` is `<= max_dist`, sorted by ascending distance and breaking
/// ties lexicographically by the candidate string. Each candidate is visited
/// with a cap-aware distance call, so the work is bounded by `max_dist`.
///
/// # Examples
///
/// ```
/// use crate::levenshtein::suggest_within;
///
/// let sugg = suggest_within("apple", &["apply", "aple", "banana"], 2);
/// assert_eq!(sugg.len(), 2);
/// assert_eq!(sugg[0].0, "aple");
/// ```
pub fn suggest_within(target: &str, candidates: &[&str], max_dist: usize) -> Vec<(String, usize)> {
    let mut out: Vec<(String, usize)> = Vec::new();
    for &cand in candidates {
        let d = distance_with_cap(target, cand, max_dist);
        if d <= max_dist {
            out.push((cand.to_string(), d));
        }
    }
    // Sort by (distance asc, candidate asc).
    out.sort_by(|x, y| x.1.cmp(&y.1).then_with(|| x.0.cmp(&y.0)));
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    // 1. Identical strings.
    #[test]
    fn distance_identical() {
        assert_eq!(distance("hello", "hello"), 0);
        assert_eq!(distance("a", "a"), 0);
    }

    // 2. Empty string edge cases.
    #[test]
    fn distance_empty_strings() {
        assert_eq!(distance("", ""), 0);
        assert_eq!(distance("abc", ""), 3);
        assert_eq!(distance("", "abc"), 3);
    }

    // 3. Single insertion.
    #[test]
    fn distance_single_insertion() {
        assert_eq!(distance("cat", "cats"), 1);
        assert_eq!(distance("", "x"), 1);
        assert_eq!(distance("abc", "abcd"), 1);
    }

    // 4. Single deletion.
    #[test]
    fn distance_single_deletion() {
        assert_eq!(distance("cats", "cat"), 1);
        assert_eq!(distance("x", ""), 1);
        assert_eq!(distance("abcd", "abc"), 1);
    }

    // 5. Single substitution.
    #[test]
    fn distance_single_substitution() {
        assert_eq!(distance("cat", "bat"), 1);
        assert_eq!(distance("cat", "cot"), 1);
        assert_eq!(distance("a", "b"), 1);
    }

    // 6. Pure-transpose costs 2 (classic Levenshtein is NOT Damerau).
    #[test]
    fn distance_pure_transpose_is_two() {
        assert_eq!(distance("ab", "ba"), 2);
        assert_eq!(distance("abc", "bac"), 2);
        assert_eq!(distance("abcd", "abdc"), 2);
    }

    // 7. distance_with_cap early termination.
    #[test]
    fn distance_with_cap_terminates() {
        // identical with cap 0 -> 0.
        assert_eq!(distance_with_cap("abc", "abc", 0), 0);
        // within cap returns true distance.
        assert_eq!(distance_with_cap("cat", "bat", 1), 1);
        // exceeds cap -> cap + 1.
        assert_eq!(distance_with_cap("abc", "xyz", 2), 3);
        // empty edge.
        assert_eq!(distance_with_cap("", "", 0), 0);
    }

    // 7b. Explicit identity edge case requested in spec.
    #[test]
    fn distance_with_cap_abc_abc_zero() {
        assert_eq!(distance_with_cap("abc", "abc", 0), 0);
    }

    // 7c. Long inputs - Ukkonen band actually reduces work and returns correctly.
    #[test]
    fn distance_with_cap_long_inputs() {
        let a = "abcdefghij";
        let b = "klmnopqrst";
        // true distance = 10 (every char substituted), cap 5 -> cap + 1.
        assert_eq!(distance_with_cap(a, b, 5), 6);
        // cap 10 -> exact.
        assert_eq!(distance_with_cap(a, b, 10), 10);
        // cap >= 10 -> exact.
        assert_eq!(distance_with_cap(a, b, 20), 10);
    }

    // 7d. Length-difference lower bound triggers early cap+1.
    #[test]
    fn distance_with_cap_length_lower_bound() {
        // alen 0 vs blen 100, cap 5 -> alen vs blen diff = 100 > 5 -> 6.
        let long: String = (0..100).map(|_| 'x').collect();
        assert_eq!(distance_with_cap("", &long, 5), 6);
        let short: String = (0..3).map(|_| 'x').collect();
        assert_eq!(distance_with_cap(&short, &long, 5), 6);
    }

    // 8. suggest_within filter — keeps within, drops outside.
    #[test]
    fn suggest_within_filters_by_distance() {
        // Distances from "apple": "aple"=1 (delete 'p'), "apply"=1 (sub e->y),
        // "banana">=4. With max_dist=1, expect 2 results sorted by distance then lex.
        let sugg = suggest_within("apple", &["banana", "apply", "aple"], 1);
        assert_eq!(sugg.len(), 2);
        assert_eq!(sugg[0].0, "aple");
        assert_eq!(sugg[0].1, 1);
        assert_eq!(sugg[1].0, "apply");
        assert_eq!(sugg[1].1, 1);
    }

    // 9. suggest_within sort order (distance asc, ties lex asc).
    #[test]
    fn suggest_within_sort_order() {
        // Distances from "apple":
        //   "aple" = 1 (delete 'p')
        //   "apples" = 1 (insert 's')
        //   "apply" = 1 (sub e->y)
        //   "bpple" = 1 (sub a->b)
        // All within max_dist=1. Sort order: distance asc then lex asc.
        let sugg = suggest_within("apple", &["apples", "apply", "bpple", "aple"], 1);
        assert_eq!(sugg.len(), 4);
        assert_eq!(sugg[0].0, "aple");
        assert_eq!(sugg[1].0, "apples");
        assert_eq!(sugg[2].0, "apply");
        assert_eq!(sugg[3].0, "bpple");
        for entry in &sugg {
            assert_eq!(entry.1, 1);
        }
    }

    // 10. Unicode byte-level handling — operates on chars, not bytes.
    #[test]
    fn distance_unicode_chars() {
        assert_eq!(distance("café", "cafe"), 1);
        assert_eq!(distance("ñ", "n"), 1);
        assert_eq!(distance("", "ñ"), 1);
        assert_eq!(distance("ñ", ""), 1);
        assert_eq!(distance("日本", "日本"), 0);
    }

    // 11. Classical kitten/sitting sanity.
    #[test]
    fn distance_kitten_sitting() {
        assert_eq!(distance("kitten", "sitting"), 3);
    }
}
