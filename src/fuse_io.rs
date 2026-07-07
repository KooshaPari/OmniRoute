//! FUSE IO interception data structures (no actual mount).
//!
//! Provides a minimal wire-format abstraction over FUSE-style requests
//! and responses, used by upstream sharecli-fuse (L122) to bridge user-space
//! IO events into the sharecli scheduler.

#![allow(dead_code)]

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct IoRequest {
    pub ino: u64,
    pub op: IoOp,
    pub offset: u64,
    pub size: u32,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum IoOp {
    Read,
    Write { data: Vec<u8> },
    Create { mode: u32 },
    Unlink,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum IoErrorKind {
    PermissionDenied,
    NotFound,
    IoError,
    InvalidArgument,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct IoError {
    pub kind: IoErrorKind,
    pub message: String,
}

impl std::fmt::Display for IoError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{:?}: {}", self.kind, self.message)
    }
}

impl std::error::Error for IoError {}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum IoResponseKind {
    Data(Vec<u8>),
    Created { ino: u64 },
    Ok,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct IoResponse {
    pub req: IoRequest,
    pub result: Result<IoResponseKind, IoError>,
}

pub trait IoHandler: Send + Sync {
    fn handle(&self, req: IoRequest) -> IoResponse;
}

/// Default passthrough handler that echoes Read ops with an empty buffer.
/// Provided so users have something to embed; real handlers are built on top.
pub struct EchoHandler;

impl IoHandler for EchoHandler {
    fn handle(&self, req: IoRequest) -> IoResponse {
        let result = match req.op {
            IoOp::Read => Ok(IoResponseKind::Data(vec![0u8; req.size as usize])),
            IoOp::Write { data } => {
                if data.is_empty() {
                    Err(IoError {
                        kind: IoErrorKind::InvalidArgument,
                        message: "empty write".into(),
                    })
                } else {
                    Ok(IoResponseKind::Ok)
                }
            }
            IoOp::Create { .. } => Ok(IoResponseKind::Created { ino: req.ino }),
            IoOp::Unlink => Ok(IoResponseKind::Ok),
        };
        IoResponse { req, result }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn read_round_trips_to_data() {
        let h = EchoHandler;
        let req = IoRequest {
            ino: 42,
            op: IoOp::Read,
            offset: 0,
            size: 16,
        };
        let resp = h.handle(req.clone());
        match resp.result {
            Ok(IoResponseKind::Data(buf)) => assert_eq!(buf.len(), 16),
            other => panic!("expected Data(16), got {:?}", other),
        }
        assert_eq!(resp.req.ino, 42);
    }

    #[test]
    fn write_with_data_ok() {
        let h = EchoHandler;
        let req = IoRequest {
            ino: 1,
            op: IoOp::Write { data: vec![1, 2, 3] },
            offset: 0,
            size: 3,
        };
        let resp = h.handle(req);
        assert!(matches!(resp.result, Ok(IoResponseKind::Ok)));
    }

    #[test]
    fn empty_write_errors() {
        let h = EchoHandler;
        let req = IoRequest {
            ino: 1,
            op: IoOp::Write { data: vec![] },
            offset: 0,
            size: 0,
        };
        let resp = h.handle(req);
        assert!(resp.result.is_err());
        assert_eq!(
            resp.result.as_ref().err().unwrap().kind,
            IoErrorKind::InvalidArgument
        );
    }

    #[test]
    fn create_returns_ino() {
        let h = EchoHandler;
        let req = IoRequest {
            ino: 99,
            op: IoOp::Create { mode: 0o644 },
            offset: 0,
            size: 0,
        };
        let resp = h.handle(req);
        match resp.result {
            Ok(IoResponseKind::Created { ino }) => assert_eq!(ino, 99),
            other => panic!("expected Created{{ino:99}}, got {:?}", other),
        }
    }

    #[test]
    fn unlink_ok() {
        let h = EchoHandler;
        let req = IoRequest {
            ino: 5,
            op: IoOp::Unlink,
            offset: 0,
            size: 0,
        };
        let resp = h.handle(req);
        assert!(matches!(resp.result, Ok(IoResponseKind::Ok)));
    }
}
