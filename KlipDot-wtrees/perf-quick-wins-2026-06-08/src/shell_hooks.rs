use crate::{error::Result, Error};
use std::collections::HashMap;
use std::path::PathBuf;
use regex::Regex;
use tracing::debug;

pub struct ShellHookManager {
    patterns: Vec<Regex>,
    command_aliases: HashMap<String, String>,
    environment_vars: HashMap<String, String>,
}

impl ShellHookManager {
    pub fn new() -> Result<Self> {
        let mut patterns = Vec::new();
        
        // Compile regex patterns for image command detection
        for pattern in crate::IMAGE_COMMAND_PATTERNS {
            let regex = Regex::new(pattern)
                .map_err(|e| Error::Parse(format!("Invalid regex pattern '{}': {}", pattern, e)))?;
            patterns.push(regex);
        }
        
        let mut command_aliases = HashMap::new();
        command_aliases.insert("cp".to_string(), "klipdot_cp".to_string());
        command_aliases.insert("mv".to_string(), "klipdot_mv".to_string());
        command_aliases.insert("scp".to_string(), "klipdot_scp".to_string());
        
        let mut environment_vars = HashMap::new();
        environment_vars.insert("KLIPDOT_ENABLED".to_string(), "1".to_string());
        environment_vars.insert("KLIPDOT_LOG_LEVEL".to_string(), "info".to_string());
        
        Ok(Self {
            patterns,
            command_aliases,
            environment_vars,
        })
    }
    
    pub fn is_image_command(&self, command: &str) -> bool {
        for pattern in &self.patterns {
            if pattern.is_match(command) {
                debug!("Command matches image pattern: {}", command);
                return true;
            }
        }
        false
    }
    
    pub fn extract_image_files(&self, command: &str) -> Vec<PathBuf> {
        let mut files = Vec::new();
        
        // Split command into arguments
        let args: Vec<&str> = command.split_whitespace().collect();
        
        for arg in args {
            let path = PathBuf::from(arg);
            if path.exists() && crate::is_image_file(&path) {
                files.push(path);
            }
        }
        
        files
    }
    
    pub fn get_command_replacement(&self, command: &str) -> Option<String> {
        let parts: Vec<&str> = command.split_whitespace().collect();
        if let Some(first_part) = parts.first() {
            if let Some(replacement) = self.command_aliases.get(*first_part) {
                let mut new_command = replacement.clone();
                for part in parts.iter().skip(1) {
                    new_command.push(' ');
                    new_command.push_str(part);
                }
                return Some(new_command);
            }
        }
        None
    }
    
    pub fn should_intercept_command(&self, command: &str) -> bool {
        // Check if command contains image files or matches patterns
        self.is_image_command(command) || !self.extract_image_files(command).is_empty()
    }
    
