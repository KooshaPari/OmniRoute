use crate::{config::Config, error::Result, Error, image_preview::ImagePreviewManager};
use regex::Regex;
use std::io::{BufRead, BufReader, Write};
use std::sync::Arc;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use tokio::sync::mpsc;
use tracing::{debug, info, warn};
use std::collections::HashMap;

/// Monitors stdout/stderr for image paths and automatically shows previews
pub struct StdoutMonitor {
    config: Config,
    preview_manager: ImagePreviewManager,
    image_path_regex: Regex,
    url_regex: Regex,
    base64_regex: Regex,
    escape_sequence_regex: Regex,
    tui_apps: HashMap<String, TuiConfig>,
}

#[derive(Debug, Clone)]
pub struct TuiConfig {
    pub name: String,
    pub supports_images: bool,
    pub preview_method: TuiPreviewMethod,
    pub escape_sequences: Vec<String>,
}

#[derive(Debug, Clone)]
pub enum TuiPreviewMethod {
    /// Show inline preview in TUI
    Inline,
    /// Show preview in separate pane/window
    SeparatePane,
    /// Show floating overlay
    Overlay,
    /// External preview window
    External,
    /// No preview (just detect and log)
    None,
}

#[derive(Debug, Clone)]
pub struct DetectedImage {
    pub path: PathBuf,
    pub source: ImageSource,
    pub context: String,
    pub line_number: usize,
}

#[derive(Debug, Clone)]
pub enum ImageSource {
    FilePath,
    Url,
    Base64Data,
    StdinPipe,
}

impl StdoutMonitor {
    pub async fn new(config: Config) -> Result<Self> {
        let preview_manager = ImagePreviewManager::new(config.clone()).await?;
        
        // Regex patterns for detecting image references
        let image_path_regex = Regex::new(
            r#"(?:^|\s|["'])((?:[~/.]|[A-Za-z]:|\\\\)[^"'\s]*\.(?:png|jpe?g|gif|bmp|webp|svg|tiff?|ico))(?:["']|\s|$)"#
        ).map_err(|e| Error::Config(format!("Failed to compile image path regex: {}", e)))?;
        
        let url_regex = Regex::new(
            r#"https?://[^\s"']+\.(?:png|jpe?g|gif|bmp|webp|svg|tiff?|ico)(?:\?[^\s"']*)?(?:["']|\s|$)"#
        ).map_err(|e| Error::Config(format!("Failed to compile URL regex: {}", e)))?;
        
        let base64_regex = Regex::new(
            r"data:image/(?:png|jpe?g|gif|bmp|webp|svg\+xml);base64,([A-Za-z0-9+/=]+)"
        ).map_err(|e| Error::Config(format!("Failed to compile base64 regex: {}", e)))?;
        
        // Regex for detecting ANSI escape sequences
        let escape_sequence_regex = Regex::new(
            r"\x1b\[[0-9;]*[mK]|\x1b\].*?\x07|\x1b\[.*?[HJf]"
        ).map_err(|e| Error::Config(format!("Failed to compile escape sequence regex: {}", e)))?;
        
        // Initialize TUI application configurations
        let mut tui_apps = HashMap::new();
        
        // Vim/Neovim
        tui_apps.insert("vim".to_string(), TuiConfig {
            name: "Vim".to_string(),
            supports_images: false,
            preview_method: TuiPreviewMethod::External,
            escape_sequences: vec![],
        });
        
        tui_apps.insert("nvim".to_string(), TuiConfig {
            name: "Neovim".to_string(),
            supports_images: true,
            preview_method: TuiPreviewMethod::Overlay,
            escape_sequences: vec![],
        });
        
        // Terminal file managers
        tui_apps.insert("ranger".to_string(), TuiConfig {
            name: "Ranger".to_string(),
            supports_images: true,
            preview_method: TuiPreviewMethod::SeparatePane,
            escape_sequences: vec![],
        });
        
        tui_apps.insert("lf".to_string(), TuiConfig {
            name: "LF".to_string(),
            supports_images: true,
            preview_method: TuiPreviewMethod::SeparatePane,
            escape_sequences: vec![],
        });
        
        tui_apps.insert("nnn".to_string(), TuiConfig {
            name: "NNN".to_string(),
            supports_images: true,
            preview_method: TuiPreviewMethod::External,
            escape_sequences: vec![],
        });
        
        // Terminal browsers
        tui_apps.insert("w3m".to_string(), TuiConfig {
            name: "w3m".to_string(),
            supports_images: true,
            preview_method: TuiPreviewMethod::Inline,
            escape_sequences: vec![],
        });
        
        tui_apps.insert("lynx".to_string(), TuiConfig {
            name: "Lynx".to_string(),
            supports_images: false,
            preview_method: TuiPreviewMethod::External,
            escape_sequences: vec![],
        });
        
        // Terminal multiplexers
        tui_apps.insert("tmux".to_string(), TuiConfig {
            name: "Tmux".to_string(),
            supports_images: true,
            preview_method: TuiPreviewMethod::SeparatePane,
            escape_sequences: vec![],
        });
        
        tui_apps.insert("screen".to_string(), TuiConfig {
            name: "Screen".to_string(),
            supports_images: false,
            preview_method: TuiPreviewMethod::External,
            escape_sequences: vec![],
        });
        
        // Git TUIs
        tui_apps.insert("tig".to_string(), TuiConfig {
            name: "Tig".to_string(),
            supports_images: false,
            preview_method: TuiPreviewMethod::External,
            escape_sequences: vec![],
        });
        
        tui_apps.insert("gitui".to_string(), TuiConfig {
            name: "GitUI".to_string(),
            supports_images: false,
            preview_method: TuiPreviewMethod::External,
            escape_sequences: vec![],
        });
        
        // System monitors
        tui_apps.insert("htop".to_string(), TuiConfig {
            name: "htop".to_string(),
            supports_images: false,
            preview_method: TuiPreviewMethod::None,
            escape_sequences: vec![],
        });
        
        tui_apps.insert("btop".to_string(), TuiConfig {
            name: "btop".to_string(),
            supports_images: false,
            preview_method: TuiPreviewMethod::None,
            escape_sequences: vec![],
        });
        
        Ok(Self {
            config,
            preview_manager,
            image_path_regex,
            url_regex,
            base64_regex,
            escape_sequence_regex,
            tui_apps,
        })
    }
    
