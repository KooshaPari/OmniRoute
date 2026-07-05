#[derive(Debug,Clone,Copy,PartialEq)]
pub struct Money { pub cents: i64 }
impl Money {
    pub fn from_cents(c: i64) -> Self { Self { cents: c } }
    pub fn from_dollars(d: i64) -> Self { Self { cents: d * 100 } }
    pub fn add(&self, other: Money) -> Money { Money { cents: self.cents + other.cents } }
    pub fn sub(&self, other: Money) -> Money { Money { cents: self.cents - other.cents } }
    pub fn is_negative(&self) -> bool { self.cents < 0 }
    pub fn is_zero(&self) -> bool { self.cents == 0 }
    pub fn format(&self) -> String {
        let sign = if self.cents < 0 { "-" } else { "" };
        let abs = self.cents.abs();
        format!("{}${}.{:02}", sign, abs / 100, abs % 100)
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test] fn from_dollars() { assert_eq!(Money::from_dollars(5), Money { cents: 500 }); }
    #[test] fn from_cents() { assert_eq!(Money::from_cents(150), Money { cents: 150 }); }
    #[test] fn add() { assert_eq!(Money::from_dollars(1).add(Money::from_dollars(2)), Money::from_dollars(3)); }
    #[test] fn sub() { assert_eq!(Money::from_dollars(5).sub(Money::from_dollars(2)), Money::from_dollars(3)); }
    #[test] fn negative_check() { assert!(Money::from_cents(-100).is_negative()); assert!(!Money::from_cents(0).is_negative()); }
    #[test] fn format_zero() { assert_eq!(Money::from_cents(0).format(), "$0.00"); }
    #[test] fn format_dollars() { assert_eq!(Money::from_dollars(3).add(Money::from_cents(45)).format(), "$3.45"); }
    #[test] fn format_negative() { assert_eq!(Money::from_cents(-100).format(), "-$1.00"); }
}
