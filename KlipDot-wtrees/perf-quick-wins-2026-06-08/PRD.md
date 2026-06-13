# KlipDot Product Requirements Document (PRD)

## 1. Executive Summary

### 1.1 Product Vision
KlipDot is a universal terminal image interceptor that automatically captures, processes, and replaces image interactions with file paths across all CLI and TUI applications. It serves as the missing link between graphical clipboard operations and terminal workflows, enabling seamless image integration for developers, technical writers, and AI-powered workflows.

### 1.2 Mission Statement
To eliminate the friction between visual content and terminal workflows by providing an intelligent, high-performance image interception and processing system that works universally across all command-line interfaces and terminal applications.

### 1.3 Target Users
- **Software Developers**: Writing documentation with screenshots in terminal editors
- **DevOps Engineers**: Creating runbooks and incident reports with visual aids
- **Technical Writers**: Documenting software with embedded images
- **AI Agents**: Automated workflows requiring image capture and processing
- **Terminal Power Users**: Anyone working extensively in CLI/TUI environments

### 1.4 Value Proposition
KlipDot delivers exceptional value through:
- **Universal Compatibility**: Works with any CLI or TUI application
- **AI-Native Integration**: Purpose-built for Claude Code and AI workflows
- **High Performance**: Sub-100ms response times, <50MB memory footprint
- **Privacy-First**: 100% local processing, no network calls
- **Cross-Platform**: Full support for macOS, Linux, and Windows
- **Terminal Native**: Deep shell integration with ZSH, Bash, Fish

## 2. System Architecture

### 2.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           KlipDot System                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   ┌───────────────────────────────────────────────────────────────────┐    │
│   │                        Interception Layer                           │    │
│   │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────┐  │    │
│   │  │ Clipboard    │ │ File Ops     │ │ Drag & Drop  │ │ Stdin    │  │    │
│   │  │ Monitor      │ │ Monitor      │ │ Handler      │ │ Filter   │  │    │
│   │  └──────┬───────┘ └──────┬───────┘ └──────┬───────┘ └────┬─────┘  │    │
│   │         └─────────────────┴─────────────────┴──────────┘        │    │
│   │                                    │                              │    │
│   └────────────────────────────────────┼──────────────────────────────┘    │
│                                        │                                    │
│   ┌────────────────────────────────────▼──────────────────────────────┐   │
│   │                        Processing Core (Rust)                       │   │
│   │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────┐  │   │
│   │  │ Image        │ │ Format       │ │ Compression  │ │ Metadata │  │   │
│   │  │ Processor    │ │ Converter    │ │ Engine       │ │ Extractor│  │   │
│   │  └──────┬───────┘ └──────┬───────┘ └──────┬───────┘ └────┬─────┘  │   │
│   │         └─────────────────┴─────────────────┴──────────┘        │   │
│   │                                    │                              │   │
│   └────────────────────────────────────┼──────────────────────────────┘   │
│                                        │                                    │
│   ┌────────────────────────────────────▼──────────────────────────────┐   │
│   │                        Storage Layer                              │   │
│   │  ┌─────────────────────────────────────────────────────────────┐  │   │
│   │  │  ~/.klipdot/screenshots/                                    │  │   │
│   │  │  • clipboard-{timestamp}-{uuid}.png                         │  │   │
│   │  │  • terminal-{timestamp}-{uuid}.png                          │  │   │
│   │  │  • dragdrop-{timestamp}-{uuid}.png                          │  │   │
│   │  └─────────────────────────────────────────────────────────────┘  │   │
│   └───────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│   ┌───────────────────────────────────────────────────────────────────┐   │
│   │                        API & Integration Layer                    │   │
│   │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐              │   │
│   │  │ REST API     │ │ WebSocket    │ │ Webhook      │              │   │
│   │  │ Server       │ │ Streaming    │ │ Notifications│              │   │
│   │  └──────────────┘ └──────────────┘ └──────────────┘              │   │
│   └───────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│   ┌───────────────────────────────────────────────────────────────────┐   │
│   │                        Shell Integration                          │   │
│   │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────┐  │   │
│   │  │ ZSH          │ │ Bash         │ │ Fish         │ │ PowerShell│  │   │
│   │  │ Integration  │ │ Integration  │ │ Integration  │ │ (Windows) │  │   │
│   │  └──────────────┘ └──────────────┘ └──────────────┘ └──────────┘  │   │
│   └───────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Core Components

