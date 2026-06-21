// SPDX-License-Identifier: MIT OR Apache-2.0
// SBOM generator for FocalPoint workspace
// Emits CycloneDX-JSON format at docs/security/sbom.json
// Usage: cargo run -p sbom-gen

use anyhow::{Context, Result};
use cargo_metadata::MetadataCommand;
use serde_json::json;
use std::collections::BTreeMap;
use std::fs;

fn main() -> Result<()> {
    // Load workspace metadata
    let metadata = MetadataCommand::new()
        .exec()
        .context("Failed to load cargo metadata")?;

    // Build SBOM components
    let mut components = Vec::new();
    let mut unique_crates: BTreeMap<String, String> = BTreeMap::new();

    // Iterate all packages and extract direct dependencies
    for package in &metadata.packages {
        let key = format!("{}-{}", package.name, package.version);
        let source_str = package
            .source
            .as_ref()
            .map(|s| s.to_string())
            .unwrap_or_else(|| "unknown".to_string());

        if !unique_crates.contains_key(&key) && !is_workspace_crate(package) {
            unique_crates.insert(key, source_str);
        }
    }

    // Build CycloneDX components
    for (crate_name_ver, source) in unique_crates {
        let (name, version) = crate_name_ver.rsplit_once('-').unwrap_or((&crate_name_ver, ""));
        let purl = format!("pkg:cargo/{}/{}", name, version);

        components.push(json!({
            "type": "library",
            "name": name,
            "version": version,
            "purl": purl,
            "scope": "required",
            "source": source,
        }));
    }

    // Build CycloneDX-JSON SBOM
    let sbom = json!({
        "bomFormat": "CycloneDX",
        "specVersion": "1.4",
        "version": 1,
        "metadata": {
            "timestamp": chrono::Local::now().to_rfc3339(),
            "tools": [
                {
                    "vendor": "FocalPoint",
                    "name": "sbom-gen",
                    "version": "0.1.0"
                }
            ],
            "component": {
                "type": "application",
                "name": "FocalPoint",
                "version": "0.0.1",
                "description": "Connector-first screen-time platform"
            }
        },
        "components": components,
    });

    // Ensure output directory
    fs::create_dir_all("docs/security")
        .context("Failed to create docs/security directory")?;

    // Write SBOM
    let sbom_path = "docs/security/sbom.json";
    let sbom_content = serde_json::to_string_pretty(&sbom)
        .context("Failed to serialize SBOM")?;

    fs::write(sbom_path, sbom_content)
        .context("Failed to write SBOM file")?;

    let component_count = sbom["components"]
        .as_array()
        .map(|c| c.len())
        .unwrap_or(0);

    println!("✓ SBOM generated: {}", sbom_path);
    println!("  Components: {}", component_count);
    println!("  Timestamp: {}", sbom["metadata"]["timestamp"]);

    Ok(())
}

// Check if a package is part of the workspace
fn is_workspace_crate(package: &cargo_metadata::Package) -> bool {
    // Workspace crates have a "path" source that starts with the repo path
    if let Some(source) = &package.source {
        let source_str = source.to_string();
        source_str.starts_with("path+") && source_str.contains("crates/")
    } else {
        false
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_sbom_generation() {
        // Traces to: FR-FOCALPOINT-SBOMs
        // Verify SBOM can be generated without errors
        assert!(main().is_ok(), "SBOM generation should succeed");
    }

    #[test]
    fn test_sbom_format() {
        // Traces to: FR-FOCALPOINT-SBOMs
        // Verify CycloneDX format
        if let Ok(content) = fs::read_to_string("docs/security/sbom.json") {
            if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(&content) {
                assert_eq!(parsed["bomFormat"], "CycloneDX");
                assert_eq!(parsed["specVersion"], "1.4");
            }
        }
    }
}
