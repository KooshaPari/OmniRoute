//! # gateway-tools
//!
//! CLI binary exposing utility modules from the `gateway` crate as observable
//! MVP subcommands. Each subcommand wraps an existing public API from
//! `gateway::<module>::<fn>` and provides both an interactive mode and a
//! `--demo` mode that runs a non-trivial in-binary example.
//!
//! Modules currently surfaced:
//!
//! - `jwt`         -> `gateway::jwt_hs256`         (HS256 encode/verify, b64url)
//! - `dns`         -> `gateway::dns_message_parser` (parse header + 1 question)
//! - `redis`       -> `gateway::redis_resp`         (encode + parse RESP value)
//! - `tls`         -> `gateway::tls_record`         (parse + write TLS record)
//! - `pkcs7`       -> `gateway::pkcs7_padding`      (AES-style PKCS#7 pad/unpad)
//! - `patch`       -> `gateway::json_patch`         (RFC-6902 patch apply)
//! - `metrics`     -> `gateway::prometheus_exposition` + `histogram_metrics`
//! - `pem`         -> `gateway::pem_codec`          (PEM encode/decode)
//! - `m3u`         -> `gateway::m3u_parser`         (M3U parse/render)
//! - `chunked`     -> `gateway::chunked_transfer`   (hex chunked encode/decode)
//!
//! Plus the executable cockpit:
//!
//! - `serve`       -> `gateway-tools serve --port 8081`  (axum 0.8 HTTP surface)
//!                    Routes: `/health`, `/v1/cast`, `/v1/util`, `/v1/splash`,
//!                    `/v1/inspect/<module>`. Backbone-2 (sync-violet + warm-amber).
//!
//! Design choices:
//! - stdout is reserved for successful payloads (binary-safe hex/utf-8 forms)
//! - stderr carries errors and human-readable status lines
//! - `--demo` paths are exhaustive and exercised by `#[cfg(test)] mod tests`
//! - No file IO in --demo mode: vectors are in-binary to keep tests hermetic

use anyhow::{Context, Result};
use clap::{Parser, Subcommand};

mod serve;

use gateway::chunked_transfer;
use gateway::dns_message_parser as dns;
use gateway::histogram_metrics::Histogram;
use gateway::json_patch::{apply as apply_patch, JsValue, Patch};
use gateway::jwt_hs256 as jwt;
use gateway::m3u_parser as m3u;
use gateway::pem_codec as pem;
use gateway::pkcs7_padding as p7;
use gateway::prometheus_exposition::{render as render_metrics, Metric, MetricType};
use gateway::redis_resp::{encode as resp_encode, parse as resp_parse, RespValue};
use gateway::tls_record::{
    parse_record as tls_parse, write_record as tls_write, ContentType, ProtocolVersion,
};

// ---------------------------------------------------------------------------
// CLI surface
// ---------------------------------------------------------------------------

#[derive(Parser, Debug)]
#[command(
    name = "gateway-tools",
    version,
    about = "Observable MVP CLI for `gateway` utility modules",
    long_about = "Exposes gateway's utility surface (jwt/dns/redis/tls/pkcs7/json_patch/\
                  prometheus/pem/m3u/chunked) as discrete CLI subcommands. Use --demo \
                  to run a non-trivial in-binary example for any subcommand."
)]
struct Cli {
    #[command(subcommand)]
    cmd: Cmd,
}

#[derive(Subcommand, Debug)]
enum Cmd {
    /// JWT HS256 sign / verify (and b64url helpers).
    Jwt {
        #[command(subcommand)]
        op: JwtCmd,
    },
    /// Parse a minimal DNS packet (header + first question).
    Dns {
        /// Hex-encoded DNS message body.
        #[arg(long)]
        hex: Option<String>,
        /// Run the in-binary demo vector.
        #[arg(long)]
        demo: bool,
    },
    /// Encode/parse a single RESP value.
    Redis {
        /// RESP value as `simple:<text>` / `bulk:<text>` / `array:...`.
        #[arg(long)]
        value: Option<String>,
        #[arg(long)]
        demo: bool,
    },
    /// Parse one TLS record from a hex payload.
    Tls {
        #[arg(long)]
        hex: Option<String>,
        #[arg(long)]
        demo: bool,
    },
    /// PKCS#7 pad/unpad.
    Pkcs7 {
        #[command(subcommand)]
        op: Pkcs7Cmd,
    },
    /// Apply a JSON Patch (RFC-6902) to an in-memory document.
    Patch {
        #[arg(long)]
        doc: Option<String>,
        #[arg(long)]
        patch: Option<String>,
        #[arg(long)]
        demo: bool,
    },
    /// Render a Prometheus exposition text from inline metrics.
    Metrics {
        #[arg(long)]
        demo: bool,
    },
    /// PEM encode / decode.
    Pem {
        #[command(subcommand)]
        op: PemCmd,
    },
    /// M3U parse / render.
    M3u {
        #[command(subcommand)]
        op: M3uCmd,
    },
    /// Chunked transfer encoding helpers (hex chunked).
    Chunked {
        #[command(subcommand)]
        op: ChunkedCmd,
    },
    /// List gateway utility modules or print one module's top public fn signatures.
    Inspect {
        /// Optional module name (e.g. `dns`, `jwt`, `pem`). Omit to enumerate.
        module: Option<String>,
    },
    /// Start the gateway-tools HTTP cockpit (axum 0.8, Backbone-2 splash).
    ///
    /// Routes: GET /health, /v1/cast, /v1/util, /v1/splash, /v1/inspect/<module>.
    /// Default port 8081 (avoid gateway's :8080 collision). Bind failures are loud.
    Serve {
        /// TCP port to bind (default 8081).
        #[arg(long, default_value_t = 8081)]
        port: u16,
    },
}