#### 2.2.1 Interception Layer
- **Clipboard Monitor**: Continuous clipboard content monitoring
- **File Operations Monitor**: Watch for image file operations
- **Drag & Drop Handler**: Capture terminal drag-and-drop events
- **Stdin Filter**: Intercept image data from stdin

#### 2.2.2 Processing Core
- **Image Processor**: Format detection and validation
- **Format Converter**: PNG, JPG, WebP, GIF support
- **Compression Engine**: Quality optimization
- **Metadata Extractor**: Dimensions, size, format info

#### 2.2.3 Storage Layer
- **Directory Structure**: Organized by interception source
- **Retention Policy**: Automatic cleanup based on age
- **File Permissions**: Secure user-only access
- **Naming Convention**: Timestamp + UUID format

### 2.3 Integration Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    KlipDot Integration Flow                               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  User copies image    ┌──────────────┐    File path inserted            │
│  (Cmd+C / Ctrl+C)────▶│  KlipDot     │──▶ (e.g., ~/.klipdot/            │
│  or drags image       │  Interceptor │     screenshots/img-uuid.png)    │
│                       └──────────────┘                                  │
│                              │                                          │
│                              ▼                                          │
│                       ┌──────────────┐                                  │
│                       │   Process    │                                  │
│                       │   & Store    │                                  │
│                       └──────────────┘                                  │
│                              │                                          │
│              ┌───────────────┼───────────────┐                          │
│              │               │               │                            │
│              ▼               ▼               ▼                          │
│       ┌──────────┐   ┌──────────┐   ┌──────────┐                        │
│       │ Terminal │   │   API    │   │  Claude  │                        │
│       │   UI     │   │ Response │   │   Code   │                        │
│       └──────────┘   └──────────┘   └──────────┘                        │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

## 3. Feature Specifications

### 3.1 Core Interception Features

#### 3.1.1 Clipboard Monitoring
**Objective**: Detect and intercept image clipboard operations

**Requirements**:
- Cross-platform clipboard monitoring
- Image format detection (PNG, JPG, GIF, WebP, BMP, SVG)
- Background daemon operation
- Configurable polling interval

**Technical Specifications**:
- Polling interval: 1000ms (configurable: 100ms - 5000ms)
- Supported formats: PNG, JPG, JPEG, GIF, BMP, WebP, SVG
- Maximum file size: 50MB (configurable)
- Automatic format conversion to PNG (default)

**Configuration**:
```json
{
  "interception": {
    "clipboard": true,
    "clipboardPollInterval": 1000,
    "maxImageSize": "50MB"
  }
}
```

#### 3.1.2 File Operation Monitoring
**Objective**: Intercept image file copy/move operations in terminal

**Requirements**:
- Monitor cp, mv, scp commands for images
- Intercept image paths and convert to klipdot storage
- Preserve original operation intent
- Shell-specific integration

**Technical Specifications**:
- File watch interval: 500ms
- Monitored commands: cp, mv, scp, rsync
- Path interception: Pre-command execution hook
- Backup original: Optional

#### 3.1.3 Drag & Drop Support
**Objective**: Handle drag-and-drop operations into terminal

**Requirements**:
- Detect image drops into terminal
- Convert dropped images to file paths
- Work with all major terminal emulators
- Handle multiple simultaneous drops

**Supported Terminals**:
- iTerm2 (macOS)
- Terminal.app (macOS)
- Alacritty
- Kitty
- Windows Terminal
- GNOME Terminal
- Konsole

### 3.2 Image Processing Features

#### 3.2.1 Format Conversion
**Objective**: Convert images to optimal formats

