// SPDX-License-Identifier: MIT OR Apache-2.0

use anyhow::Result;
use clap::Parser;
use focus_icon_gen::IconGenerator;
use std::path::PathBuf;

#[derive(Parser)]
#[command(name = "focalpoint-icon-gen")]
#[command(about = "Generate FocalPoint app icons for App Store submission")]
#[command(long_about = "Procedural icon generator: Coachy flame silhouette with gradient background. Renders all required iOS sizes and generates XCAssets Contents.json manifest.")]
struct Args {
    /// Output directory for generated icons (default: ../../apps/ios/FocalPoint/Sources/FocalPointApp/Resources/Assets.xcassets/AppIcon.appiconset/)
    #[arg(short, long)]
    output_dir: Option<PathBuf>,

    /// Preview mode: render 1024x1024 PNG and print SHA-256 hash (no manifest)
    #[arg(short, long)]
    preview: bool,

    /// Override mode: regenerate icons from override image (not yet implemented)
    #[arg(long)]
    #[arg(requires = "output_dir")]
    r#override: bool,
}

fn main() -> Result<()> {
    let args = Args::parse();

    let gen = IconGenerator::new();

    if args.preview {
        // Preview mode: render 1024x1024, print hash and ASCII art
        eprintln!("🔥 FocalPoint Icon Generator — Preview Mode");
        eprintln!("==========================================\n");

        let png_data = gen.render(1024)?;
        let hash = gen.icon_hash(1024)?;

        eprintln!("✅ Icon rendered: 1024x1024 PNG");
        eprintln!("   SHA-256: {}", hash);
        eprintln!("\n   [ASCII Art Placeholder]");
        eprintln!("           ╱╲");
        eprintln!("          ╱  ╲");
        eprintln!("         ╱ 🔥 ╲");
        eprintln!("        ╱      ╲");
        eprintln!("       ╱________╲");
        eprintln!();

        // Write to temp or stdout-redirectable path
        let preview_path = "focalpoint-icon-preview.png";
        std::fs::write(preview_path, png_data)?;
        eprintln!("📁 Preview saved to: {}\n", preview_path);
        return Ok(());
    }

    // Full generation mode
    eprintln!("🔥 FocalPoint Icon Generator");
    eprintln!("============================\n");

    // Determine output directory
    let out_dir = if let Some(dir) = args.output_dir {
        dir
    } else {
        PathBuf::from(
            "../../apps/ios/FocalPoint/Sources/FocalPointApp/Resources/Assets.xcassets/AppIcon.appiconset/",
        )
    };

    // Create output directory if needed
    if !out_dir.exists() {
        std::fs::create_dir_all(&out_dir)?;
        eprintln!("📁 Created output directory: {}", out_dir.display());
    }

    // Render all sizes
    eprintln!("\n📸 Rendering icon sizes...");
    let sizes = gen.render_all_sizes()?;

    for (size, name, png_data) in sizes {
        let filename = format!("icon-{}.png", name);
        let filepath = out_dir.join(&filename);
        std::fs::write(&filepath, png_data)?;
        eprintln!("   ✓ {} ({}×{})", filename, size, size);
    }

    // Generate and write Contents.json
    eprintln!("\n📋 Generating Contents.json...");
    let contents_json = gen.generate_contents_json()?;
    let contents_path = out_dir.join("Contents.json");
    std::fs::write(&contents_path, contents_json)?;
    eprintln!("   ✓ Contents.json");

    eprintln!("\n✅ Icon generation complete!");
    eprintln!("   Output: {}", out_dir.display());
    eprintln!("   Run xcodebuild to verify XCAssets integrity.\n");

    Ok(())
}
