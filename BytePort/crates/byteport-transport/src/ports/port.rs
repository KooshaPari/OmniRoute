use std::io;

/// I/O port abstraction — low-level byte read/write interface.
pub trait Port {
    /// Open the port for I/O.
    fn open(&mut self) -> io::Result<()>;
    /// Close the port.
    fn close(&mut self) -> io::Result<()>;
    /// Read bytes into `buf`; returns number of bytes read.
    fn read(&mut self, buf: &mut [u8]) -> io::Result<usize>;
    /// Write bytes from `buf`; returns number of bytes written.
    fn write(&mut self, buf: &[u8]) -> io::Result<usize>;
    /// Returns true if the port is currently open.
    fn is_open(&self) -> bool;
}

/// Mock adapter for testing port behaviour without real hardware.
#[derive(Debug, Clone, Default)]
pub struct MockPortAdapter {
    pub open_calls: usize,
    pub close_calls: usize,
    pub read_calls: usize,
    pub write_calls: usize,
    pub read_data: Vec<u8>,
    pub written_data: Vec<u8>,
    pub is_open: bool,
    pub next_read_len: usize,
}

impl MockPortAdapter {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn with_read_data(mut self, data: Vec<u8>) -> Self {
        self.read_data = data;
        self
    }

    pub fn with_next_read_len(mut self, len: usize) -> Self {
        self.next_read_len = len;
        self
    }
}

impl Port for MockPortAdapter {
    fn open(&mut self) -> io::Result<()> {
        self.open_calls += 1;
        self.is_open = true;
        Ok(())
    }

    fn close(&mut self) -> io::Result<()> {
        self.close_calls += 1;
        self.is_open = false;
        Ok(())
    }

    fn read(&mut self, buf: &mut [u8]) -> io::Result<usize> {
        self.read_calls += 1;
        let read_len = if self.next_read_len == 0 {
            buf.len()
        } else {
            self.next_read_len
        };
        let len = read_len.min(self.read_data.len()).min(buf.len());
        if len > 0 {
            buf[..len].copy_from_slice(&self.read_data[..len]);
            self.read_data.drain(..len);
        }
        Ok(len)
    }

    fn write(&mut self, buf: &[u8]) -> io::Result<usize> {
        self.write_calls += 1;
        self.written_data.extend_from_slice(buf);
        Ok(buf.len())
    }

    fn is_open(&self) -> bool {
        self.is_open
    }
}

/// Wire adapter that performs real I/O against an in-memory buffer.
/// Useful for integration-style tests where you want a real-ish port.
#[derive(Debug, Clone, Default)]
pub struct WirePortAdapter {
    buffer: Vec<u8>,
    read_cursor: usize,
    is_open: bool,
}

impl WirePortAdapter {
    pub fn new(buffer: Vec<u8>) -> Self {
        Self {
            buffer,
            read_cursor: 0,
            is_open: false,
        }
    }
}

impl Port for WirePortAdapter {
    fn open(&mut self) -> io::Result<()> {
        self.is_open = true;
        Ok(())
    }

    fn close(&mut self) -> io::Result<()> {
        self.is_open = false;
        Ok(())
    }

    fn read(&mut self, buf: &mut [u8]) -> io::Result<usize> {
        if !self.is_open {
            return Err(io::Error::new(io::ErrorKind::NotConnected, "port closed"));
        }
        let remaining = self.buffer.len().saturating_sub(self.read_cursor);
        let len = remaining.min(buf.len());
        if len > 0 {
            buf[..len].copy_from_slice(&self.buffer[self.read_cursor..self.read_cursor + len]);
            self.read_cursor += len;
        }
        Ok(len)
    }

    fn write(&mut self, buf: &[u8]) -> io::Result<usize> {
        if !self.is_open {
            return Err(io::Error::new(io::ErrorKind::NotConnected, "port closed"));
        }
        self.buffer.extend_from_slice(buf);
        Ok(buf.len())
    }

    fn is_open(&self) -> bool {
        self.is_open
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn mock_port_open_close() {
        let mut port = MockPortAdapter::new();
        assert!(!port.is_open());
        port.open().unwrap();
        assert!(port.is_open());
        assert_eq!(port.open_calls, 1);
        port.close().unwrap();
        assert!(!port.is_open());
        assert_eq!(port.close_calls, 1);
    }

    #[test]
    fn mock_port_read_returns_configured_data() {
        let mut port = MockPortAdapter::new().with_read_data(vec![1, 2, 3, 4]);
        port.open().unwrap();
        let mut buf = [0u8; 2];
        let n = port.read(&mut buf).unwrap();
        assert_eq!(n, 2);
        assert_eq!(buf, [1, 2]);
        let n = port.read(&mut buf).unwrap();
        assert_eq!(n, 2);
        assert_eq!(buf, [3, 4]);
    }

    #[test]
    fn mock_port_write_records_data() {
        let mut port = MockPortAdapter::new();
        port.open().unwrap();
        let n = port.write(b"hello").unwrap();
        assert_eq!(n, 5);
        assert_eq!(port.written_data, b"hello");
        assert_eq!(port.write_calls, 1);
    }

    #[test]
    fn wire_port_read_after_open() {
        let mut port = WirePortAdapter::new(vec![10, 20, 30]);
        port.open().unwrap();
        let mut buf = [0u8; 3];
        let n = port.read(&mut buf).unwrap();
        assert_eq!(n, 3);
        assert_eq!(buf, [10, 20, 30]);
    }

    #[test]
    fn wire_port_write_extends_buffer() {
        let mut port = WirePortAdapter::new(vec![]);
        port.open().unwrap();
        port.write(b"abc").unwrap();
        let mut buf = [0u8; 3];
        let n = port.read(&mut buf).unwrap();
        assert_eq!(n, 3);
        assert_eq!(&buf, b"abc");
    }

    #[test]
    fn wire_port_read_when_closed_fails() {
        let mut port = WirePortAdapter::new(vec![1, 2]);
        let mut buf = [0u8; 2];
        let result = port.read(&mut buf);
        assert!(result.is_err());
    }
}
