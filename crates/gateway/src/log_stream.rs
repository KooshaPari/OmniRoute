/**
 * Bounded ring buffer for omniroute-server stderr/stdout.
 * The webview subscribes via the `gateway://log` Tauri event.
 */
use std::sync::Mutex;

#[derive(Default)]
pub struct RingBuffer {
    inner: Mutex<Vec<String>>,
    capacity: usize,
}

impl RingBuffer {
    pub fn new(capacity: usize) -> Self {
        Self { inner: Mutex::new(Vec::with_capacity(capacity)), capacity }
    }

    pub fn push(&self, line: String) {
        let mut g = self.inner.lock().unwrap();
        if g.len() == self.capacity {
            g.remove(0);
        }
        g.push(line);
    }

    pub fn tail(&self, n: usize) -> Vec<String> {
        let g = self.inner.lock().unwrap();
        let start = g.len().saturating_sub(n);
        g[start..].to_vec()
    }
}
