use crate::{config::Config, error::Result, Error};
use std::path::PathBuf;
use std::process::Stdio;
use std::time::{Duration, SystemTime};
use tokio::process::Command;
use tokio::time::sleep;
use tracing::{info, warn};

pub struct ServiceManager {
    pid_file: PathBuf,
    log_file: PathBuf,
}

#[derive(Debug)]
pub struct ServiceStatus {
    pub running: bool,
    pub pid: Option<u32>,
    pub uptime: Option<Duration>,
    pub memory_usage: Option<u64>,
    pub cpu_usage: Option<f64>,
}

impl Default for ServiceManager {
    fn default() -> Self {
        Self::new()
    }
}

impl ServiceManager {
    pub fn new() -> Self {
        let home_dir = crate::get_home_dir().unwrap_or_else(|_| {
            std::env::temp_dir().join(".klipdot")
        });
        
        Self {
            pid_file: home_dir.join(crate::PID_FILE),
            log_file: home_dir.join(crate::LOG_FILE),
        }
    }
    
    pub async fn start_daemon(config: Config) -> Result<()> {
        let service_manager = Self::new();
        
        // Check if already running
        if service_manager.is_running().await? {
            return Err(Error::AlreadyExists("Service is already running".to_string()));
        }
        
        info!("Starting KlipDot daemon");
        
        // Get current executable path
        let current_exe = std::env::current_exe()
            .map_err(|e| Error::Service(format!("Failed to get current executable: {}", e)))?;
        
        // Start daemon process
        let mut command = Command::new(&current_exe);
        command
            .arg("start")
            .arg("--config")
            .arg(&config.config_file)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .stdin(Stdio::null());
        
        // Set environment variables
        command.env("RUST_LOG", config.log_level.clone());
        
        let child = command
            .spawn()
            .map_err(|e| Error::Service(format!("Failed to start daemon: {}", e)))?;
        
        let pid = child.id().ok_or_else(|| {
            Error::Service("Failed to get daemon PID".to_string())
        })?;
        
        // Write PID file
        service_manager.write_pid_file(pid).await?;
        
        // Wait a moment to ensure the daemon started successfully
        sleep(Duration::from_millis(1000)).await;
        
        if !service_manager.is_running().await? {
            return Err(Error::Service("Daemon failed to start".to_string()));
        }
        
        info!("KlipDot daemon started with PID: {}", pid);
        Ok(())
    }
    
    pub async fn stop() -> Result<()> {
        let service_manager = Self::new();
        
        if !service_manager.is_running().await? {
            return Err(Error::NotFound("Service is not running".to_string()));
        }
        
        let pid = service_manager.read_pid_file().await?;
        
        info!("Stopping KlipDot daemon (PID: {})", pid);
        
        // Send SIGTERM to the process
        #[cfg(unix)]
        {
            use libc::{kill, SIGTERM};
            unsafe {
                if kill(pid as i32, SIGTERM) != 0 {
                    return Err(Error::Service("Failed to send SIGTERM".to_string()));
                }
            }
        }
        
        #[cfg(windows)]
        {
            let mut command = Command::new("taskkill");
            command.arg("/PID").arg(&pid.to_string()).arg("/F");
            let status = command.status().await
                .map_err(|e| Error::Service(format!("Failed to kill process: {}", e)))?;
            
            if !status.success() {
                return Err(Error::Service("Failed to stop daemon".to_string()));
            }
        }
        
        // Wait for process to stop
        for _ in 0..30 {
            if !service_manager.is_running().await? {
                break;
            }
            sleep(Duration::from_millis(100)).await;
        }
        
        // Remove PID file
        service_manager.remove_pid_file().await?;
        
        info!("KlipDot daemon stopped");
        Ok(())
    }
    
    pub async fn restart() -> Result<()> {
        info!("Restarting KlipDot daemon");
        
        // Try to stop if running
        if let Err(e) = Self::stop().await {
            warn!("Failed to stop daemon during restart: {}", e);
        }
        
        // Wait a moment
        sleep(Duration::from_millis(1000)).await;
        
        // Load config and start
        let config = Config::load_or_create_default()?;
        Self::start_daemon(config).await
    }
    
