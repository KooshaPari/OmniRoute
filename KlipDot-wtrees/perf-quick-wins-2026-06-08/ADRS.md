# Architecture Decision Records

## ADR-001: Async Runtime Selection

**Status:** Accepted  
**Date:** 2024-01-15  
**Author:** KlipDot Architecture Team  

### Context

KlipDot requires an asynchronous runtime to handle multiple concurrent operations:
- Clipboard monitoring (polling and event-driven)
- File system watching (inotify/FSEvents)
- Process monitoring
- HTTP API server
- Terminal preview coordination
- Image processing (offloaded to blocking threads)

The Rust ecosystem offers multiple async runtime options with different trade-offs.

### Decision Drivers

1. **Performance Requirements**
   - Sub-100ms response times for API endpoints
   - Minimal overhead for clipboard polling (target <0.5% CPU at 250ms intervals)
   - Efficient handling of I/O-bound operations (clipboard, file system, network)

2. **Ecosystem Maturity**
   - Rich library ecosystem for integration
   - Stable, production-tested codebase
   - Active maintenance and community support

3. **Platform Support**
   - First-class support for macOS, Linux, Windows
   - Consistent behavior across platforms
   - Support for platform-specific async I/O (kqueue, epoll, IOCP)

4. **Developer Experience**
   - Clear documentation and learning resources
   - Good debugging and profiling tools
   - IDE support and type inference

### Options Considered

#### Option 1: Tokio

**Description:** The most widely-used Rust async runtime with comprehensive features.

**Pros:**
- Largest ecosystem: most async libraries target Tokio (axum, hyper, tonic, sqlx)
- Mature and production-tested at scale (Discord, AWS, Azure)
- Excellent performance with work-stealing scheduler
- Rich set of utilities: channels, timers, synchronization primitives
- Built-in blocking thread pool for CPU-intensive tasks
- Strong platform abstraction (epoll, kqueue, IOCP)
- Active development and large community

**Cons:**
- Larger binary size (~500KB overhead)
- Steeper learning curve for advanced features
- Some libraries incompatible with other runtimes
- Heavier than minimal alternatives for simple use cases

**Performance Characteristics:**
```
Task Spawn Latency: ~100ns
Context Switch: ~5ns
Memory Per Task: ~1KB
Thread Pool Scaling: Automatic
```

#### Option 2: async-std

**Description:** Runtime modeled after the standard library with a focus on ergonomics.

**Pros:**
- API designed to mirror std library (familiar patterns)
- Smaller runtime footprint than Tokio
- Good integration with surf, Tide web frameworks
- Smaller learning curve for std users

**Cons:**
- Smaller ecosystem than Tokio
- Fewer platform-specific optimizations
- Less active development (maintenance mode)
- Fewer integration libraries
- Performance slightly below Tokio in benchmarks

**Performance Characteristics:**
```
Task Spawn Latency: ~150ns
Context Switch: ~8ns
Memory Per Task: ~1.2KB
Thread Pool Scaling: Manual configuration
```

#### Option 3: smol

**Description:** Minimal, modular async runtime.

**Pros:**
- Very small footprint (~50KB)
- Modular design: use only what you need
- Good for embedded or resource-constrained environments
- Simple API surface

**Cons:**
- Minimal ecosystem
- Manual integration required for many features
- Not suitable for complex applications
- Limited platform support

**Performance Characteristics:**
```
Task Spawn Latency: ~80ns
Context Switch: ~3ns
Memory Per Task: ~0.5KB
Thread Pool Scaling: Manual
```

#### Option 4: Embassy (for embedded)

**Description:** Runtime designed for embedded systems with async/await.

**Pros:**
- Excellent for no_std environments
- Deterministic timing
- Very small footprint

**Cons:**
- Not designed for desktop/server applications
- Limited std library support
- Requires nightly Rust

### Decision

**Selected: Tokio**

Rationale:
1. **Ecosystem Lock-in**: Critical libraries (axum for HTTP API, notify for file watching) depend on Tokio
2. **Performance**: Best-in-class scheduler and I/O driver performance
3. **Production Readiness**: Battle-tested in production environments at scale
4. **Feature Completeness**: Built-in blocking thread pool for image processing, channels for inter-task communication
5. **Platform Support**: Excellent macOS, Linux, and Windows support
6. **Future-Proofing**: Active development and large community ensure long-term viability

