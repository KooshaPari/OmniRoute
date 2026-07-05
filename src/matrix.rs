pub fn matmul(a: &[Vec<f64>], b: &[Vec<f64>]) -> Result<Vec<Vec<f64>>, String> {
    if a.is_empty() || b.is_empty() { return Err("empty matrix".into()); }
    let rows_a = a.len(); let cols_a = a[0].len();
    let rows_b = b.len(); let cols_b = b[0].len();
    if cols_a != rows_b { return Err(format!("dim mismatch {} vs {}", cols_a, rows_b)); }
    let mut out = vec![vec![0.0; cols_b]; rows_a];
    for i in 0..rows_a { for j in 0..cols_b { for k in 0..cols_a { out[i][j] += a[i][k] * b[k][j]; } } }
    Ok(out)
}
pub fn transpose(m: &[Vec<f64>]) -> Vec<Vec<f64>> {
    if m.is_empty() { return Vec::new(); }
    let rows = m.len(); let cols = m[0].len();
    let mut out = vec![vec![0.0; rows]; cols];
    for i in 0..rows { for j in 0..cols { out[j][i] = m[i][j]; } }
    out
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test] fn matmul_basic() { let a = vec![vec![1.0, 2.0], vec![3.0, 4.0]]; let b = vec![vec![5.0, 6.0], vec![7.0, 8.0]]; let r = matmul(&a, &b).unwrap(); assert_eq!(r[0][0], 19.0); assert_eq!(r[0][1], 22.0); }
    #[test] fn matmul_identity() { let a = vec![vec![1.0, 2.0], vec![3.0, 4.0]]; let i = vec![vec![1.0, 0.0], vec![0.0, 1.0]]; let r = matmul(&a, &i).unwrap(); assert_eq!(r[0][0], 1.0); }
    #[test] fn matmul_dim_mismatch() { assert!(matmul(&vec![vec![1.0, 2.0]], &vec![vec![1.0]]).is_err()); }
    #[test] fn transpose_basic() { let m = vec![vec![1.0, 2.0, 3.0], vec![4.0, 5.0, 6.0]]; let t = transpose(&m); assert_eq!(t[0][0], 1.0); assert_eq!(t[2][1], 6.0); assert_eq!(t.len(), 3); }
    #[test] fn transpose_square() { let m = vec![vec![1.0, 2.0], vec![3.0, 4.0]]; let t = transpose(&m); assert_eq!(t[0], vec![1.0, 3.0]); }
}
