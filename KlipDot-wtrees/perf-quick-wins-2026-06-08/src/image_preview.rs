use crate::{config::Config, error::Result, Error};
use std::path::Path;
use tokio::process::Command;
use tracing::{debug, info, warn};

/// Terminal image preview system supporting multiple protocols
#[derive(Clone)]
pub struct ImagePreviewManager {
    #[allow(dead_code)]
    config: Config,  // reserved for future use
    preview_method: PreviewMethod,
}

#[derive(Debug, Clone)]
pub enum PreviewMethod {
    /// iTerm2 inline images protocol
    ITerm2,
    /// Kitty graphics protocol
    Kitty,
    /// Sixel graphics protocol
    Sixel,
    /// ASCII art fallback
    ASCII,
    /// External viewer
    External(String),
    /// No preview available
    None,
}

impl ImagePreviewManager {
    pub async fn new(config: Config) -> Result<Self> {
        let preview_method = Self::detect_preview_method().await;
        info!("Image preview method detected: {:?}", preview_method);
        
        Ok(Self {
            config,
            preview_method,
        })
    }
    
    /// Preview image data from stdin
    pub async fn preview_stdin_data(&self, data: Vec<u8>) -> Result<()> {
        // Create temporary file for stdin data
        let temp_dir = std::env::temp_dir();
        let temp_file = temp_dir.join(format!("klipdot_stdin_{}.png", uuid::Uuid::new_v4()));
        
        std::fs::write(&temp_file, &data)?;
        
        // Show preview of temporary file
        let result = self.show_preview(&temp_file, None, None).await;
        
        // Clean up temporary file
        let _ = std::fs::remove_file(&temp_file);
        
        result
    }
    
    /// Create a compact preview for LSP-style display
    pub async fn show_compact_preview(&self, image_path: &Path) -> Result<String> {
        if !image_path.exists() {
            return Err(Error::NotFound(format!("Image file not found: {:?}", image_path)));
        }
        
        let metadata = std::fs::metadata(image_path)?;
        let file_name = image_path.file_name().unwrap_or_default().to_string_lossy();
        let file_size = Self::format_file_size(metadata.len());
        let dimensions = self.get_image_dimensions(image_path).await.unwrap_or_default();
        
        let mut info = format!("🖼️ {}", file_name);
        if !dimensions.is_empty() {
            info.push_str(&format!(" ({})", dimensions));
        }
        info.push_str(&format!(" - {}", file_size));
        
        Ok(info)
    }
    
    /// Detect the best available preview method for the current terminal
    async fn detect_preview_method() -> PreviewMethod {
        // Check for terminal capabilities in order of preference
        
        // 1. Check for iTerm2
        if let Ok(term_program) = std::env::var("TERM_PROGRAM") {
            if term_program == "iTerm.app" {
                return PreviewMethod::ITerm2;
            }
            // Apple Terminal - use external viewer
            if term_program == "Apple_Terminal" {
                return PreviewMethod::External("qlmanage".to_string());
            }
        }
        
        // 2. Check for Kitty
        if let Ok(term) = std::env::var("TERM") {
            if term.contains("kitty") {
                return PreviewMethod::Kitty;
            }
        }
        
        // 3. Check for sixel support
        if Self::check_sixel_support().await {
            return PreviewMethod::Sixel;
        }
        
        // 4. Check for external viewers in order of preference
        let viewers = [
            "imgcat",     // iTerm2 utilities
            "chafa",      // Modern ASCII art generator
            "catimg",     // Popular image viewer
            "timg",       // Terminal image viewer
            "qlmanage",   // macOS built-in QuickLook
            "open",       // macOS default opener
        ];
        
        for viewer in &viewers {
            if crate::is_command_available(viewer) {
                return PreviewMethod::External(viewer.to_string());
            }
        }
        
        // 5. Fallback to ASCII if available
        if crate::is_command_available("jp2a") || crate::is_command_available("img2txt") {
            return PreviewMethod::ASCII;
        }
        
        // 6. Last resort - use basic file info with macOS qlmanage if available
        if cfg!(target_os = "macos") {
            return PreviewMethod::External("qlmanage".to_string());
        }
        
        PreviewMethod::None
    }
    
