use crate::{config::Config, error::Result, Error};
use std::collections::HashMap;
use std::time::Duration;
use tokio::process::Command;
use tokio::time::sleep;
use tracing::{debug, info, warn};

pub struct TerminalInterceptor {
    config: Config,
    running: bool,
    process_monitors: HashMap<String, ProcessMonitor>,
}

#[derive(Debug, Clone)]
struct ProcessMonitor {
    #[allow(dead_code)]
    name: String,
    #[allow(dead_code)]
    pid: Option<u32>,
    last_seen: std::time::SystemTime,
}

impl TerminalInterceptor {
    pub async fn new(config: Config) -> Result<Self> {
        Ok(Self {
            config,
            running: false,
            process_monitors: HashMap::new(),
        })
    }
    
    pub async fn run(&mut self) -> Result<()> {
        if !self.config.intercept_methods.process_monitor {
            info!("Process monitoring disabled in config");
            return Ok(());
        }
        
        info!("Starting terminal interceptor");
        self.running = true;
        
        let mut interval = tokio::time::interval(Duration::from_millis(self.config.poll_interval));
        
        while self.running {
            interval.tick().await;
            
            if let Err(e) = self.monitor_processes().await {
                if e.is_recoverable() {
                    warn!("Recoverable process monitoring error: {}", e);
                } else {
                    return Err(e);
                }
            }
        }
        
        Ok(())
    }
    
    pub fn stop(&mut self) {
        info!("Stopping terminal interceptor");
        self.running = false;
    }
    
    async fn monitor_processes(&mut self) -> Result<()> {
        debug!("Monitoring processes for image operations");
        
        let processes = self.get_running_processes().await?;
        
        for process in processes {
            if self.is_image_process(&process.name) {
                self.handle_image_process(&process).await?;
            }
        }
        
        // Monitor display server specific screenshot tools
        self.monitor_display_server_tools().await?;
        
        Ok(())
    }
    
    async fn monitor_display_server_tools(&mut self) -> Result<()> {
        let display_server = crate::detect_display_server();
        
        match display_server {
            crate::DisplayServer::Wayland => {
                self.monitor_wayland_tools().await?;
            }
            crate::DisplayServer::X11 => {
                self.monitor_x11_tools().await?;
            }
            crate::DisplayServer::MacOS => {
                self.monitor_macos_tools().await?;
            }
            crate::DisplayServer::Unknown => {
                // Try both
                let _ = self.monitor_wayland_tools().await;
                let _ = self.monitor_x11_tools().await;
                let _ = self.monitor_macos_tools().await;
            }
        }
        
        Ok(())
    }
    
    async fn monitor_wayland_tools(&mut self) -> Result<()> {
        for tool in crate::WAYLAND_SCREENSHOT_TOOLS {
            if crate::is_command_available(tool) {
                let processes = self.get_processes_by_name(tool).await?;
                for process in processes {
                    self.handle_wayland_screenshot_process(&process).await?;
                }
            }
        }
        
        Ok(())
    }
    
    async fn monitor_x11_tools(&mut self) -> Result<()> {
        for tool in crate::X11_SCREENSHOT_TOOLS {
            if crate::is_command_available(tool) {
                let processes = self.get_processes_by_name(tool).await?;
                for process in processes {
                    self.handle_x11_screenshot_process(&process).await?;
                }
            }
        }
        
        Ok(())
    }
    
    async fn monitor_macos_tools(&mut self) -> Result<()> {
        for tool in crate::MACOS_SCREENSHOT_TOOLS {
            if crate::is_command_available(tool) {
                let processes = self.get_processes_by_name(tool).await?;
                for process in processes {
                    self.handle_macos_screenshot_process(&process).await?;
                }
            }
        }
        
        Ok(())
    }
    
    async fn handle_wayland_screenshot_process(&mut self, process: &Process) -> Result<()> {
        info!("Detected Wayland screenshot tool: {} (PID: {})", process.name, process.pid);
        
        // Wait for the process to complete
        self.wait_for_process_completion(process.pid).await?;
        
        // Look for recently created images in common directories
        let screenshot_dirs = vec![
            dirs::desktop_dir(),
            dirs::download_dir(),
            dirs::picture_dir(),
            Some(std::env::current_dir().unwrap_or_else(|_| std::path::PathBuf::from("/tmp")))
        ];
        
        for dir in screenshot_dirs.into_iter().flatten() {
            self.scan_directory_for_new_images(&dir, "wayland-screenshot").await?;
        }
        
        Ok(())
    }
    
