pub struct Queue2<T> { items: Vec<T> }
impl<T> Queue2<T> {
    pub fn new() -> Self { Self { items: Vec::new() } }
    pub fn enqueue(&mut self, v: T) { self.items.push(v); }
    pub fn dequeue(&mut self) -> Option<T> { if self.items.is_empty() { None } else { Some(self.items.remove(0)) } }
    pub fn front(&self) -> Option<&T> { self.items.first() }
    pub fn len(&self) -> usize { self.items.len() }
    pub fn is_empty(&self) -> bool { self.items.is_empty() }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test] fn enqueue_dequeue() { let mut q: Queue2<i32> = Queue2::new(); q.enqueue(1); q.enqueue(2); assert_eq!(q.dequeue(), Some(1)); assert_eq!(q.dequeue(), Some(2)); }
    #[test] fn front() { let mut q: Queue2<i32> = Queue2::new(); q.enqueue(42); assert_eq!(q.front(), Some(&42)); assert_eq!(q.len(), 1); }
    #[test] fn empty() { let mut q: Queue2<i32> = Queue2::new(); assert_eq!(q.dequeue(), None); assert_eq!(q.front(), None); }
    #[test] fn fifo() { let mut q: Queue2<i32> = Queue2::new(); q.enqueue(1); q.enqueue(2); q.enqueue(3); assert_eq!(q.dequeue(), Some(1)); assert_eq!(q.dequeue(), Some(2)); }
    #[test] fn is_empty() { let mut q: Queue2<i32> = Queue2::new(); assert!(q.is_empty()); q.enqueue(1); assert!(!q.is_empty()); }
}