### Implementation Notes

**Runtime Configuration:**

```rust
#[tokio::main]
async fn main() -> Result<()> {
    // Multi-threaded scheduler with work-stealing
    // Number of worker threads = number of CPU cores
    
    let runtime = tokio::runtime::Builder::new_multi_thread()
        .worker_threads(num_cpus::get())
        .max_blocking_threads(512)  // For image processing
        .thread_stack_size(2 * 1024 * 1024)  // 2MB stack
        .enable_all()
        .build()?;
    
    runtime.block_on(async {
        // Application logic
    })
}
```

**Blocking Operations:**

```rust
// Image processing offloaded to blocking thread pool
let processed = tokio::task::spawn_blocking(move || {
    image::load_from_memory(&data)
        .and_then(|img| img.save_with_format(path, ImageFormat::Png))
}).await??;
```

**Clipboard Monitoring:**

```rust
// Async clipboard polling with interval
let mut interval = tokio::time::interval(Duration::from_millis(250));

loop {
    interval.tick().await;
    
    if let Ok(content) = check_clipboard().await {
        handle_clipboard_change(content).await?;
    }
}
```

### Consequences

**Positive:**
- Access to rich ecosystem of async libraries
- Excellent performance for I/O-bound operations
- Built-in utilities for common patterns
- Strong platform abstraction

**Negative:**
- Binary size increase (~500KB)
- Dependency on Tokio-specific libraries
- Learning curve for advanced features

### References