    async fn handle_x11_screenshot_process(&mut self, process: &Process) -> Result<()> {
        info!("Detected X11 screenshot tool: {} (PID: {})", process.name, process.pid);
        
        // Wait for the process to complete
        self.wait_for_process_completion(process.pid).await?;
        
        // Look for recently created images in common directories
        let screenshot_dirs = vec![
            dirs::desktop_dir(),
            dirs::download_dir(),
            dirs::picture_dir(),
            Some(std::env::current_dir().unwrap_or_else(|_| std::path::PathBuf::from("/tmp")))
        ];
        
        for dir in screenshot_dirs.into_iter().flatten() {
            self.scan_directory_for_new_images(&dir, "x11-screenshot").await?;
        }
        
        Ok(())
    }
    
    async fn handle_macos_screenshot_process(&mut self, process: &Process) -> Result<()> {
        info!("Detected macOS screenshot tool: {} (PID: {})", process.name, process.pid);
        
        // Wait for the process to complete
        self.wait_for_process_completion(process.pid).await?;
        
        // Check clipboard for screenshot data (screencapture -c puts it in clipboard)
        self.check_clipboard_after_screenshot().await?;
        
        // Look for recently created images in macOS screenshot directories
        let screenshot_dirs = vec![
            dirs::desktop_dir(),
            dirs::download_dir(),
            dirs::picture_dir(),
            Some(std::env::current_dir().unwrap_or_else(|_| std::path::PathBuf::from("/tmp")))
        ];
        
        for dir in screenshot_dirs.into_iter().flatten() {
            self.scan_directory_for_new_images(&dir, "macos-screenshot").await?;
        }
        
        Ok(())
    }
    
    async fn get_processes_by_name(&self, name: &str) -> Result<Vec<Process>> {
        let mut processes = Vec::new();
        let all_processes = self.get_running_processes().await?;
        
        for process in all_processes {
            if process.name == name {
                processes.push(process);
            }
        }
        
        Ok(processes)
    }
    
    async fn wait_for_process_completion(&self, pid: u32) -> Result<()> {
        let max_wait = Duration::from_secs(30); // Maximum wait time
        let check_interval = Duration::from_millis(100);
        let start_time = std::time::Instant::now();
        
        while start_time.elapsed() < max_wait {
            if !self.is_process_running(pid).await? {
                return Ok(());
            }
            sleep(check_interval).await;
        }
        
        warn!("Process {} did not complete within {} seconds", pid, max_wait.as_secs());
        Ok(())
    }
    
    async fn is_process_running(&self, pid: u32) -> Result<bool> {
        #[cfg(unix)]
        {
            use libc::{kill, ESRCH};
            unsafe {
                let result = kill(pid as i32, 0);
                if result == 0 {
                    Ok(true)
                } else {
                    let errno = {
                        #[cfg(target_os = "linux")]
                        { *libc::__errno_location() }
                        #[cfg(target_os = "macos")]
                        { *libc::__error() }
                        #[cfg(not(any(target_os = "linux", target_os = "macos")))]
                        { 0 }
                    };
                    if errno == ESRCH {
                        Ok(false)
                    } else {
                        Err(Error::Process(format!("Failed to check process: {}", errno)))
                    }
                }
            }
        }
        
        #[cfg(windows)]
        {
            let output = Command::new("tasklist")
                .arg("/FI")
                .arg(&format!("PID eq {}", pid))
                .output()
                .await
                .map_err(|e| Error::Process(format!("Failed to check process: {}", e)))?;
            
            let output_str = String::from_utf8_lossy(&output.stdout);
            Ok(output_str.contains(&pid.to_string()))
        }
    }
    
    async fn scan_directory_for_new_images(&self, dir: &std::path::Path, source: &str) -> Result<()> {
        if !dir.exists() {
            return Ok(());
        }
        
        let mut entries = tokio::fs::read_dir(dir).await
            .map_err(|e| Error::Io(std::io::Error::other(e)))?;
        
        let recent_threshold = std::time::SystemTime::now() - Duration::from_secs(30);
        
        while let Some(entry) = entries.next_entry().await
            .map_err(|e| Error::Io(std::io::Error::other(e)))? {
            
            let path = entry.path();
            
            if crate::is_image_file(&path) {
                if let Ok(metadata) = entry.metadata().await {
                    if let Ok(modified) = metadata.modified() {
                        if modified > recent_threshold {
                            info!("Found new image: {:?}", path);
                            self.process_image_file(&path, source).await?;
                        }
                    }
                }
            }
        }
        
        Ok(())
    }
    
