// SPDX-License-Identifier: MIT OR Apache-2.0
// FocalPoint UI asset library — exports icon definitions and branding components.

pub const BRAND_PRIMARY: &str = "#ff6b3d";
pub const BRAND_LIGHT: &str = "#ff8b65";
pub const BRAND_DARK: &str = "#c94a21";
pub const BRAND_OK: &str = "#2bb673";
pub const BRAND_WARN: &str = "#f5a623";
pub const BRAND_BLOCK: &str = "#e0544a";
pub const BRAND_INFO: &str = "#6ea8ff";

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_brand_colors_defined() {
        assert_eq!(BRAND_PRIMARY, "#ff6b3d");
        assert_eq!(BRAND_OK, "#2bb673");
    }
}