**Supported Formats**:
| Format | Read | Write | Default Quality |
|--------|------|-------|-----------------|
| PNG    | ✅   | ✅    | - (lossless)    |
| JPEG   | ✅   | ✅    | 90              |
| GIF    | ✅   | ❌    | -               |
| WebP   | ✅   | ✅    | 85              |
| BMP    | ✅   | ❌    | -               |
| SVG    | ✅   | ❌    | - (rasterized)  |

**Technical Specifications**:
- Default output format: PNG
- Quality range: 1-100
- Preserve transparency: Yes (PNG, WebP)
- Progressive JPEG: Enabled

#### 3.2.2 Image Optimization
**Objective**: Reduce file size while maintaining quality

**Features**:
- Lossless compression
- Metadata stripping (optional)
- Dimension-based resizing (optional)
- Smart quality adjustment

**Configuration**:
```json
{
  "storage": {
    "compressionQuality": 90,
    "maxFileSize": "10MB",
    "stripMetadata": false,
    "autoCleanup": true,
    "retentionDays": 30
  }
}
```

### 3.3 Terminal Preview Features

#### 3.3.1 Terminal Image Display
**Objective**: Preview images directly in terminal

**Supported Methods**:
- **chafa**: ASCII art conversion (universal)
- **timg**: Advanced terminal graphics with Sixel
- **qlmanage**: macOS QuickLook (macOS only)
- **Image info**: Dimensions, file size display

**Implementation**:
```bash
# Quick preview command
klipdot_quick_preview ~/.klipdot/screenshots/demo.png

# Output:
# 📸 demo.png
# 📏 Size: 462.9 KB
# 🖼️ Dimensions: 1216x1320
# 📁 /Users/you/.klipdot/screenshots/demo.png
```

### 3.4 AI Integration Features

#### 3.4.1 Claude Code Integration
**Objective**: Native integration with Claude Code

**Features**:
- Automatic image interception for Claude Code
- File path conversion for AI processing
- Webhook notifications for processing completion
- Batch processing for AI training datasets

**Configuration**:
```json
{
  "ai_integration": {
    "enabled": true,
    "api_port": 8080,
    "json_output": true,
    "webhook_url": "http://localhost:3000/webhook",
    "batch_size": 100,
    "response_timeout": 5000
  }
}
```

#### 3.4.2 REST API
**Objective**: Provide programmatic access for AI agents

**API Endpoints**:
```
GET  /api/status           - System status
GET  /api/health           - Health check
GET  /api/stats            - Performance statistics
GET  /api/images           - List all images
GET  /api/images/recent    - Recent images (last 24h)
POST /api/images/process   - Process image batch
GET  /api/monitor/stream   - Server-sent events stream
```

**Performance Guarantees**:
- Response time: < 100ms for all endpoints
- Throughput: 1000+ images/minute
- Memory usage: < 50MB steady state
- Uptime: 99.9% with auto-restart

## 4. Technical Specifications

### 4.1 Technology Stack

#### 4.1.1 Core Engine
- **Language**: Rust (Edition 2021)
- **CLI Framework**: clap
- **Image Processing**: image crate
- **Async Runtime**: tokio
- **HTTP Server**: axum

#### 4.1.2 Platform-Specific
- **macOS**: Cocoa framework for clipboard
- **Linux**: X11/Wayland clipboard APIs
- **Windows**: Win32 clipboard API

#### 4.1.3 Shell Integration
- **ZSH**: zsh hooks and functions
- **Bash**: bash preexec/precmd hooks
- **Fish**: fish event system

### 4.2 Configuration System

#### 4.2.1 Configuration File
**Location**: `~/.klipdot/config.json`