    async fn process_image_file(&self, path: &std::path::Path, source: &str) -> Result<()> {
        debug!("Processing image file: {:?} from source: {}", path, source);
        
        // Here you would integrate with your image processor
        // For now, we'll just log the detection
        info!("Detected image file: {:?} from {}", path, source);
        
        Ok(())
    }
    
    async fn get_running_processes(&self) -> Result<Vec<Process>> {
        let mut processes = Vec::new();
        
        #[cfg(unix)]
        {
            let output = Command::new("ps")
                .arg("-eo")
                .arg("pid,comm,args")
                .output()
                .await
                .map_err(|e| Error::Process(format!("Failed to run ps: {}", e)))?;
            
            if output.status.success() {
                let output_str = String::from_utf8_lossy(&output.stdout);
                for line in output_str.lines().skip(1) {
                    if let Some(process) = self.parse_ps_line(line) {
                        processes.push(process);
                    }
                }
            }
        }
        
        #[cfg(windows)]
        {
            let output = Command::new("wmic")
                .arg("process")
                .arg("get")
                .arg("ProcessId,Name,CommandLine")
                .arg("/format:csv")
                .output()
                .await
                .map_err(|e| Error::Process(format!("Failed to run wmic: {}", e)))?;
            
            if output.status.success() {
                let output_str = String::from_utf8_lossy(&output.stdout);
                for line in output_str.lines().skip(1) {
                    if let Some(process) = self.parse_wmic_line(line) {
                        processes.push(process);
                    }
                }
            }
        }
        
        Ok(processes)
    }
    
    #[cfg(unix)]
    fn parse_ps_line(&self, line: &str) -> Option<Process> {
        let parts: Vec<&str> = line.split_whitespace().collect();
        if parts.len() >= 3 {
            if let Ok(pid) = parts[0].parse::<u32>() {
                let name = parts[1].to_string();
                let command = parts[2..].join(" ");
                
                return Some(Process {
                    pid,
                    name,
                    command,
                });
            }
        }
        None
    }
    
    #[cfg(windows)]
    fn parse_wmic_line(&self, line: &str) -> Option<Process> {
        let parts: Vec<&str> = line.split(',').collect();
        if parts.len() >= 3 {
            if let Ok(pid) = parts[2].parse::<u32>() {
                let name = parts[1].to_string();
                let command = parts[0].to_string();
                
                return Some(Process {
                    pid,
                    name,
                    command,
                });
            }
        }
        None
    }
    
    fn is_image_process(&self, name: &str) -> bool {
        let name_lower = name.to_lowercase();
        
        for process_name in crate::IMAGE_PROCESS_NAMES {
            if name_lower.contains(&process_name.to_lowercase()) {
                return true;
            }
        }
        
        false
    }
    
    async fn handle_image_process(&mut self, process: &Process) -> Result<()> {
        debug!("Detected image process: {} (PID: {})", process.name, process.pid);
        
        // Check if this is a screenshot process
        if self.is_screenshot_process(&process.name) {
            self.handle_screenshot_process(process).await?;
        }
        
        // Update process monitor
        self.process_monitors.insert(
            process.name.clone(),
            ProcessMonitor {
                name: process.name.clone(),
                pid: Some(process.pid),
                last_seen: std::time::SystemTime::now(),
            },
        );
        
        Ok(())
    }
    
    fn is_screenshot_process(&self, name: &str) -> bool {
        let name_lower = name.to_lowercase();
        
        // Check against all available screenshot tools
        let available_tools = self.config.get_available_screenshot_tools();
        for tool in &available_tools {
            if name_lower.contains(&tool.to_lowercase()) {
                return true;
            }
        }
        
        // Fallback to hardcoded list
        let screenshot_processes = [
            "screencapture",
            "screenshot",
            "scrot",
            "gnome-screenshot",
            "spectacle",
            "flameshot",
            "grim",
            "slurp",
            "wayshot",
            "grimshot",
            "import",
            "xfce4-screenshooter",
        ];
        
        for proc in &screenshot_processes {
            if name_lower.contains(proc) {
                return true;
            }
        }
        
        false
    }
    
    async fn handle_screenshot_process(&mut self, process: &Process) -> Result<()> {
        info!("Screenshot process detected: {} (PID: {})", process.name, process.pid);
        
        // Handle Wayland-specific screenshot processes
        if self.is_wayland_screenshot_process(&process.name) {
            self.handle_wayland_screenshot_process_new(process).await?;
        } else {
            // Handle traditional screenshot processes
            self.handle_traditional_screenshot_process(process).await?;
        }
        
        Ok(())
    }
    