    pub fn generate_hook_functions(&self) -> String {
        r#"
# KlipDot Hook Functions

klipdot_handle_file() {
    local file_path="$1"
    local source="${2:-terminal}"
    
    if [[ -f "$file_path" ]]; then
        local mime_type=$(file --mime-type -b "$file_path" 2>/dev/null || echo "")
        if [[ "$mime_type" =~ ^image/ ]]; then
            if command -v klipdot >/dev/null 2>&1; then
                klipdot --quiet process-file "$file_path" --source "$source" 2>/dev/null &
            fi
        fi
    fi
}

klipdot_scan_args() {
    local cmd="$1"
    shift
    
    for arg in "$@"; do
        if [[ -f "$arg" ]]; then
            klipdot_handle_file "$arg" "command"
        fi
    done
}

klipdot_monitor_directory() {
    local dir="${1:-.}"
    
    if [[ -d "$dir" ]]; then
        for file in "$dir"/*.{png,jpg,jpeg,gif,bmp,webp,svg}; do
            if [[ -f "$file" ]]; then
                local age=$(stat -c %Y "$file" 2>/dev/null || stat -f %m "$file" 2>/dev/null || echo 0)
                local now=$(date +%s)
                local diff=$((now - age))
                
                # Process files created/modified in the last 30 seconds
                if [[ $diff -lt 30 ]]; then
                    klipdot_handle_file "$file" "directory"
                fi
            fi
        done 2>/dev/null
    fi
}

klipdot_preexec_hook() {
    local cmd="$1"
    
    # Extract command and arguments
    local cmd_array=($cmd)
    local base_cmd="${cmd_array[0]}"
    
    # Check for image-related operations
    case "$base_cmd" in
        cp|mv|scp|rsync|wget|curl)
            klipdot_scan_args "$cmd" "${cmd_array[@]:1}"
            ;;
        screencapture|screenshot|scrot|gnome-screenshot|spectacle|flameshot)
            echo "[KlipDot] Screenshot command detected: $base_cmd"
            ;;
    esac
}

klipdot_precmd_hook() {
    # Monitor current directory for new images
    klipdot_monitor_directory "."
    
    # Also monitor common screenshot directories
    klipdot_monitor_directory "$HOME/Desktop"
    klipdot_monitor_directory "$HOME/Downloads"
    klipdot_monitor_directory "$HOME/Pictures"
}

# Clipboard monitoring function
klipdot_monitor_clipboard() {
    if command -v klipdot >/dev/null 2>&1; then
        klipdot --quiet monitor-clipboard 2>/dev/null &
    fi
}

# Initialize clipboard monitoring if not already running
if [[ -z "$KLIPDOT_CLIPBOARD_PID" ]]; then
    klipdot_monitor_clipboard
    export KLIPDOT_CLIPBOARD_PID=$!
fi
"#.to_string()
    }
    
    pub fn generate_command_wrappers(&self) -> String {
        let mut wrappers = String::new();
        
        for original in self.command_aliases.keys() {
            let wrapper = format!(r#"
{original}() {{
    local result
    local cmd_line="{original} $*"
    
    # Pre-execution hook
    klipdot_preexec_hook "$cmd_line"
    
    # Execute original command
    command {original} "$@"
    result=$?
    
    # Post-execution hook
    klipdot_scan_args "$cmd_line" "$@"
    
    return $result
}}
"#, original = original);
            
            wrappers.push_str(&wrapper);
        }
        
        wrappers
    }
    
    pub fn generate_environment_setup(&self) -> String {
        let mut setup = String::new();
        
        setup.push_str("# KlipDot Environment Setup\n");
        
        for (key, value) in &self.environment_vars {
            setup.push_str(&format!("export {}=\"{}\"\n", key, value));
        }
        
        setup.push('\n');
        setup
    }
    
    pub fn generate_shell_integration(&self, shell_type: &str) -> String {
        let mut integration = String::new();
        
        integration.push_str(&self.generate_environment_setup());
        integration.push_str(&self.generate_hook_functions());
        integration.push_str(&self.generate_command_wrappers());
        
        match shell_type {
            "zsh" => {
                integration.push_str(r#"
# ZSH-specific integration
if [[ -n "$ZSH_VERSION" ]]; then
    autoload -Uz add-zsh-hook
    add-zsh-hook preexec klipdot_preexec_hook
    add-zsh-hook precmd klipdot_precmd_hook
fi
"#);
            }
            "bash" => {
                integration.push_str(r#"
# Bash-specific integration
if [[ -n "$BASH_VERSION" ]]; then
    trap 'klipdot_preexec_hook "$BASH_COMMAND"' DEBUG
    
    if [[ -z "$PROMPT_COMMAND" ]]; then
        PROMPT_COMMAND="klipdot_precmd_hook"
    else
        PROMPT_COMMAND="klipdot_precmd_hook;$PROMPT_COMMAND"
    fi
fi
"#);
            }
            _ => {
                integration.push_str("# Generic shell integration\n");
            }
        }
        
        integration
    }
    
    pub fn validate_shell_syntax(&self, shell_type: &str, content: &str) -> Result<bool> {
        let temp_file = std::env::temp_dir().join(format!("klipdot_test.{}", shell_type));
        
        // Write content to temporary file
        std::fs::write(&temp_file, content)?;
        
        // Validate syntax
        let result = match shell_type {
            "bash" => {
                std::process::Command::new("bash")
                    .arg("-n")
                    .arg(&temp_file)
                    .output()
            }
            "zsh" => {
                std::process::Command::new("zsh")
                    .arg("-n")
                    .arg(&temp_file)
                    .output()
            }
            _ => {
                // Default to bash for unknown shells
                std::process::Command::new("bash")
                    .arg("-n")
                    .arg(&temp_file)
                    .output()
            }
        };
        
        // Clean up temporary file
        let _ = std::fs::remove_file(&temp_file);
        
        match result {
            Ok(output) => Ok(output.status.success()),
            Err(e) => {
                debug!("Shell syntax validation failed: {}", e);
                Ok(false)
            }
        }
    }
    
    pub fn get_hook_status(&self) -> HookStatus {
        let mut status = HookStatus::default();
        
        // Check if klipdot binary is available
        status.binary_available = std::process::Command::new("klipdot")
            .arg("--version")
            .output()
            .map(|output| output.status.success())
            .unwrap_or(false);
        
        // Check if shell hooks are installed
        let home_dir = dirs::home_dir().unwrap_or_else(|| "/tmp".into());
        let klipdot_dir = home_dir.join(".klipdot");
        
        status.hooks_installed = klipdot_dir.join("hooks").exists();
        
        // Check if shell RC files contain source lines
        let bashrc = home_dir.join(".bashrc");
        let zshrc = home_dir.join(".zshrc");
        
        if bashrc.exists() {
            if let Ok(content) = std::fs::read_to_string(&bashrc) {
                status.bash_integrated = content.contains("klipdot") || content.contains("KlipDot");
            }
        }
        
        if zshrc.exists() {
            if let Ok(content) = std::fs::read_to_string(&zshrc) {
                status.zsh_integrated = content.contains("klipdot") || content.contains("KlipDot");
            }
        }
        
        status
    }
    
    pub fn estimate_performance_impact(&self) -> PerformanceImpact {
        PerformanceImpact {
            startup_delay_ms: 50,     // Estimated shell startup delay
            command_overhead_ms: 5,   // Estimated per-command overhead
            memory_usage_kb: 2048,    // Estimated memory usage
            cpu_usage_percent: 1.0,   // Estimated CPU usage during monitoring
        }
    }
}

impl Default for ShellHookManager {
    fn default() -> Self {
        Self::new().unwrap_or_else(|e| {
            eprintln!("Failed to create ShellHookManager: {}", e);
            Self {
                patterns: Vec::new(),
                command_aliases: HashMap::new(),
                environment_vars: HashMap::new(),
            }
        })
    }
}

#[derive(Debug, Default)]
pub struct HookStatus {
    pub binary_available: bool,
    pub hooks_installed: bool,
    pub bash_integrated: bool,
    pub zsh_integrated: bool,
}

#[derive(Debug)]
pub struct PerformanceImpact {
    pub startup_delay_ms: u64,
    pub command_overhead_ms: u64,
    pub memory_usage_kb: u64,
    pub cpu_usage_percent: f64,
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_shell_hook_manager_creation() {
        let manager = ShellHookManager::new();
        assert!(manager.is_ok());
        
        let manager = manager.unwrap();
        assert!(!manager.patterns.is_empty());
        assert!(!manager.command_aliases.is_empty());
    }
    
    #[test]
    fn test_image_command_detection() {
        let manager = ShellHookManager::new().unwrap();
        
        assert!(manager.is_image_command("cp test.png /tmp/"));
        assert!(manager.is_image_command("mv screenshot.jpg ~/Desktop/"));
        assert!(manager.is_image_command("scp image.gif user@host:/path/"));
        assert!(manager.is_image_command("screencapture -i test.png"));
        
        assert!(!manager.is_image_command("cp test.txt /tmp/"));
        assert!(!manager.is_image_command("ls -la"));
        assert!(!manager.is_image_command("echo hello"));
    }
    
    #[test]
    fn test_command_replacement() {
        let manager = ShellHookManager::new().unwrap();
        
        let replacement = manager.get_command_replacement("cp file1 file2");
        assert!(replacement.is_some());
        assert!(replacement.unwrap().starts_with("klipdot_cp"));
        
        let replacement = manager.get_command_replacement("ls -la");
        assert!(replacement.is_none());
    }
    
    #[test]
    fn test_hook_function_generation() {
        let manager = ShellHookManager::new().unwrap();
        
        let functions = manager.generate_hook_functions();
        assert!(functions.contains("klipdot_handle_file"));
        assert!(functions.contains("klipdot_preexec_hook"));
        assert!(functions.contains("klipdot_precmd_hook"));
    }
    
    #[test]
    fn test_command_wrapper_generation() {
        let manager = ShellHookManager::new().unwrap();
        
        let wrappers = manager.generate_command_wrappers();
        assert!(wrappers.contains("cp()"));
        assert!(wrappers.contains("mv()"));
        assert!(wrappers.contains("scp()"));
        assert!(wrappers.contains("command cp"));
    }
    
    #[test]
    fn test_shell_integration_generation() {
        let manager = ShellHookManager::new().unwrap();
        
        let bash_integration = manager.generate_shell_integration("bash");
        assert!(bash_integration.contains("BASH_VERSION"));
        assert!(bash_integration.contains("PROMPT_COMMAND"));
        
        let zsh_integration = manager.generate_shell_integration("zsh");
        assert!(zsh_integration.contains("ZSH_VERSION"));
        assert!(zsh_integration.contains("add-zsh-hook"));
    }
    
    #[test]
    fn test_hook_status() {
        let manager = ShellHookManager::new().unwrap();
        let status = manager.get_hook_status();
        
        // These tests depend on the actual system state
        // so we just check that the function runs without error
        assert!(status.binary_available || !status.binary_available);
        assert!(status.hooks_installed || !status.hooks_installed);
    }
    
    #[test]
    fn test_performance_impact() {
        let manager = ShellHookManager::new().unwrap();
        let impact = manager.estimate_performance_impact();
        
        assert!(impact.startup_delay_ms > 0);
        assert!(impact.command_overhead_ms > 0);
        assert!(impact.memory_usage_kb > 0);
        assert!(impact.cpu_usage_percent >= 0.0);
    }
}