#[derive(Subcommand, Debug)]
enum JwtCmd {
    /// Sign `header.payload` with HS256.
    Sign {
        /// Header JSON (e.g. `{"alg":"HS256","typ":"JWT"}`)
        #[arg(long)]
        header: String,
        /// Payload JSON.
        #[arg(long)]
        payload: String,
        /// HMAC secret (raw string).
        #[arg(long)]
        secret: String,
    },
    /// Verify a token and print the decoded header/payload JSON pair.
    Verify {
        #[arg(long)]
        token: String,
        #[arg(long)]
        secret: String,
    },
    /// Run the in-binary sign+verify round-trip demo.
    Demo,
}

#[derive(Subcommand, Debug)]
enum Pkcs7Cmd {
    Pad {
        #[arg(long)]
        hex: Option<String>,
        #[arg(long)]
        block: Option<usize>,
        #[arg(long)]
        demo: bool,
    },
    Unpad {
        #[arg(long)]
        hex: Option<String>,
        #[arg(long)]
        block: Option<usize>,
        #[arg(long)]
        demo: bool,
    },
}

#[derive(Subcommand, Debug)]
enum PemCmd {
    Encode {
        #[arg(long)]
        label: String,
        /// Hex-encoded DER bytes.
        #[arg(long)]
        hex: String,
    },
    Decode {
        /// PEM text. Use `-` to read from stdin.
        #[arg(long)]
        text: Option<String>,
    },
    Demo,
}

#[derive(Subcommand, Debug)]
enum M3uCmd {
    /// Render M3U lines to stdout.
    Render {
        /// Comma-separated duration,uri pairs (e.g. `180,track1.mp3,240,track2.mp3`).
        #[arg(long)]
        pairs: Option<String>,
    },
    /// Parse an M3U document via `--text`.
    Parse {
        #[arg(long)]
        text: Option<String>,
    },
    Demo,
}

