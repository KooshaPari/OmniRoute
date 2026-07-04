use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

#[derive(Debug,Clone,PartialEq)]
pub enum SignalKind { Shutdown, Reload, Usr1, Usr2 }

#[derive(Clone,Default)]
pub struct ShutdownFlag { flag: Arc<AtomicBool> }
impl ShutdownFlag {
    pub fn new() -> Self { Self { flag: Arc::new(AtomicBool::new(false)) } }
    pub fn trigger(&self) { self.flag.store(true, Ordering::SeqCst); }
    pub fn is_set(&self) -> bool { self.flag.load(Ordering::SeqCst) }
    pub fn reset(&self) { self.flag.store(false, Ordering::SeqCst); }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test] fn initially_clear() { assert!(!ShutdownFlag::new().is_set()); }
    #[test] fn trigger_sets() { let f=ShutdownFlag::new(); f.trigger(); assert!(f.is_set()); }
    #[test] fn reset_clears() { let f=ShutdownFlag::new(); f.trigger(); f.reset(); assert!(!f.is_set()); }
    #[test] fn clone_shares_state() { let f=ShutdownFlag::new(); let g=f.clone(); g.trigger(); assert!(f.is_set()); }
    #[test] fn signal_kinds_eq() { assert_eq!(SignalKind::Shutdown,SignalKind::Shutdown); assert_ne!(SignalKind::Shutdown,SignalKind::Reload); }
}