    /// Monitor a command's output for image paths
    pub async fn monitor_command(&self, command_args: Vec<String>) -> Result<()> {
        if command_args.is_empty() {
            return Err(Error::InvalidInput("No command provided".to_string()));
        }
        
        info!("Monitoring command output: {:?}", command_args);
        
        // Detect if this is a TUI application
        let tui_config = self.detect_tui_app(&command_args[0]).map(Arc::new);
        if let Some(tui) = &tui_config {
            info!("Detected TUI application: {} (supports images: {})", tui.name, tui.supports_images);
        }
        
        let mut cmd = Command::new(&command_args[0]);
        if command_args.len() > 1 {
            cmd.args(&command_args[1..]);
        }
        
        cmd.stdout(Stdio::piped())
           .stderr(Stdio::piped());
        
        let mut child = cmd.spawn()
            .map_err(|e| Error::Process(format!("Failed to spawn command: {}", e)))?;
        
        let (tx, mut rx) = mpsc::channel::<DetectedImage>(100);
        
        // Monitor stdout
        if let Some(stdout) = child.stdout.take() {
            let tx_stdout = tx.clone();
            let monitor = self.clone();
            let tui_config_clone = tui_config.clone();
            tokio::spawn(async move {
                if let Err(e) = monitor.monitor_tui_stream(stdout, tx_stdout, "stdout", tui_config_clone.as_deref()).await {
                    warn!("Error monitoring stdout: {}", e);
                }
            });
        }
        
        // Monitor stderr
        if let Some(stderr) = child.stderr.take() {
            let tx_stderr = tx.clone();
            let monitor = self.clone();
            let tui_config_clone = tui_config.clone();
            tokio::spawn(async move {
                if let Err(e) = monitor.monitor_tui_stream(stderr, tx_stderr, "stderr", tui_config_clone.as_deref()).await {
                    warn!("Error monitoring stderr: {}", e);
                }
            });
        }
        
        // Handle detected images with TUI-aware preview
        let preview_manager = self.preview_manager.clone();
        tokio::spawn(async move {
            while let Some(detected_image) = rx.recv().await {
                info!("Detected image: {:?}", detected_image);
                
                // Show appropriate preview based on TUI context
                if let Some(tui) = &tui_config {
                    Self::show_tui_aware_preview(&preview_manager, &detected_image, tui).await;
                } else {
                    // Standard preview for non-TUI commands
                    let _ = preview_manager.show_preview(&detected_image.path, Some(40), Some(20)).await;
                }
            }
        });
        
        // Wait for command to complete
        let status = child.wait()
            .map_err(|e| Error::Process(format!("Failed to wait for command: {}", e)))?;
        
        if !status.success() {
            warn!("Command exited with non-zero status: {}", status);
        }
        
        Ok(())
    }
    