    pub async fn status(&self) -> Result<ServiceStatus> {
        let running = self.is_running().await?;
        
        if !running {
            return Ok(ServiceStatus {
                running: false,
                pid: None,
                uptime: None,
                memory_usage: None,
                cpu_usage: None,
            });
        }
        
        let pid = self.read_pid_file().await?;
        let uptime = self.get_process_uptime(pid).await?;
        let memory_usage = self.get_process_memory_usage(pid).await?;
        let cpu_usage = self.get_process_cpu_usage(pid).await?;
        
        Ok(ServiceStatus {
            running: true,
            pid: Some(pid),
            uptime,
            memory_usage,
            cpu_usage,
        })
    }
    
    async fn is_running(&self) -> Result<bool> {
        if !self.pid_file.exists() {
            return Ok(false);
        }
        
        let pid = self.read_pid_file().await?;
        self.is_process_running(pid).await
    }
    
    async fn read_pid_file(&self) -> Result<u32> {
        let content = tokio::fs::read_to_string(&self.pid_file).await?;
        let pid = content.trim().parse::<u32>()
            .map_err(|e| Error::Service(format!("Invalid PID file: {}", e)))?;
        Ok(pid)
    }
    
    async fn write_pid_file(&self, pid: u32) -> Result<()> {
        // Ensure parent directory exists
        if let Some(parent) = self.pid_file.parent() {
            tokio::fs::create_dir_all(parent).await?;
        }
        
        tokio::fs::write(&self.pid_file, pid.to_string()).await?;
        Ok(())
    }
    
    async fn remove_pid_file(&self) -> Result<()> {
        if self.pid_file.exists() {
            tokio::fs::remove_file(&self.pid_file).await?;
        }
        Ok(())
    }
    
