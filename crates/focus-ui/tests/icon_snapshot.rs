// SPDX-License-Identifier: MIT OR Apache-2.0
// Icon sprite snapshot test — verifies icon count and integrity.
// Traces to: FR-UI-ICON-SPRITE (icon set generation and sprite integrity)

fn workspace_root() -> std::path::PathBuf {
    std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .unwrap()
        .parent()
        .unwrap()
        .to_path_buf()
}

#[test]
fn test_icon_sprite_integrity() {
    use std::fs;

    let sprite_path = workspace_root().join("assets/icons/sprite.svg");
    assert!(sprite_path.exists(), "Icon sprite must exist at assets/icons/sprite.svg");

    let sprite_content = fs::read_to_string(sprite_path)
        .expect("Failed to read sprite.svg");

    // Verify sprite is valid SVG
    assert!(sprite_content.contains("<svg"), "Sprite must contain SVG root");
    assert!(sprite_content.contains("</svg>"), "Sprite must have closing SVG tag");
    assert!(sprite_content.contains("<symbol"), "Sprite must contain symbol elements");

    // Count symbols (each icon is a <symbol> element)
    let symbol_count = sprite_content.matches("<symbol").count();
    assert_eq!(symbol_count, 63, "Sprite must contain exactly 63 icons");

    // Verify expected icon names exist
    let expected_icons = vec![
        "nav-home", "nav-focus", "nav-rules", "nav-insights", "nav-connectors", "nav-settings",
        "focus-strict", "focus-moderate", "focus-light", "focus-break", "focus-sleep",
        "rule-app", "rule-time", "rule-penalty", "rule-reward", "rule-allowlist",
        "connector-canvas", "connector-slack", "connector-gmail",
        "status-active", "status-blocked", "status-warning",
        "achievement-streak", "achievement-milestone",
        "action-add", "action-delete", "action-edit",
        "mascot-happy", "mascot-thinking", "mascot-celebrating",
    ];

    for icon_name in expected_icons {
        let symbol_id = format!("id=\"{}-icon\"", icon_name);
        assert!(
            sprite_content.contains(&symbol_id),
            "Sprite must contain icon: {}",
            icon_name
        );
    }
}

#[test]
fn test_icon_sprite_size() {
    use std::fs;

    let sprite_path = workspace_root().join("assets/icons/sprite.svg");
    let metadata = fs::metadata(sprite_path)
        .expect("Failed to stat sprite.svg");
    let size_bytes = metadata.len();

    // Sprite should be reasonably sized (10-25 KB for 63 icons)
    assert!(
        size_bytes > 10_000 && size_bytes < 30_000,
        "Sprite size ({} bytes) should be between 10 KB and 30 KB",
        size_bytes
    );
}

#[test]
fn test_icon_types_generation() {
    use std::fs;

    let types_path = workspace_root().join("assets/icons/sprite.types.ts");
    assert!(
        types_path.exists(),
        "Icon types must exist at assets/icons/sprite.types.ts"
    );

    let types_content = fs::read_to_string(types_path)
        .expect("Failed to read sprite.types.ts");

    // Verify TypeScript exports
    assert!(
        types_content.contains("export type IconName"),
        "Types must export IconName type"
    );
    assert!(
        types_content.contains("export interface IconProps"),
        "Types must export IconProps interface"
    );

    // Count type union members (should match icon count)
    let union_count = types_content.matches(" | \"").count();
    assert!(
        union_count >= 60,
        "IconName union should have 60+ members, got {}",
        union_count
    );
}

#[test]
fn test_individual_icon_files() {
    use std::fs;

    let icons_dir = workspace_root().join("assets/icons/individual");
    assert!(
        icons_dir.is_dir(),
        "Individual icons directory must exist at assets/icons/individual"
    );

    let icon_files: Vec<_> = fs::read_dir(icons_dir)
        .expect("Failed to read icons directory")
        .filter_map(|e| e.ok())
        .filter(|e| {
            e.path()
                .extension()
                .map(|ext| ext == "svg")
                .unwrap_or(false)
        })
        .collect();

    assert_eq!(
        icon_files.len(),
        63,
        "Should have exactly 63 individual SVG files"
    );

    // Spot-check a few files are valid SVG
    for entry in icon_files.iter().take(5) {
        let content = fs::read_to_string(entry.path())
            .unwrap_or_else(|_| panic!("Failed to read {:?}", entry.path()));
        assert!(
            content.contains("<svg"),
            "Icon file must contain SVG root: {:?}",
            entry.path()
        );
    }
}