**Full Configuration Schema**:
```json
{
  "enabled": true,
  "autoStart": false,
  "daemon": {
    "enabled": false,
    "pidFile": "~/.klipdot/klipdot.pid",
    "logFile": "~/.klipdot/klipdot.log"
  },
  "interception": {
    "clipboard": true,
    "fileOperations": true,
    "dragDrop": true,
    "stdin": true,
    "processMonitoring": true
  },
  "storage": {
    "directory": "~/.klipdot/screenshots",
    "maxFileSize": "10MB",
    "compressionQuality": 90,
    "retentionDays": 30,
    "autoCleanup": true
  },
  "imageFormats": ["png", "jpg", "jpeg", "gif", "bmp", "webp", "svg"],
  "performance": {
    "clipboardPollInterval": 1000,
    "fileWatchInterval": 500,
    "processPollInterval": 5000,
    "maxConcurrentProcessing": 4
  },
  "security": {
    "allowExternalAccess": false,
    "restrictedPaths": [],
    "maxImageSize": "50MB"
  },
  "ai_integration": {
    "enabled": true,
    "api_port": 8080,
    "json_output": true,
    "webhook_url": null,
    "batch_size": 100,
    "response_timeout": 5000
  }
}
```

### 4.3 Directory Structure

```
~/.klipdot/
├── screenshots/              # Stored screenshots
│   ├── clipboard-*.png      # From clipboard
│   ├── terminal-*.png       # From terminal ops
│   ├── dragdrop-*.png       # From drag & drop
│   └── stdin-*.png          # From stdin
├── hooks/                   # Shell integration
│   ├── zsh-integration.zsh
│   ├── bash-integration.bash
│   └── common-functions.sh
├── temp/                    # Temporary processing
├── logs/                    # Log files
│   ├── klipdot.log
│   └── error.log
├── config.json             # Main configuration
├── klipdot.pid             # Process ID
└── service.json            # Service configuration
```

## 5. User Experience Design

### 5.1 CLI Interface

#### 5.1.1 Command Structure
```
klipdot [OPTIONS] <COMMAND>

Commands:
  start          Start image interceptor
  stop           Stop image interceptor
  status         Show status and recent screenshots
  list           List recent screenshots
  cleanup        Clean up old files
  config         Configuration management
  service        Service management
  doctor         Run diagnostics
  logs           View logs
  help           Show help

Options:
  -c, --config <FILE>     Use custom config file
  -v, --verbose          Enable verbose output
  -q, --quiet            Suppress output
  -h, --help             Show help
  -V, --version          Show version
```

#### 5.1.2 Service Management Commands
```bash
# Service control
klipdot service start
klipdot service stop
klipdot service restart
klipdot service status

# Auto-start configuration
klipdot service enable   # Enable auto-start on login
klipdot service disable  # Disable auto-start

# View logs
klipdot logs --tail 50
klipdot logs --follow
```

### 5.2 Shell Integration

#### 5.2.1 ZSH Integration
**Automatic Setup**:
```bash
# Added to ~/.zshrc by installer
source ~/.klipdot/hooks/zsh-integration.zsh
```

**Features**:
- Pre-command hooks for cp, mv, scp interception
- Post-command clipboard checking
- Enhanced aliases with image awareness

**Functions**:
```bash
klipdot_handle_image()     # Process image files
klipdot_check_paste()      # Check clipboard for images
klipdot_quick_preview()    # Preview image in terminal
```

### 5.3 Usage Examples

#### 5.3.1 With Vim/Neovim
```bash
# In editor, paste image in insert mode
# KlipDot automatically converts to file path
vim document.md
# Insert mode: Cmd+V → gets "/Users/you/.klipdot/screenshots/image-uuid.png"
```

#### 5.3.2 With Git
```bash
# Git commit with screenshot reference
git add .
git commit -m "Add screenshot: $(pbpaste)"
```

#### 5.3.3 With Markdown
```bash
# Append image to README
echo "![Screenshot]($(pbpaste))" >> README.md
```

#### 5.3.4 With Image Processing
```bash
# Resize image using intercepted path
convert $(pbpaste) -resize 50% output.png
```

## 6. Performance Requirements

### 6.1 Response Times
- Clipboard detection: < 1000ms polling
- File operation interception: < 100ms
- Image processing: ~50ms per image
- API response: < 100ms
- Terminal preview: < 500ms

### 6.2 Resource Usage
- **Memory**: < 50MB steady state
- **CPU**: < 1% during idle monitoring
- **Disk**: 10MB base + screenshot storage
- **Network**: 0 (local processing only)