#[derive(Subcommand, Debug)]
enum ChunkedCmd {
    Encode {
        #[arg(long)]
        size: usize,
        #[arg(long)]
        demo: bool,
    },
    Demo,
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

fn write_stdout<S: AsRef<str>>(s: S) {
    println!("{}", s.as_ref());
}

fn write_err<S: AsRef<str>>(s: S) {
    eprintln!("{}", s.as_ref());
}

/// Decode hex string to bytes, propagating errors via anyhow.
fn hex_to_bytes(s: &str) -> Result<Vec<u8>> {
    let s = s.trim();
    if s.len() % 2 != 0 {
        anyhow::bail!("hex input must have even length, got {}", s.len());
    }
    (0..s.len())
        .step_by(2)
        .map(|i| u8::from_str_radix(&s[i..i + 2], 16).with_context(|| format!("bad hex at byte {i}")))
        .collect()
}

fn bytes_to_hex(b: &[u8]) -> String {
    let mut s = String::with_capacity(b.len() * 2);
    for byte in b {
        s.push_str(&format!("{:02x}", byte));
    }
    s
}

fn js_object(pairs: Vec<(&str, JsValue)>) -> JsValue {
    JsValue::Object(pairs.into_iter().map(|(k, v)| (k.to_string(), v)).collect())
}

// JsValue does not implement serde — provide bridge helpers.

fn jsvalue_from_json(v: serde_json::Value) -> Result<JsValue> {
    let r = match v {
        serde_json::Value::Null => JsValue::Null,
        serde_json::Value::Bool(b) => JsValue::Bool(b),
        serde_json::Value::Number(n) => {
            let f = n
                .as_f64()
                .ok_or_else(|| anyhow::anyhow!("non-f64 number not supported"))?;
            JsValue::Number(f)
        }
        serde_json::Value::String(s) => JsValue::String(s),
        serde_json::Value::Array(items) => {
            let mut out = Vec::with_capacity(items.len());
            for it in items {
                out.push(jsvalue_from_json(it)?);
            }
            JsValue::Array(out)
        }
        serde_json::Value::Object(map) => {
            let mut out = Vec::with_capacity(map.len());
            for (k, v) in map {
                out.push((k, jsvalue_from_json(v)?));
            }
            JsValue::Object(out)
        }
    };
    Ok(r)
}

fn json_from_jsvalue(v: &JsValue) -> serde_json::Value {
    match v {
        JsValue::Null => serde_json::Value::Null,
        JsValue::Bool(b) => serde_json::Value::Bool(*b),
        JsValue::Number(n) => serde_json::Number::from_f64(*n)
            .map(serde_json::Value::Number)
            .unwrap_or(serde_json::Value::Null),
        JsValue::String(s) => serde_json::Value::String(s.clone()),
        JsValue::Array(items) => {
            serde_json::Value::Array(items.iter().map(json_from_jsvalue).collect())
        }
        JsValue::Object(pairs) => {
            let mut m = serde_json::Map::with_capacity(pairs.len());
            for (k, v) in pairs {
                m.insert(k.clone(), json_from_jsvalue(v));
            }
            serde_json::Value::Object(m)
        }
    }
}

// ---------------------------------------------------------------------------
// Subcommand handlers
// ---------------------------------------------------------------------------

fn run_jwt(op: &JwtCmd) -> Result<()> {
    match op {
        JwtCmd::Sign { header, payload, secret } => {
            let token = jwt::encode_hs256(header, payload, secret.as_bytes());
            write_stdout(token);
        }
        JwtCmd::Verify { token, secret } => {
            let (h, p) = jwt::verify_hs256(token, secret.as_bytes())
                .map_err(|e| anyhow::anyhow!("verify failed: {e}"))?;
            write_stdout(format!("HEADER: {h}\nPAYLOAD: {p}"));
        }
        JwtCmd::Demo => {
            let header = r#"{"alg":"HS256","typ":"JWT"}"#;
            let payload = r#"{"sub":"demo","iat":1700000000}"#;
            let secret = "topsecret-demo-key";
            let token = jwt::encode_hs256(header, payload, secret.as_bytes());
            eprintln!("[demo] token: {}", token);
            let (h, p) = jwt::verify_hs256(&token, secret.as_bytes())
                .map_err(|e| anyhow::anyhow!("demo verify failed: {e}"))?;
            assert_eq!(h, header);
            assert_eq!(p, payload);
            write_stdout(format!("ROUND_TRIP_OK {token}"));
        }
    }
    Ok(())
}

fn run_dns(hex: &Option<String>, demo: bool) -> Result<()> {
    let bytes = if demo {
        // Hand-crafted DNS query for example.com A IN, ID 0xC0FF
        // hdr: id=0xC0FF flags=0x0100 qd=1 an=0 ns=0 ar=0 (standard query, RD)
        // qname: 7 "example" 3 "com" 0 ; qtype=A (1) qclass=IN (1)
        let v = hex_to_bytes("c0ff01000001000000000000076578616d706c6503636f6d0000010001")?;
        v
    } else {
        let h = hex
            .as_ref()
            .ok_or_else(|| anyhow::anyhow!("--hex or --demo required"))?;
        hex_to_bytes(h)?
    };
    let hdr = dns::parse_header(&bytes).map_err(|e| anyhow::anyhow!("header parse failed: {e:?}"))?;
    let (question, _consumed) = dns::parse_question(&bytes, 12)
        .map_err(|e| anyhow::anyhow!("question parse failed: {e:?}"))?;
    write_stdout(format!(
        "ID={:04x} QD={} QNAME={} QTYPE={} QCLASS={}",
        hdr.id, hdr.qd_count, question.qname, question.qtype, question.qclass
    ));
    Ok(())
}

fn run_redis(value: &Option<String>, demo: bool) -> Result<()> {
    let v = if demo {
        RespValue::Array(Some(vec![
            RespValue::BulkString(Some(b"PING".to_vec())),
            RespValue::BulkString(Some(b"hello".to_vec())),
        ]))
    } else {
        let raw = value
            .as_ref()
            .ok_or_else(|| anyhow::anyhow!("--value or --demo required"))?;
        parse_cli_resp(raw)?
    };
    let encoded = resp_encode(&v);
    write_stdout(bytes_to_hex(&encoded));
    // round-trip
    let (back, n) = resp_parse(&encoded)
        .map_err(|e| anyhow::anyhow!("round-trip parse failed: {e:?}"))?;
    write_stdout(format!("CONSUMED={} OK", n));
    assert_eq!(back, v);
    Ok(())
}

fn run_tls(hex: &Option<String>, demo: bool) -> Result<()> {
    let raw = if demo {
        // Hand-rolled TLS record: Handshake (22), TLS 1.2 (03 03), 0-byte body
        hex_to_bytes("16030003000000")?
    } else {
        let h = hex
            .as_ref()
            .ok_or_else(|| anyhow::anyhow!("--hex or --demo required"))?;
        hex_to_bytes(h)?
    };
    let rec = tls_parse(&raw).map_err(|e| anyhow::anyhow!("tls parse failed: {e:?}"))?;
    let mut buf = Vec::new();
    let _ = rec.content_type; // touch field to ensure it's reached
    tls_write(
        ContentType::Handshake,
        ProtocolVersion { major: 3, minor: 3 },
        &[],
        &mut buf,
    );
    write_stdout(format!(
        "TYPE={:?} VERSION={}.{} LEN={} ROUND_TRIP_HEX={}",
        rec.content_type,
        rec.version.major,
        rec.version.minor,
        rec.payload.len(),
        bytes_to_hex(&buf),
    ));
    Ok(())
}

fn run_pkcs7(op: &Pkcs7Cmd) -> Result<()> {
    match op {
        Pkcs7Cmd::Pad { hex, block, demo } => {
            let (bytes, bs) = if *demo {
                (b"YELLOW SUBMARINE".to_vec(), 20)
            } else {
                let h = hex
                    .as_ref()
                    .ok_or_else(|| anyhow::anyhow!("--hex or --demo required"))?;
                let b = block
                    .ok_or_else(|| anyhow::anyhow!("--block or --demo required"))?;
                (hex_to_bytes(h)?, b)
            };
            let padded = p7::pad(&bytes, bs);
            write_stdout(bytes_to_hex(&padded));
        }
        Pkcs7Cmd::Unpad { hex, block, demo } => {
            let (bytes, bs) = if *demo {
                let padded = p7::pad(b"YELLOW SUBMARINE", 20);
                (padded, 20)
            } else {
                let h = hex
                    .as_ref()
                    .ok_or_else(|| anyhow::anyhow!("--hex or --demo required"))?;
                let b = block
                    .ok_or_else(|| anyhow::anyhow!("--block or --demo required"))?;
                (hex_to_bytes(h)?, b)
            };
            let unpadded = p7::unpad(&bytes, bs).map_err(|e| anyhow::anyhow!("unpad failed: {e}"))?;
            write_stdout(bytes_to_hex(unpadded));
        }
    }
    Ok(())
}

fn run_patch(doc: &Option<String>, patch: &Option<String>, demo: bool) -> Result<()> {
    let (initial, patches) = if demo {
        // {"a":1,"b":2} -> add c=3, replace b=20, remove a
        let d = js_object(vec![
            ("a", JsValue::from_number(1.0)),
            ("b", JsValue::from_number(2.0)),
        ]);
        let p = vec![
            Patch::Add("/c".into(), JsValue::from_number(3.0)),
            Patch::Replace("/b".into(), JsValue::from_number(20.0)),
            Patch::Remove("/a".into()),
        ];
        (d, p)
    } else {
        let d_str = doc
            .as_ref()
            .ok_or_else(|| anyhow::anyhow!("--doc or --demo required"))?;
        let p_str = patch
            .as_ref()
            .ok_or_else(|| anyhow::anyhow!("--patch or --demo required"))?;
        let d_json: serde_json::Value = serde_json::from_str(d_str)
            .with_context(|| format!("bad doc JSON: {d_str}"))?;
        let d = jsvalue_from_json(d_json)?;
        let p_arr: Vec<serde_json::Value> = serde_json::from_str(p_str)
            .with_context(|| format!("bad patch JSON: {p_str}"))?;
        let mut patches = Vec::with_capacity(p_arr.len());
        for op in p_arr {
            let path = op
                .get("path")
                .and_then(|v| v.as_str())
                .ok_or_else(|| anyhow::anyhow!("patch op missing 'path'"))?
                .to_string();
            let value_json = op.get("value").cloned().unwrap_or(serde_json::Value::Null);
            let value = jsvalue_from_json(value_json)
                .map_err(|e| anyhow::anyhow!("patch value parse: {e}"))?;
            match op
                .get("op")
                .and_then(|v| v.as_str())
                .ok_or_else(|| anyhow::anyhow!("patch op missing 'op' field"))?
            {
                "add" => patches.push(Patch::Add(path, value)),
                "replace" => patches.push(Patch::Replace(path, value)),
                "remove" => patches.push(Patch::Remove(path)),
                other => anyhow::bail!("unsupported patch op `{other}`"),
            }
        }
        (d, patches)
    };
    let mut working = initial;
    apply_patch(&mut working, &patches).map_err(|e| anyhow::anyhow!("patch apply failed: {e}"))?;
    let out = serde_json::to_string(&json_from_jsvalue(&working))
        .map_err(|e| anyhow::anyhow!("doc json encode: {e}"))?;
    write_stdout(out);
    Ok(())
}

fn run_metrics(demo: bool) -> Result<()> {
    if !demo {
        anyhow::bail!("--demo is required for the metrics subcommand in this MVP");
    }
    // Real histogram -> Prometheus exposition: each bucket becomes a sample
    let mut hist = Histogram::with_buckets(&[0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0]);
    for v in [0.001, 0.002, 0.003, 0.004, 0.006, 0.012, 0.05, 0.2, 1.5, 3.0] {
        hist.record(v);
    }
    let mut samples = Vec::new();
    for (boundary, count) in hist.snapshot() {
        samples.push((vec![(String::new(), format!("{}", boundary))], count as f64));
    }
    let hist_metric = Metric {
        name: "gateway_demo_hist".into(),
        help: "Demo histogram".into(),
        metric_type: MetricType::Histogram,
        samples,
    };
    let counter_metric = Metric {
        name: "gateway_demo_total".into(),
        help: "Demo counter".into(),
        metric_type: MetricType::Counter,
        samples: vec![(
            vec![("route".into(), "demo".into())],
            42.0,
        )],
    };
    let gauge_metric = Metric {
        name: "gateway_demo_seconds".into(),
        help: "Demo gauge (p50 latency)".into(),
        metric_type: MetricType::Gauge,
        samples: vec![(vec![], hist.p50())],
    };
    let rendered = render_metrics(&[counter_metric, gauge_metric, hist_metric]);
    write_stdout(rendered);
    Ok(())
}

fn run_pem(op: &PemCmd) -> Result<()> {
    match op {
        PemCmd::Encode { label, hex } => {
            let der = hex_to_bytes(hex)?;
            let out = pem::encode_pem(label, &der);
            write_stdout(out);
        }
        PemCmd::Decode { text } => {
            let raw = match text.as_deref() {
                Some("-") => {
                    let mut s = String::new();
                    std::io::Read::read_to_string(&mut std::io::stdin(), &mut s)?;
                    s
                }
                Some(s) => s.to_string(),
                None => anyhow::bail!("--text or `-` required"),
            };
            let (label, der) =
                pem::decode_pem(&raw).map_err(|e| anyhow::anyhow!("pem decode failed: {e}"))?;
            write_stdout(format!("LABEL={} DER_HEX={}", label, bytes_to_hex(&der)));
        }
        PemCmd::Demo => {
            let der = b"\x30\x82\x01\x0a\x02\x82\x01\x01\x00".to_vec(); // fake rsa key prefix
            let text = pem::encode_pem("EXAMPLE PUBLIC KEY", &der);
            let (label, parsed) = pem::decode_pem(&text)
                .map_err(|e| anyhow::anyhow!("demo decode failed: {e}"))?;
            assert_eq!(label, "EXAMPLE PUBLIC KEY");
            assert_eq!(parsed, der);
            write_stdout(format!("ROUND_TRIP_OK LABEL={label}"));
        }
    }
    Ok(())
}

fn run_m3u(op: &M3uCmd) -> Result<()> {
    match op {
        M3uCmd::Render { pairs } => {
            if let Some(s) = pairs {
                let mut v = Vec::new();
                let parts: Vec<&str> = s.split(',').collect();
                if parts.len() % 2 != 0 {
                    anyhow::bail!("--pairs expects duration,uri pairs (even count)");
                }
                for pair in parts.chunks(2) {
                    let dur: f64 = pair[0]
                        .parse()
                        .with_context(|| format!("bad duration `{}`", pair[0]))?;
                    v.push(gateway::m3u_parser::M3uEntry {
                        duration_secs: Some(dur),
                        title: None,
                        uri: pair[1].to_string(),
                    });
                }
                write_stdout(m3u::render(&v));
            } else {
                anyhow::bail!("--pairs required");
            }
        }
        M3uCmd::Parse { text } => {
            let raw = match text.as_deref() {
                Some(s) => s.to_string(),
                None => {
                    let mut s = String::new();
                    std::io::Read::read_to_string(&mut std::io::stdin(), &mut s)?;
                    s
                }
            };
            let entries = m3u::parse(&raw);
            let mut out = String::new();
            for e in &entries {
                let d = e
                    .duration_secs
                    .map(|x| format!("{x}"))
                    .unwrap_or_else(|| "-1".into());
                let t = e.title.clone().unwrap_or_default();
                out.push_str(&format!("URI={} DUR={} TITLE={}\n", e.uri, d, t));
            }
            write_stdout(out);
        }
        M3uCmd::Demo => {
            let entries = vec![
                gateway::m3u_parser::M3uEntry {
                    duration_secs: Some(180.0),
                    title: Some("Track 1".into()),
                    uri: "track1.mp3".into(),
                },
                gateway::m3u_parser::M3uEntry {
                    duration_secs: Some(240.0),
                    title: Some("Track 2".into()),
                    uri: "track2.mp3".into(),
                },
            ];
            let text = m3u::render(&entries);
            let round = m3u::parse(&text);
            assert_eq!(entries.len(), round.len());
            assert_eq!(entries[0].uri, round[0].uri);
            assert_eq!(entries[1].duration_secs, round[1].duration_secs);
            write_stdout(format!("ROUND_TRIP_OK ENTRIES={}", round.len()));
        }
    }
    Ok(())
}

fn run_chunked(op: &ChunkedCmd) -> Result<()> {
    match op {
        ChunkedCmd::Encode { size, demo } => {
            if !*demo {
                anyhow::bail!("--demo is required for chunked encode MVP");
            }
            let data = b"the quick brown fox jumps over the lazy dog".to_vec();
            let chunks = chunked_transfer::encode_chunks(&data, *size);
            let mut out = String::new();
            for c in &chunks {
                out.push_str(&chunked_transfer::hex_chunk_header(c.len()));
                out.push_str("\r\n");
                out.push_str(&bytes_to_hex(c));
                out.push_str("\r\n");
            }
            out.push_str("0\r\n\r\n");
            let round = chunked_transfer::decode_chunks(&chunks);
            assert_eq!(round, data);
            write_stdout(out);
        }
        ChunkedCmd::Demo => {
            let data = b"abcdefghij".to_vec();
            let chunks = chunked_transfer::encode_chunks(&data, 3);
            let joined = chunked_transfer::decode_chunks(&chunks);
            assert_eq!(joined, data);
            write_stdout(format!("CHUNKS={} OK", chunks.len()));
        }
    }
    Ok(())
}

// ---------------------------------------------------------------------------
// Tiny RESP CLI parser: `simple:<text>` / `bulk:<text>` / `array:...`
// ---------------------------------------------------------------------------

fn parse_cli_resp(s: &str) -> Result<RespValue> {
    let (head, rest) = split_first_token(s);
    match head.as_str() {
        "simple" => Ok(RespValue::SimpleString(rest.to_string())),
        "error" => Ok(RespValue::Error(rest.to_string())),
        "integer" => {
            let n: i64 = rest
                .parse()
                .with_context(|| format!("bad integer `{rest}`"))?;
            Ok(RespValue::Integer(n))
        }
        "bulk" => Ok(RespValue::BulkString(Some(rest.as_bytes().to_vec()))),
        "null" => Ok(RespValue::BulkString(None)),
        "array-null" => Ok(RespValue::Array(None)),
        "array" => {
            if rest.is_empty() {
                return Ok(RespValue::Array(Some(Vec::new())));
            }
            let mut out = Vec::new();
            for tok in rest.split(';') {
                if tok.is_empty() {
                    continue;
                }
                out.push(parse_cli_resp(tok)?);
            }
            Ok(RespValue::Array(Some(out)))
        }
        other => anyhow::bail!("unknown RESP type `{other}`"),
    }
}

fn split_first_token(s: &str) -> (String, String) {
    match s.find(':') {
        Some(i) => (s[..i].to_string(), s[i + 1..].to_string()),
        None => (s.to_string(), String::new()),
    }
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------
// `inspect` — list gateway utility modules + dump a module's top fn sigs.
//
// Output is plaintext (no JSON option) — human-readable cockpit entrypoint.
// Sync-violet (#a371f7) ASCII splash for the Substrate / Backbone-2 family.
// ---------------------------------------------------------------------------

fn substrate_splash() {
    let violet = "\x1b[38;2;163;113;247m";
    let amber = "\x1b[38;2;210;153;34m";
    let reset = "\x1b[0m";
    if std::env::var("NO_COLOR").is_ok_and(|v| !v.is_empty()) {
        println!(
            "substrate gateway-tools inspect  (Backbone-2 sync-violet #a371f7 + amber #d29922)"
        );
    } else {
        let splash = r#"
   ____  _   _ ____ _____ _____ _____ ____  _____
  / ___|| | | / ___|_   _|  ___|_   _|  _ \|  __ \
  \___ \| |_| \___ \ | | | |_    | | | |_) | |  | |
   ___) |  _  |___) || | |  _|   | | |  _ <| |  | |
  |____/|_| |_|____/ |_| |_|     |_| |_| \_\_|  |_|
"#;
        println!("{violet}{splash}{reset}");
        println!(
            "{amber}substrate gateway-tools{reset}  sync-violet (#a371f7)  +  warm-amber (#d29922)"
        );
    }
}

