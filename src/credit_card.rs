pub fn luhn_check(digits: &str) -> bool {
    let nums: Vec<u32> = digits.chars().filter_map(|c| c.to_digit(10)).collect();
    if nums.is_empty() { return false; }
    let mut sum = 0;
    for (i, &d) in nums.iter().rev().enumerate() {
        if i % 2 == 1 {
            let doubled = d * 2;
            sum += if doubled > 9 { doubled - 9 } else { doubled };
        } else {
            sum += d;
        }
    }
    sum % 10 == 0
}
pub fn mask(digits: &str) -> String {
    let last4: String = digits.chars().rev().take(4).collect::<String>().chars().rev().collect();
    format!("**** **** **** {}", last4)
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test] fn valid_visa() { assert!(luhn_check("4111111111111111")); }
    #[test] fn valid_amex() { assert!(luhn_check("378282246310005")); }
    #[test] fn invalid() { assert!(!luhn_check("4111111111111112")); }
    #[test] fn empty() { assert!(!luhn_check("")); }
    #[test] fn mask_keeps_last4() { assert_eq!(mask("4111111111111111"), "**** **** **** 1111"); }
}
