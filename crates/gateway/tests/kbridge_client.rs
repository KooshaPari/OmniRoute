/**
 * Mock kbridge server: bind a Unix socket, accept one frame, reply.
 */
use std::path::PathBuf;

use omniroute_gateway::{KbridgeClient, KbridgeRequest, KbridgeResponse};
use rmp_serde::Serializer;
use serde::Serialize;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::UnixListener;

#[derive(Serialize)]
struct Reply {
    id: String,
    ok: bool,
    data: serde_json::Value,
}

#[tokio::test]
async fn roundtrip_ping() {
    let dir = tempfile::tempdir().unwrap();
    let sock = dir.path().join("k.sock");
    let listener = UnixListener::bind(&sock).unwrap();

    tokio::spawn(async move {
        let (mut s, _) = listener.accept().await.unwrap();
        let mut len_buf = [0u8; 4];
        s.read_exact(&mut len_buf).await.unwrap();
        let len = u32::from_be_bytes(len_buf) as usize;
        let mut body = vec![0u8; len];
        s.read_exact(&mut body).await.unwrap();
        let req: KbridgeRequest = rmp_serde::from_slice(&body).unwrap();
        let id = match &req {
            KbridgeRequest::Ping { id } => id.clone(),
            _ => unreachable!(),
        };
        let reply = Reply { id, ok: true, data: serde_json::json!({"pong": true}) };
        let mut buf = vec![];
        reply.serialize(&mut Serializer::new(&mut buf)).unwrap();
        let frame_len = (buf.len() as u32).to_be_bytes();
        s.write_all(&frame_len).await.unwrap();
        s.write_all(&buf).await.unwrap();
    });

    let client = KbridgeClient::with_socket(PathBuf::from(&sock));
    let reply = client.call(KbridgeRequest::Ping { id: "019f3003-fd00-7910-b23e-012452a3fc14".into() }).await.unwrap();
    match reply {
        KbridgeResponse::Ok { id, data, .. } => {
            assert_eq!(id, "019f3003-fd00-7910-b23e-012452a3fc14");
            assert_eq!(data["pong"], serde_json::json!(true));
        }
        KbridgeResponse::Err { error, .. } => panic!("unexpected err: {error:?}"),
    }
}