    async fn check_sixel_support() -> bool {
        // Check if terminal supports sixel graphics
        if let Ok(output) = Command::new("sh")
            .arg("-c")
            .arg("echo -e '\\e[c' && read -t 1 -s -r response && echo $response | grep -q '4;'")
            .output()
            .await
        {
            output.status.success()
        } else {
            false
        }
    }
    
    /// Show an image preview in the terminal
    pub async fn show_preview(&self, image_path: &Path, max_width: Option<u32>, max_height: Option<u32>) -> Result<()> {
        if !image_path.exists() {
            return Err(Error::NotFound(format!("Image file not found: {:?}", image_path)));
        }
        
        debug!("Showing preview for: {:?} using method: {:?}", image_path, self.preview_method);
        
        match &self.preview_method {
            PreviewMethod::ITerm2 => self.show_iterm2_preview(image_path, max_width, max_height).await,
            PreviewMethod::Kitty => self.show_kitty_preview(image_path, max_width, max_height).await,
            PreviewMethod::Sixel => self.show_sixel_preview(image_path, max_width, max_height).await,
            PreviewMethod::ASCII => self.show_ascii_preview(image_path, max_width, max_height).await,
            PreviewMethod::External(viewer) => self.show_external_preview(viewer, image_path, max_width, max_height).await,
            PreviewMethod::None => {
                warn!("No preview method available for image: {:?}", image_path);
                self.show_text_info(image_path).await
            }
        }
    }
    
    /// Show image using iTerm2 inline images protocol
    async fn show_iterm2_preview(&self, image_path: &Path, max_width: Option<u32>, max_height: Option<u32>) -> Result<()> {
        let image_data = std::fs::read(image_path)?;
        let base64_data = base64::encode(&image_data);
        
        let width_param = max_width.map(|w| format!(";width={}px", w)).unwrap_or_default();
        let height_param = max_height.map(|h| format!(";height={}px", h)).unwrap_or_default();
        
        // iTerm2 inline image sequence
        let escape_sequence = format!(
            "\x1b]1337;File=inline=1;preserveAspectRatio=1{}{};size={}:{}\x07",
            width_param,
            height_param,
            image_data.len(),
            base64_data
        );
        
        print!("{}", escape_sequence);
        Ok(())
    }
    
    /// Show image using Kitty graphics protocol
    async fn show_kitty_preview(&self, image_path: &Path, max_width: Option<u32>, max_height: Option<u32>) -> Result<()> {
        let mut cmd = Command::new("kitten");
        cmd.arg("icat");
        
        if let Some(width) = max_width {
            cmd.arg("--cols").arg(width.to_string());
        }
        
        if let Some(height) = max_height {
            cmd.arg("--rows").arg(height.to_string());
        }
        
        cmd.arg(image_path);
        
        let output = cmd.output().await.map_err(|e| Error::Process(format!("Failed to run kitten: {}", e)))?;
        
        if output.status.success() {
            print!("{}", String::from_utf8_lossy(&output.stdout));
            Ok(())
        } else {
            Err(Error::Process(format!("Kitty preview failed: {}", String::from_utf8_lossy(&output.stderr))))
        }
    }
    
    /// Show image using sixel graphics protocol
    async fn show_sixel_preview(&self, image_path: &Path, max_width: Option<u32>, max_height: Option<u32>) -> Result<()> {
        let mut cmd = Command::new("img2sixel");
        
        if let Some(width) = max_width {
            cmd.arg("-w").arg(width.to_string());
        }
        
        if let Some(height) = max_height {
            cmd.arg("-h").arg(height.to_string());
        }
        
        cmd.arg(image_path);
        
        let output = cmd.output().await.map_err(|e| Error::Process(format!("Failed to run img2sixel: {}", e)))?;
        
        if output.status.success() {
            print!("{}", String::from_utf8_lossy(&output.stdout));
            Ok(())
        } else {
            Err(Error::Process(format!("Sixel preview failed: {}", String::from_utf8_lossy(&output.stderr))))
        }
    }
    
