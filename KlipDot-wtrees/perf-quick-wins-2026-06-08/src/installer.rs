use crate::error::Result;
use std::path::{Path, PathBuf};
use tracing::{debug, info, warn};

pub struct ShellInstaller {
    shell_type: String,
    home_dir: PathBuf,
    shell_rc_path: PathBuf,
    hooks_dir: PathBuf,
}

impl ShellInstaller {
    pub fn new(shell_type: &str) -> Self {
        let home_dir = dirs::home_dir().unwrap_or_else(|| "/tmp".into());
        let shell_rc_path = Self::get_shell_rc_path(&home_dir, shell_type);
        let hooks_dir = crate::get_home_dir().unwrap_or_else(|_| home_dir.clone().join(".klipdot")).join(crate::HOOKS_DIR);
        
        Self {
            shell_type: shell_type.to_string(),
            home_dir,
            shell_rc_path,
            hooks_dir,
        }
    }
    
    pub fn detect_shell() -> Self {
        let shell = std::env::var("SHELL")
            .unwrap_or_else(|_| "/bin/bash".to_string())
            .split('/')
            .next_back()
            .unwrap_or("bash")
            .to_string();
        
        Self::new(&shell)
    }
    
    pub async fn install(&self) -> Result<()> {
        info!("Installing shell hooks for {}", self.shell_type);
        
        // Create hooks directory
        tokio::fs::create_dir_all(&self.hooks_dir).await?;
        
        // Install shell-specific hooks
        match self.shell_type.as_str() {
            "zsh" => self.install_zsh_hooks().await?,
            "bash" => self.install_bash_hooks().await?,
            _ => {
                warn!("Unsupported shell type: {}, trying bash hooks", self.shell_type);
                self.install_bash_hooks().await?;
            }
        }
        
        // Add source line to shell RC file
        self.add_source_line().await?;
        
        info!("Shell hooks installed successfully");
        Ok(())
    }
    
    pub async fn uninstall(&self) -> Result<()> {
        info!("Uninstalling shell hooks for {}", self.shell_type);
        
        // Remove source line from shell RC file
        self.remove_source_line().await?;
        
        // Remove hooks directory
        if self.hooks_dir.exists() {
            tokio::fs::remove_dir_all(&self.hooks_dir).await?;
        }
        
        info!("Shell hooks uninstalled successfully");
        Ok(())
    }
    
    async fn install_zsh_hooks(&self) -> Result<()> {
        let hook_content = self.generate_zsh_hook_content();
        let hook_path = self.hooks_dir.join("zsh-hooks.zsh");
        
        tokio::fs::write(&hook_path, hook_content).await?;
        debug!("Created ZSH hook file: {:?}", hook_path);
        
        Ok(())
    }
    
    async fn install_bash_hooks(&self) -> Result<()> {
        let hook_content = self.generate_bash_hook_content();
        let hook_path = self.hooks_dir.join("bash-hooks.bash");
        
        tokio::fs::write(&hook_path, hook_content).await?;
        debug!("Created Bash hook file: {:?}", hook_path);
        
        Ok(())
    }
    