    fn is_wayland_screenshot_process(&self, name: &str) -> bool {
        let name_lower = name.to_lowercase();
        for tool in crate::WAYLAND_SCREENSHOT_TOOLS {
            if name_lower.contains(&tool.to_lowercase()) {
                return true;
            }
        }
        false
    }
    
    async fn handle_wayland_screenshot_process_new(&self, process: &Process) -> Result<()> {
        info!("Wayland screenshot process detected: {} (PID: {})", process.name, process.pid);
        
        // Wait for the process to complete
        self.wait_for_process_completion(process.pid).await?;
        
        // Check for clipboard changes (many Wayland tools copy to clipboard)
        self.check_clipboard_after_screenshot().await?;
        
        // Look for recently created image files
        self.scan_for_new_images().await?;
        
        Ok(())
    }
    
    async fn handle_traditional_screenshot_process(&self, process: &Process) -> Result<()> {
        info!("Traditional screenshot process detected: {} (PID: {})", process.name, process.pid);
        
        // Wait for the process to complete
        self.wait_for_process_completion(process.pid).await?;
        
        // Look for recently created image files
        self.scan_for_new_images().await?;
        
        Ok(())
    }
    
    async fn check_clipboard_after_screenshot(&self) -> Result<()> {
        // Give the screenshot tool time to update clipboard
        tokio::time::sleep(std::time::Duration::from_millis(500)).await;
        
        // Check if there's new image data in clipboard
        // This would integrate with the clipboard monitor
        debug!("Checking clipboard for screenshot data");
        
        Ok(())
    }
    
    async fn scan_for_new_images(&self) -> Result<()> {
        let mut scan_dirs = vec![
            dirs::desktop_dir(),
            dirs::download_dir(),
            dirs::picture_dir(),
            Some(std::env::current_dir().unwrap_or_else(|_| "/tmp".into())),
        ];
        
        // Add platform-specific screenshot directories
        match self.config.get_display_server() {
            crate::DisplayServer::Wayland => {
                self.add_wayland_screenshot_dirs(&mut scan_dirs).await?;
            }
            crate::DisplayServer::MacOS => {
                self.add_macos_screenshot_dirs(&mut scan_dirs).await?;
            }
            _ => {}
        }
        
        for dir in scan_dirs.iter().flatten() {
            if dir.exists() {
                self.scan_directory_for_images(dir).await?;
            }
        }
        
        Ok(())
    }
    
    async fn add_wayland_screenshot_dirs(&self, dirs: &mut Vec<Option<std::path::PathBuf>>) -> Result<()> {
        // Add compositor-specific directories
        if let Some(compositor) = self.config.get_wayland_compositor() {
            match compositor.as_str() {
                "gnome" => {
                    // GNOME Shell saves to Pictures by default
                    if let Some(pictures_dir) = dirs::picture_dir() {
                        dirs.push(Some(pictures_dir.join("Screenshots")));
                    }
                }
                "kde" => {
                    // KDE Spectacle saves to Pictures/Screenshots
                    if let Some(pictures_dir) = dirs::picture_dir() {
                        dirs.push(Some(pictures_dir.join("Screenshots")));
                    }
                }
                "sway" => {
                    // Sway users often save to home directory
                    if let Some(home_dir) = dirs::home_dir() {
                        dirs.push(Some(home_dir.join("Pictures")));
                        dirs.push(Some(home_dir));
                    }
                }
                _ => {}
            }
        }
        
        // Add XDG user directories
        if let Some(config_dir) = dirs::config_dir() {
            dirs.push(Some(config_dir.join("user-dirs.dirs")));
        }
        
        Ok(())
    }
    
    async fn add_macos_screenshot_dirs(&self, dirs: &mut Vec<Option<std::path::PathBuf>>) -> Result<()> {
        // macOS default screenshot location is Desktop
        if let Some(desktop_dir) = dirs::desktop_dir() {
            dirs.push(Some(desktop_dir));
        }
        
        // Also check Pictures directory
        if let Some(pictures_dir) = dirs::picture_dir() {
            dirs.push(Some(pictures_dir.join("Screenshots")));
        }
        
        // Check ~/Documents for some apps
        if let Some(documents_dir) = dirs::document_dir() {
            dirs.push(Some(documents_dir.join("Screenshots")));
        }
        
        Ok(())
    }
    
