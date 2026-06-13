use crate::{error::Result, Error};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use tracing::{debug, info};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Config {
    pub enabled: bool,
    pub auto_start: bool,
    pub screenshot_dir: PathBuf,
    pub config_file: PathBuf,
    pub poll_interval: u64,
    pub image_formats: Vec<String>,
    pub max_file_size: u64,
    pub compression_quality: u8,
    pub cleanup_days: u32,
    pub enable_logging: bool,
    pub log_level: String,
    pub intercept_methods: InterceptMethods,
    pub shell_integration: ShellIntegration,
    pub display_server: DisplayServerConfig,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InterceptMethods {
    pub clipboard: bool,
    pub terminal: bool,
    pub drag_drop: bool,
    pub stdin: bool,
    pub file_watch: bool,
    pub process_monitor: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ShellIntegration {
    pub enabled: bool,
    pub shells: Vec<String>,
    pub hook_commands: Vec<String>,
    pub aliases: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DisplayServerConfig {
    pub auto_detect: bool,
    pub preferred_server: Option<String>, // "wayland", "x11", or None for auto
    pub wayland_compositor: Option<String>,
    pub clipboard_tools: ClipboardToolsConfig,
    pub screenshot_tools: ScreenshotToolsConfig,
    pub fallback_enabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClipboardToolsConfig {
    pub wayland_tools: Vec<String>,
    pub x11_tools: Vec<String>,
    pub preferred_tool: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScreenshotToolsConfig {
    pub wayland_tools: Vec<String>,
    pub x11_tools: Vec<String>,
    pub preferred_tool: Option<String>,
    pub default_args: std::collections::HashMap<String, Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Screenshot {
    pub filename: String,
    pub path: PathBuf,
    pub size: u64,
    pub source: String,
    pub created_at: DateTime<Utc>,
    pub mime_type: String,
}

impl Default for Config {
    fn default() -> Self {
        let home_dir = crate::get_home_dir().unwrap_or_else(|_| {
            std::env::temp_dir().join(".klipdot")
        });
        
        let now = Utc::now();
        
        Config {
            enabled: true,
            auto_start: false,
            screenshot_dir: home_dir.join(crate::SCREENSHOT_DIR),
            config_file: home_dir.join(crate::CONFIG_FILE),
            poll_interval: crate::DEFAULT_POLL_INTERVAL,
            image_formats: crate::SUPPORTED_FORMATS.iter().map(|s| s.to_string()).collect(),
            max_file_size: crate::MAX_FILE_SIZE,
            compression_quality: crate::IMAGE_QUALITY,
            cleanup_days: crate::DEFAULT_CLEANUP_DAYS,
            enable_logging: true,
            log_level: "info".to_string(),
            intercept_methods: InterceptMethods::default(),
            shell_integration: ShellIntegration::default(),
            display_server: DisplayServerConfig::default(),
            created_at: now,
            updated_at: now,
        }
    }
}

impl Default for InterceptMethods {
    fn default() -> Self {
        Self {
            clipboard: true,
            terminal: true,
            drag_drop: true,
            stdin: true,
            file_watch: true,
            process_monitor: true,
        }
    }
}

impl Default for ShellIntegration {
    fn default() -> Self {
        Self {
            enabled: true,
            shells: vec!["bash".to_string(), "zsh".to_string()],
            hook_commands: vec![
                "cp".to_string(),
                "mv".to_string(),
                "scp".to_string(),
                "rsync".to_string(),
            ],
            aliases: vec![
                "cp".to_string(),
                "mv".to_string(),
                "scp".to_string(),
            ],
        }
    }
}

impl Default for DisplayServerConfig {
    fn default() -> Self {
        Self {
            auto_detect: true,
            preferred_server: None,
            wayland_compositor: None,
            clipboard_tools: ClipboardToolsConfig::default(),
            screenshot_tools: ScreenshotToolsConfig::default(),
            fallback_enabled: true,
        }
    }
}

impl Default for ClipboardToolsConfig {
    fn default() -> Self {
        let mut wayland_tools = crate::WAYLAND_CLIPBOARD_TOOLS.iter().map(|s| s.to_string()).collect::<Vec<_>>();
        let mut x11_tools = crate::X11_CLIPBOARD_TOOLS.iter().map(|s| s.to_string()).collect::<Vec<_>>();
        
        // Add macOS tools to both lists for compatibility
        #[cfg(target_os = "macos")]
        {
            wayland_tools.extend(crate::MACOS_CLIPBOARD_TOOLS.iter().map(|s| s.to_string()));
            x11_tools.extend(crate::MACOS_CLIPBOARD_TOOLS.iter().map(|s| s.to_string()));
        }
        
        Self {
            wayland_tools,
            x11_tools,
            preferred_tool: Some(if cfg!(target_os = "macos") {
                "pbcopy".to_string()
            } else {
                "wl-copy".to_string()
            }),
        }
    }
}

impl Default for ScreenshotToolsConfig {
    fn default() -> Self {
        let mut default_args = std::collections::HashMap::new();
        
        // Wayland tools
        default_args.insert("grim".to_string(), vec!["-".to_string()]);
        default_args.insert("wayshot".to_string(), vec!["--stdout".to_string()]);
        default_args.insert("grimshot".to_string(), vec!["copy".to_string(), "screen".to_string()]);
        default_args.insert("spectacle".to_string(), vec!["-b".to_string(), "-n".to_string()]);
        default_args.insert("flameshot".to_string(), vec!["gui".to_string()]);
        
        // X11 tools
        default_args.insert("scrot".to_string(), vec!["-".to_string()]);
        default_args.insert("gnome-screenshot".to_string(), vec!["-f".to_string(), "-".to_string()]);
        default_args.insert("import".to_string(), vec!["-window".to_string(), "root".to_string(), "-".to_string()]);
        default_args.insert("xfce4-screenshooter".to_string(), vec!["-f".to_string(), "-s".to_string()]);
        
        // macOS tools
        default_args.insert("screencapture".to_string(), vec!["-c".to_string()]);
        default_args.insert("screenshot".to_string(), vec![]);
        
        let mut wayland_tools = crate::WAYLAND_SCREENSHOT_TOOLS.iter().map(|s| s.to_string()).collect::<Vec<_>>();
        let mut x11_tools = crate::X11_SCREENSHOT_TOOLS.iter().map(|s| s.to_string()).collect::<Vec<_>>();
        
        // Add macOS tools to both lists for compatibility
        #[cfg(target_os = "macos")]
        {
            wayland_tools.extend(crate::MACOS_SCREENSHOT_TOOLS.iter().map(|s| s.to_string()));
            x11_tools.extend(crate::MACOS_SCREENSHOT_TOOLS.iter().map(|s| s.to_string()));
        }
        
        Self {
            wayland_tools,
            x11_tools,
            preferred_tool: Some(if cfg!(target_os = "macos") {
                "screencapture".to_string()
            } else {
                "grim".to_string()
            }),
            default_args
        }
    }
}

impl Config {
    pub fn load_or_create_default() -> Result<Self> {
        let config_path = Self::get_default_config_path()?;
        
        if config_path.exists() {
            Self::load_from_path(&config_path)
        } else {
            let config = Self::default();
            config.save()?;
            Ok(config)
        }
    }
    
    pub fn load_from_path(path: &PathBuf) -> Result<Self> {
        debug!("Loading config from: {:?}", path);
        
        let content = std::fs::read_to_string(path)?;
        let mut config: Config = serde_json::from_str(&content)?;
        
        // Update the config file path to the one we loaded from
        config.config_file = path.clone();
        
        // Ensure directories exist
        std::fs::create_dir_all(&config.screenshot_dir)?;
        
        info!("Config loaded successfully");
        Ok(config)
    }
    
    pub fn save(&self) -> Result<()> {
        debug!("Saving config to: {:?}", self.config_file);
        
        // Ensure parent directory exists
        if let Some(parent) = self.config_file.parent() {
            std::fs::create_dir_all(parent)?;
        }
        
        let content = serde_json::to_string_pretty(self)?;
        std::fs::write(&self.config_file, content)?;
        
        info!("Config saved successfully");
        Ok(())
    }
    
    pub fn get_default_config_path() -> Result<PathBuf> {
        let config_dir = crate::get_home_dir()?;
        Ok(config_dir.join(crate::CONFIG_FILE))
    }
    
    pub fn get_config_path(&self) -> &Path {
        &self.config_file
    }
    
    pub fn reset_to_default() -> Result<()> {
        let config_path = Self::get_default_config_path()?;
        if config_path.exists() {
            std::fs::remove_file(&config_path)?;
        }
        
        let config = Self::default();
        config.save()?;
        
        info!("Config reset to default");
        Ok(())
    }
    
    pub fn update(&mut self) -> Result<()> {
        self.updated_at = Utc::now();
        self.save()
    }
    
    pub fn is_image_format_supported(&self, extension: &str) -> bool {
        self.image_formats.contains(&extension.to_lowercase())
    }
    
    pub fn get_screenshot_path(&self, filename: &str) -> PathBuf {
        self.screenshot_dir.join(filename)
    }
    
    pub async fn get_recent_screenshots(&self, limit: usize) -> Result<Vec<Screenshot>> {
        let mut screenshots = Vec::new();
        
        if !self.screenshot_dir.exists() {
            return Ok(screenshots);
        }
        
        let mut entries = tokio::fs::read_dir(&self.screenshot_dir).await?;
        let mut files = Vec::new();
        
        while let Some(entry) = entries.next_entry().await? {
            let path = entry.path();
            if path.is_file() {
                if let Some(ext) = path.extension() {
                    if let Some(ext_str) = ext.to_str() {
                        if self.is_image_format_supported(ext_str) {
                            files.push(path);
                        }
                    }
                }
            }
        }
        
        // Sort by modification time (newest first)
        files.sort_by(|a, b| {
            let a_meta = std::fs::metadata(a).unwrap();
            let b_meta = std::fs::metadata(b).unwrap();
            b_meta.modified().unwrap().cmp(&a_meta.modified().unwrap())
        });
        
        for file in files.iter().take(limit) {
            if let Ok(screenshot) = self.create_screenshot_info(file).await {
                screenshots.push(screenshot);
            }
        }
        
        Ok(screenshots)
    }
    
    pub async fn cleanup_old_screenshots(&self, days: u32) -> Result<usize> {
        let cutoff = Utc::now() - chrono::Duration::days(days as i64);
        let mut count = 0;
        
        if !self.screenshot_dir.exists() {
            return Ok(count);
        }
        
        let mut entries = tokio::fs::read_dir(&self.screenshot_dir).await?;
        
        while let Some(entry) = entries.next_entry().await? {
            let path = entry.path();
            if path.is_file() {
                if let Ok(metadata) = std::fs::metadata(&path) {
                    if let Ok(modified) = metadata.modified() {
                        let modified_utc = DateTime::<Utc>::from(modified);
                        if modified_utc < cutoff {
                            if let Err(e) = tokio::fs::remove_file(&path).await {
                                tracing::warn!("Failed to remove old screenshot {:?}: {}", path, e);
                            } else {
                                count += 1;
                                debug!("Removed old screenshot: {:?}", path);
                            }
                        }
                    }
                }
            }
        }
        
        info!("Cleaned up {} old screenshots", count);
        Ok(count)
    }
    
    async fn create_screenshot_info(&self, path: &PathBuf) -> Result<Screenshot> {
        let metadata = std::fs::metadata(path)?;
        let filename = path.file_name()
            .ok_or_else(|| Error::Format("Invalid filename".to_string()))?
            .to_string_lossy()
            .to_string();
        
        let created_at = DateTime::<Utc>::from(metadata.created().unwrap_or_else(|_| {
            std::time::SystemTime::now()
        }));
        
        let source = if filename.contains("clipboard") {
            "clipboard"
        } else if filename.contains("terminal") {
            "terminal"
        } else if filename.contains("dragdrop") {
            "dragdrop"
        } else if filename.contains("stdin") {
            "stdin"
        } else {
            "unknown"
        }.to_string();
        
        let mime_type = if let Some(ext) = path.extension() {
            match ext.to_str() {
                Some("png") => "image/png",
                Some("jpg") | Some("jpeg") => "image/jpeg",
                Some("gif") => "image/gif",
                Some("bmp") => "image/bmp",
                Some("webp") => "image/webp",
                Some("svg") => "image/svg+xml",
                _ => "application/octet-stream",
            }
        } else {
            "application/octet-stream"
        }.to_string();
        
        Ok(Screenshot {
            filename,
            path: path.clone(),
            size: metadata.len(),
            source,
            created_at,
            mime_type,
        })
    }
    
    pub fn validate(&self) -> Result<()> {
        if self.poll_interval < 100 {
            return Err(Error::Validation("Poll interval must be at least 100ms".to_string()));
        }
        
        if self.max_file_size < 1024 {
            return Err(Error::Validation("Max file size must be at least 1KB".to_string()));
        }
        
        if self.compression_quality > 100 {
            return Err(Error::Validation("Compression quality must be between 0-100".to_string()));
        }
        
        if self.cleanup_days == 0 {
            return Err(Error::Validation("Cleanup days must be greater than 0".to_string()));
        }
        
        Ok(())
    }
    
    pub fn get_log_level(&self) -> tracing::Level {
        match self.log_level.to_lowercase().as_str() {
            "error" => tracing::Level::ERROR,
            "warn" => tracing::Level::WARN,
            "info" => tracing::Level::INFO,
            "debug" => tracing::Level::DEBUG,
            "trace" => tracing::Level::TRACE,
            _ => tracing::Level::INFO,
        }
    }
    
    pub fn get_display_server(&self) -> crate::DisplayServer {
        if self.display_server.auto_detect {
            crate::detect_display_server()
        } else if let Some(ref preferred) = self.display_server.preferred_server {
            match preferred.to_lowercase().as_str() {
                "wayland" => crate::DisplayServer::Wayland,
                "x11" => crate::DisplayServer::X11,
                "macos" => crate::DisplayServer::MacOS,
                _ => crate::DisplayServer::Unknown,
            }
        } else {
            crate::detect_display_server()
        }
    }
    
    pub fn get_wayland_compositor(&self) -> Option<String> {
        if let Some(ref compositor) = self.display_server.wayland_compositor {
            Some(compositor.clone())
        } else {
            crate::detect_wayland_compositor()
        }
    }
    
    pub fn get_available_clipboard_tools(&self) -> Vec<String> {
        let mut tools = Vec::new();
        
        // Check preferred tool first
        if let Some(ref preferred) = self.display_server.clipboard_tools.preferred_tool {
            if crate::is_command_available(preferred) {
                tools.push(preferred.clone());
                return tools;
            }
        }
        
        // Get tools based on display server
        match self.get_display_server() {
            crate::DisplayServer::Wayland => {
                for tool in &self.display_server.clipboard_tools.wayland_tools {
                    if crate::is_command_available(tool) {
                        tools.push(tool.clone());
                    }
                }
                // Fallback to X11 if enabled
                if self.display_server.fallback_enabled {
                    for tool in &self.display_server.clipboard_tools.x11_tools {
                        if crate::is_command_available(tool) {
                            tools.push(tool.clone());
                        }
                    }
                }
            }
            crate::DisplayServer::X11 => {
                for tool in &self.display_server.clipboard_tools.x11_tools {
                    if crate::is_command_available(tool) {
                        tools.push(tool.clone());
                    }
                }
            }
            crate::DisplayServer::MacOS => {
                // On macOS, pbcopy/pbpaste are in both tool lists
                for tool in &self.display_server.clipboard_tools.x11_tools {
                    if crate::is_command_available(tool) {
                        tools.push(tool.clone());
                    }
                }
            }
            crate::DisplayServer::Unknown => {
                // Try both
                for tool in &self.display_server.clipboard_tools.wayland_tools {
                    if crate::is_command_available(tool) {
                        tools.push(tool.clone());
                    }
                }
                for tool in &self.display_server.clipboard_tools.x11_tools {
                    if crate::is_command_available(tool) {
                        tools.push(tool.clone());
                    }
                }
            }
        }
        
        tools
    }
    
    pub fn get_available_screenshot_tools(&self) -> Vec<String> {
        let mut tools = Vec::new();
        
        // Check preferred tool first
        if let Some(ref preferred) = self.display_server.screenshot_tools.preferred_tool {
            if crate::is_command_available(preferred) {
                tools.push(preferred.clone());
                return tools;
            }
        }
        
        // Get tools based on display server
        match self.get_display_server() {
            crate::DisplayServer::Wayland => {
                for tool in &self.display_server.screenshot_tools.wayland_tools {
                    if crate::is_command_available(tool) {
                        tools.push(tool.clone());
                    }
                }
            }
            crate::DisplayServer::X11 => {
                for tool in &self.display_server.screenshot_tools.x11_tools {
                    if crate::is_command_available(tool) {
                        tools.push(tool.clone());
                    }
                }
            }
            crate::DisplayServer::MacOS => {
                // On macOS, screencapture is in both tool lists
                for tool in &self.display_server.screenshot_tools.x11_tools {
                    if crate::is_command_available(tool) {
                        tools.push(tool.clone());
                    }
                }
            }
            crate::DisplayServer::Unknown => {
                // Try both
                for tool in &self.display_server.screenshot_tools.wayland_tools {
                    if crate::is_command_available(tool) {
                        tools.push(tool.clone());
                    }
                }
                for tool in &self.display_server.screenshot_tools.x11_tools {
                    if crate::is_command_available(tool) {
                        tools.push(tool.clone());
                    }
                }
            }
        }
        
        tools
    }
    
    pub fn get_screenshot_tool_args(&self, tool: &str) -> Vec<String> {
        self.display_server.screenshot_tools.default_args
            .get(tool)
            .cloned()
            .unwrap_or_default()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;
    
    #[test]
    fn test_default_config() {
        let config = Config::default();
        assert!(config.enabled);
        assert!(!config.auto_start);
        assert!(config.intercept_methods.clipboard);
        assert!(config.shell_integration.enabled);
        assert_eq!(config.compression_quality, 90);
    }
    
    #[test]
    fn test_config_validation() {
        let mut config = Config::default();
        
        // Valid config should pass
        assert!(config.validate().is_ok());
        
        // Invalid poll interval
        config.poll_interval = 50;
        assert!(config.validate().is_err());
        config.poll_interval = 1000;
        
        // Invalid compression quality
        config.compression_quality = 150;
        assert!(config.validate().is_err());
        config.compression_quality = 90;
        
        // Invalid cleanup days
        config.cleanup_days = 0;
        assert!(config.validate().is_err());
    }
    
    #[tokio::test]
    async fn test_config_save_load() {
        let temp_dir = TempDir::new().unwrap();
        let config_path = temp_dir.path().join("config.json");
        
        let mut config = Config::default();
        config.config_file = config_path.clone();
        config.enabled = false;
        
        assert!(config.save().is_ok());
        assert!(config_path.exists());
        
        let loaded_config = Config::load_from_path(&config_path).unwrap();
        assert!(!loaded_config.enabled);
        assert_eq!(loaded_config.config_file, config_path);
    }
    
    #[test]
    fn test_image_format_support() {
        let config = Config::default();
        assert!(config.is_image_format_supported("png"));
        assert!(config.is_image_format_supported("PNG"));
        assert!(config.is_image_format_supported("jpg"));
        assert!(!config.is_image_format_supported("txt"));
        assert!(!config.is_image_format_supported("exe"));
    }
}