    fn generate_zsh_hook_content(&self) -> String {
        let klipdot_dir = crate::get_home_dir().unwrap_or_else(|_| self.home_dir.clone().join(".klipdot"));
        let klipdot_bin = Self::get_klipdot_binary_path();
        
        format!(r#"# KlipDot ZSH Integration
KLIPDOT_DIR="{}"
KLIPDOT_BIN="{}"

# Function to handle image files
klipdot_handle_image() {{
    local file_path="$1"
    if [[ -f "$file_path" ]]; then
        local mime_type=$(file --mime-type -b "$file_path" 2>/dev/null)
        if [[ "$mime_type" =~ ^image/ ]]; then
            "$KLIPDOT_BIN" --quiet process-file "$file_path" 2>/dev/null &
            return $?
        fi
    fi
    return 1
}}

# Hook into command execution
preexec_klipdot() {{
    local cmd="$1"
    
    # Check for image-related commands
    if [[ "$cmd" =~ (cp|mv|scp|rsync).*\.(png|jpg|jpeg|gif|bmp|webp|svg) ]]; then
        echo "[KlipDot] Image operation detected"
    fi
    
    # Check for file arguments that might be images
    local args=("${{(@s/ /)cmd}}")
    for arg in "${{args[@]}}"; do
        if [[ -f "$arg" ]]; then
            klipdot_handle_image "$arg"
        fi
    done
}}

# Hook into command completion
precmd_klipdot() {{
    # Check for new files in current directory
    for file in *.{{png,jpg,jpeg,gif,bmp,webp,svg}}(N); do
        if [[ -f "$file" ]]; then
            klipdot_handle_image "$file"
        fi
    done
}}

# Add hooks to ZSH
if [[ -n "$ZSH_VERSION" ]]; then
    autoload -Uz add-zsh-hook
    add-zsh-hook preexec preexec_klipdot
    add-zsh-hook precmd precmd_klipdot
fi

# Enhanced aliases
alias cp='klipdot_cp'
alias mv='klipdot_mv'
alias scp='klipdot_scp'

klipdot_cp() {{
    local result
    command cp "$@"
    result=$?
    
    for arg in "$@"; do
        if [[ -f "$arg" ]]; then
            klipdot_handle_image "$arg"
        fi
    done
    
    return $result
}}

klipdot_mv() {{
    local result
    command mv "$@"
    result=$?
    
    for arg in "$@"; do
        if [[ -f "$arg" ]]; then
            klipdot_handle_image "$arg"
        fi
    done
    
    return $result
}}

klipdot_scp() {{
    local result
    command scp "$@"
    result=$?
    
    for arg in "$@"; do
        if [[ -f "$arg" ]]; then
            klipdot_handle_image "$arg"
        fi
    done
    
    return $result
}}
"#, klipdot_dir.display(), klipdot_bin)
    }
    
    fn generate_bash_hook_content(&self) -> String {
        let klipdot_dir = crate::get_home_dir().unwrap_or_else(|_| self.home_dir.clone().join(".klipdot"));
        let klipdot_bin = Self::get_klipdot_binary_path();
        
        format!(r#"# KlipDot Bash Integration
KLIPDOT_DIR="{}"
KLIPDOT_BIN="{}"

# Function to handle image files
klipdot_handle_image() {{
    local file_path="$1"
    if [[ -f "$file_path" ]]; then
        local mime_type=$(file --mime-type -b "$file_path" 2>/dev/null)
        if [[ "$mime_type" =~ ^image/ ]]; then
            "$KLIPDOT_BIN" --quiet process-file "$file_path" 2>/dev/null &
            return $?
        fi
    fi
    return 1
}}

# Hook into command execution
klipdot_preexec() {{
    local cmd="$BASH_COMMAND"
    
    # Check for image-related commands
    if [[ "$cmd" =~ (cp|mv|scp|rsync).*\.(png|jpg|jpeg|gif|bmp|webp|svg) ]]; then
        echo "[KlipDot] Image operation detected"
    fi
    
    # Check for file arguments that might be images
    for arg in $cmd; do
        if [[ -f "$arg" ]]; then
            klipdot_handle_image "$arg"
        fi
    done
}}

# Hook into prompt
klipdot_precmd() {{
    # Check for new files in current directory
    for file in *.{{png,jpg,jpeg,gif,bmp,webp,svg}}; do
        if [[ -f "$file" ]] 2>/dev/null; then
            klipdot_handle_image "$file"
        fi
    done 2>/dev/null
}}

# Set up command hooks
trap 'klipdot_preexec' DEBUG
if [[ -z "$PROMPT_COMMAND" ]]; then
    PROMPT_COMMAND="klipdot_precmd"
else
    PROMPT_COMMAND="klipdot_precmd;$PROMPT_COMMAND"
fi

# Enhanced aliases
alias cp='klipdot_cp'
alias mv='klipdot_mv'
alias scp='klipdot_scp'

klipdot_cp() {{
    local result
    command cp "$@"
    result=$?
    
    for arg in "$@"; do
        if [[ -f "$arg" ]]; then
            klipdot_handle_image "$arg"
        fi
    done
    
    return $result
}}

klipdot_mv() {{
    local result
    command mv "$@"
    result=$?
    
    for arg in "$@"; do
        if [[ -f "$arg" ]]; then
            klipdot_handle_image "$arg"
        fi
    done
    
    return $result
}}

klipdot_scp() {{
    local result
    command scp "$@"
    result=$?
    
    for arg in "$@"; do
        if [[ -f "$arg" ]]; then
            klipdot_handle_image "$arg"
        fi
    done
    
    return $result
}}
"#, klipdot_dir.display(), klipdot_bin)
    }
    
    async fn add_source_line(&self) -> Result<()> {
        let hook_file = match self.shell_type.as_str() {
            "zsh" => self.hooks_dir.join("zsh-hooks.zsh"),
            "bash" => self.hooks_dir.join("bash-hooks.bash"),
            _ => self.hooks_dir.join("bash-hooks.bash"),
        };
        
        let source_line = format!("source \"{}\"", hook_file.display());
        
        // Check if RC file exists
        if !self.shell_rc_path.exists() {
            tokio::fs::write(&self.shell_rc_path, "").await?;
        }
        
        // Read current content
        let content = tokio::fs::read_to_string(&self.shell_rc_path).await?;
        
        // Check if source line already exists
        if content.contains(&source_line) {
            debug!("Source line already exists in {:?}", self.shell_rc_path);
            return Ok(());
        }
        
        // Add source line
        let new_content = format!("{}\n# KlipDot Terminal Interceptor\n{}\n", content, source_line);
        tokio::fs::write(&self.shell_rc_path, new_content).await?;
        
        info!("Added source line to {:?}", self.shell_rc_path);
        Ok(())
    }
    
    async fn remove_source_line(&self) -> Result<()> {
        if !self.shell_rc_path.exists() {
            return Ok(());
        }
        
        let content = tokio::fs::read_to_string(&self.shell_rc_path).await?;
        
        // Remove KlipDot related lines
        let lines: Vec<&str> = content.lines().collect();
        let mut new_lines = Vec::new();
        let mut skip_next = false;
        
        for line in lines {
            if line.contains("# KlipDot Terminal Interceptor") {
                skip_next = true;
                continue;
            }
            
            if skip_next && line.contains("klipdot") {
                skip_next = false;
                continue;
            }
            
            skip_next = false;
            new_lines.push(line);
        }
        
        let new_content = new_lines.join("\n");
        tokio::fs::write(&self.shell_rc_path, new_content).await?;
        
        info!("Removed source line from {:?}", self.shell_rc_path);
        Ok(())
    }
    
    fn get_shell_rc_path(home_dir: &Path, shell_type: &str) -> PathBuf {
        match shell_type {
            "zsh" => home_dir.join(".zshrc"),
            "bash" => home_dir.join(".bashrc"),
            _ => home_dir.join(".bashrc"),
        }
    }
    
    fn get_klipdot_binary_path() -> String {
        // Try to find klipdot in PATH
        if let Ok(output) = std::process::Command::new("which")
            .arg("klipdot")
            .output()
        {
            if output.status.success() {
                if let Ok(path) = String::from_utf8(output.stdout) {
                    return path.trim().to_string();
                }
            }
        }
        
        // Try common installation paths
        let common_paths = [
            "/usr/local/bin/klipdot",
            "/usr/bin/klipdot",
            "/opt/klipdot/bin/klipdot",
        ];
        
        for path in &common_paths {
            if std::path::Path::new(path).exists() {
                return path.to_string();
            }
        }
        
        // Try to get current executable path
        if let Ok(current_exe) = std::env::current_exe() {
            return current_exe.to_string_lossy().to_string();
        }
        
        // Default fallback
        "klipdot".to_string()
    }
    
    pub async fn create_desktop_entry(&self) -> Result<()> {
        let applications_dir = self.home_dir.join(".local/share/applications");
        tokio::fs::create_dir_all(&applications_dir).await?;
        
        let desktop_file = applications_dir.join("klipdot.desktop");
        let klipdot_bin = Self::get_klipdot_binary_path();
        
        let desktop_content = format!(r#"[Desktop Entry]
Name=KlipDot
Comment=Universal terminal image interceptor
Exec={} start --daemon
Icon=image-x-generic
Type=Application
Categories=Utility;System;
StartupNotify=false
NoDisplay=true
"#, klipdot_bin);
        
        tokio::fs::write(&desktop_file, desktop_content).await?;
        info!("Created desktop entry: {:?}", desktop_file);
        
        Ok(())
    }
    
    pub async fn create_systemd_service(&self) -> Result<()> {
        let systemd_dir = self.home_dir.join(".config/systemd/user");
        tokio::fs::create_dir_all(&systemd_dir).await?;
        
        let service_file = systemd_dir.join("klipdot.service");
        let klipdot_bin = Self::get_klipdot_binary_path();
        
        let service_content = format!(r#"[Unit]
Description=KlipDot Universal Terminal Image Interceptor
After=graphical-session.target

[Service]
Type=simple
ExecStart={} start --daemon
Restart=always
RestartSec=5
Environment=DISPLAY=:0

[Install]
WantedBy=default.target
"#, klipdot_bin);
        
        tokio::fs::write(&service_file, service_content).await?;
        info!("Created systemd service: {:?}", service_file);
        
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;
    
    #[tokio::test]
    async fn test_shell_installer_creation() {
        let installer = ShellInstaller::new("bash");
        assert_eq!(installer.shell_type, "bash");
        assert!(installer.shell_rc_path.to_string_lossy().contains(".bashrc"));
        
        let installer = ShellInstaller::new("zsh");
        assert_eq!(installer.shell_type, "zsh");
        assert!(installer.shell_rc_path.to_string_lossy().contains(".zshrc"));
    }
    
    #[test]
    fn test_shell_detection() {
        let installer = ShellInstaller::detect_shell();
        assert!(!installer.shell_type.is_empty());
    }
    
    #[test]
    fn test_hook_content_generation() {
        let temp_dir = TempDir::new().unwrap();
        let installer = ShellInstaller {
            shell_type: "bash".to_string(),
            home_dir: temp_dir.path().to_path_buf(),
            shell_rc_path: temp_dir.path().join(".bashrc"),
            hooks_dir: temp_dir.path().join("hooks"),
        };
        
        let bash_content = installer.generate_bash_hook_content();
        assert!(bash_content.contains("KlipDot Bash Integration"));
        assert!(bash_content.contains("klipdot_handle_image"));
        assert!(bash_content.contains("preexec"));
        
        let zsh_content = installer.generate_zsh_hook_content();
        assert!(zsh_content.contains("KlipDot ZSH Integration"));
        assert!(zsh_content.contains("klipdot_handle_image"));
        assert!(zsh_content.contains("add-zsh-hook"));
    }
    
    #[tokio::test]
    async fn test_source_line_operations() {
        let temp_dir = TempDir::new().unwrap();
        let installer = ShellInstaller {
            shell_type: "bash".to_string(),
            home_dir: temp_dir.path().to_path_buf(),
            shell_rc_path: temp_dir.path().join(".bashrc"),
            hooks_dir: temp_dir.path().join("hooks"),
        };
        
        // Create hooks directory and file
        tokio::fs::create_dir_all(&installer.hooks_dir).await.unwrap();
        let hook_file = installer.hooks_dir.join("bash-hooks.bash");
        tokio::fs::write(&hook_file, "# test hook").await.unwrap();
        
        // Test adding source line
        installer.add_source_line().await.unwrap();
        
        let content = tokio::fs::read_to_string(&installer.shell_rc_path).await.unwrap();
        assert!(content.contains("KlipDot Terminal Interceptor"));
        assert!(content.contains("source"));
        
        // Test removing source line
        installer.remove_source_line().await.unwrap();
        
        let content = tokio::fs::read_to_string(&installer.shell_rc_path).await.unwrap();
        assert!(!content.contains("KlipDot Terminal Interceptor"));
    }
    
    #[test]
    fn test_binary_path_detection() {
        let binary_path = ShellInstaller::get_klipdot_binary_path();
        assert!(!binary_path.is_empty());
        assert!(binary_path.contains("klipdot"));
    }
}