pub struct Stack<T> { items: Vec<T> }
impl<T> Stack<T> {
    pub fn new() -> Self { Self { items: Vec::new() } }
    pub fn push(&mut self, v: T) { self.items.push(v); }
    pub fn pop(&mut self) -> Option<T> { self.items.pop() }
    pub fn peek(&self) -> Option<&T> { self.items.last() }
    pub fn len(&self) -> usize { self.items.len() }
    pub fn is_empty(&self) -> bool { self.items.is_empty() }
}
impl<T> Default for Stack<T> { fn default() -> Self { Self::new() } }
#[cfg(test)]
mod tests {
    use super::*;
    #[test] fn push_pop() { let mut s: Stack<i32> = Stack::new(); s.push(1); s.push(2); assert_eq!(s.pop(), Some(2)); assert_eq!(s.pop(), Some(1)); }
    #[test] fn peek() { let mut s: Stack<i32> = Stack::new(); s.push(42); assert_eq!(s.peek(), Some(&42)); assert_eq!(s.len(), 1); }
    #[test] fn empty_pop() { let mut s: Stack<i32> = Stack::new(); assert_eq!(s.pop(), None); }
    #[test] fn empty_peek() { let s: Stack<i32> = Stack::new(); assert_eq!(s.peek(), None); }
    #[test] fn is_empty() { let mut s: Stack<i32> = Stack::new(); assert!(s.is_empty()); s.push(1); assert!(!s.is_empty()); }
}
