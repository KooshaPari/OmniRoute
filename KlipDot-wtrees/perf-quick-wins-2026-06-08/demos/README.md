# KlipDot Demonstrations

This directory contains demonstration materials for KlipDot's features.

## 🎬 Authentic Demonstrations

**NEW**: Real klipdot binary execution demonstrations (no fake output):

- **[authentic-usage.gif](authentic-usage.gif)** - **AUTHENTIC**: Real klipdot commands and actual output
- **[working-features.gif](working-features.gif)** - Core features with real command execution
- **[clipboard-workflow.gif](clipboard-workflow.gif)** - Complete clipboard interception workflow
- **[terminal-preview.gif](terminal-preview.gif)** - In-terminal image display using chafa and timg
- **[real-preview.gif](real-preview.gif)** - Real image preview and information display

### Basic Demos
- **[basic-preview.gif](basic-preview.gif)** - Basic command demonstrations
- **[tui-integration.gif](tui-integration.gif)** - TUI application integration concepts
- **[live-preview.gif](live-preview.gif)** - LSP-style live preview concepts

## VHS Tape Files

Use [VHS](https://github.com/charmbracelet/vhs) to regenerate GIF demonstrations:

```bash
# Install VHS
brew install vhs

# Generate AUTHENTIC demo with real klipdot commands
vhs demo-authentic-usage.tape

# Generate comprehensive showcase
vhs demo-comprehensive-showcase.tape

# Generate AI integration demo
vhs demo-ai-integration.tape

# Generate basic demos
vhs demo-basic-preview.tape
vhs demo-tui-integration.tape
vhs demo-live-preview.tape
```

## Demo Scripts

### 🎯 Authentic Usage (`demo-authentic-usage.tape`)
- **REAL klipdot binary execution** - no fake output
- Version check with actual output
- Service start/stop with real status
- Configuration display with actual config
- Help system showing real command options
- Directory structure verification

### 🤖 AI Integration (`demo-ai-integration.tape`)
- Service management for AI workflows
- Configuration for Claude Code integration
- Real command execution for automation
- Screenshot directory management

### 🔧 Comprehensive Showcase (`demo-comprehensive-showcase.tape`)
- Complete feature demonstration
- Real klipdot command execution
- Service status and management
- Configuration and help systems

### Legacy Demos
1. **Basic Preview** (`demo-basic-preview.tape`) - Image preview basics
2. **TUI Integration** (`demo-tui-integration.tape`) - TUI application monitoring  
3. **Live Preview** (`demo-live-preview.tape`) - Real-time preview features

## Running Live Demos

### Basic Features
```bash
# Quick image preview
klipdot preview [image_path]

# Monitor command output
ls *.png | klipdot monitor-output

# ZSH integration
source ~/.klipdot/zsh-preview-integration.zsh
klipdot_quick_preview [image_path]
```

### TUI Integration
```bash
# Run TUI with monitoring
klipdot tui ls ~/Pictures/
klipdot tui ranger ~/Downloads/

# Enhanced aliases
tuiimg vim notes.md
rangerimg ~/Pictures/
```

### Advanced Features
```bash
# Live preview mode
klipdot live-preview --auto-preview

# Stdin data preview
cat image.png | klipdot preview-stdin

# Alt+I keybinding for cursor preview
# (Type image path and press Alt+I)
```

## Feature Highlights

- ✅ **Apple Terminal Support**: Native qlmanage integration
- ✅ **Non-blocking Previews**: Quick info + background app launch
- ✅ **TUI-Aware Monitoring**: 15+ applications supported
- ✅ **Real-time Detection**: Stdout/stdin monitoring
- ✅ **Smart Fallbacks**: Always shows useful information
- ✅ **macOS Integration**: Native tools (sips, stat, qlmanage)

## Demo Requirements

- macOS (tested on macOS 14+)
- Terminal.app or compatible terminal
- KlipDot installed in PATH
- ZSH shell (for integration features)
- Optional: VHS for generating GIFs