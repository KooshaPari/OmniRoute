use std::collections::VecDeque;

pub struct SlidingWindow<T> { items: VecDeque<T>, capacity: usize }
impl<T> SlidingWindow<T> {
    pub fn new(capacity: usize) -> Self { Self { items: VecDeque::new(), capacity } }
    pub fn push(&mut self, item: T) {
        self.items.push_back(item);
        while self.items.len() > self.capacity { self.items.pop_front(); }
    }
    pub fn window(&self) -> &VecDeque<T> { &self.items }
    pub fn len(&self) -> usize { self.items.len() }
    pub fn is_full(&self) -> bool { self.items.len() == self.capacity }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test] fn push_within() { let mut w: SlidingWindow<i32> = SlidingWindow::new(3); w.push(1); w.push(2); assert_eq!(w.len(), 2); }
    #[test] fn overflow_evicts() { let mut w: SlidingWindow<i32> = SlidingWindow::new(3); for i in 1..=5 { w.push(i); } assert_eq!(w.window().iter().copied().collect::<Vec<_>>(), vec![3, 4, 5]); }
    #[test] fn is_full() { let mut w: SlidingWindow<i32> = SlidingWindow::new(2); w.push(1); assert!(!w.is_full()); w.push(2); assert!(w.is_full()); }
    #[test] fn capacity_zero() { let mut w: SlidingWindow<i32> = SlidingWindow::new(0); w.push(1); assert_eq!(w.len(), 0); }
}
