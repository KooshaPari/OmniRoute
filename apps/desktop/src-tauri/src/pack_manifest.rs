//! Parser for the optional-pack manifest.
//!
//! `scripts/packs/optionalPackManifest.mjs` is the build-side source of truth
//! for which optional runtime packs exist. The desktop shell needs the same
//! names at run time to build the supervised server's `NODE_PATH`, and must not
//! import build tooling to get them, so `build.rs` parses the manifest and
//! injects the names (`OMNIROUTE_OPTIONAL_PACK_NAMES`).
//!
//! This module is compiled twice on purpose: into `build.rs` (via `#[path]`) and
//! into the test build (`#[cfg(test)] mod pack_manifest`), so the parser can be
//! unit-tested without executing a build script.

/// Extract the pack `name` values from the `OPTIONAL_PACKS` array literal.
///
/// A deliberate scanner rather than a JavaScript parser: it walks the array
/// tracking nesting depth and string state, and captures `name` keys at the
/// depth of the first object inside the array — the pack objects. The
/// `packages: [{ name: ... }]` entries sit one level deeper and are ignored.
pub fn pack_names(source: &str) -> Vec<String> {
    let bytes = source.as_bytes();
    let Some(anchor) = source.find("OPTIONAL_PACKS") else {
        return Vec::new();
    };
    let Some(offset) = source[anchor..].find('[') else {
        return Vec::new();
    };
    let mut index = anchor + offset;
    let mut depth: i32 = 0;
    let mut pack_depth: Option<i32> = None;
    let mut quote: Option<u8> = None;
    let mut names: Vec<String> = Vec::new();

    while index < bytes.len() {
        let byte = bytes[index];
        if let Some(delimiter) = quote {
            if byte == b'\\' {
                index += 2;
                continue;
            }
            if byte == delimiter {
                quote = None;
            }
            index += 1;
            continue;
        }
        match byte {
            b'"' | b'\'' | b'`' if opens_string(bytes, index, byte) => {
                quote = Some(byte);
                index += 1;
            }
            b'[' | b'{' | b'(' => {
                depth += 1;
                if byte == b'{' && depth > 1 && pack_depth.is_none() {
                    pack_depth = Some(depth);
                }
                index += 1;
            }
            b']' | b'}' | b')' => {
                depth -= 1;
                index += 1;
                if depth <= 0 {
                    break;
                }
            }
            _ => {
                if Some(depth) == pack_depth
                    && is_token_start(bytes, index)
                    && bytes[index..].starts_with(b"name")
                {
                    if let Some(name) = string_after_key(&source[index + 4..]) {
                        let name = name.trim().to_owned();
                        if !name.is_empty() && !names.contains(&name) {
                            names.push(name);
                        }
                    }
                }
                index += 1;
            }
        }
    }

    names
}

/// Whether the quote byte at `index` opens a string.
///
/// Double quotes and backticks always do. A single quote only does when it
/// follows a value delimiter, so apostrophes in prose (`don't`, `pack's`) inside
/// comments are not mistaken for the start of a string — which would otherwise
/// hide everything up to the next apostrophe, including later pack names.
fn opens_string(bytes: &[u8], index: usize, byte: u8) -> bool {
    match byte {
        b'"' | b'`' => true,
        b'\'' => previous_non_space(bytes, index)
            .map(|previous| matches!(previous, b':' | b',' | b'(' | b'[' | b'=' | b'{'))
            .unwrap_or(true),
        _ => false,
    }
}

fn previous_non_space(bytes: &[u8], index: usize) -> Option<u8> {
    bytes[..index]
        .iter()
        .rev()
        .find(|byte| !byte.is_ascii_whitespace())
        .copied()
}

/// Whether `index` begins a fresh token rather than the middle of an identifier.
fn is_token_start(bytes: &[u8], index: usize) -> bool {
    index == 0
        || matches!(
            bytes[index - 1],
            b' ' | b'\t' | b'\n' | b'\r' | b'{' | b',' | b'(' | b'['
        )
}

/// Read the quoted value of a `: "value"` tail, or `None` when the value is not
/// a plain string literal.
fn string_after_key(rest: &str) -> Option<&str> {
    let rest = rest.trim_start().strip_prefix(':')?;
    let rest = rest.trim_start();
    let delimiter = rest.chars().next()?;
    if !matches!(delimiter, '"' | '\'' | '`') {
        return None;
    }
    let body = &rest[delimiter.len_utf8()..];
    let end = body.find(delimiter)?;
    Some(&body[..end])
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::Path;

    /// The real manifest, resolved from this crate's manifest dir:
    /// `apps/desktop/src-tauri` -> repository root -> `scripts/packs/...`.
    fn real_manifest_path() -> std::path::PathBuf {
        Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("../../../scripts/packs/optionalPackManifest.mjs")
    }

    #[test]
    fn reads_pack_names_from_the_real_manifest() {
        let path = real_manifest_path();
        let Ok(source) = std::fs::read_to_string(&path) else {
            // Building outside a repository checkout: nothing to assert against.
            return;
        };
        assert_eq!(
            pack_names(&source),
            vec!["ml-runtime".to_string(), "browser-runtime".to_string()],
            "unexpected OPTIONAL_PACKS in {}",
            path.display()
        );
    }

    #[test]
    fn ignores_package_names_one_level_deeper() {
        let source = r#"
export const OPTIONAL_PACKS = [
  {
    name: "ml-runtime",
    packVersion: 1,
    packages: [{ name: "@huggingface/transformers" }, { name: "onnxruntime-node" }],
  },
  {
    name: "browser-runtime",
    packVersion: 1,
    packages: [{ name: "playwright" }],
  },
];
"#;
        assert_eq!(
            pack_names(source),
            vec!["ml-runtime".to_string(), "browser-runtime".to_string()]
        );
    }

    #[test]
    fn apostrophes_in_prose_do_not_hide_later_packs() {
        let source = r#"
export const OPTIONAL_PACKS = [
  {
    name: "ml-runtime",
    description: "the manifest defines membership only, so bumps don't need an edit",
    packages: [{ name: "@atjsh/llmlingua-2" }],
  },
  {
    name: "browser-runtime",
    description: "it's the browser closure",
    packages: [{ name: "playwright" }],
  },
];
"#;
        assert_eq!(
            pack_names(source),
            vec!["ml-runtime".to_string(), "browser-runtime".to_string()]
        );
    }

    #[test]
    fn brackets_inside_strings_do_not_change_depth() {
        let source = r#"
export const OPTIONAL_PACKS = [
  { name: "ml-runtime", description: "uses [brackets] and {braces}" },
  { name: "browser-runtime", packages: [] },
];
"#;
        assert_eq!(
            pack_names(source),
            vec!["ml-runtime".to_string(), "browser-runtime".to_string()]
        );
    }

    #[test]
    fn missing_manifest_yields_no_names() {
        assert!(pack_names("export const SOMETHING_ELSE = [];").is_empty());
        assert!(pack_names("export const OPTIONAL_PACKS = 3;").is_empty());
    }
}