    /// Show image using ASCII art
    async fn show_ascii_preview(&self, image_path: &Path, max_width: Option<u32>, max_height: Option<u32>) -> Result<()> {
        // Try jp2a first (usually better quality)
        if crate::is_command_available("jp2a") {
            let mut cmd = Command::new("jp2a");
            cmd.arg("--colors");
            
            if let Some(width) = max_width {
                cmd.arg("--width").arg(width.to_string());
            }
            
            if let Some(height) = max_height {
                cmd.arg("--height").arg(height.to_string());
            }
            
            cmd.arg(image_path);
            
            if let Ok(output) = cmd.output().await {
                if output.status.success() {
                    print!("{}", String::from_utf8_lossy(&output.stdout));
                    return Ok(());
                }
            }
        }
        
        // Fallback to img2txt
        if crate::is_command_available("img2txt") {
            let mut cmd = Command::new("img2txt");
            
            if let Some(width) = max_width {
                cmd.arg("-W").arg(width.to_string());
            }
            
            if let Some(height) = max_height {
                cmd.arg("-H").arg(height.to_string());
            }
            
            cmd.arg(image_path);
            
            let output = cmd.output().await.map_err(|e| Error::Process(format!("Failed to run img2txt: {}", e)))?;
            
            if output.status.success() {
                print!("{}", String::from_utf8_lossy(&output.stdout));
                return Ok(());
            }
        }
        
        Err(Error::Unsupported("No ASCII art tools available".to_string()))
    }
    
    /// Show image using external viewer
    async fn show_external_preview(&self, viewer: &str, image_path: &Path, max_width: Option<u32>, max_height: Option<u32>) -> Result<()> {
        let mut cmd = Command::new(viewer);
        
        match viewer {
            "imgcat" => {
                // imgcat from iTerm2 utilities
                cmd.arg(image_path);
            }
            "catimg" => {
                // catimg tool
                if let Some(width) = max_width {
                    cmd.arg("-w").arg(width.to_string());
                }
                cmd.arg(image_path);
            }
            "timg" => {
                // timg tool
                if let Some(width) = max_width {
                    cmd.arg("-g").arg(format!("{}x{}", width, max_height.unwrap_or(width)));
                }
                cmd.arg(image_path);
            }
            "chafa" => {
                // chafa tool - modern ASCII art generator
                if let Some(width) = max_width {
                    cmd.arg("--size").arg(format!("{}x{}", width, max_height.unwrap_or(width/2)));
                } else {
                    cmd.arg("--size").arg("80x40");
                }
                cmd.arg("--format").arg("symbols");
                cmd.arg(image_path);
            }
            "qlmanage" => {
                // macOS QuickLook manager
                cmd.arg("-p").arg(image_path);
                
                // Launch in background and show info immediately
                println!("🖼️  Opening with QuickLook: {}", image_path.file_name().unwrap_or_default().to_string_lossy());
                
                // Spawn QuickLook in background and return immediately
                let _ = cmd.spawn();
                return Ok(());
            }
            "open" => {
                // macOS default opener
                cmd.arg(image_path);
                
                println!("🖼️  Opening with default app: {}", image_path.file_name().unwrap_or_default().to_string_lossy());
                
                // Spawn in background
                let _ = cmd.spawn();
                return Ok(());
            }
            _ => {
                cmd.arg(image_path);
            }
        }
        
        let output = cmd.output().await.map_err(|e| Error::Process(format!("Failed to run {}: {}", viewer, e)))?;
        
        if output.status.success() {
            let stdout = String::from_utf8_lossy(&output.stdout);
            if !stdout.is_empty() {
                print!("{}", stdout);
            }
            Ok(())
        } else {
            Err(Error::Process(format!("{} preview failed: {}", viewer, String::from_utf8_lossy(&output.stderr))))
        }
    }
    
    /// Show text information about the image (fallback)
    async fn show_text_info(&self, image_path: &Path) -> Result<()> {
        let metadata = std::fs::metadata(image_path)?;
        let file_name = image_path.file_name().unwrap_or_default().to_string_lossy();
        let file_size = Self::format_file_size(metadata.len());
        
        // Try to get image dimensions if possible
        let dimensions = self.get_image_dimensions(image_path).await.unwrap_or_default();
        
        println!("📸 Image: {}", file_name);
        println!("📏 Size: {}", file_size);
        if !dimensions.is_empty() {
            println!("🖼️  Dimensions: {}", dimensions);
        }
        println!("📁 Path: {}", image_path.display());
        
        // On macOS, offer to open with QuickLook
        if cfg!(target_os = "macos") {
            println!("💡 Tip: Run 'qlmanage -p \"{}\"' to preview with QuickLook", image_path.display());
            println!("💡 Or: 'open \"{}\"' to open with default app", image_path.display());
        }
        
        Ok(())
    }
    
