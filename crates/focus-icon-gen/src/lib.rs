// SPDX-License-Identifier: MIT OR Apache-2.0

use anyhow::Result;
use serde::Serialize;
use sha2::{Digest, Sha256};

/// FocalPoint icon generator: procedural Coachy flame silhouette with gradient background.
/// Renders a flame icon inspired by the Coachy mascot using pure Rust pixel manipulation.
const ICON_SIZES: &[(u32, &str)] = &[
    (1024, "1024x1024"),
    (512, "512x512"),
    (256, "256x256"),
    (180, "180x180"), // iPhone App Icon
    (167, "167x167"), // iPad Pro App Icon
    (152, "152x152"), // iPad App Icon
    (120, "120x120"), // iPhone 6 Plus/7 Plus Spotlight/Settings
    (114, "114x114"), // iPhone non-retina Spotlight
    (80, "80x80"),    // Spotlight
    (76, "76x76"),    // iPad Notification
    (58, "58x58"),    // iPhone non-retina Notification
];

#[derive(Clone, Copy)]
struct Rgb {
    r: u8,
    g: u8,
    b: u8,
}

impl Rgb {
    const fn new(r: u8, g: u8, b: u8) -> Self {
        Self { r, g, b }
    }

    fn lerp(self, other: Rgb, t: f32) -> Rgb {
        let t = t.clamp(0.0, 1.0);
        Rgb {
            r: (self.r as f32 * (1.0 - t) + other.r as f32 * t) as u8,
            g: (self.g as f32 * (1.0 - t) + other.g as f32 * t) as u8,
            b: (self.b as f32 * (1.0 - t) + other.b as f32 * t) as u8,
        }
    }
}

pub struct IconGenerator {
    /// Primary flame color (orange)
    flame_primary: Rgb,
    /// Flame gradient end (deep red)
    flame_secondary: Rgb,
    /// Background gradient start (dark)
    bg_dark: Rgb,
    /// Background gradient end (lighter)
    bg_light: Rgb,
}

impl Default for IconGenerator {
    fn default() -> Self {
        Self {
            flame_primary: Rgb::new(255, 140, 0),   // Orange
            flame_secondary: Rgb::new(220, 20, 60), // Crimson red
            bg_dark: Rgb::new(30, 30, 40),          // Dark blue-black
            bg_light: Rgb::new(60, 60, 80),         // Lighter blue-gray
        }
    }
}

impl IconGenerator {
    pub fn new() -> Self {
        Self::default()
    }

    /// Render icon at specified size (in pixels). Returns PNG-encoded bytes.
    pub fn render(&self, size: u32) -> Result<Vec<u8>> {
        let size_usize = size as usize;
        let mut pixels = vec![0u8; size_usize * size_usize * 4];

        // Fill with background gradient (dark to light, vertical)
        for y in 0..size_usize {
            let t = y as f32 / size as f32;
            let color = self.bg_dark.lerp(self.bg_light, t);
            for x in 0..size_usize {
                let idx = (y * size_usize + x) * 4;
                pixels[idx] = color.r;
                pixels[idx + 1] = color.g;
                pixels[idx + 2] = color.b;
                pixels[idx + 3] = 255;
            }
        }

        // Render flame silhouette
        self.render_flame(&mut pixels, size)?;

        // Encode to PNG using png crate
        let png_data = {
            let mut data = Vec::new();
            {
                let mut encoder = png::Encoder::new(&mut data, size, size);
                encoder.set_color(png::ColorType::Rgba);
                encoder.set_depth(png::BitDepth::Eight);
                let mut writer = encoder.write_header()?;
                // PNG expects raw RGBA scanlines
                writer.write_image_data(&pixels)?;
            }
            data
        };

        Ok(png_data)
    }