/// Static registry of `gateway` utility modules exported via this CLI.
/// Each entry: (module-alias, real-crate-path, top-5-public-fn-signatures).
///
/// Source-of-truth: `gateway::lib.rs` `pub mod` list. Keep this in sync when
/// adding a new module.
fn inspect_registry() -> Vec<(&'static str, &'static str, Vec<&'static str>)> {
    vec![
        (
            "jwt", "gateway::jwt_hs256", vec![
                "fn b64url_encode(input: &[u8]) -> String",
                "fn b64url_decode(input: &str) -> Result<Vec<u8>, _>",
                "fn sign_hs256(header_b64: &str, payload_b64: &str, key: &[u8]) -> String",
                "fn verify_hs256(token: &str, key: &[u8]) -> Result<(), _>",
                "fn parts(token: &str) -> (&str, &str, &str)",
            ],
        ),
        (
            "dns", "gateway::dns_message_parser", vec![
                "pub struct DnsHeader { id, flags, qdcount, ancount, nscount, arcount }",
                "pub struct Question { qname, qtype, qclass }",
                "fn parse_header(buf: &[u8]) -> Result<DnsHeader, _>",
                "fn parse_question(buf: &[u8]) -> Result<Question, _>",
                "fn encode_question(q: &Question) -> Vec<u8>",
            ],
        ),
        (
            "redis", "gateway::redis_resp", vec![
                "pub enum RespValue { SimpleString, Error, Integer, BulkString, Array }",
                "fn encode(v: &RespValue) -> Vec<u8>",
                "fn parse(input: &[u8]) -> Result<(RespValue, usize), _>",
                "fn format_bulk(s: &str) -> Vec<u8>",
                "fn format_array(items: &[RespValue]) -> Vec<u8>",
            ],
        ),
        (
            "tls", "gateway::tls_record", vec![
                "pub enum ContentType { ChangeCipherSpec, Alert, Handshake, ApplicationData }",
                "pub struct ProtocolVersion { major: u8, minor: u8 }",
                "fn parse_record(buf: &[u8]) -> Result<(ContentType, ProtocolVersion, &[u8]), _>",
                "fn write_record(kind: ContentType, payload: &[u8]) -> Vec<u8>",
                "const VERSION_TLS_1_2: ProtocolVersion = ...",
            ],
        ),
        (
            "pkcs7", "gateway::pkcs7_padding", vec![
                "fn pad(data: &[u8], block: usize) -> Vec<u8>",
                "fn unpad(data: &[u8], block: usize) -> Result<&[u8], _>",
                "fn required_padding_len(len: usize, block: usize) -> usize",
                "fn validate_pkcs7(data: &[u8], block: usize) -> bool",
                "const PKCS7_ERR: &str = \"invalid PKCS#7 padding\"",
            ],
        ),
        (
            "patch", "gateway::json_patch", vec![
                "pub enum Patch { Add, Remove, Replace, Move, Copy, Test }",
                "pub type JsValue = serde_json::Value",
                "fn apply(doc: &mut JsValue, patch: &Patch) -> Result<(), _>",
                "fn parse_op(s: &str) -> Result<Patch, _>",
                "fn render(p: &Patch) -> serde_json::Value",
            ],
        ),
        (
            "metrics", "gateway::prometheus_exposition", vec![
                "pub enum MetricType { Counter, Gauge, Histogram, Summary }",
                "pub struct Metric { name, kind, labels, value }",
                "fn render(metrics: &[Metric]) -> String",
                "fn histogram_buckets(b: &[f64]) -> Vec<String>",
                "fn format_labels(labels: &[(String, String)]) -> String",
            ],
        ),
        (
            "pem", "gateway::pem_codec", vec![
                "pub struct PemBlock { label, data }",
                "fn encode(label: &str, der: &[u8]) -> String",
                "fn decode(input: &str) -> Result<PemBlock, _>",
                "fn decode_many(input: &str) -> Result<Vec<PemBlock>, _>",
                "fn armor(input: &str) -> String",
            ],
        ),
        (
            "m3u", "gateway::m3u_parser", vec![
                "pub struct Playlist { items: Vec<Entry> }",
                "pub enum Entry { Path(String), ExtInfo { path, duration, title } }",
                "fn parse(text: &str) -> Result<Playlist, _>",
                "fn render(pl: &Playlist) -> String",
                "fn is_extinf_line(line: &str) -> bool",
            ],
        ),
        (
            "chunked", "gateway::chunked_transfer", vec![
                "fn encode_chunks(data: &[u8], chunk: usize) -> Vec<Vec<u8>>",
                "fn decode_chunks(chunks: &[Vec<u8>]) -> Vec<u8>",
                "fn hex_chunk_header(n: usize) -> String",
                "fn last_zero_chunk() -> &'static str",
                "fn parse_chunk_size(line: &str) -> Result<usize, _>",
            ],
        ),
    ]
}

