// SPDX-License-Identifier: MIT OR Apache-2.0

//! Version bump utilities for Cargo.toml and iOS plist.

use semver::Version;

/// Bump a semantic version (major.minor.patch).
#[allow(dead_code)]
pub fn bump_patch(version: &str) -> Option<String> {
    if let Ok(mut v) = Version::parse(version) {
        v.patch += 1;
        Some(v.to_string())
    } else {
        None
    }
}

/// Bump minor version (resets patch to 0).
#[allow(dead_code)]
pub fn bump_minor(version: &str) -> Option<String> {
    if let Ok(mut v) = Version::parse(version) {
        v.minor += 1;
        v.patch = 0;
        Some(v.to_string())
    } else {
        None
    }
}

/// Bump major version (resets minor and patch to 0).
#[allow(dead_code)]
pub fn bump_major(version: &str) -> Option<String> {
    if let Ok(mut v) = Version::parse(version) {
        v.major += 1;
        v.minor = 0;
        v.patch = 0;
        Some(v.to_string())
    } else {
        None
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // Traces to: FR-RELEASE-002 (version-bump correct per semver)
    #[test]
    fn test_bump_patch() {
        assert_eq!(bump_patch("0.0.6"), Some("0.0.7".to_string()));
        assert_eq!(bump_patch("1.2.3"), Some("1.2.4".to_string()));
    }

    #[test]
    fn test_bump_minor() {
        assert_eq!(bump_minor("0.0.6"), Some("0.1.0".to_string()));
        assert_eq!(bump_minor("1.2.3"), Some("1.3.0".to_string()));
    }

    #[test]
    fn test_bump_major() {
        assert_eq!(bump_major("0.0.6"), Some("1.0.0".to_string()));
        assert_eq!(bump_major("1.2.3"), Some("2.0.0".to_string()));
    }

    #[test]
    fn test_invalid_version() {
        assert_eq!(bump_patch("not-a-version"), None);
    }
}