    async fn get_image_dimensions(&self, image_path: &Path) -> Option<String> {
        // Try using ImageMagick identify command
        if crate::is_command_available("identify") {
            if let Ok(output) = Command::new("identify")
                .arg("-format")
                .arg("%wx%h")
                .arg(image_path)
                .output()
                .await
            {
                if output.status.success() {
                    let dimensions = String::from_utf8_lossy(&output.stdout).trim().to_string();
                    if !dimensions.is_empty() {
                        return Some(dimensions);
                    }
                }
            }
        }
        
        // Try using file command
        if let Ok(output) = Command::new("file")
            .arg(image_path)
            .output()
            .await
        {
            if output.status.success() {
                let file_info = String::from_utf8_lossy(&output.stdout);
                // Parse dimensions from file output (format varies)
                if let Some(dims) = Self::parse_file_dimensions(&file_info) {
                    return Some(dims);
                }
            }
        }
        
        None
    }
    
    fn parse_file_dimensions(file_output: &str) -> Option<String> {
        // Look for patterns like "1920 x 1080" or "1920x1080"
        let re = regex::Regex::new(r"(\d+)\s*[x×]\s*(\d+)").ok()?;
        if let Some(caps) = re.captures(file_output) {
            let width = caps.get(1)?.as_str();
            let height = caps.get(2)?.as_str();
            return Some(format!("{}x{}", width, height));
        }
        None
    }
    
    fn format_file_size(size: u64) -> String {
        const UNITS: &[&str] = &["B", "KB", "MB", "GB"];
        let mut size = size as f64;
        let mut unit_index = 0;
        
        while size >= 1024.0 && unit_index < UNITS.len() - 1 {
            size /= 1024.0;
            unit_index += 1;
        }
        
        if unit_index == 0 {
            format!("{} {}", size as u64, UNITS[unit_index])
        } else {
            format!("{:.1} {}", size, UNITS[unit_index])
        }
    }
    
    /// Create a quick preview command for a given image path
    pub fn create_preview_command(&self, image_path: &Path) -> String {
        match &self.preview_method {
            PreviewMethod::ITerm2 | PreviewMethod::Kitty | PreviewMethod::Sixel => {
                format!("klipdot preview '{}'", image_path.display())
            }
            PreviewMethod::External(viewer) => {
                format!("{} '{}'", viewer, image_path.display())
            }
            PreviewMethod::ASCII => {
                if crate::is_command_available("jp2a") {
                    format!("jp2a --colors '{}'", image_path.display())
                } else {
                    format!("img2txt '{}'", image_path.display())
                }
            }
            PreviewMethod::None => {
                format!("file '{}'", image_path.display())
            }
        }
    }
}

// Module for base64 encoding
mod base64 {
    use base64::engine::general_purpose;
    use base64::Engine;
    
    pub fn encode(data: &[u8]) -> String {
        general_purpose::STANDARD.encode(data)
    }
}


#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;
    
    #[tokio::test]
    async fn test_preview_manager_creation() {
        let config = Config::default();
        let manager = ImagePreviewManager::new(config).await;
        assert!(manager.is_ok());
    }
    
    #[test]
    fn test_file_size_formatting() {
        assert_eq!(ImagePreviewManager::format_file_size(500), "500 B");
        assert_eq!(ImagePreviewManager::format_file_size(1500), "1.5 KB");
        assert_eq!(ImagePreviewManager::format_file_size(1500000), "1.4 MB");
    }
    
    #[test]
    fn test_parse_file_dimensions() {
        let file_output = "test.png: PNG image data, 1920 x 1080, 8-bit/color RGBA";
        let dims = ImagePreviewManager::parse_file_dimensions(file_output);
        assert_eq!(dims, Some("1920x1080".to_string()));
    }
}