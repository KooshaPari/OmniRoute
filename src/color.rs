pub fn hex_to_rgb(hex: &str) -> (u8, u8, u8) {
    let s = hex.trim_start_matches('#');
    let v = u32::from_str_radix(s, 16).unwrap_or(0);
    ((v >> 16) as u8, (v >> 8) as u8, v as u8)
}
pub fn rgb_to_hex(r: u8, g: u8, b: u8) -> String {
    format!("#{:02x}{:02x}{:02x}", r, g, b)
}
pub fn hsl_to_rgb(h: f64, s: f64, l: f64) -> (u8, u8, u8) {
    let c = (1.0 - (2.0 * l - 1.0).abs()) * s;
    let hh = h / 60.0;
    let x = c * (1.0 - (hh % 2.0 - 1.0).abs());
    let (r1, g1, b1) = if hh < 1.0 { (c, x, 0.0) }
        else if hh < 2.0 { (x, c, 0.0) }
        else if hh < 3.0 { (0.0, c, x) }
        else if hh < 4.0 { (0.0, x, c) }
        else if hh < 5.0 { (x, 0.0, c) }
        else { (c, 0.0, x) };
    let m = l - c / 2.0;
    (((r1 + m) * 255.0) as u8, ((g1 + m) * 255.0) as u8, ((b1 + m) * 255.0) as u8)
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test] fn hex_to_rgb_red() { assert_eq!(hex_to_rgb("#ff0000"), (255, 0, 0)); }
    #[test] fn hex_to_rgb_no_prefix() { assert_eq!(hex_to_rgb("00ff00"), (0, 255, 0)); }
    #[test] fn rgb_to_hex_red() { assert_eq!(rgb_to_hex(255, 0, 0), "#ff0000"); }
    #[test] fn rgb_to_hex_white() { assert_eq!(rgb_to_hex(255, 255, 255), "#ffffff"); }
    #[test] fn hsl_red() { let (r, g, b) = hsl_to_rgb(0.0, 1.0, 0.5); assert_eq!(r, 255); assert!(g < 5); assert!(b < 5); }
    #[test] fn hsl_blue() { let (r, g, b) = hsl_to_rgb(240.0, 1.0, 0.5); assert!(r < 5); assert!(g < 5); assert_eq!(b, 255); }
}
