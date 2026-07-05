pub fn erf(x: f64) -> f64 {
    // Abramowitz & Stegun 7.1.26 approximation, max error ~1.5e-7
    let sign = if x < 0.0 { -1.0 } else { 1.0 };
    let x = x.abs();
    let a1 = 0.254829592;
    let a2 = -0.284496736;
    let a3 = 1.421413741;
    let a4 = -1.453152027;
    let a5 = 1.061405429;
    let p = 0.3275911;
    let t = 1.0 / (1.0 + p * x);
    let y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * (-x * x).exp();
    sign * y
}
pub fn erfc(x: f64) -> f64 { 1.0 - erf(x) }
pub fn normal_cdf(x: f64, mean: f64, stddev: f64) -> f64 { 0.5 * (1.0 + erf((x - mean) / (stddev * (2.0_f64).sqrt()))) }
#[cfg(test)]
mod tests {
    use super::*;
    #[test] fn erf_zero() { assert!(erf(0.0).abs() < 1e-6); }
    #[test] fn erf_pos() { assert!(erf(1.0) > 0.84 && erf(1.0) < 0.86); }
    #[test] fn erf_neg() { assert!(erf(-1.0) < -0.84 && erf(-1.0) > -0.86); }
    #[test] fn erf_large() { assert!(erf(3.0) > 0.99); }
    #[test] fn normal_cdf_zero() { assert!((normal_cdf(0.0, 0.0, 1.0) - 0.5).abs() < 1e-5); }
}