    /// Detect if a command is a known TUI application
    fn detect_tui_app(&self, command: &str) -> Option<TuiConfig> {
        // Extract just the binary name from the command
        let binary_name = std::path::Path::new(command)
            .file_name()?
            .to_str()?;
        
        self.tui_apps.get(binary_name).cloned()
    }
    
    /// Show preview appropriate for TUI context
    async fn show_tui_aware_preview(
        preview_manager: &ImagePreviewManager,
        detected_image: &DetectedImage,
        tui_config: &TuiConfig,
    ) {
        match tui_config.preview_method {
            TuiPreviewMethod::Inline => {
                // Try to show inline preview if TUI supports it
                if tui_config.supports_images {
                    let _ = preview_manager.show_preview(&detected_image.path, Some(60), Some(30)).await;
                } else {
                    // Just show compact info
                    if let Ok(info) = preview_manager.show_compact_preview(&detected_image.path).await {
                        println!("📷 {}", info);
                    }
                }
            }
            TuiPreviewMethod::SeparatePane => {
                // For apps like ranger/lf, show in a way that doesn't interfere
                println!("🖼️  Image detected: {}", detected_image.path.display());
                // Could integrate with tmux/screen to show in separate pane
            }
            TuiPreviewMethod::Overlay => {
                // For apps like nvim, show floating overlay
                let _ = preview_manager.show_preview(&detected_image.path, Some(80), Some(40)).await;
            }
            TuiPreviewMethod::External => {
                // Open in external viewer
                println!("🖼️  Image detected: {} (use external viewer)", detected_image.path.display());
                // Could launch external image viewer here
            }
            TuiPreviewMethod::None => {
                // Just log detection
                debug!("Image detected in {}: {}", tui_config.name, detected_image.path.display());
            }
        }
    }
    
