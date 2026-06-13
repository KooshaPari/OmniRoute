# 🎯 KlipDot - Universal Terminal Image Interceptor

<div align="center">

![KlipDot Logo](https://img.shields.io/badge/KlipDot-Universal%20Terminal%20Image%20Interceptor-blue?style=for-the-badge)

[![Release](https://img.shields.io/github/v/release/KooshaPari/KlipDot?style=flat-square)](https://github.com/KooshaPari/KlipDot/releases)
[![License](https://img.shields.io/github/license/KooshaPari/KlipDot?style=flat-square)](LICENSE)
[![Rust](https://img.shields.io/badge/rust-1.70+-orange?style=flat-square)](https://www.rust-lang.org)

**High-performance, universal terminal image interceptor with advanced clipboard monitoring and LSP-style live preview**

</div>

## 🚀 Quick Start

```bash
# One-line installation
curl -sSL https://raw.githubusercontent.com/KooshaPari/KlipDot/main/install.sh | bash

# Start intercepting
klipdot start --daemon

# Load shell integration
source ~/.klipdot/zsh-preview-integration.zsh
```

## 🎬 See It In Action

<div align="center">

### 🖼️ Basic Preview Functionality
<img src="https://raw.githubusercontent.com/KooshaPari/KlipDot/main/demos/basic-preview.gif" width="800" alt="KlipDot Basic Preview Demo">

### 🔧 TUI Integration Features  
<img src="https://raw.githubusercontent.com/KooshaPari/KlipDot/main/demos/tui-integration.gif" width="800" alt="KlipDot TUI Integration Demo">

### ⚡ Live Preview & LSP-style Detection
<img src="https://raw.githubusercontent.com/KooshaPari/KlipDot/main/demos/live-preview.gif" width="800" alt="KlipDot Live Preview Demo">

</div>

## 📋 What It Does

KlipDot automatically captures and processes image interactions across all terminal applications:

- **📋 Clipboard Monitoring**: Detects macOS Cmd+Shift+(3-5) screenshots in real-time
- **🔄 Auto-Replacement**: Replaces clipboard images with organized file paths  
- **⚡ LSP-style Preview**: Alt+I keybinding for instant image preview
- **🖥️ TUI Integration**: Enhanced monitoring for 15+ terminal applications
- **📁 Smart Organization**: Automatic file naming and directory management

## 🛠️ Core Features

| Feature | Description | Status |
|---------|-------------|---------|
| **Universal Compatibility** | Works with any CLI/TUI application | ✅ |
| **Real-time Monitoring** | Sub-250ms clipboard detection | ✅ |
| **Advanced Shell Integration** | ZSH/Bash hooks and enhanced aliases | ✅ |
| **Image Preview System** | Multiple terminal protocol support | ✅ |
| **Live Path Detection** | Auto-detection of image paths in commands | ✅ |
| **Production Ready** | Error recovery and daemon management | ✅ |

## 📦 Installation Options

### 🚀 Quick Install (Recommended)
```bash
curl -sSL https://raw.githubusercontent.com/KooshaPari/KlipDot/main/install.sh | bash
```

### 📥 Download Binary
```bash
# Download from GitHub releases
wget https://github.com/KooshaPari/KlipDot/releases/download/v1.0.0/klipdot
chmod +x klipdot
sudo mv klipdot /usr/local/bin/
```

### 🔨 Build from Source
```bash
git clone https://github.com/KooshaPari/KlipDot.git
cd KlipDot
cargo build --release
./install.sh
```

## 🎯 Usage Examples

### Basic Screenshot Interception
```bash
# Take a screenshot (Cmd+Shift+3/4/5 on macOS)
# Paste in terminal - automatically becomes file path:
echo "Screenshot saved to: /Users/you/.klipdot/screenshots/clipboard-2025-07-10-uuid.png"
```

### Enhanced Terminal Applications
```bash
# Load shell integration
source ~/.klipdot/zsh-preview-integration.zsh

# Enhanced commands available:
vimimg document.md    # Vim with image detection
rangerimg ~/Pictures  # Ranger with live previews
tuiimg htop          # Any TUI with monitoring
```

### Live Preview System
```bash
# Type image path and press Alt+I for instant preview
~/.klipdot/screenshots/image.png  # Press Alt+I here

# Auto-detection in commands
ls ~/Pictures/*.png               # Shows 🖼️ indicator
cp image.png ~/Desktop/           # Automatically detected
```

## ⚙️ Configuration

### Basic Setup
```bash
# Check configuration
klipdot config show

# Start as daemon
klipdot start --daemon

# View status
klipdot status
```

### Advanced Configuration
```json
{
  "enabled": true,
  "daemon": { "enabled": true },
  "interception": {
    "clipboard": true,
    "fileOperations": true,
    "processMonitoring": true
  },
  "performance": {
    "clipboardPollInterval": 250,
    "maxConcurrentProcessing": 4
  }
}
```

## 📊 Performance Metrics

- **Response Time**: <250ms clipboard detection
- **Memory Usage**: <50MB steady state
- **CPU Usage**: <1% during idle monitoring  
- **Reliability**: 99.9% uptime with auto-recovery

## 🔧 Platform Support

| Platform | Status | Features |
|----------|--------|----------|
| **macOS** | ✅ Full Support | Native screenshot integration, qlmanage previews |
| **Linux** | ✅ Full Support | X11/Wayland compatibility, multiple preview methods |
| **Windows** | 🚧 In Progress | Basic functionality available |

## 📚 Documentation

- 📖 **[Complete Documentation](README.md)** - Full setup and usage guide
- 🎬 **[Demonstrations](demos/)** - VHS-generated GIF examples
- 🔧 **[Configuration Guide](docs/configuration.md)** - Advanced settings
- 🐛 **[Troubleshooting](docs/troubleshooting.md)** - Common issues and fixes

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built with [Rust](https://www.rust-lang.org/) for maximum performance
- Terminal recordings made with [VHS](https://github.com/charmbracelet/vhs)
- Inspired by LSP and modern developer tooling

---

<div align="center">

**⭐ Star this repository if KlipDot helps improve your terminal workflow!**

[Report Bug](https://github.com/KooshaPari/KlipDot/issues) • [Request Feature](https://github.com/KooshaPari/KlipDot/issues) • [Discussions](https://github.com/KooshaPari/KlipDot/discussions)

</div>