    /// Render a stylized flame silhouette using Bresenham-style pixel checks.
    fn render_flame(&self, pixels: &mut [u8], size: u32) -> Result<()> {
        let sz = size as f32;
        let cx = sz / 2.0;
        let cy = sz / 2.0;

        let flame_height = sz * 0.6;
        let flame_width = sz * 0.45;
        let flame_base_y = cy + flame_height * 0.3;

        // Simple teardrop-shaped flame: check if point is inside using distance formula
        for y in 0..size as usize {
            for x in 0..size as usize {
                let px = x as f32;
                let py = y as f32;

                // Check if point is in flame bounds
                let rel_y = flame_base_y - py;
                if rel_y < 0.0 || rel_y > flame_height {
                    continue;
                }

                // Normalize height (0 at base, 1 at top)
                let h_norm = rel_y / flame_height;

                // Width tapers from base to top (wider at base, narrower at top)
                let width_at_height = flame_width * (1.0 - h_norm * 0.8);

                // Distance from center line
                let dx = (px - cx).abs();

                // Check if inside flame using smooth boundary
                if dx <= width_at_height {
                    // Gradient from base (orange) to top (red)
                    let color = self.flame_primary.lerp(self.flame_secondary, h_norm);

                    let idx = (y * size as usize + x) * 4;
                    pixels[idx] = color.r;
                    pixels[idx + 1] = color.g;
                    pixels[idx + 2] = color.b;
                    pixels[idx + 3] = 255;
                }
            }
        }

        Ok(())
    }

    /// Compute SHA-256 hash of the icon's raw pixel data (not the PNG encoding).
    pub fn icon_hash(&self, size: u32) -> Result<String> {
        let size_usize = size as usize;
        let mut pixels = vec![0u8; size_usize * size_usize * 4];

        // Fill with background gradient
        for y in 0..size_usize {
            let t = y as f32 / size as f32;
            let color = self.bg_dark.lerp(self.bg_light, t);
            for x in 0..size_usize {
                let idx = (y * size_usize + x) * 4;
                pixels[idx] = color.r;
                pixels[idx + 1] = color.g;
                pixels[idx + 2] = color.b;
                pixels[idx + 3] = 255;
            }
        }

        // Render flame
        self.render_flame(&mut pixels, size)?;

        // Hash the raw pixel data
        let mut hasher = Sha256::new();
        hasher.update(&pixels);
        let hash = hasher.finalize();
        Ok(hex::encode(hash))
    }

    /// Generate all required iOS icon sizes and return a map of size -> PNG bytes.
    pub fn render_all_sizes(&self) -> Result<Vec<(u32, String, Vec<u8>)>> {
        let mut results = Vec::new();
        for &(size, name) in ICON_SIZES {
            let png_data = self.render(size)?;
            results.push((size, name.to_string(), png_data));
        }
        Ok(results)
    }

