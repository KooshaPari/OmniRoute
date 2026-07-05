pub fn search<T: Ord>(items: &[T], target: &T) -> Option<usize> {
    let mut lo = 0;
    let mut hi = items.len();
    while lo < hi {
        let mid = lo + (hi - lo) / 2;
        match items[mid].cmp(target) {
            std::cmp::Ordering::Equal => return Some(mid),
            std::cmp::Ordering::Less => lo = mid + 1,
            std::cmp::Ordering::Greater => hi = mid,
        }
    }
    None
}
pub fn lower_bound<T: Ord>(items: &[T], target: &T) -> usize {
    let mut lo = 0; let mut hi = items.len();
    while lo < hi {
        let mid = lo + (hi - lo) / 2;
        if items[mid] < *target { lo = mid + 1; } else { hi = mid; }
    }
    lo
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test] fn search_hit() { assert_eq!(search(&[1, 3, 5, 7, 9], &5), Some(2)); }
    #[test] fn search_miss() { assert_eq!(search(&[1, 3, 5, 7, 9], &4), None); }
    #[test] fn search_empty() { assert_eq!(search::<i32>(&[], &0), None); }
    #[test] fn lower_bound_basic() { assert_eq!(lower_bound(&[1, 3, 5, 7, 9], &5), 2); assert_eq!(lower_bound(&[1, 3, 5, 7, 9], &4), 2); }
}
