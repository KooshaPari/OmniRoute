use thiserror::Error;

#[derive(Error, Debug)]
pub enum Error {
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    
    #[error("Serialization error: {0}")]
    Serialization(#[from] serde_json::Error),
    
    #[error("Image processing error: {0}")]
    Image(#[from] image::ImageError),
    
    #[error("File watcher error: {0}")]
    FileWatcher(#[from] notify::Error),
    
    #[error("Configuration error: {0}")]
    Config(String),
    
    #[error("Clipboard error: {0}")]
    Clipboard(String),
    
    #[error("Service error: {0}")]
    Service(String),
    
    #[error("Shell integration error: {0}")]
    Shell(String),
    
    #[error("Process error: {0}")]
    Process(String),
    
    #[error("Network error: {0}")]
    Network(String),
    
    #[error("Permission error: {0}")]
    Permission(String),
    
    #[error("Timeout error: {0}")]
    Timeout(String),
    
    #[error("Validation error: {0}")]
    Validation(String),
    
    #[error("Not found: {0}")]
    NotFound(String),
    
    #[error("Already exists: {0}")]
    AlreadyExists(String),
    
    #[error("Invalid input: {0}")]
    InvalidInput(String),
    
    #[error("Unsupported operation: {0}")]
    Unsupported(String),
    
    #[error("Internal error: {0}")]
    Internal(String),
    
    #[error("Parse error: {0}")]
    Parse(String),
    
    #[error("Format error: {0}")]
    Format(String),
    
    #[error("Wayland error: {0}")]
    Wayland(String),
    
    #[error("Display server error: {0}")]
    DisplayServer(String),
    
    #[error("Compositor error: {0}")]
    Compositor(String),
    
    #[error("Cancelled")]
    Cancelled,
    
    #[error("Unknown error: {0}")]
    Unknown(String),
}

pub type Result<T> = std::result::Result<T, Error>;

impl Error {
    pub fn is_recoverable(&self) -> bool {
        matches!(
            self,
            Error::Io(_)
                | Error::Clipboard(_)
                | Error::Network(_)
                | Error::Timeout(_)
                | Error::Process(_)
                | Error::Wayland(_)
                | Error::DisplayServer(_)
                | Error::Cancelled
        )
    }
    
    pub fn is_fatal(&self) -> bool {
        matches!(
            self,
            Error::Config(_)
                | Error::Permission(_)
                | Error::Unsupported(_)
                | Error::Internal(_)
                | Error::Compositor(_)
        )
    }
    
    pub fn error_code(&self) -> &'static str {
        match self {
            Error::Io(_) => "IO",
            Error::Serialization(_) => "SERIALIZATION",
            Error::Image(_) => "IMAGE",
            Error::FileWatcher(_) => "FILE_WATCHER",
            Error::Config(_) => "CONFIG",
            Error::Clipboard(_) => "CLIPBOARD",
            Error::Service(_) => "SERVICE",
            Error::Shell(_) => "SHELL",
            Error::Process(_) => "PROCESS",
            Error::Network(_) => "NETWORK",
            Error::Permission(_) => "PERMISSION",
            Error::Timeout(_) => "TIMEOUT",
            Error::Validation(_) => "VALIDATION",
            Error::NotFound(_) => "NOT_FOUND",
            Error::AlreadyExists(_) => "ALREADY_EXISTS",
            Error::InvalidInput(_) => "INVALID_INPUT",
            Error::Unsupported(_) => "UNSUPPORTED",
            Error::Internal(_) => "INTERNAL",
            Error::Parse(_) => "PARSE",
            Error::Format(_) => "FORMAT",
            Error::Wayland(_) => "WAYLAND",
            Error::DisplayServer(_) => "DISPLAY_SERVER",
            Error::Compositor(_) => "COMPOSITOR",
            Error::Cancelled => "CANCELLED",
            Error::Unknown(_) => "UNKNOWN",
        }
    }
    
    /// Create a Wayland-specific error
    pub fn wayland<T: ToString>(msg: T) -> Self {
        Error::Wayland(msg.to_string())
    }
    
    /// Create a display server error
    pub fn display_server<T: ToString>(msg: T) -> Self {
        Error::DisplayServer(msg.to_string())
    }
    
    /// Create a compositor error
    pub fn compositor<T: ToString>(msg: T) -> Self {
        Error::Compositor(msg.to_string())
    }
    
    /// Create a clipboard error with context about the display server
    pub fn clipboard_with_context<T: ToString>(msg: T, display_server: crate::DisplayServer) -> Self {
        let context = match display_server {
            crate::DisplayServer::Wayland => "Wayland",
            crate::DisplayServer::X11 => "X11",
            crate::DisplayServer::MacOS => "macOS",
            crate::DisplayServer::Unknown => "Unknown",
        };
        Error::Clipboard(format!("{} ({})", msg.to_string(), context))
    }
    
    /// Check if this error is related to Wayland
    pub fn is_wayland_related(&self) -> bool {
        matches!(self, Error::Wayland(_) | Error::DisplayServer(_) | Error::Compositor(_))
    }
}

impl From<Box<dyn std::error::Error + Send + Sync>> for Error {
    fn from(err: Box<dyn std::error::Error + Send + Sync>) -> Self {
        Error::Unknown(err.to_string())
    }
}

impl From<&str> for Error {
    fn from(err: &str) -> Self {
        Error::Unknown(err.to_string())
    }
}

impl From<String> for Error {
    fn from(err: String) -> Self {
        Error::Unknown(err)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_error_properties() {
        let io_error = Error::Io(std::io::Error::new(std::io::ErrorKind::NotFound, "file not found"));
        assert!(io_error.is_recoverable());
        assert!(!io_error.is_fatal());
        assert_eq!(io_error.error_code(), "IO");
        
        let config_error = Error::Config("invalid config".to_string());
        assert!(!config_error.is_recoverable());
        assert!(config_error.is_fatal());
        assert_eq!(config_error.error_code(), "CONFIG");
    }
    
    #[test]
    fn test_error_from_string() {
        let error = Error::from("test error");
        assert_eq!(error.error_code(), "UNKNOWN");
        assert!(error.to_string().contains("test error"));
    }
}