    /// Monitor stream with TUI-aware processing
    async fn monitor_tui_stream<R: std::io::Read + Send + 'static>(
        &self,
        stream: R,
        tx: mpsc::Sender<DetectedImage>,
        stream_name: &str,
        tui_config: Option<&TuiConfig>,
    ) -> Result<()> {
        let reader = BufReader::new(stream);
        let mut line_number = 0;
        let mut buffer = String::new();
        
        for line in reader.lines() {
            line_number += 1;
            let mut line = line.map_err(Error::Io)?;
            
            // Handle TUI-specific processing
            if let Some(ref tui) = tui_config {
                line = self.process_tui_line(&line, tui);
            }
            
            // Print the line to maintain normal output (with escape sequences intact for TUIs)
            if tui_config.is_some() {
                // For TUIs, preserve escape sequences
                print!("{}\r\n", line);
                let _ = std::io::stdout().flush();
            } else {
                // For regular commands, use normal println
                println!("{}", line);
            }
            
            // Accumulate buffer for better context detection
            buffer.push_str(&line);
            buffer.push('\n');
            
            // Keep buffer manageable
            if buffer.len() > 4096 {
                buffer = buffer.split_off(buffer.len() - 2048);
            }
            
            // Detect images in this line and accumulated buffer
            let detected = self.detect_images_in_tui_context(&line, &buffer, line_number, &tui_config);
            
            for image in detected {
                if tx.send(image).await.is_err() {
                    debug!("Receiver dropped, stopping {} monitoring", stream_name);
                    break;
                }
            }
        }
        
        Ok(())
    }
    
    /// Process a line for TUI-specific handling
    fn process_tui_line(&self, line: &str, tui_config: &TuiConfig) -> String {
        // Remove or preserve escape sequences based on TUI needs
        match tui_config.name.as_str() {
            "Vim" | "Neovim" => {
                // Preserve most escape sequences for vim
                line.to_string()
            }
            "Ranger" | "LF" | "NNN" => {
                // File managers - preserve navigation sequences
                line.to_string()
            }
            _ => {
                // For other TUIs, clean escape sequences for image detection
                self.escape_sequence_regex.replace_all(line, "").to_string()
            }
        }
    }
    
    /// Detect images with TUI context awareness
    fn detect_images_in_tui_context(
        &self,
        line: &str,
        _buffer: &str,
        line_number: usize,
        tui_config: &Option<TuiConfig>,
    ) -> Vec<DetectedImage> {
        let mut detected = Vec::new();
        
        // Use different detection strategies based on TUI type
        if let Some(tui) = tui_config {
            match tui.name.as_str() {
                "Ranger" | "LF" | "NNN" => {
                    // File managers often show file paths directly
                    detected.extend(self.detect_file_manager_images(line, line_number));
                }
                "Vim" | "Neovim" => {
                    // Editors might show file names in status lines or command output
                    detected.extend(self.detect_editor_images(line, line_number));
                }
                "w3m" => {
                    // Browser might show image URLs or local paths
                    detected.extend(self.detect_browser_images(line, line_number));
                }
                _ => {
                    // Default detection for other TUIs
                    detected.extend(self.detect_images_in_line(line, line_number));
                }
            }
        } else {
            // Standard detection for non-TUI commands
            detected.extend(self.detect_images_in_line(line, line_number));
        }
        
        detected
    }
    
    /// Specialized detection for file managers
    fn detect_file_manager_images(&self, line: &str, line_number: usize) -> Vec<DetectedImage> {
        let mut detected = Vec::new();
        
        // File managers often show file listings - look for image files in any position
        for cap in self.image_path_regex.captures_iter(line) {
            if let Some(path_match) = cap.get(1) {
                let path_str = path_match.as_str();
                let path = PathBuf::from(self.expand_path(path_str));
                
                if path.exists() && self.is_image_file(&path) {
                    detected.push(DetectedImage {
                        path,
                        source: ImageSource::FilePath,
                        context: line.to_string(),
                        line_number,
                    });
                }
            }
        }
        
        detected
    }
    
    /// Specialized detection for editors
    fn detect_editor_images(&self, line: &str, line_number: usize) -> Vec<DetectedImage> {
        // Editors might show images in :ls output, file explorer, or command feedback
        self.detect_images_in_line(line, line_number)
    }
    
    /// Specialized detection for browsers
    fn detect_browser_images(&self, line: &str, line_number: usize) -> Vec<DetectedImage> {
        let detected = self.detect_images_in_line(line, line_number);
        
        // Also check for URLs that might be images
        for cap in self.url_regex.captures_iter(line) {
            if let Some(url_match) = cap.get(0) {
                let url = url_match.as_str().trim_end_matches(['"', '\'', ' ', '\n', '\r']);
                debug!("Detected image URL in browser: {}", url);
                // Could download and preview URL images here
            }
        }
        
        detected
    }
    
    #[allow(dead_code)]
    async fn monitor_stream<R: std::io::Read + Send + 'static>(
        &self,
        stream: R,
        tx: mpsc::Sender<DetectedImage>,
        stream_name: &str,
    ) -> Result<()> {
        let reader = BufReader::new(stream);
        let mut line_number = 0;
        
        for line in reader.lines() {
            line_number += 1;
            let line = line.map_err(Error::Io)?;
            
            // Print the line to maintain normal output
            println!("{}", line);
            
            // Detect images in this line
            let detected = self.detect_images_in_line(&line, line_number);
            
            for image in detected {
                if tx.send(image).await.is_err() {
                    debug!("Receiver dropped, stopping {} monitoring", stream_name);
                    break;
                }
            }
        }
        
        Ok(())
    }
    
    /// Detect image references in a single line
    pub fn detect_images_in_line(&self, line: &str, line_number: usize) -> Vec<DetectedImage> {
        let mut detected = Vec::new();
        
        // Detect file paths
        for cap in self.image_path_regex.captures_iter(line) {
            if let Some(path_match) = cap.get(1) {
                let path_str = path_match.as_str();
                let path = PathBuf::from(self.expand_path(path_str));
                
                if path.exists() && self.is_image_file(&path) {
                    detected.push(DetectedImage {
                        path,
                        source: ImageSource::FilePath,
                        context: line.to_string(),
                        line_number,
                    });
                }
            }
        }
        
        // Detect URLs
        for cap in self.url_regex.captures_iter(line) {
            if let Some(url_match) = cap.get(0) {
                let url = url_match.as_str().trim_end_matches(['"', '\'', ' ', '\n', '\r']);
                // For URLs, we could download and create a temp file
                // For now, just log the detection
                debug!("Detected image URL: {}", url);
            }
        }
        
        // Detect base64 images
        for cap in self.base64_regex.captures_iter(line) {
            if let Some(base64_match) = cap.get(1) {
                let base64_data = base64_match.as_str();
                // Could decode and create temp file for preview
                debug!("Detected base64 image data: {} bytes", base64_data.len());
            }
        }
        
        detected
    }
    
    fn expand_path(&self, path: &str) -> String {
        if path.starts_with('~') {
            if let Some(home) = dirs::home_dir() {
                return path.replacen('~', &home.to_string_lossy(), 1);
            }
        }
        path.to_string()
    }
    
    fn is_image_file(&self, path: &Path) -> bool {
        if let Some(ext) = path.extension() {
            if let Some(ext_str) = ext.to_str() {
                let ext_lower = ext_str.to_lowercase();
                return matches!(ext_lower.as_str(), 
                    "png" | "jpg" | "jpeg" | "gif" | "bmp" | "webp" | "svg" | "tiff" | "tif" | "ico"
                );
            }
        }
        false
    }
    
    /// Create a wrapper command that monitors the original command's output
    pub fn create_monitoring_wrapper(&self, original_command: &str) -> String {
        format!(
            "({}) 2>&1 | klipdot monitor-output",
            original_command
        )
    }
}

