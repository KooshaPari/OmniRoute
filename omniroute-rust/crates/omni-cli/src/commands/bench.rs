//! `omni bench` - concurrent load against `/v1/chat/completions`.
//!
//! Spawns N concurrent threads that each loop a tiny chat request for the
//! configured duration. Reports p50/p95/p99 latency and RPS.

use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use std::time::{Duration, Instant};

use anyhow::Result;
use clap::Args;
use parking_lot::Mutex;
use serde_json::json;

use crate::http;
use crate::output::print_table;

#[derive(Args, Debug, Clone)]
pub struct BenchArgs {
    /// Target base URL. Defaults to the configured server.
    #[arg(long)]
    pub target: Option<String>,
    #[arg(long, default_value_t = 10)]
    pub concurrency: usize,
    /// How long to run the bench, in seconds.
    #[arg(long, default_value_t = 10)]
    pub duration: u64,
    #[arg(long, default_value = "gpt-4o-mini")]
    pub model: String,
}

pub fn run(args: BenchArgs) -> Result<()> {
    let base = args
        .target
        .clone()
        .unwrap_or_else(crate::http::server_url);
    let target = format!("{}/v1/chat/completions", base.trim_end_matches('/'));
    println!(
        "Bench: target={} concurrency={} duration={}s model={}",
        target, args.concurrency, args.duration, args.model
    );
    let latencies_ms: Arc<Mutex<Vec<u128>>> = Arc::new(Mutex::new(Vec::with_capacity(2048)));
    let errors: Arc<AtomicU64> = Arc::new(AtomicU64::new(0));
    let success: Arc<AtomicU64> = Arc::new(AtomicU64::new(0));
    let deadline = Instant::now() + Duration::from_secs(args.duration);
    let body = json!({
        "model": args.model,
        "messages": [{"role": "user", "content": "ping"}],
        "max_tokens": 1,
        "stream": false,
    });
    let mut handles = Vec::with_capacity(args.concurrency);
    for _ in 0..args.concurrency {
        let target = target.clone();
        let body = body.clone();
        let latencies = Arc::clone(&latencies_ms);
        let errors = Arc::clone(&errors);
        let success = Arc::clone(&success);
        handles.push(std::thread::spawn(move || loop {
            if Instant::now() >= deadline {
                break;
            }
            let started = Instant::now();
            match http::post_json_raw(&target, &body) {
                Ok((200..=299, _)) => {
                    success.fetch_add(1, Ordering::Relaxed);
                    let elapsed = started.elapsed().as_millis();
                    latencies.lock().push(elapsed);
                }
                _ => {
                    errors.fetch_add(1, Ordering::Relaxed);
                }
            }
        }));
    }
    for h in handles {
        let _ = h.join();
    }
    let total = success.load(Ordering::Relaxed) + errors.load(Ordering::Relaxed);
    let rps = total as f64 / args.duration as f64;
    let mut lats = latencies_ms.lock();
    lats.sort_unstable();
    let p = |q: f64| -> String {
        if lats.is_empty() {
            return "n/a".into();
        }
        let idx = ((lats.len() as f64 - 1.0) * q) as usize;
        format!("{} ms", lats[idx])
    };
    let rows = vec![
        vec![
            "requests".into(),
            total.to_string(),
            format!("{:.1} rps", rps),
        ],
        vec![
            "success".into(),
            success.load(Ordering::Relaxed).to_string(),
            format!("{:.1}%", 100.0 * success.load(Ordering::Relaxed) as f64 / total.max(1) as f64),
        ],
        vec![
            "errors".into(),
            errors.load(Ordering::Relaxed).to_string(),
            format!("{:.1}%", 100.0 * errors.load(Ordering::Relaxed) as f64 / total.max(1) as f64),
        ],
        vec!["p50".into(), p(0.50), "".into()],
        vec!["p95".into(), p(0.95), "".into()],
        vec!["p99".into(), p(0.99), "".into()],
    ];
    print_table(&["metric", "value", "note"], &rows);
    Ok(())
}
