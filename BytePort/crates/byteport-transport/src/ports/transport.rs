use std::io;

/// Network transport abstraction — connect, send, receive.
pub trait Transport {
    /// Connect to a remote endpoint.
    fn connect(&mut self, addr: &str) -> io::Result<()>;
    /// Disconnect from the remote endpoint.
    fn disconnect(&mut self) -> io::Result<()>;
    /// Send bytes; returns number of bytes sent.
    fn send(&mut self, data: &[u8]) -> io::Result<usize>;
    /// Receive bytes into `buf`; returns number of bytes received.
    fn recv(&mut self, buf: &mut [u8]) -> io::Result<usize>;
    /// Returns true if the transport is connected.
    fn is_connected(&self) -> bool;
    /// Return the peer address, if any.
    fn peer_addr(&self) -> Option<String>;
}

/// Mock transport for testing networking logic without a real stack.
#[derive(Debug, Clone, Default)]
pub struct MockTransportAdapter {
    pub connect_calls: Vec<String>,
    pub disconnect_calls: usize,
    pub send_calls: usize,
    pub recv_calls: usize,
    pub recv_data: Vec<u8>,
    pub sent_data: Vec<u8>,
    pub connected: bool,
    pub peer_addr: Option<String>,
}

impl MockTransportAdapter {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn with_recv_data(mut self, data: Vec<u8>) -> Self {
        self.recv_data = data;
        self
    }

    pub fn with_peer_addr(mut self, addr: impl Into<String>) -> Self {
        self.peer_addr = Some(addr.into());
        self
    }
}

impl Transport for MockTransportAdapter {
    fn connect(&mut self, addr: &str) -> io::Result<()> {
        self.connect_calls.push(addr.to_string());
        self.connected = true;
        self.peer_addr = Some(addr.to_string());
        Ok(())
    }

    fn disconnect(&mut self) -> io::Result<()> {
        self.disconnect_calls += 1;
        self.connected = false;
        self.peer_addr = None;
        Ok(())
    }

    fn send(&mut self, data: &[u8]) -> io::Result<usize> {
        self.send_calls += 1;
        self.sent_data.extend_from_slice(data);
        Ok(data.len())
    }

    fn recv(&mut self, buf: &mut [u8]) -> io::Result<usize> {
        self.recv_calls += 1;
        let len = self.recv_data.len().min(buf.len());
        if len > 0 {
            buf[..len].copy_from_slice(&self.recv_data[..len]);
            self.recv_data.drain(..len);
        }
        Ok(len)
    }

    fn is_connected(&self) -> bool {
        self.connected
    }

    fn peer_addr(&self) -> Option<String> {
        self.peer_addr.clone()
    }
}

/// Wire transport that operates over an in-memory byte pipe.
/// Simulates a real transport without requiring a network stack.
#[derive(Debug, Clone, Default)]
pub struct WireTransportAdapter {
    rx: Vec<u8>,
    tx: Vec<u8>,
    connected: bool,
    peer_addr: Option<String>,
}

impl WireTransportAdapter {
    pub fn new() -> Self {
        Self::default()
    }

    /// Provide bytes that will be returned by `recv`.
    pub fn push_rx(&mut self, data: &[u8]) {
        self.rx.extend_from_slice(data);
    }

    /// Take bytes that were sent via `send`.
    pub fn take_tx(&mut self) -> Vec<u8> {
        std::mem::take(&mut self.tx)
    }
}

impl Transport for WireTransportAdapter {
    fn connect(&mut self, addr: &str) -> io::Result<()> {
        self.connected = true;
        self.peer_addr = Some(addr.to_string());
        Ok(())
    }

    fn disconnect(&mut self) -> io::Result<()> {
        self.connected = false;
        self.peer_addr = None;
        Ok(())
    }

    fn send(&mut self, data: &[u8]) -> io::Result<usize> {
        if !self.connected {
            return Err(io::Error::new(
                io::ErrorKind::NotConnected,
                "transport not connected",
            ));
        }
        self.tx.extend_from_slice(data);
        Ok(data.len())
    }

    fn recv(&mut self, buf: &mut [u8]) -> io::Result<usize> {
        if !self.connected {
            return Err(io::Error::new(
                io::ErrorKind::NotConnected,
                "transport not connected",
            ));
        }
        let len = self.rx.len().min(buf.len());
        if len > 0 {
            buf[..len].copy_from_slice(&self.rx[..len]);
            self.rx.drain(..len);
        }
        Ok(len)
    }

    fn is_connected(&self) -> bool {
        self.connected
    }

    fn peer_addr(&self) -> Option<String> {
        self.peer_addr.clone()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn mock_transport_connect_disconnect() {
        let mut tx = MockTransportAdapter::new();
        assert!(!tx.is_connected());
        tx.connect("127.0.0.1:8080").unwrap();
        assert!(tx.is_connected());
        assert_eq!(tx.connect_calls, vec!["127.0.0.1:8080"]);
        assert_eq!(tx.peer_addr(), Some("127.0.0.1:8080".to_string()));
        tx.disconnect().unwrap();
        assert!(!tx.is_connected());
        assert_eq!(tx.peer_addr(), None);
    }

    #[test]
    fn mock_transport_send_and_recv() {
        let mut tx = MockTransportAdapter::new().with_recv_data(vec![0xAA, 0xBB, 0xCC]);
        tx.connect("any").unwrap();

        let mut buf = [0u8; 3];
        let n = tx.recv(&mut buf).unwrap();
        assert_eq!(n, 3);
        assert_eq!(buf, [0xAA, 0xBB, 0xCC]);

        let n = tx.send(b"ping").unwrap();
        assert_eq!(n, 4);
        assert_eq!(tx.sent_data, b"ping");
    }

    #[test]
    fn mock_transport_recv_drains_data() {
        let mut tx = MockTransportAdapter::new().with_recv_data(vec![1, 2, 3, 4, 5]);
        tx.connect("any").unwrap();
        let mut buf = [0u8; 2];
        tx.recv(&mut buf).unwrap();
        tx.recv(&mut buf).unwrap();
        let n = tx.recv(&mut buf).unwrap();
        assert_eq!(n, 1);
        assert_eq!(buf[0], 5);
    }

    #[test]
    fn wire_transport_connect_and_send() {
        let mut tx = WireTransportAdapter::new();
        tx.connect("pipe").unwrap();
        tx.send(b"hello").unwrap();
        assert_eq!(tx.take_tx(), b"hello");
    }

    #[test]
    fn wire_transport_recv_reads_pushed_data() {
        let mut tx = WireTransportAdapter::new();
        tx.connect("pipe").unwrap();
        tx.push_rx(b"world");
        let mut buf = [0u8; 5];
        let n = tx.recv(&mut buf).unwrap();
        assert_eq!(n, 5);
        assert_eq!(&buf, b"world");
    }

    #[test]
    fn wire_transport_send_when_disconnected_fails() {
        let mut tx = WireTransportAdapter::new();
        let result = tx.send(b"x");
        assert!(result.is_err());
    }
}
