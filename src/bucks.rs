pub struct Money { pub cents: i64 }
impl Money {
    pub fn from_cents(c: i64) -> Self { Self { cents: c } }
    pub fn from_dollars(d: f64) -> Self { Self { cents: (d * 100.0).round() as i64 } }
    pub fn dollars(&self) -> f64 { self.cents as f64 / 100.0 }
    pub fn add(&self, other: &Money) -> Money { Money { cents: self.cents + other.cents } }
    pub fn sub(&self, other: &Money) -> Money { Money { cents: self.cents - other.cents } }
    pub fn mul(&self, factor: f64) -> Money { Money { cents: (self.cents as f64 * factor).round() as i64 } }
    pub fn split(&self, n: u32) -> Vec<Money> {
        let base = self.cents / n as i64;
        let rem = (self.cents % n as i64) as u32;
        (0..n).map(|i| Money { cents: base + if i < rem { 1 } else { 0 } }).collect()
    }
}
pub fn fmt_usd(cents: i64) -> String {
    let neg = cents < 0;
    let v = cents.unsigned_abs();
    let dollars = v / 100;
    let c = v % 100;
    let mut s = String::new();
    let d_str = format!("{}", dollars);
    let chars: Vec<char> = d_str.chars().rev().collect();
    for (i, c) in chars.iter().enumerate() {
        if i > 0 && i % 3 == 0 { s.push(','); }
        s.push(*c);
    }
    let s: String = s.chars().rev().collect();
    if neg { format!("-${}.{:02}", s, c) } else { format!("${}.{:02}", s, c) }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test] fn from_cents() { assert_eq!(Money::from_cents(1234).dollars(), 12.34); }
    #[test] fn from_dollars() { assert_eq!(Money::from_dollars(9.99).cents, 999); }
    #[test] fn add_sub() {
        let a = Money::from_dollars(10.0);
        let b = Money::from_dollars(3.50);
        assert_eq!(a.add(&b).cents, 1350);
        assert_eq!(a.sub(&b).cents, 650);
    }
    #[test] fn mul_pct() {
        let m = Money::from_dollars(100.0);
        assert_eq!(m.mul(0.0825).cents, 825);
    }
    #[test] fn split_even() {
        let parts = Money::from_cents(100).split(4);
        assert_eq!(parts.iter().map(|m| m.cents).collect::<Vec<_>>(), vec![25, 25, 25, 25]);
    }
    #[test] fn split_uneven() {
        let parts = Money::from_cents(100).split(3);
        assert_eq!(parts.iter().map(|m| m.cents).collect::<Vec<_>>(), vec![34, 33, 33]);
    }
    #[test] fn fmt_small() { assert_eq!(fmt_usd(1234), "$12.34"); }
    #[test] fn fmt_thousand() { assert_eq!(fmt_usd(1234567), "$12,345.67"); }
    #[test] fn fmt_negative() { assert_eq!(fmt_usd(-5050), "-$50.50"); }
}
