//! Minimal W3C-Trace-Context-flavoured span context. Captures trace id,
//! span id, flags, and a vendor list. Not a full OTel implementation; just
//! enough to plumb correlation ids through the call graph and into logs.

use serde::{Deserialize, Serialize};
use std::sync::atomic::{AtomicU64, Ordering};
static SPAN_COUNTER: AtomicU64 = AtomicU64::new(0);

use std::fmt;

/// 16-byte (128-bit) trace id, hex-encoded. 32 hex chars.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct TraceId(pub [u8; 16]);

impl TraceId {
    pub fn new_random() -> Self {
        let mut id = [0u8; 16];
        // Avoid pulling getrandom into the workspace deps for this small
        // crate; use a simple time+counter mix. Real impls should use
        // getrandom or the rand crate.
        let nanos = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_nanos() as u64)
            .unwrap_or(0);
        let ctr = SPAN_COUNTER.fetch_add(1, Ordering::Relaxed);
        for (i, b) in id.iter_mut().enumerate() {
            *b = ((nanos >> ((i % 8) * 8)) as u8).wrapping_add(i as u8).wrapping_add(ctr as u8);
        }
        Self(id)
    }
    pub fn as_hex(&self) -> String {
        let mut s = String::with_capacity(32);
        for b in &self.0 { s.push_str(&format!("{b:02x}")); }
        s
    }
}

impl fmt::Display for TraceId {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result { f.write_str(&self.as_hex()) }
}

/// 8-byte (64-bit) span id, hex-encoded. 16 hex chars.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct SpanId(pub [u8; 8]);

impl SpanId {
    pub fn new_random() -> Self {
        let mut id = [0u8; 8];
        let nanos = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_nanos() as u64)
            .unwrap_or(0);
        let ctr = SPAN_COUNTER.fetch_add(1, Ordering::Relaxed);
        for (i, b) in id.iter_mut().enumerate() {
            *b = ((nanos >> ((i % 8) * 8)) as u8)
                .wrapping_add((i as u8).wrapping_mul(31))
                .wrapping_add(ctr as u8);
        }
        Self(id)
    }
    pub fn as_hex(&self) -> String {
        let mut s = String::with_capacity(16);
        for b in &self.0 { s.push_str(&format!("{b:02x}")); }
        s
    }
}

impl fmt::Display for SpanId {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result { f.write_str(&self.as_hex()) }
}

/// W3C trace flags. Bit 0 = sampled.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct TraceFlags(pub u8);

impl TraceFlags {
    pub const SAMPLED: Self = Self(0x01);
    pub fn is_sampled(self) -> bool { self.0 & 0x01 != 0 }
}

/// Vendor-specific trace state. Free-form, encoded as `k=v,k=v`.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct TraceState(pub String);

impl TraceState {
    pub fn new() -> Self { Self(String::new()) }
    pub fn as_str(&self) -> &str { &self.0 }
}

/// Composite span context. Carry this through async boundaries.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct SpanContext {
    pub trace_id: TraceId,
    pub span_id: SpanId,
    pub flags: TraceFlags,
    pub state: TraceState,
}

impl SpanContext {
    pub fn new_root() -> Self {
        Self {
            trace_id: TraceId::new_random(),
            span_id: SpanId::new_random(),
            flags: TraceFlags::SAMPLED,
            state: TraceState::new(),
        }
    }

    pub fn new_child(&self) -> Self {
        Self {
            trace_id: self.trace_id,
            span_id: SpanId::new_random(),
            flags: self.flags,
            state: self.state.clone(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn trace_id_hex_length() {
        let t = TraceId::new_random();
        assert_eq!(t.as_hex().len(), 32);
    }

    #[test]
    fn span_id_hex_length() {
        let s = SpanId::new_random();
        assert_eq!(s.as_hex().len(), 16);
    }

    #[test]
    fn child_keeps_trace_id() {
        let root = SpanContext::new_root();
        let child = root.new_child();
        assert_eq!(root.trace_id, child.trace_id);
        assert_ne!(root.span_id, child.span_id);
    }

    #[test]
    fn flags_sampled_bit() {
        assert!(TraceFlags::SAMPLED.is_sampled());
        assert!(!TraceFlags(0).is_sampled());
    }
}
