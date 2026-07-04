use std::sync::{Arc, Mutex};
use std::collections::VecDeque;

#[derive(Debug,Clone,PartialEq)]
pub enum LogLevel { Debug, Info, Warn, Error }

#[derive(Debug,Clone)]
pub struct LogEntry { pub level: LogLevel, pub message: String }

#[derive(Clone)]
pub struct LogSink { buffer: Arc<Mutex<VecDeque<LogEntry>>>, capacity: usize }
impl LogSink {
    pub fn new(capacity: usize) -> Self { Self { buffer: Arc::new(Mutex::new(VecDeque::new())), capacity } }
    pub fn write(&self, level: LogLevel, msg: impl Into<String>) {
        let mut buf = self.buffer.lock().unwrap();
        if buf.len() >= self.capacity { buf.pop_front(); }
        buf.push_back(LogEntry { level, message: msg.into() });
    }
    pub fn info(&self, msg: impl Into<String>) { self.write(LogLevel::Info, msg); }
    pub fn warn(&self, msg: impl Into<String>) { self.write(LogLevel::Warn, msg); }
    pub fn error(&self, msg: impl Into<String>) { self.write(LogLevel::Error, msg); }
    pub fn drain(&self) -> Vec<LogEntry> { self.buffer.lock().unwrap().drain(..).collect() }
    pub fn len(&self) -> usize { self.buffer.lock().unwrap().len() }
    pub fn is_empty(&self) -> bool { self.len() == 0 }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test] fn write_and_drain() { let s=LogSink::new(10); s.info("hi"); let d=s.drain(); assert_eq!(d.len(),1); assert_eq!(d[0].message,"hi"); }
    #[test] fn capacity_evicts() { let s=LogSink::new(2); s.info("a"); s.info("b"); s.info("c"); assert_eq!(s.len(),2); let d=s.drain(); assert_eq!(d[0].message,"b"); }
    #[test] fn levels() { let s=LogSink::new(10); s.warn("w"); s.error("e"); let d=s.drain(); assert_eq!(d[0].level,LogLevel::Warn); assert_eq!(d[1].level,LogLevel::Error); }
    #[test] fn drain_empties() { let s=LogSink::new(5); s.info("x"); s.drain(); assert!(s.is_empty()); }
    #[test] fn empty_initially() { assert!(LogSink::new(5).is_empty()); }
    #[test] fn clone_shares() { let s=LogSink::new(5); let t=s.clone(); t.info("shared"); assert_eq!(s.len(),1); }
}
