pub fn lower_bound<T: Ord>(arr: &[T], target: &T) -> usize {
    let mut lo = 0usize;
    let mut hi = arr.len();
    while lo < hi {
        let mid = lo + (hi - lo) / 2;
        if &arr[mid] < target { lo = mid + 1; } else { hi = mid; }
    }
    lo
}
pub fn upper_bound<T: Ord>(arr: &[T], target: &T) -> usize {
    let mut lo = 0usize;
    let mut hi = arr.len();
    while lo < hi {
        let mid = lo + (hi - lo) / 2;
        if &arr[mid] <= target { lo = mid + 1; } else { hi = mid; }
    }
    lo
}
pub fn equal_range<T: Ord>(arr: &[T], target: &T) -> std::ops::Range<usize> {
    lower_bound(arr, target)..upper_bound(arr, target)
}
pub fn insert_position<T: Ord>(arr: &[T], target: &T) -> usize {
    lower_bound(arr, target)
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test] fn lower_basic() { assert_eq!(lower_bound(&[1, 3, 5, 7], &4), 2); }
    #[test] fn lower_first() { assert_eq!(lower_bound(&[1, 3, 5, 7], &0), 0); }
    #[test] fn lower_last() { assert_eq!(lower_bound(&[1, 3, 5, 7], &9), 4); }
    #[test] fn lower_duplicate() {
        assert_eq!(lower_bound(&[1, 2, 2, 2, 3], &2), 1);
    }
    #[test] fn upper_duplicate() {
        assert_eq!(upper_bound(&[1, 2, 2, 2, 3], &2), 4);
    }
    #[test] fn equal_range_duplicate() {
        assert_eq!(equal_range(&[1, 2, 2, 2, 3], &2), 1..4);
    }
    #[test] fn empty() { assert_eq!(lower_bound::<i32>(&[], &5), 0); }
    #[test] fn insert_at_end() { assert_eq!(insert_position(&[1, 2, 3], &10), 3); }
}