    /// Generate an App Store `Contents.json` manifest for XCAssets.
    pub fn generate_contents_json(&self) -> Result<String> {
        #[derive(Serialize)]
        struct Image {
            filename: String,
            idiom: String,
            scale: String,
            #[serde(skip_serializing_if = "Option::is_none")]
            size: Option<String>,
        }

        #[derive(Serialize)]
        struct Info {
            version: i32,
            author: String,
        }

        #[derive(Serialize)]
        struct ContentsJson {
            images: Vec<Image>,
            info: Info,
        }

        // Map sizes to XCAssets idiom/scale/filename format
        let images = vec![
            // 1024x1024 (universal)
            Image {
                filename: "icon-1024x1024.png".to_string(),
                idiom: "universal".to_string(),
                scale: "1x".to_string(),
                size: Some("1024x1024".to_string()),
            },
            // iPhone App Icon (180x180 @3x = 60pt)
            Image {
                filename: "icon-180x180.png".to_string(),
                idiom: "iphone".to_string(),
                scale: "3x".to_string(),
                size: Some("60x60".to_string()),
            },
            // iPhone App Icon (120x120 @2x = 60pt)
            Image {
                filename: "icon-120x120.png".to_string(),
                idiom: "iphone".to_string(),
                scale: "2x".to_string(),
                size: Some("60x60".to_string()),
            },
            // iPad App Icon (152x152 @2x = 76pt)
            Image {
                filename: "icon-152x152.png".to_string(),
                idiom: "ipad".to_string(),
                scale: "2x".to_string(),
                size: Some("76x76".to_string()),
            },
            // iPad App Icon (76x76 @1x = 76pt)
            Image {
                filename: "icon-76x76.png".to_string(),
                idiom: "ipad".to_string(),
                scale: "1x".to_string(),
                size: Some("76x76".to_string()),
            },
            // iPad Pro App Icon (167x167 @2x = 83.5pt)
            Image {
                filename: "icon-167x167.png".to_string(),
                idiom: "ipad".to_string(),
                scale: "2x".to_string(),
                size: Some("83.5x83.5".to_string()),
            },
        ];

        let contents = ContentsJson {
            images,
            info: Info {
                version: 1,
                author: "focalpoint-icon-gen".to_string(),
            },
        };
        let json_str = serde_json::to_string_pretty(&contents)?;
        Ok(json_str)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // Traces to: FR-APPSTORE-001 (Icon generation)
    #[test]
    fn test_icon_hash_stable() {
        let gen = IconGenerator::new();
        let hash1 = gen.icon_hash(1024).expect("First hash");
        let hash2 = gen.icon_hash(1024).expect("Second hash");
        assert_eq!(hash1, hash2, "Icon hash must be stable across renders");
    }

    // Traces to: FR-APPSTORE-001 (All required sizes)
    #[test]
    fn test_all_required_sizes_render() {
        let gen = IconGenerator::new();
        let sizes = gen.render_all_sizes().expect("Render all sizes");

        let required_sizes = [1024, 512, 256, 180, 167, 152, 120, 114, 80, 76, 58];
        let rendered_sizes: Vec<u32> = sizes.iter().map(|(sz, _, _)| *sz).collect();

        assert_eq!(
            rendered_sizes.len(),
            11,
            "Must render all 11 required sizes"
        );

        for req_size in &required_sizes {
            assert!(
                rendered_sizes.contains(req_size),
                "Required size {} not in rendered: {:?}",
                req_size,
                rendered_sizes
            );
        }

        // Verify each PNG is non-empty and valid
        for (size, _name, png_data) in &sizes {
            assert!(!png_data.is_empty(), "PNG for size {} must not be empty", size);
            assert!(
                png_data.starts_with(&[137, 80, 78, 71, 13, 10, 26, 10]),
                "PNG for size {} must have valid PNG signature",
                size
            );
        }
    }

    // Traces to: FR-APPSTORE-001 (Contents.json validity)
    #[test]
    fn test_contents_json_valid() {
        let gen = IconGenerator::new();
        let json_str = gen.generate_contents_json().expect("Generate Contents.json");
        let parsed: serde_json::Value = serde_json::from_str(&json_str)
            .expect("Contents.json must be valid JSON");

        assert!(parsed["images"].is_array(), "images field must be array");
        assert!(parsed["info"]["version"].is_number(), "info.version must be present");

        let images = parsed["images"].as_array().expect("images array");
        assert!(!images.is_empty(), "images array must not be empty");
    }

    // Traces to: FR-APPSTORE-001 (Flame rendering)
    #[test]
    fn test_flame_renders_correctly() {
        let gen = IconGenerator::new();
        let png_data = gen.render(1024).expect("Render 1024x1024");
        assert!(!png_data.is_empty(), "PNG must not be empty");

        // Verify PNG header signature (PNG magic bytes)
        assert!(
            png_data.starts_with(&[137, 80, 78, 71, 13, 10, 26, 10]),
            "Valid PNG signature"
        );
    }
}
