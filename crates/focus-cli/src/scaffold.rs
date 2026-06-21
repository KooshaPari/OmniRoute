// SPDX-License-Identifier: MIT OR Apache-2.0

//! Connector scaffolding: `focus connector new <name>` generator.

use std::fs;
use std::path::{Path, PathBuf};
use anyhow::{anyhow, Result};
use std::collections::HashMap;

/// Generate a connector crate scaffold.
pub fn generate_connector(
    name: &str,
    tier: &str,
    auth: &str,
    sync_mode: &str,
    workspace_root: &Path,
) -> Result<PathBuf> {
    // Validate name: alphanumeric + hyphens
    if !name.chars().all(|c| c.is_alphanumeric() || c == '-') {
        return Err(anyhow!(
            "Connector name must be alphanumeric or hyphens, got: {}",
            name
        ));
    }

    let connector_name = format!("connector-{}", name);
    let connector_path = workspace_root.join("crates").join(&connector_name);

    if connector_path.exists() {
        return Err(anyhow!(
            "Connector crate already exists: {}",
            connector_path.display()
        ));
    }

    // Create directory structure
    fs::create_dir_all(connector_path.join("src"))?;
    fs::create_dir_all(connector_path.join("tests"))?;

    // Prepare template variables
    let mut vars = HashMap::new();
    vars.insert("name".to_string(), name.to_string());
    vars.insert("Name".to_string(), to_pascal_case(name));
    vars.insert("tier".to_string(), tier.to_string());
    vars.insert("auth".to_string(), auth.to_string());
    vars.insert("sync_mode".to_string(), sync_mode.to_string());
    vars.insert("Tier".to_string(), tier_display(tier));
    vars.insert("Auth".to_string(), auth_display(auth));
    vars.insert("Sync".to_string(), sync_display(sync_mode));
    vars.insert("tier_variant".to_string(), to_pascal_case(tier));
    vars.insert("auth_variant".to_string(), auth_variant(auth));
    vars.insert("sync_variant".to_string(), sync_variant(sync_mode));
    vars.insert("oauth2".to_string(), (auth == "oauth2").to_string());
    vars.insert("apikey".to_string(), (auth == "apikey").to_string());
    vars.insert("none".to_string(), (auth == "none").to_string());
    vars.insert("keychain".to_string(), (auth != "none").to_string());

    // Write files
    write_template_file(
        &connector_path.join("Cargo.toml"),
        include_str!("../templates/connector/Cargo.toml.tmpl"),
        &vars,
    )?;

    write_template_file(
        &connector_path.join("src/lib.rs"),
        include_str!("../templates/connector/lib.rs.tmpl"),
        &vars,
    )?;

    write_template_file(
        &connector_path.join("src/api.rs"),
        include_str!("../templates/connector/api.rs.tmpl"),
        &vars,
    )?;

    write_template_file(
        &connector_path.join("src/auth.rs"),
        include_str!("../templates/connector/auth.rs.tmpl"),
        &vars,
    )?;

    write_template_file(
        &connector_path.join("src/events.rs"),
        include_str!("../templates/connector/events.rs.tmpl"),
        &vars,
    )?;

    write_template_file(
        &connector_path.join("src/models.rs"),
        include_str!("../templates/connector/models.rs.tmpl"),
        &vars,
    )?;

    write_template_file(
        &connector_path.join("tests/integration.rs"),
        include_str!("../templates/connector/integration.rs.tmpl"),
        &vars,
    )?;

    write_template_file(
        &connector_path.join("README.md"),
        include_str!("../templates/connector/README.md.tmpl"),
        &vars,
    )?;

    // Update workspace Cargo.toml
    update_workspace_cargo(&workspace_root.join("Cargo.toml"), &connector_name)?;

    Ok(connector_path)
}

/// Simple template substitution: handles {{key}} and {{#if key}}...{{/if}} blocks.
fn write_template_file(path: &Path, template: &str, vars: &HashMap<String, String>) -> Result<()> {
    let mut content = template.to_string();

    // Handle {{#if key}} ... {{/if}} blocks (naive but sufficient)
    for (key, value) in vars {
        let open_marker = format!("{{{{#if {}}}}}", key);
        let close_marker = "{{{{/if}}}}";

        loop {
            if let Some(start) = content.find(&open_marker) {
                if let Some(end) = content[start..].find(&close_marker) {
                    let end_abs = start + end;
                    let content_start = start + open_marker.len();
                    let block_content = content[content_start..end_abs].to_string();

                    // If value is "true", keep the content; otherwise remove it
                    if value == "true" {
                        content.replace_range(start..end_abs + close_marker.len(), &block_content);
                    } else {
                        content.replace_range(start..end_abs + close_marker.len(), "");
                    }
                } else {
                    break;
                }
            } else {
                break;
            }
        }
    }

    // Replace simple placeholders {{key}}
    for (key, value) in vars {
        let pattern = format!("{{{{{}}}}}", key);
        content = content.replace(&pattern, value);
    }

    fs::write(path, content)?;
    Ok(())
}

/// Update workspace Cargo.toml to include the new connector.
fn update_workspace_cargo(cargo_path: &Path, connector_name: &str) -> Result<()> {
    let content = fs::read_to_string(cargo_path)?;

    if content.contains(&format!(r#""crates/{}"#, connector_name)) {
        // Already present
        return Ok(());
    }

    // Find the members array and append
    let mut updated = content.clone();
    if let Some(pos) = content.rfind(']') {
        if let Some(members_start) = content.rfind("members = [") {
            if members_start < pos {
                // Insert before the closing bracket
                let new_member = format!(r#"    "crates/{}","#, connector_name);
                updated.insert_str(pos, &format!("{}\n", new_member));
                fs::write(cargo_path, updated)?;
                return Ok(());
            }
        }
    }

    // Fallback: append a comment if we can't find the members array safely
    updated.push_str(&format!(
        "\n# TODO: Add to members array: \"crates/{}\"\n",
        connector_name
    ));
    fs::write(cargo_path, updated)?;

    Ok(())
}

fn to_pascal_case(s: &str) -> String {
    s.split('-')
        .map(|part| {
            let mut chars = part.chars();
            match chars.next() {
                None => String::new(),
                Some(first) => first.to_uppercase().collect::<String>() + chars.as_str(),
            }
        })
        .collect()
}

fn tier_display(tier: &str) -> String {
    match tier {
        "official" => "Official",
        "verified" => "Verified",
        "mcp-bridged" => "MCP-Bridged",
        "private" => "Private",
        _ => tier,
    }
    .to_string()
}

fn auth_display(auth: &str) -> String {
    match auth {
        "oauth2" => "OAuth2",
        "apikey" => "API Key",
        "none" => "None",
        _ => auth,
    }
    .to_string()
}

fn sync_display(sync: &str) -> String {
    match sync {
        "polling" => "Polling",
        "webhook" => "Webhook",
        "hybrid" => "Hybrid",
        _ => sync,
    }
    .to_string()
}

fn auth_variant(auth: &str) -> String {
    match auth {
        "oauth2" => "OAuth2",
        "apikey" => "ApiKey",
        "none" => "None",
        _ => auth,
    }
    .to_string()
}

fn sync_variant(sync: &str) -> String {
    match sync {
        "polling" => "Polling",
        "webhook" => "Webhook",
        "hybrid" => "Hybrid",
        _ => sync,
    }
    .to_string()
}