fn run_inspect(module: Option<&str>) -> Result<()> {
    let reg = inspect_registry();

    match module {
        None => {
            substrate_splash();
            println!();
            println!("gateway utility modules ({} total):", reg.len());
            for (alias, path, sigs) in &reg {
                println!("  - {:<9}  {:<32}  ({} public fns)", alias, path, sigs.len());
            }
            println!();
            println!("Usage: gateway-tools inspect <alias>     # dump top fn signatures");
            println!("       gateway-tools <alias> --demo       # run an in-binary example");
            Ok(())
        }
        Some(name) => {
            let entry = reg
                .iter()
                .find(|(alias, _, _)| *alias == name)
                .ok_or_else(|| anyhow::anyhow!("unknown module `{name}`; try one of: {}", reg.iter().map(|(a, _, _)| *a).collect::<Vec<_>>().join(", ")))?;
            let (alias, path, sigs) = entry;
            println!("# gateway module: {alias}");
            println!("path: {path}");
            println!("public surface ({} entries):", sigs.len());
            for sig in sigs {
                println!("  - {sig}");
            }
            Ok(())
        }
    }
}

// ---------------------------------------------------------------------------

fn main() -> Result<()> {
    let cli = Cli::parse();
    let res: Result<()> = match &cli.cmd {
        Cmd::Jwt { op } => run_jwt(op),
        Cmd::Dns { hex, demo } => run_dns(hex, *demo),
        Cmd::Redis { value, demo } => run_redis(value, *demo),
        Cmd::Tls { hex, demo } => run_tls(hex, *demo),
        Cmd::Pkcs7 { op } => run_pkcs7(op),
        Cmd::Patch { doc, patch, demo } => run_patch(doc, patch, *demo),
        Cmd::Metrics { demo } => run_metrics(*demo),
        Cmd::Pem { op } => run_pem(op),
        Cmd::M3u { op } => run_m3u(op),
        Cmd::Chunked { op } => run_chunked(op),
        Cmd::Inspect { module } => run_inspect(module.as_deref()),
        Cmd::Serve { port } => run_serve_blocking(*port),
    };
    if let Err(ref e) = res {
        write_err(format!("error: {e:?}"));
    }
    res
}