impl Clone for StdoutMonitor {
    fn clone(&self) -> Self {
        // Note: This is a simplified clone that recreates the regexes
        // In practice, you might want to use Arc<Regex> for better performance
        Self {
            config: self.config.clone(),
            preview_manager: self.preview_manager.clone(),
            image_path_regex: self.image_path_regex.clone(),
            url_regex: self.url_regex.clone(),
            base64_regex: self.base64_regex.clone(),
            escape_sequence_regex: self.escape_sequence_regex.clone(),
            tui_apps: self.tui_apps.clone(),
        }
    }
}

/// LSP-style live preview system for real-time image detection
pub struct LivePreviewSystem {
    #[allow(dead_code)]
    config: Config,  // reserved for future use
    preview_manager: ImagePreviewManager,
    current_preview: Option<PathBuf>,
}

impl LivePreviewSystem {
    pub async fn new(config: Config) -> Result<Self> {
        let preview_manager = ImagePreviewManager::new(config.clone()).await?;
        
        Ok(Self {
            config,
            preview_manager,
            current_preview: None,
        })
    }
    
    /// Show live preview as user types (like LSP hover)
    pub async fn show_live_preview(&mut self, text: &str, cursor_position: usize) -> Result<bool> {
        let detected_path = self.extract_image_path_at_cursor(text, cursor_position);
        
        match detected_path {
            Some(path) if Some(&path) != self.current_preview.as_ref() => {
                // New image detected, show preview
                self.show_floating_preview(&path).await?;
                self.current_preview = Some(path);
                Ok(true)
            }
            None if self.current_preview.is_some() => {
                // No image at cursor, hide preview
                self.hide_floating_preview().await?;
                self.current_preview = None;
                Ok(true)
            }
            _ => Ok(false), // No change needed
        }
    }
    