### 6.3 Throughput
- Clipboard operations: Unlimited
- Concurrent processing: 4 images (configurable)
- API requests: 1000/minute
- Batch processing: 100 images/batch

## 7. Security & Privacy

### 7.1 Data Privacy
- **Local Processing**: All operations happen locally
- **No Network Calls**: Zero external data transmission
- **Secure Storage**: Images stored with restricted permissions
- **Automatic Cleanup**: Configurable retention policies

### 7.2 File System Security
```bash
# Secure permissions
chmod 700 ~/.klipdot/                    # Directory: user only
chmod 600 ~/.klipdot/config.json         # Config: user only
chmod 644 ~/.klipdot/screenshots/*.png   # Screenshots: user readable
```

### 7.3 Access Control
```json
{
  "security": {
    "allowExternalAccess": false,
    "restrictedPaths": [
      "/etc",
      "/var",
      "/tmp"
    ],
    "maxImageSize": "50MB",
    "allowedFormats": ["png", "jpg", "jpeg", "gif"],
    "enableFileValidation": true
  }
}
```

## 8. Deployment & Operations

### 8.1 Installation Methods

#### 8.1.1 One-Line Install
```bash
# Automatic installation
curl -sSL https://raw.githubusercontent.com/KooshaPari/KlipDot/main/install.sh | bash
```

#### 8.1.2 From Source
```bash
# Build from source
git clone https://github.com/KooshaPari/KlipDot.git
cd KlipDot
cargo build --release

# Install binary
mkdir -p ~/bin
cp target/release/klipdot ~/bin/
chmod +x ~/bin/klipdot
```

#### 8.1.3 AI Agent Quick Setup
```bash
# One-line install for Claude Code integration
curl -sSL https://raw.githubusercontent.com/KooshaPari/KlipDot/main/install.sh | bash

# Start with API enabled
klipdot start --daemon --api-port 8080

# Verify integration
curl http://localhost:8080/status
```

### 8.2 Platform-Specific Setup

#### 8.2.1 macOS
```bash
# Install dependencies
brew install fswatch

# Grant permissions
# System Preferences → Security & Privacy → Privacy → Accessibility

# Install and start
cargo build --release && ./install.sh
klipdot start --daemon
```

#### 8.2.2 Linux
```bash
# Ubuntu/Debian
sudo apt-get install inotify-tools xclip file

# Fedora/Red Hat
sudo yum install inotify-tools xclip file

# Arch
sudo pacman -S inotify-tools xclip file

# Build and install
cargo build --release && ./install.sh
```

#### 8.2.3 Windows
```powershell
# PowerShell installation
# No additional dependencies on Windows 10+

# Build and install
cargo build --release
.\install.ps1
```

### 8.3 Diagnostic Tools

#### 8.3.1 Doctor Command
```bash
# Full system diagnostic
klipdot doctor

# Check specific components
klipdot doctor --clipboard
klipdot doctor --filesystem
klipdot doctor --shell-integration
klipdot doctor --permissions

# Generate diagnostic report
klipdot doctor --report > klipdot-diagnostics.txt
```

#### 8.3.2 Debug Modes
```bash
# Debug logging
klipdot start --debug

# Verbose logging
klipdot start --verbose

# Trace logging
klipdot start --trace

# Log to file
klipdot start --log-file ~/.klipdot/debug.log
```

## 9. Development Roadmap

### 9.1 Phase 1: Core Platform (Complete)
- [x] Rust core implementation
- [x] Cross-platform clipboard monitoring
- [x] Basic image processing
- [x] File storage system
- [x] CLI interface

### 9.2 Phase 2: Advanced Features (Current)
- [x] Shell integration (ZSH, Bash, Fish)
- [x] Terminal preview support (chafa, timg)
- [x] REST API for AI integration
- [x] Configuration management
- [x] Service management

### 9.3 Phase 3: AI Integration (Planned)
- [ ] Advanced Claude Code integration
- [ ] Webhook system
- [ ] Batch processing API
- [ ] AI training dataset export
- [ ] Smart image categorization