- [Tokio Documentation](https://tokio.rs/)
- [Tokio vs async-std Benchmarks](https://github.com/jkelleyrtp/tokio-async-std-bench)
- [Discord's Rust Story](https://discord.com/blog/why-discord-is-switching-from-go-to-rust)

---

## ADR-002: Platform Clipboard Abstraction Strategy

**Status:** Accepted  
**Date:** 2024-01-20  
**Author:** KlipDot Architecture Team  

### Context

KlipDot must interact with platform clipboard systems across macOS, Linux (X11/Wayland), and Windows. Each platform has distinct APIs, capabilities, and behaviors for clipboard operations, particularly for image data.

### Decision Drivers

1. **Cross-Platform Consistency**: Uniform API across all supported platforms
2. **Image Data Support**: Robust handling of binary image data in clipboard
3. **Platform Idioms**: Leverage native capabilities where beneficial
4. **Maintainability**: Clean separation of platform-specific code
5. **Testing**: Ability to test without full platform environment
6. **Performance**: Minimal overhead for clipboard operations

### Platform Analysis

#### macOS

**API:** NSPasteboard via pbcopy/pbpaste CLI or direct Cocoa calls

**Capabilities:**
- Full image support (PNG, TIFF, JPEG)
- Universal Type Identifiers (UTI) system
- Multiple pasteboard types (general, drag, find)
- Binary data via `osascript` or `pngpaste`

**Challenges:**
- No direct CLI for binary data (requires AppleScript)
- Sandboxed app restrictions
- API differences between macOS versions

#### Linux X11

**API:** X11 selection system via xclip/xsel

**Capabilities:**
- Multiple selection atoms (PRIMARY, SECONDARY, CLIPBOARD)
- Raw binary data transfer
- Format negotiation via TARGETS
- Established CLI tools

**Challenges:**
- Selection ownership semantics
- No centralized clipboard manager (DE-specific)
- Requires active X11 connection

#### Linux Wayland

**API:** wl_data_device_manager via wl-clipboard

**Capabilities:**
- MIME type-based data transfer
- Pipe-based data exchange
- Growing adoption

**Challenges:**
- Limited tool ecosystem (wl-clipboard is primary)
- Compositor-specific behaviors
- Primary selection not universally supported
- Pipe-based transfer adds latency

#### Windows

**API:** Win32 clipboard API via PowerShell or direct calls

**Capabilities:**
- OLE-based clipboard
- Multiple format support
- Delayed rendering

**Challenges:**
- PowerShell dependency for CLI
- Format conversion complexity

### Options Considered

#### Option 1: External Crate (arboard)

**Description:** Use the `arboard` crate for cross-platform clipboard access.

**Implementation:**

```rust
use arboard::Clipboard;

let mut clipboard = Clipboard::new()?;
let image = clipboard.get_image()?;
clipboard.set_image(image)?;
```

**Pros:**
- Unified API across platforms
- Handles platform differences internally
- Well-maintained
- Good image support on most platforms

**Cons:**
- Additional dependency
- Less control over platform-specific behavior
- Limited Wayland support
- May not expose all native capabilities

#### Option 2: Custom Abstraction with CLI Tools

**Description:** Implement custom abstraction layer using platform CLI tools.

**Implementation:**

```rust
pub enum ClipboardBackend {
    MacOs,      // pbcopy/pbpaste/osascript
    LinuxX11,   // xclip/xsel
    LinuxWayland, // wl-copy/wl-paste
    Windows,    // PowerShell/clip
}

impl ClipboardBackend {
    async fn get_image(&self) -> Result<Vec<u8>> {
        match self {
            Self::MacOs => self.macos_get_image().await,
            Self::LinuxX11 => self.x11_get_image().await,
            Self::LinuxWayland => self.wayland_get_image().await,
            Self::Windows => self.windows_get_image().await,
        }
    }
}
```

**Pros:**
- Full control over implementation
- Can leverage platform-specific optimizations
- No additional Rust dependencies for clipboard
- Direct use of mature CLI tools
- Easy to debug (visible CLI commands)

**Cons:**
- More code to maintain
- Must handle each platform separately
- CLI tool availability issues
- Process spawn overhead

#### Option 3: Hybrid Approach

**Description:** Use arboard as default, with custom implementations for specific needs.

**Implementation:**

```rust
pub struct ClipboardManager {
    backend: Box<dyn ClipboardBackend>,
}

trait ClipboardBackend {
    async fn get_text(&self) -> Result<String>;
    async fn set_text(&self, text: &str) -> Result<()>;
    async fn get_image(&self) -> Result<Vec<u8>>;
    async fn set_image(&self, data: &[u8]) -> Result<()>;
}

// Use arboard for text, custom for images
struct HybridBackend {
    arboard: arboard::Clipboard,
    platform: PlatformBackend,
}
```

**Pros:**
- Leverages arboard for simple cases
- Custom handling for complex operations
- Fallback strategies possible

**Cons:**
- Increased complexity
- Two code paths to maintain
- Potential consistency issues

### Decision

**Selected: Option 2 - Custom Abstraction with CLI Tools**

Rationale:

1. **Image Data Requirements**: KlipDot's primary use case is image interception. Custom implementation allows optimal handling of binary image data across all platforms, especially Wayland where arboard support is limited.

2. **Transparency**: CLI-based approach makes debugging easier - commands are visible in logs and can be reproduced manually.

3. **Platform-Specific Optimization**: Each platform can use the best available tool (e.g., osascript for macOS binary data, wl-clipboard for Wayland).

4. **Control Over Behavior**: Direct control over clipboard polling, error handling, and format negotiation.

5. **Fallback Strategies**: Can implement multiple strategies per platform (e.g., try pngpaste, fallback to osascript, fallback to pbpaste text).

6. **No Runtime Dependencies**: Only build-time Rust dependencies; runtime requires standard CLI tools already present on target systems.

### Implementation

**Platform Detection:**

```rust
pub fn detect_clipboard_backend() -> ClipboardBackend {
    #[cfg(target_os = "macos")]
    {
        return ClipboardBackend::MacOs;
    }
    
    #[cfg(target_os = "linux")]
    {
        // Check for Wayland first
        if env::var("WAYLAND_DISPLAY").is_ok() {
            return ClipboardBackend::Wayland;
        }
        
        // Check XDG_SESSION_TYPE
        if let Ok(session_type) = env::var("XDG_SESSION_TYPE") {
            if session_type == "wayland" {
                return ClipboardBackend::Wayland;
            }
        }
        
        // Check for DISPLAY
        if env::var("DISPLAY").is_ok() {
            return ClipboardBackend::X11;
        }
        
        // Default to X11
        return ClipboardBackend::X11;
    }
    
    #[cfg(target_os = "windows")]
    {
        return ClipboardBackend::Windows;
    }
}
```

**macOS Implementation:**

```rust
async fn get_image(&self) -> Result<Vec<u8>> {
    // Strategy 1: Try pngpaste if available
    if self.has_command("pngpaste") {
        let output = Command::new("pngpaste")
            .arg("-")
            .output()
            .await?;
        
        if output.status.success() && !output.stdout.is_empty() {
            return Ok(output.stdout);
        }
    }
    
    // Strategy 2: Use osascript for clipboard access
    let output = Command::new("osascript")
        .arg("-e")
        .arg(r#"
            try
                set imageData to the clipboard as «class PNGf»
                return imageData
            end try
        "#)
        .output()
        .await?;
    
    if output.status.success() {
        // Parse AppleScript hex output
        let hex_str = String::from_utf8_lossy(&output.stdout);
        return hex::decode(&clean_hex(&hex_str));
    }
    
    Err(Error::Clipboard("No image data available".into()))
}
```

**Wayland Implementation:**

```rust
async fn get_image(&self) -> Result<Vec<u8>> {
    // wl-paste with explicit image type
    let output = Command::new("wl-paste")
        .arg("--type")
        .arg("image/png")
        .output()
        .await?;
    
    if output.status.success() {
        return Ok(output.stdout);
    }
    
    // Try other image formats
    for mime_type in &["image/jpeg", "image/webp", "image/gif"] {
        let output = Command::new("wl-paste")
            .arg("--type")
            .arg(mime_type)
            .output()
            .await?;
        
        if output.status.success() && !output.stdout.is_empty() {
            // Convert to PNG if needed
            return convert_to_png(&output.stdout).await;
        }
    }
    
    Err(Error::Clipboard("No image data available".into()))
}
```

### Consequences

**Positive:**
- Optimal image handling on all platforms
- Full control over behavior
- Transparent operations (debuggable)
- No additional Rust dependencies
- Can implement sophisticated fallback strategies

**Negative:**
- More code to maintain
- Must handle platform differences explicitly
- CLI tool availability required
- Process spawn overhead (mitigated by async)

### Migration Path

Future migration to arboard or similar crate possible if:
1. Wayland support in arboard improves
2. Binary size becomes critical concern
3. Feature parity achieved

Migration would be straightforward due to trait-based abstraction.

---

## ADR-003: Terminal Preview Protocol Selection

**Status:** Accepted  
**Date:** 2024-01-25  
**Author:** KlipDot Architecture Team  

### Context

KlipDot needs to display image previews in terminal environments across various terminal emulators. Multiple protocols exist with varying capabilities, terminal support, and performance characteristics.

### Decision Drivers

1. **Image Quality**: Preview should accurately represent the image
2. **Terminal Coverage**: Support maximum number of terminal emulators
3. **Performance**: Fast rendering without terminal lag
4. **Color Support**: Full color representation (ideally true color)
5. **Animation**: Optional support for animated images
6. **Implementation Complexity**: Balance capability vs maintenance burden
7. **User Experience**: Consistent behavior across terminals

### Protocol Analysis

#### iTerm2 Inline Images Protocol

**Capabilities:**
- True color support
- Inline image placement
- Variable sizing (cells, pixels, percentage)
- Aspect ratio preservation
- Base64 encoding (no external files needed)

**Terminal Support:**
| Terminal | Version | Support |
|----------|---------|---------|
| iTerm2 | 2.9+ | Native |
| Terminal.app | 2.10+ | Partial |
| WezTerm | All | Yes |
| VS Code | 1.80+ | Yes |
| Warp | All | No |
| Alacritty | All | No |

**Pros:**
- Excellent image quality
- Widely supported in modern terminals
- No external dependencies
- Easy implementation

**Cons:**
- Limited support in Linux terminals
- No animation support
- Base64 overhead (~33% size increase)

#### Kitty Graphics Protocol

**Capabilities:**
- True color support
- Animation support (frame-based)
- Shared memory transfer (performance)
- Image positioning and compositing
- Z-index layering

**Terminal Support:**
| Terminal | Version | Support |
|----------|---------|---------|
| Kitty | All | Native |
| WezTerm | All | Yes |
| Konsole | 21.04+ | Partial |
| GNOME Terminal | Never | No |
| Alacritty | Never | No |

**Pros:**
- Most feature-complete protocol
- Fastest performance (shared memory)
- Animation support
- Active development

**Cons:**
- Limited terminal support
- Complex implementation
- Shared memory requires Unix sockets

#### Sixel Graphics

**Capabilities:**
- 256 color palette (or true color with extensions)
- Standardized format
- No external dependencies
- Works over SSH

**Terminal Support:**
| Terminal | Version | Support |
|----------|---------|---------|
| iTerm2 | 3.0+ | Yes |
| mlterm | All | Yes |
| xterm | 366+ | Compile-time |
| Konsole | 20.04+ | Yes |
| WezTerm | All | Yes |
| GNOME Terminal | Never | No |
| Alacritty | Never | No |

**Pros:**
- Standardized protocol
- Good terminal support
- No external tools needed

**Cons:**
- Lower image quality (limited colors)
- Large data overhead
- Limited animation
- Slow for large images

#### ASCII Art (chafa/jp2a)

**Capabilities:**
- Universal terminal support
- Multiple character sets (ASCII, Unicode blocks, Braille)
- Color support (ANSI, 256, true color)
- Configurable resolution

**Pros:**
- Works in any terminal
- No protocol dependencies
- Fast generation
- Multiple tool options

**Cons:**
- Lowest image quality
- Character-based limitations
- No pixel-perfect representation

### Options Considered

#### Option 1: Single Protocol

**Description:** Select one protocol and require compatible terminals.

**Choices:**
- **Kitty**: Best features, limited support
- **iTerm2**: Good balance, moderate support
- **ASCII**: Universal, poor quality

**Verdict:** Rejected - too limiting for users with diverse terminal environments.

#### Option 2: Protocol Cascade

**Description:** Implement multiple protocols with automatic selection based on terminal capabilities.

**Implementation:**

```rust
pub enum PreviewMethod {
    ITerm2,
    Kitty,
    Sixel,
    ASCII,
    None,
}

fn detect_preview_method() -> PreviewMethod {
    let term_program = env::var("TERM_PROGRAM").ok();
    let term = env::var("TERM").ok();
    
    // Priority 1: iTerm2
    if term_program.as_deref() == Some("iTerm.app") {
        return PreviewMethod::ITerm2;
    }
    
    // Priority 2: Kitty
    if term.as_ref().map(|t| t.contains("kitty")).unwrap_or(false) {
        return PreviewMethod::Kitty;
    }
    
    // Priority 3: Check sixel support
    if has_sixel_support() {
        return PreviewMethod::Sixel;
    }
    
    // Priority 4: ASCII fallback
    if has_command("chafa") || has_command("jp2a") {
        return PreviewMethod::ASCII;
    }
    
    PreviewMethod::None
}
```

**Pros:**
- Maximum terminal coverage
- Best quality available for each terminal
- Graceful degradation
- User-transparent

**Cons:**
- More code to maintain
- Testing matrix complexity
- Slight detection overhead

#### Option 3: User-Configurable

**Description:** Allow users to explicitly select preview method.

**Pros:**
- User control
- Predictable behavior
- Simple implementation

**Cons:**
- Requires user knowledge
- Suboptimal defaults possible
- Poor first-time experience

### Decision

**Selected: Option 2 - Protocol Cascade with Automatic Detection**

Rationale:

1. **Maximum Compatibility**: Supporting all major protocols ensures KlipDot works in virtually any modern terminal.

2. **Progressive Enhancement**: Users get the best available experience without configuration.

3. **Quality First**: Priority ordering ensures high-quality protocols are used when available (iTerm2 > Kitty > Sixel > ASCII).

4. **Transparent Operation**: Users don't need to know or care about protocols - it just works.

5. **Future-Proof**: New protocols can be added to the cascade as they emerge.

### Implementation

**Detection Algorithm:**

```rust
pub struct PreviewMethodDetector;

impl PreviewMethodDetector {
    pub async fn detect() -> PreviewMethod {
        // Check explicit environment variable override
        if let Ok(method) = env::var("KLIPDOT_PREVIEW_METHOD") {
            match method.as_str() {
                "iterm2" => return PreviewMethod::ITerm2,
                "kitty" => return PreviewMethod::Kitty,
                "sixel" => return PreviewMethod::Sixel,
                "ascii" => return PreviewMethod::ASCII,
                _ => {}
            }
        }
        
        // Check TERM_PROGRAM
        if let Ok(term_program) = env::var("TERM_PROGRAM") {
            match term_program.as_str() {
                "iTerm.app" => return PreviewMethod::ITerm2,
                "Apple_Terminal" => {
                    // Terminal.app - use external viewer
                    return PreviewMethod::External("qlmanage");
                }
                _ => {}
            }
        }
        
        // Check TERM
        if let Ok(term) = env::var("TERM") {
            if term.contains("kitty") {
                return PreviewMethod::Kitty;
            }
        }
        
        // Check for explicit Kitty support
        if env::var("KITTY_WINDOW_ID").is_ok() {
            return PreviewMethod::Kitty;
        }
        
        // Check sixel support
        if Self::check_sixel_support().await {
            return PreviewMethod::Sixel;
        }
        
        // Check for external tools
        let tools = ["chafa", "jp2a", "img2txt", "catimg", "timg"];
        for tool in &tools {
            if which::which(tool).is_ok() {
                return PreviewMethod::External(tool.to_string());
            }
        }
        
        // Fallback to text info
        PreviewMethod::None
    }
    
    async fn check_sixel_support() -> bool {
        // Query terminal for sixel capability
        // Send DCS + q Pt ST sequence
        // Check response for +ve (sixel available) or -ve (not available)
        
        let timeout = Duration::from_millis(100);
        // Implementation would use terminal query with timeout
        false // Default to false for safety
    }
}
```

**Preview Implementation:**

```rust
pub struct ImagePreviewManager {
    method: PreviewMethod,
}

impl ImagePreviewManager {
    pub async fn show_preview(&self, path: &Path) -> Result<()> {
        match &self.method {
            PreviewMethod::ITerm2 => self.show_iterm2(path).await,
            PreviewMethod::Kitty => self.show_kitty(path).await,
            PreviewMethod::Sixel => self.show_sixel(path).await,
            PreviewMethod::ASCII => self.show_ascii(path).await,
            PreviewMethod::External(cmd) => self.show_external(cmd, path).await,
            PreviewMethod::None => self.show_text_info(path).await,
        }
    }
    
    async fn show_iterm2(&self, path: &Path) -> Result<()> {
        let image_data = fs::read(path).await?;
        let base64 = base64::encode(&image_data);
        
        // iTerm2 escape sequence
        let sequence = format!(
            "\x1b]1337;File=inline=1;size={}:{}",
            image_data.len(),
            base64
        );
        
        print!("{}", sequence);
        Ok(())
    }
    
    async fn show_kitty(&self, path: &Path) -> Result<()> {
        // Use kitten icat for simplicity
        let output = Command::new("kitten")
            .arg("icat")
            .arg(path)
            .output()
            .await?;
        
        if output.status.success() {
            print!("{}", String::from_utf8_lossy(&output.stdout));
            Ok(())
        } else {
            Err(Error::Preview("Kitty preview failed".into()))
        }
    }
    
    async fn show_sixel(&self, path: &Path) -> Result<()> {
        let output = Command::new("img2sixel")
            .arg(path)
            .output()
            .await?;
        
        if output.status.success() {
            print!("{}", String::from_utf8_lossy(&output.stdout));
            Ok(())
        } else {
            Err(Error::Preview("Sixel conversion failed".into()))
        }
    }
    
    async fn show_ascii(&self, path: &Path) -> Result<()> {
        // Prefer chafa for better quality
        if which::which("chafa").is_ok() {
            let output = Command::new("chafa")
                .arg("--size=80x40")
                .arg("--colors=full")
                .arg(path)
                .output()
                .await?;
            
            if output.status.success() {
                print!("{}", String::from_utf8_lossy(&output.stdout));
                return Ok(());
            }
        }
        
        // Fallback to jp2a
        let output = Command::new("jp2a")
            .arg("--colors")
            .arg("--width=80")
            .arg(path)
            .output()
            .await?;
        
        print!("{}", String::from_utf8_lossy(&output.stdout));
        Ok(())
    }
}
```

### Consequences

**Positive:**
- Maximum terminal compatibility
- Best available quality for each terminal
- No user configuration required
- Extensible for future protocols

**Negative:**
- Increased code complexity
- Larger test matrix required
- Slight startup overhead for detection

### Future Considerations

**Emerging Protocols:**
- Terminal Graphics Protocol (TGP) standardization effort
- Inline Images Protocol (IIP) as potential standard
- Extended Sixel with better color support

**Monitoring:**
Track protocol usage to prioritize optimization efforts.

---

## References

- [ADR-001] - Tokio Runtime Selection
- [ADR-002] - Platform Clipboard Abstraction
- [ADR-003] - Terminal Preview Protocol Selection

*End of ADR Documents*