    fn extract_image_path_at_cursor(&self, text: &str, cursor_position: usize) -> Option<PathBuf> {
        // Find word boundaries around cursor
        let before_cursor = &text[..cursor_position.min(text.len())];
        let after_cursor = &text[cursor_position.min(text.len())..];
        
        // Find start of current word
        let word_start = before_cursor.rfind(|c: char| c.is_whitespace() || c == '"' || c == '\'')
            .map(|i| i + 1)
            .unwrap_or(0);
        
        // Find end of current word
        let word_end = after_cursor.find(|c: char| c.is_whitespace() || c == '"' || c == '\'')
            .map(|i| cursor_position + i)
            .unwrap_or(text.len());
        
        if word_start < word_end {
            let word = &text[word_start..word_end];
            let path = PathBuf::from(self.expand_path(word));
            
            if path.exists() && self.is_image_file(&path) {
                return Some(path);
            }
        }
        
        None
    }
    
    async fn show_floating_preview(&self, path: &Path) -> Result<()> {
        // In a real implementation, this would show a floating window or modal
        // For now, we'll show a compact preview with escape sequences for positioning
        
        print!("\x1b[s"); // Save cursor position
        print!("\x1b[H"); // Move to top-left
        print!("\x1b[2K"); // Clear line
        print!("🖼️  Live Preview: {}", path.file_name().unwrap_or_default().to_string_lossy());
        
        // Show small preview
        self.preview_manager.show_preview(path, Some(40), Some(10)).await?;
        
        print!("\x1b[u"); // Restore cursor position
        
        Ok(())
    }
    
    async fn hide_floating_preview(&self) -> Result<()> {
        // Clear the preview area
        print!("\x1b[s"); // Save cursor position
        print!("\x1b[H"); // Move to top-left
        print!("\x1b[K"); // Clear line
        print!("\x1b[u"); // Restore cursor position
        
        Ok(())
    }
    
    fn expand_path(&self, path: &str) -> String {
        if path.starts_with('~') {
            if let Some(home) = dirs::home_dir() {
                return path.replacen('~', &home.to_string_lossy(), 1);
            }
        }
        path.to_string()
    }
    
    fn is_image_file(&self, path: &Path) -> bool {
        if let Some(ext) = path.extension() {
            if let Some(ext_str) = ext.to_str() {
                let ext_lower = ext_str.to_lowercase();
                return matches!(ext_lower.as_str(), 
                    "png" | "jpg" | "jpeg" | "gif" | "bmp" | "webp" | "svg" | "tiff" | "tif" | "ico"
                );
            }
        }
        false
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;
    use std::fs;
    
    #[tokio::test]
    async fn test_detect_images_in_line() {
        let config = Config::default();
        let monitor = StdoutMonitor::new(config).await.unwrap();
        
        // Create a temporary image file for testing
        let temp_dir = tempdir().unwrap();
        let image_path = temp_dir.path().join("test.png");
        fs::write(&image_path, b"fake image data").unwrap();
        
        let line = format!("Found image at: {}", image_path.display());
        let detected = monitor.detect_images_in_line(&line, 1);
        
        assert_eq!(detected.len(), 1);
        assert_eq!(detected[0].path, image_path);
        assert!(matches!(detected[0].source, ImageSource::FilePath));
    }
    
    #[tokio::test]
    async fn test_live_preview_path_extraction() {
        let config = Config::default();
        let mut system = LivePreviewSystem::new(config).await.unwrap();
        
        // Create a temporary image file
        let temp_dir = tempdir().unwrap();
        let image_path = temp_dir.path().join("test.png");
        fs::write(&image_path, b"fake image data").unwrap();
        
        let text = format!("vim {}", image_path.display());
        let cursor_pos = text.len() - 4; // Position in the middle of the filename
        
        let detected = system.extract_image_path_at_cursor(&text, cursor_pos);
        assert_eq!(detected, Some(image_path));
    }
}