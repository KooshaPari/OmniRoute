use std::time::Duration;

#[derive(Debug,Clone)]
pub struct RetryPolicy {
    pub max_attempts: u32,
    pub base_delay: Duration,
    pub max_delay: Duration,
}
impl Default for RetryPolicy {
    fn default() -> Self { Self { max_attempts: 3, base_delay: Duration::from_millis(100), max_delay: Duration::from_secs(5) } }
}
pub struct RetryOutcome { pub attempts: u32 }

pub fn should_retry(attempt: u32, policy: &RetryPolicy) -> bool {
    attempt < policy.max_attempts
}

pub fn compute_delay(attempt: u32, policy: &RetryPolicy) -> Duration {
    let ms = policy.base_delay.as_millis() as u64 * 2u64.saturating_pow(attempt);
    Duration::from_millis(ms.min(policy.max_delay.as_millis() as u64))
}

pub fn retry_until_success<F: FnMut() -> bool>(policy: RetryPolicy, mut f: F) -> RetryOutcome {
    let mut attempt = 0;
    while attempt < policy.max_attempts {
        if f() { return RetryOutcome { attempts: attempt + 1 }; }
        attempt += 1;
    }
    RetryOutcome { attempts: attempt }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test] fn should_retry_within() { let p = RetryPolicy::default(); assert!(should_retry(0, &p)); assert!(!should_retry(3, &p)); }
    #[test] fn delay_grows() { let p = RetryPolicy::default(); assert!(compute_delay(2, &p) > compute_delay(0, &p)); }
    #[test] fn delay_capped() { let p = RetryPolicy { max_delay: Duration::from_millis(200), ..Default::default() }; assert_eq!(compute_delay(5, &p).as_millis(), 200); }
    #[test] fn retry_until_immediate_success() { let out = retry_until_success(RetryPolicy::default(), || true); assert_eq!(out.attempts, 1); }
    #[test] fn retry_until_max() { let p = RetryPolicy { max_attempts: 3, ..Default::default() }; let out = retry_until_success(p, || false); assert_eq!(out.attempts, 3); }
    #[test] fn retry_eventually_succeeds() { let p = RetryPolicy::default(); let mut calls = 0; let out = retry_until_success(p, || { calls += 1; calls >= 2 }); assert_eq!(out.attempts, 2); }
}