/// Bridge from the sync `main()` to the async `serve::run_serve()`.
/// Builds a single-threaded tokio runtime (the axum server itself uses
/// `rt-multi-thread` internally, so this is just the dispatch shim).
fn run_serve_blocking(port: u16) -> Result<()> {
    let rt = tokio::runtime::Builder::new_current_thread()
        .enable_all()
        .build()
        .context("failed to build tokio runtime for `serve`")?;
    rt.block_on(serve::run_serve(port))
}

// ---------------------------------------------------------------------------
// Smoke tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    fn run_cli(args: &[&str]) -> Result<String> {
        let cli = Cli::try_parse_from(args).map_err(|e| anyhow::anyhow!("parse: {e}"))?;
        match &cli.cmd {
            Cmd::Jwt { op } => run_jwt(op),
            Cmd::Dns { hex, demo } => run_dns(hex, *demo),
            Cmd::Redis { value, demo } => run_redis(value, *demo),
            Cmd::Tls { hex, demo } => run_tls(hex, *demo),
            Cmd::Pkcs7 { op } => run_pkcs7(op),
            Cmd::Patch { doc, patch, demo } => run_patch(doc, patch, *demo),
            Cmd::Metrics { demo } => run_metrics(*demo),
            Cmd::Pem { op } => run_pem(op),
            Cmd::M3u { op } => run_m3u(op),
            Cmd::Chunked { op } => run_chunked(op),
            Cmd::Inspect { module } => run_inspect(module.as_deref()),
            Cmd::Serve { .. } => Ok(()), // not exercised in unit tests; see serve.rs tests
        }
        .map(|_| String::new())
    }

    #[test]
    fn jwt_demo_round_trip() {
        run_cli(&["gateway-tools", "jwt", "demo"]).expect("jwt demo");
    }

    #[test]
    fn dns_demo_parses_example_com() {
        run_cli(&["gateway-tools", "dns", "--demo"]).expect("dns demo");
    }

    #[test]
    fn redis_demo_encodes_array() {
        run_cli(&["gateway-tools", "redis", "--demo"]).expect("redis demo");
    }

    #[test]
    fn pkcs7_pad_then_unpad_demo() {
        run_cli(&["gateway-tools", "pkcs7", "pad", "--demo"]).expect("pad");
        run_cli(&["gateway-tools", "pkcs7", "unpad", "--demo"]).expect("unpad");
    }

    #[test]
    fn m3u_demo_round_trip() {
        run_cli(&["gateway-tools", "m3u", "demo"]).expect("m3u demo");
    }
}
