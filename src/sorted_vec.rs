pub struct SortedVec<T: Ord> { items: Vec<T> }
impl<T: Ord> SortedVec<T> {
    pub fn new() -> Self { Self { items: Vec::new() } }
    pub fn insert(&mut self, v: T) -> bool {
        match self.items.binary_search(&v) {
            Ok(_) => false,
            Err(pos) => { self.items.insert(pos, v); true }
        }
    }
    pub fn contains(&self, v: &T) -> bool { self.items.binary_search(v).is_ok() }
    pub fn len(&self) -> usize { self.items.len() }
    pub fn is_empty(&self) -> bool { self.items.is_empty() }
    pub fn iter(&self) -> std::slice::Iter<T> { self.items.iter() }
    pub fn pop(&mut self) -> Option<T> { self.items.pop() }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test] fn insert_maintains_order() { let mut s = SortedVec::new(); s.insert(3); s.insert(1); s.insert(2); assert_eq!(s.iter().copied().collect::<Vec<_>>(), vec![1,2,3]); }
    #[test] fn dedup() { let mut s = SortedVec::new(); assert!(s.insert(1)); assert!(!s.insert(1)); assert_eq!(s.len(), 1); }
    #[test] fn contains() { let mut s = SortedVec::new(); s.insert(5); assert!(s.contains(&5)); assert!(!s.contains(&3)); }
    #[test] fn empty() { let s: SortedVec<i32> = SortedVec::new(); assert!(s.is_empty()); }
    #[test] fn pop() { let mut s = SortedVec::new(); s.insert(1); s.insert(2); assert_eq!(s.pop(), Some(2)); }
}