### 9.4 Phase 4: Ecosystem (Future)
- [ ] Plugin system
- [ ] Cloud sync option (opt-in)
- [ ] Team collaboration features
- [ ] Advanced analytics
- [ ] Mobile companion app

## 10. Appendix

### 10.1 Glossary
- **CLI**: Command Line Interface
- **TUI**: Terminal User Interface
- **MCP**: Model Context Protocol
- **WASI**: WebAssembly System Interface
- **SSE**: Server-Sent Events
- **PID**: Process ID

### 10.2 Supported Terminal Emulators
| Emulator | Platform | Status | Notes |
|----------|----------|--------|-------|
| iTerm2 | macOS | ✅ | Full support |
| Terminal.app | macOS | ✅ | Native support |
| Alacritty | Cross | ✅ | GPU-accelerated |
| Kitty | Cross | ✅ | Sixel support |
| Windows Terminal | Windows | ✅ | Modern terminal |
| GNOME Terminal | Linux | ✅ | Default GNOME |
| Konsole | Linux | ✅ | KDE terminal |
| tmux | Cross | ⚠️ | Limited support |
| screen | Cross | ⚠️ | Limited support |

### 10.3 Environment Variables
| Variable | Purpose | Default |
|----------|---------|---------|
| `KLIPDOT_CONFIG` | Config file path | `~/.klipdot/config.json` |
| `KLIPDOT_HOME` | KlipDot home directory | `~/.klipdot` |
| `KLIPDOT_LOG_LEVEL` | Logging level | `info` |
| `KLIPDOT_API_PORT` | API server port | `8080` |

### 10.4 Reference Documents
- API Reference: `docs/api.md`
- Shell Integration: `docs/shell-integration.md`
- Configuration: `docs/configuration.md`
- Troubleshooting: `docs/troubleshooting.md`

---

**Document Version**: 1.0.0  
**Last Updated**: 2024-01-15  
**Author**: KlipDot Product Team  
**Status**: Approved

## 11. Advanced Image Processing Pipeline

### 11.1 Processing Stages

```
┌──────────────┐   ┌──────────────┐   ┌──────────────┐   ┌──────────────┐
│   Source     │──▶│   Analysis   │──▶│  Processing  │──▶│   Output     │
│   Image      │   │   & Detect   │   │   Pipeline   │   │   Storage    │
└──────────────┘   └──────────────┘   └──────────────┘   └──────────────┘
                           │                 │
                           ▼                 ▼
                    ┌──────────────┐  ┌──────────────┐
                    │ • Format ID    │  │ • Resize     │
                    │ • Dimensions   │  │ • Compress   │
                    │ • Color space  │  │ • Convert    │
                    │ • Has alpha?   │  │ • Strip meta │
                    │ • Animation?   │  │ • Watermark  │
                    └──────────────┘  └──────────────┘
```

### 11.2 Format Detection Matrix

| Format | Magic Bytes | MIME Type | Extension |
|--------|-------------|-----------|-----------|
| PNG | `89 50 4E 47` | image/png | .png |
| JPEG | `FF D8 FF` | image/jpeg | .jpg, .jpeg |
| GIF | `47 49 46 38` | image/gif | .gif |
| WebP | `52 49 46 46` | image/webp | .webp |
| BMP | `42 4D` | image/bmp | .bmp |
| TIFF | `49 49 2A 00` | image/tiff | .tiff, .tif |
| SVG | `<svg` | image/svg+xml | .svg |
| HEIC | `00 00 00 18` | image/heic | .heic |

### 11.3 Advanced Transformation Options

```json
{
  "processing": {
    "resize": {
      "mode": "fit", // fit, fill, cover, contain
      "width": 1920,
      "height": 1080,
      "upscale": false,
      "downscale": true
    },
    "crop": {
      "x": 100,
      "y": 100,
      "width": 800,
      "height": 600,
      "smart": true // Use saliency detection
    },
    "filter": {
      "sharpen": 0.5,
      "blur": 0,
      "brightness": 1.0,
      "contrast": 1.0,
      "saturation": 1.0
    },
    "output": {
      "format": "webp",
      "quality": 85,
      "lossless": false,
      "effort": 4 // Compression effort 0-6
    }
  }
}
```

