#[derive(Debug,Clone,PartialEq)]
pub struct CronExpr { pub minute: CronField, pub hour: CronField, pub dom: CronField, pub month: CronField, pub dow: CronField }
#[derive(Debug,Clone,PartialEq)]
pub struct CronField { pub values: Vec<u8>, pub wildcard: bool }
impl CronField {
    pub fn any() -> Self { Self { values: (0..=59).collect(), wildcard: true } }
    pub fn single(v: u8) -> Self { Self { values: vec![v], wildcard: false } }
    pub fn matches(&self, v: u8) -> bool { self.wildcard || self.values.contains(&v) }
}
pub fn parse(s: &str) -> Result<CronExpr, String> {
    let parts: Vec<&str> = s.split_whitespace().collect();
    if parts.len() != 5 { return Err(format!("expected 5 fields, got {}", parts.len())); }
    let minute = parse_field(parts[0], 0, 59)?;
    let hour = parse_field(parts[1], 0, 23)?;
    let dom = parse_field(parts[2], 1, 31)?;
    let month = parse_field(parts[3], 1, 12)?;
    let dow = parse_field(parts[4], 0, 6)?;
    Ok(CronExpr { minute, hour, dom, month, dow })
}
fn parse_field(s: &str, min: u8, max: u8) -> Result<CronField, String> {
    if s == "*" { return Ok(CronField::any()); }
    if let Ok(v) = s.parse::<u8>() {
        if v < min || v > max { return Err(format!("value {} out of range {}-{}", v, min, max)); }
        return Ok(CronField::single(v));
    }
    Err(format!("invalid field: {}", s))
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test] fn parse_full() { let c = parse("* * * * *").unwrap(); assert!(c.minute.wildcard); }
    #[test] fn parse_specific() { let c = parse("0 12 * * *").unwrap(); assert_eq!(c.minute.values, vec![0]); assert_eq!(c.hour.values, vec![12]); }
    #[test] fn parse_wrong_field_count() { assert!(parse("* * * *").is_err()); assert!(parse("* * * * * *").is_err()); }
    #[test] fn parse_out_of_range() { assert!(parse("60 * * * *").is_err()); assert!(parse("* 25 * * *").is_err()); }
    #[test] fn field_matches() { assert!(CronField::any().matches(30)); assert!(CronField::single(5).matches(5)); assert!(!CronField::single(5).matches(6)); }
    #[test] fn dom_range() { assert!(parse("* * 32 * *").is_err()); }
    #[test] fn month_range() { assert!(parse("* * * 13 *").is_err()); }
}
