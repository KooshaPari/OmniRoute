pub struct RingBuffer<T> { data: Vec<Option<T>>, head: usize, tail: usize, size: usize }
impl<T> RingBuffer<T> {
    pub fn new(capacity: usize) -> Self { Self { data: (0..capacity).map(|_| None).collect(), head: 0, tail: 0, size: 0 } }
    pub fn push(&mut self, v: T) -> Option<T> {
        let evicted = if self.size == self.data.len() {
            let old = self.data[self.head].take();
            self.head = (self.head + 1) % self.data.len();
            self.size -= 1;
            old
        } else { None };
        self.data[self.tail] = Some(v);
        self.tail = (self.tail + 1) % self.data.len();
        self.size += 1;
        evicted
    }
    pub fn len(&self) -> usize { self.size }
    pub fn capacity(&self) -> usize { self.data.len() }
    pub fn is_empty(&self) -> bool { self.size == 0 }
    pub fn peek(&self) -> Option<&T> { self.data[self.head].as_ref() }
    pub fn to_vec(&self) -> Vec<&T> {
        let mut v = Vec::with_capacity(self.size);
        for i in 0..self.size { let idx = (self.head + i) % self.data.len(); v.push(self.data[idx].as_ref().unwrap()); }
        v
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test] fn push_within_capacity() { let mut r = RingBuffer::new(3); r.push(1); r.push(2); assert_eq!(r.len(), 2); }
    #[test] fn push_over_capacity_evicts() { let mut r = RingBuffer::new(2); assert!(r.push(1).is_none()); assert!(r.push(2).is_none()); assert_eq!(r.push(3), Some(1)); assert_eq!(r.len(), 2); }
    #[test] fn peek_oldest() { let mut r = RingBuffer::new(3); r.push(1); r.push(2); r.push(3); assert_eq!(r.peek(), Some(&1)); }
    #[test] fn fifo_order() { let mut r = RingBuffer::new(3); r.push(1); r.push(2); r.push(3); r.push(4); assert_eq!(r.to_vec(), vec![&2, &3, &4]); }
    #[test] fn empty() { let r: RingBuffer<i32> = RingBuffer::new(3); assert!(r.is_empty()); assert!(r.peek().is_none()); }
}