## 12. Multi-Monitor Support

### 12.1 Display Detection

```bash
# List available displays
klipdot display list

# Output:
# ID    Name              Resolution  Scale  Primary
# ─────────────────────────────────────────────────────
# DP-1  Dell U2720Q       3840x2160   2.0    ✅
# HDMI-1 Acer XF270H       1920x1080   1.0    
# eDP-1 Laptop Internal     2560x1600   1.5    
```

### 12.2 Monitor-Specific Capture

```bash
# Capture specific monitor
klipdot capture --display DP-1 --output screenshot.png

# Capture all monitors as single image
klipdot capture --all-displays --output full-desktop.png

# Capture focused window only
klipdot capture --focused --output window.png

# Interactive area selection
klipdot capture --interactive --output selection.png
```

## 13. Integration Recipes

### 13.1 Git Commit Workflow

```bash
# Enhanced git commit with screenshots
klipdot-commit() {
    local message="$1"
    local screenshot_dir=".git/screenshots/$(date +%Y-%m)"
    
    mkdir -p "$screenshot_dir"
    
    # Capture screenshot
    local screenshot="$screenshot_dir/$(date +%s).png"
    klipdot capture --focused --output "$screenshot"
    
    # Add to git
    git add -A
    
    # Commit with screenshot reference
    git commit -m "$message

Screenshot: $screenshot"
}
```

### 13.2 Documentation Generator

```bash
# Auto-generate documentation with screenshots
klipdot-docs() {
    local output_dir="docs/images"
    mkdir -p "$output_dir"
    
    # Execute commands and capture
    klipdot workflow start --output "$output_dir/tutorial.gif"
    
    echo "Step 1: Starting the server"
    npm run dev &
    sleep 5
    klipdot capture --delay 2 --output "$output_dir/step1.png"
    
    echo "Step 2: Opening the application"
    open http://localhost:3000
    sleep 3
    klipdot capture --delay 2 --output "$output_dir/step2.png"
    
    klipdot workflow stop
    
    # Generate markdown
    cat > docs/tutorial.md << 'EOF'
# Tutorial

## Step 1: Start the Server
![Step 1](images/step1.png)

## Step 2: Open the App
![Step 2](images/step2.png)

## Full Demo
![Demo](images/tutorial.gif)
EOF
}
```

## 14. Security and Privacy

### 14.1 Content Scanning

```toml
# klipdot-security.toml
[content_filter]
enabled = true
scan_on_capture = true

blocked_categories = [
    "credit_card",
    "social_security",
    "api_keys",
    "passwords"
]

actions = [
    "warn",
    "quarantine",
    "encrypt"
]

[encryption]
algorithm = "AES-256-GCM"
key_rotation_days = 90
```

### 14.2 Audit Logging

```sql
-- KlipDot audit schema
CREATE TABLE klipdot_audit (
    id SERIAL PRIMARY KEY,
    timestamp TIMESTAMP DEFAULT NOW(),
    user_id TEXT,
    action TEXT, -- capture, view, delete, export
    source TEXT, -- clipboard, file, drag-drop
    file_hash TEXT,
    file_size INTEGER,
    dimensions TEXT,
    destination TEXT,
    ip_address INET
);

-- Privacy retention
CREATE EVENT privacy_cleanup
ON SCHEDULE EVERY 1 DAY
DO
    DELETE FROM klipdot_audit 
    WHERE timestamp < NOW() - INTERVAL '90 days';
```

### 14.3 Compliance Certifications

| Standard | Feature | Status |
|----------|---------|--------|
| GDPR | Data deletion on request | ✅ |
| SOC 2 | Audit logging | ✅ |
| HIPAA | Encryption at rest | ✅ |
| CCPA | Data export | ✅ |
| ISO 27001 | Access controls | ✅ |
