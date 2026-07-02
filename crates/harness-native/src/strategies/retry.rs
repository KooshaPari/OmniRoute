use std::path::Path;
use std::process::Command;
use std::thread;

use rand::{rng, RngExt};

pub fn run(
    real_cmd: &Path,
    retry_max: u32,
    retry_backoff_ms: u64,
    retry_jitter: f64,
    args: &[&str],
) -> Result<i32, String> {
    let mut rng = rng();
    for attempt in 0..=retry_max {
        let status = Command::new(real_cmd).args(args).status();
        match status {
            Ok(s) if s.success() => return Ok(s.code().unwrap_or(0)),
            Ok(_) if attempt < retry_max => {
                let jitter = rng.random::<f64>() * retry_jitter;
                let delay = retry_backoff_ms as f64 * (1.0 + jitter);
                thread::sleep(std::time::Duration::from_millis(delay as u64));
            }
            Ok(s) => return Ok(s.code().unwrap_or(1)),
            Err(_e) if attempt < retry_max => {
                let jitter = rng.random::<f64>() * retry_jitter;
                let delay = retry_backoff_ms as f64 * (1.0 + jitter);
                thread::sleep(std::time::Duration::from_millis(delay as u64));
            }
            Err(e) => return Err(format!("exec failed: {}", e)),
        }
    }
    Ok(1)
}