    async fn scan_directory_for_images(&self, dir: &std::path::Path) -> Result<()> {
        let mut entries = tokio::fs::read_dir(dir).await?;
        let now = std::time::SystemTime::now();
        
        while let Some(entry) = entries.next_entry().await? {
            let path = entry.path();
            
            if path.is_file() && crate::is_image_file(&path) {
                if let Ok(metadata) = entry.metadata().await {
                    if let Ok(created) = metadata.created() {
                        // Check if file was created in the last 30 seconds
                        if let Ok(elapsed) = now.duration_since(created) {
                            if elapsed.as_secs() < 30 {
                                self.process_new_image(&path).await?;
                            }
                        }
                    }
                }
            }
        }
        
        Ok(())
    }
    
    async fn process_new_image(&self, path: &std::path::Path) -> Result<()> {
        info!("Processing new image: {:?}", path);
        
        // Use the image processor to handle the file
        let image_processor = crate::image_processor::ImageProcessor::new(self.config.clone()).await?;
        let processed_path = image_processor.process_image_file(&path.to_path_buf(), "screenshot").await?;
        
        // Replace the original file reference with the processed path
        // This would typically involve shell integration
        debug!("Processed screenshot: {:?} -> {:?}", path, processed_path);
        
        Ok(())
    }
    
    pub async fn cleanup_old_monitors(&mut self) -> Result<()> {
        let now = std::time::SystemTime::now();
        let mut to_remove = Vec::new();
        
        for (name, monitor) in &self.process_monitors {
            if let Ok(elapsed) = now.duration_since(monitor.last_seen) {
                if elapsed.as_secs() > 300 { // 5 minutes
                    to_remove.push(name.clone());
                }
            }
        }
        
        for name in to_remove {
            self.process_monitors.remove(&name);
        }
        
        Ok(())
    }
}

#[derive(Debug, Clone)]
struct Process {
    pid: u32,
    name: String,
    #[allow(dead_code)]
    command: String,
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;
    
    #[tokio::test]
    async fn test_terminal_interceptor_creation() {
        let temp_dir = TempDir::new().unwrap();
        let mut config = Config::default();
        config.screenshot_dir = temp_dir.path().to_path_buf();
        
        let interceptor = TerminalInterceptor::new(config).await;
        assert!(interceptor.is_ok());
    }
    
    #[test]
    fn test_image_process_detection() {
        let config = Config::default();
        let interceptor = TerminalInterceptor {
            config,
            running: false,
            process_monitors: HashMap::new(),
        };
        
        assert!(interceptor.is_image_process("screencapture"));
        assert!(interceptor.is_image_process("screenshot"));
        assert!(interceptor.is_image_process("scrot"));
        assert!(interceptor.is_image_process("convert"));
        assert!(!interceptor.is_image_process("bash"));
        assert!(!interceptor.is_image_process("vim"));
    }
    
    #[test]
    fn test_screenshot_process_detection() {
        let config = Config::default();
        let interceptor = TerminalInterceptor {
            config,
            running: false,
            process_monitors: HashMap::new(),
        };
        
        assert!(interceptor.is_screenshot_process("screencapture"));
        assert!(interceptor.is_screenshot_process("gnome-screenshot"));
        assert!(interceptor.is_screenshot_process("flameshot"));
        assert!(!interceptor.is_screenshot_process("convert"));
        assert!(!interceptor.is_screenshot_process("gimp"));
    }
    
    #[tokio::test]
    async fn test_cleanup_old_monitors() {
        let temp_dir = TempDir::new().unwrap();
        let mut config = Config::default();
        config.screenshot_dir = temp_dir.path().to_path_buf();
        
        let mut interceptor = TerminalInterceptor::new(config).await.unwrap();
        
        // Add an old monitor
        let old_time = std::time::SystemTime::now() - Duration::from_secs(400);
        interceptor.process_monitors.insert(
            "old_process".to_string(),
            ProcessMonitor {
                name: "old_process".to_string(),
                pid: Some(12345),
                last_seen: old_time,
            },
        );
        
        // Add a recent monitor
        interceptor.process_monitors.insert(
            "recent_process".to_string(),
            ProcessMonitor {
                name: "recent_process".to_string(),
                pid: Some(67890),
                last_seen: std::time::SystemTime::now(),
            },
        );
        
        assert_eq!(interceptor.process_monitors.len(), 2);
        
        interceptor.cleanup_old_monitors().await.unwrap();
        
        assert_eq!(interceptor.process_monitors.len(), 1);
        assert!(interceptor.process_monitors.contains_key("recent_process"));
        assert!(!interceptor.process_monitors.contains_key("old_process"));
    }
}