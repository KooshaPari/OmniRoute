use std::collections::VecDeque;

#[derive(Debug,Clone)]
pub struct Task<T> { pub item: T, pub id: u64 }

#[derive(Default)]
pub struct TaskQueue<T> { items: VecDeque<Task<T>>, next_id: u64 }

impl<T> TaskQueue<T> {
    pub fn new() -> Self { Self { items: VecDeque::new(), next_id: 0 } }
    pub fn push(&mut self, item: T) -> u64 {
        let id = self.next_id;
        self.next_id += 1;
        self.items.push_back(Task { item, id });
        id
    }
    pub fn pop(&mut self) -> Option<Task<T>> { self.items.pop_front() }
    pub fn peek(&self) -> Option<&Task<T>> { self.items.front() }
    pub fn len(&self) -> usize { self.items.len() }
    pub fn is_empty(&self) -> bool { self.items.is_empty() }
    pub fn cancel(&mut self, id: u64) -> Option<Task<T>> {
        let pos = self.items.iter().position(|t| t.id == id)?;
        self.items.remove(pos)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test] fn push_increments() {
        let mut q: TaskQueue<&str> = TaskQueue::new();
        let a = q.push("a"); let b = q.push("b");
        assert_eq!(a, 0); assert_eq!(b, 1);
    }
    #[test] fn pop_fifo() {
        let mut q: TaskQueue<i32> = TaskQueue::new();
        q.push(1); q.push(2); q.push(3);
        assert_eq!(q.pop().unwrap().item, 1);
        assert_eq!(q.pop().unwrap().item, 2);
    }
    #[test] fn empty_peek() { let q: TaskQueue<u8> = TaskQueue::new(); assert!(q.peek().is_none()); }
    #[test] fn cancel_by_id() {
        let mut q: TaskQueue<&str> = TaskQueue::new();
        q.push("a"); let b = q.push("b");
        assert!(q.cancel(b).is_some());
        assert_eq!(q.len(), 1);
    }
    #[test] fn cancel_missing() {
        let mut q: TaskQueue<&str> = TaskQueue::new();
        q.push("a");
        assert!(q.cancel(999).is_none());
    }
    #[test] fn is_empty() { let mut q: TaskQueue<u32> = TaskQueue::new(); assert!(q.is_empty()); q.push(1); assert!(!q.is_empty()); }
}