    async fn is_process_running(&self, pid: u32) -> Result<bool> {
        #[cfg(unix)]
        {
            use libc::{kill, ESRCH};
            unsafe {
                // Send signal 0 to check if process exists
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
                        Err(Error::Service(format!("Failed to check process: {}", errno)))
                    }
                }
            }
        }
        
        #[cfg(windows)]
        {
            let mut command = Command::new("tasklist");
            command.arg("/FI").arg(&format!("PID eq {}", pid));
            
            let output = command.output().await
                .map_err(|e| Error::Service(format!("Failed to check process: {}", e)))?;
            
            let output_str = String::from_utf8_lossy(&output.stdout);
            Ok(output_str.contains(&pid.to_string()))
        }
    }
    
    async fn get_process_uptime(&self, pid: u32) -> Result<Option<Duration>> {
        #[cfg(unix)]
        {
            let stat_path = format!("/proc/{}/stat", pid);
            if let Ok(content) = tokio::fs::read_to_string(&stat_path).await {
                let fields: Vec<&str> = content.split_whitespace().collect();
                if fields.len() > 21 {
                    if let Ok(starttime) = fields[21].parse::<u64>() {
                        let boot_time = self.get_boot_time().await?;
                        let clock_ticks = self.get_clock_ticks()?;
                        
                        let start_time_secs = boot_time + (starttime / clock_ticks);
                        let current_time = SystemTime::now()
                            .duration_since(SystemTime::UNIX_EPOCH)
                            .unwrap()
                            .as_secs();
                        
                        if current_time > start_time_secs {
                            return Ok(Some(Duration::from_secs(current_time - start_time_secs)));
                        }
                    }
                }
            }
        }
        
        Ok(None)
    }
    
    async fn get_process_memory_usage(&self, pid: u32) -> Result<Option<u64>> {
        #[cfg(unix)]
        {
            let status_path = format!("/proc/{}/status", pid);
            if let Ok(content) = tokio::fs::read_to_string(&status_path).await {
                for line in content.lines() {
                    if line.starts_with("VmRSS:") {
                        let parts: Vec<&str> = line.split_whitespace().collect();
                        if parts.len() >= 2 {
                            if let Ok(rss_kb) = parts[1].parse::<u64>() {
                                return Ok(Some(rss_kb * 1024)); // Convert to bytes
                            }
                        }
                    }
                }
            }
        }
        
        Ok(None)
    }
    
    async fn get_process_cpu_usage(&self, _pid: u32) -> Result<Option<f64>> {
        // CPU usage calculation is complex and platform-specific
        // For now, return None - this could be implemented later
        Ok(None)
    }
    
    #[cfg(unix)]
    async fn get_boot_time(&self) -> Result<u64> {
        let content = tokio::fs::read_to_string("/proc/stat").await?;
        for line in content.lines() {
            if line.starts_with("btime ") {
                let parts: Vec<&str> = line.split_whitespace().collect();
                if parts.len() >= 2 {
                    return parts[1].parse::<u64>()
                        .map_err(|e| Error::Service(format!("Invalid boot time: {}", e)));
                }
            }
        }
        Err(Error::Service("Failed to get boot time".to_string()))
    }
    
    #[cfg(unix)]
    fn get_clock_ticks(&self) -> Result<u64> {
        unsafe {
            let ticks = libc::sysconf(libc::_SC_CLK_TCK);
            if ticks > 0 {
                Ok(ticks as u64)
            } else {
                Err(Error::Service("Failed to get clock ticks".to_string()))
            }
        }
    }
    
    pub async fn get_log_content(&self, lines: usize) -> Result<String> {
        if !self.log_file.exists() {
            return Ok("No log file found".to_string());
        }
        
        let content = tokio::fs::read_to_string(&self.log_file).await?;
        let lines_vec: Vec<&str> = content.lines().collect();
        
        let start_index = if lines_vec.len() > lines {
            lines_vec.len() - lines
        } else {
            0
        };
        
        Ok(lines_vec[start_index..].join("\n"))
    }
    
    pub async fn rotate_logs(&self) -> Result<()> {
        if !self.log_file.exists() {
            return Ok(());
        }
        
        let backup_file = self.log_file.with_extension("log.old");
        
        // Move current log to backup
        if backup_file.exists() {
            tokio::fs::remove_file(&backup_file).await?;
        }
        
        tokio::fs::rename(&self.log_file, &backup_file).await?;
        
        info!("Log file rotated");
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;
    
    #[tokio::test]
    async fn test_service_manager_creation() {
        let service_manager = ServiceManager::new();
        assert!(service_manager.pid_file.to_string_lossy().contains("klipdot.pid"));
        assert!(service_manager.log_file.to_string_lossy().contains("klipdot.log"));
    }
    
    #[tokio::test]
    async fn test_pid_file_operations() {
        let temp_dir = TempDir::new().unwrap();
        let service_manager = ServiceManager {
            pid_file: temp_dir.path().join("test.pid"),
            log_file: temp_dir.path().join("test.log"),
        };
        
        // Test writing PID file
        let pid = 12345;
        assert!(service_manager.write_pid_file(pid).await.is_ok());
        assert!(service_manager.pid_file.exists());
        
        // Test reading PID file
        let read_pid = service_manager.read_pid_file().await.unwrap();
        assert_eq!(read_pid, pid);
        
        // Test removing PID file
        assert!(service_manager.remove_pid_file().await.is_ok());
        assert!(!service_manager.pid_file.exists());
    }
    
    #[tokio::test]
    async fn test_service_status_not_running() {
        let temp_dir = TempDir::new().unwrap();
        let service_manager = ServiceManager {
            pid_file: temp_dir.path().join("test.pid"),
            log_file: temp_dir.path().join("test.log"),
        };
        
        let status = service_manager.status().await.unwrap();
        assert!(!status.running);
        assert!(status.pid.is_none());
    }
    
    #[tokio::test]
    async fn test_log_operations() {
        let temp_dir = TempDir::new().unwrap();
        let service_manager = ServiceManager {
            pid_file: temp_dir.path().join("test.pid"),
            log_file: temp_dir.path().join("test.log"),
        };
        
        // Test getting log content when file doesn't exist
        let content = service_manager.get_log_content(10).await.unwrap();
        assert_eq!(content, "No log file found");
        
        // Create a test log file
        let log_content = "Line 1\nLine 2\nLine 3\nLine 4\nLine 5";
        tokio::fs::write(&service_manager.log_file, log_content).await.unwrap();
        
        // Test getting limited log content
        let content = service_manager.get_log_content(3).await.unwrap();
        assert_eq!(content, "Line 3\nLine 4\nLine 5");
        
        // Test log rotation
        assert!(service_manager.rotate_logs().await.is_ok());
        assert!(!service_manager.log_file.exists());
        
        let backup_file = service_manager.log_file.with_extension("log.old");
        assert!(backup_file.exists());
    }
}