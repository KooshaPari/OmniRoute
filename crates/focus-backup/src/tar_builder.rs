// SPDX-License-Identifier: MIT OR Apache-2.0

//! Tar archive builder and extractor for backup payloads.
//!
//! Embeds manifest JSON + SHA-256 hash in a tar archive for integrity verification.

use std::io::{Cursor, Read};

/// Build a tar archive containing manifest JSON and its SHA-256 hash.
///
/// Returns the complete tar blob (not compressed; zstd happens at a higher level).
pub fn build_tar(manifest_json: &[u8], manifest_hash: &[u8]) -> Result<Vec<u8>, String> {
    let mut tar_buffer = Vec::new();
    let mut builder = tar::Builder::new(&mut tar_buffer);

    // Entry 1: manifest.json
    let mut header = tar::Header::new_gnu();
    header.set_size(manifest_json.len() as u64);
    header.set_mtime(
        std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_secs(),
    );
    builder
        .append_data(&mut header, "manifest.json", manifest_json)
        .map_err(|e| format!("failed to append manifest.json: {}", e))?;

    // Entry 2: manifest.json.sha256
    let hash_str = hex::encode(manifest_hash);
    let hash_bytes = hash_str.as_bytes();
    let mut header = tar::Header::new_gnu();
    header.set_size(hash_bytes.len() as u64);
    builder
        .append_data(&mut header, "manifest.json.sha256", hash_bytes)
        .map_err(|e| format!("failed to append hash file: {}", e))?;

    builder.finish().map_err(|e| format!("failed to finish tar: {}", e))?;
    drop(builder);

    Ok(tar_buffer)
}

/// Extract tar archive, returning (manifest_json, manifest_hash).
pub fn extract_tar(tar_data: &[u8]) -> Result<(Vec<u8>, Vec<u8>), String> {
    let mut archive = tar::Archive::new(Cursor::new(tar_data));
    let mut manifest_json = None;
    let mut manifest_hash = None;

    for entry_result in archive.entries().map_err(|e| e.to_string())? {
        let mut entry = entry_result.map_err(|e| e.to_string())?;
        let path = entry.path().map_err(|e| e.to_string())?.to_string_lossy().to_string();

        if path == "manifest.json" {
            let mut buf = Vec::new();
            entry.read_to_end(&mut buf).map_err(|e| e.to_string())?;
            manifest_json = Some(buf);
        } else if path == "manifest.json.sha256" {
            let mut buf = Vec::new();
            entry.read_to_end(&mut buf).map_err(|e| e.to_string())?;
            let hash_str = String::from_utf8(buf).map_err(|e| e.to_string())?;
            manifest_hash = Some(hex::decode(&hash_str).map_err(|e| e.to_string())?);
        }
    }

    let json = manifest_json.ok_or("manifest.json not found in tar".to_string())?;
    let hash = manifest_hash.ok_or("manifest.json.sha256 not found in tar".to_string())?;

    Ok((json, hash))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_tar_round_trip() {
        let manifest = b"test manifest content";
        let hash = b"testhash1234567890";
        let tar_data = build_tar(manifest, hash).expect("build_tar failed");
        let (extracted_manifest, extracted_hash) =
            extract_tar(&tar_data).expect("extract_tar failed");

        assert_eq!(extracted_manifest, manifest);
        assert_eq!(extracted_hash, hash);
    }

    #[test]
    fn test_tar_empty_manifest() {
        let manifest = b"";
        let hash = b"";
        let tar_data = build_tar(manifest, hash).expect("build_tar failed");
        let (extracted_manifest, extracted_hash) =
            extract_tar(&tar_data).expect("extract_tar failed");

        assert_eq!(extracted_manifest, manifest);
        assert_eq!(extracted_hash, hash);
    }
}
