#!/bin/bash

# KlipDot Production Setup Script
# This script prepares KlipDot for production deployment

set -e

echo "🎯 KlipDot Production Setup"
echo "========================="

# Check if we're in the right directory
if [[ ! -f "Cargo.toml" ]]; then
    echo "❌ Error: Must be run from KlipDot project directory"
    exit 1
fi

# Clean build
echo "🧹 Cleaning previous builds..."
cargo clean

# Build with release optimizations
echo "🔨 Building optimized release..."
cargo build --release --locked

# Run tests to ensure everything works
echo "🧪 Running tests..."
cargo test --release

# Check for security vulnerabilities
echo "🔒 Checking for security issues..."
if command -v cargo-audit &> /dev/null; then
    cargo audit
else
    echo "⚠️  cargo-audit not found, skipping security audit"
    echo "   Install with: cargo install cargo-audit"
fi

# Create production package
echo "📦 Creating production package..."
mkdir -p dist
cp target/release/klipdot dist/
cp install.sh dist/
cp README.md dist/
cp LICENSE dist/

# Create production config template
echo "⚙️  Creating production config template..."
cat > dist/config-template.json << 'EOF'
{
  "enabled": true,
  "auto_start": true,
  "screenshot_dir": "~/.klipdot/screenshots",
  "config_file": "~/.klipdot/config.json",
  "poll_interval": 1000,
  "image_formats": ["png", "jpg", "jpeg", "gif", "bmp", "webp", "svg"],
  "max_file_size": 10485760,
  "compression_quality": 90,
  "cleanup_days": 30,
  "enable_logging": true,
  "log_level": "info",
  "intercept_methods": {
    "clipboard": true,
    "terminal": true,
    "drag_drop": true,
    "stdin": true,
    "file_watch": true,
    "process_monitor": true
  },
  "shell_integration": {
    "enabled": true,
    "shells": ["bash", "zsh"],
    "hook_commands": ["cp", "mv", "scp", "rsync"],
    "aliases": ["cp", "mv", "scp"]
  },
  "display_server": {
    "auto_detect": true,
    "preferred_server": null,
    "wayland_compositor": null,
    "clipboard_tools": {
      "wayland_tools": ["wl-copy", "wl-paste"],
      "x11_tools": ["xclip", "xsel"],
      "preferred_tool": "wl-copy"
    },
    "screenshot_tools": {
      "wayland_tools": ["grim", "wayshot", "grimshot", "spectacle", "flameshot"],
      "x11_tools": ["scrot", "gnome-screenshot", "import", "xfce4-screenshooter"],
      "preferred_tool": "grim",
      "default_args": {
        "grim": ["-"],
        "wayshot": ["--stdout"],
        "grimshot": ["copy", "screen"],
        "spectacle": ["-b", "-n"],
        "flameshot": ["gui"],
        "scrot": ["-"],
        "gnome-screenshot": ["-f", "-"],
        "import": ["-window", "root", "-"],
        "xfce4-screenshooter": ["-f", "-s"]
      }
    },
    "fallback_enabled": true
  }
}
EOF

# Create systemd service file for Linux
echo "🐧 Creating systemd service template..."
cat > dist/klipdot.service << 'EOF'
[Unit]
Description=KlipDot Universal Terminal Image Interceptor
After=network.target

[Service]
Type=simple
User=%i
ExecStart=/usr/local/bin/klipdot start --daemon
Restart=always
RestartSec=5
Environment=HOME=%h
Environment=XDG_RUNTIME_DIR=/run/user/%i

[Install]
WantedBy=multi-user.target
EOF

# Create launchd plist for macOS
echo "🍎 Creating macOS launchd plist..."
cat > dist/com.klipdot.plist << 'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.klipdot</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/local/bin/klipdot</string>
        <string>start</string>
        <string>--daemon</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>/Users/$(whoami)/.klipdot/logs/klipdot.log</string>
    <key>StandardErrorPath</key>
    <string>/Users/$(whoami)/.klipdot/logs/klipdot.error.log</string>
</dict>
</plist>
EOF

# Create deployment script
echo "🚀 Creating deployment script..."
cat > dist/deploy.sh << 'EOF'
#!/bin/bash

# KlipDot Production Deployment Script

set -e

echo "🚀 Deploying KlipDot to production..."

# Install binary
sudo cp klipdot /usr/local/bin/
sudo chmod +x /usr/local/bin/klipdot

# Install for current user
./install.sh

# Set up service based on OS
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    echo "🐧 Setting up systemd service..."
    sudo cp klipdot.service /etc/systemd/system/
    sudo systemctl daemon-reload
    sudo systemctl enable klipdot@$(whoami)
    sudo systemctl start klipdot@$(whoami)
    echo "✅ KlipDot service installed and started"
elif [[ "$OSTYPE" == "darwin"* ]]; then
    echo "🍎 Setting up launchd service..."
    mkdir -p ~/Library/LaunchAgents
    cp com.klipdot.plist ~/Library/LaunchAgents/
    launchctl load ~/Library/LaunchAgents/com.klipdot.plist
    echo "✅ KlipDot service installed and started"
else
    echo "⚠️  Unsupported OS for service installation"
    echo "   Please set up KlipDot to start automatically using your system's service manager"
fi

echo "🎉 KlipDot production deployment complete!"
echo ""
echo "Commands:"
echo "  klipdot status    - Check service status"
echo "  klipdot config    - Show configuration"
echo "  klipdot --help    - Show all commands"
EOF

chmod +x dist/deploy.sh

# Create binary checksums
echo "🔐 Creating checksums..."
cd dist
sha256sum klipdot > klipdot.sha256
cd ..

# Final verification
echo "✅ Running final verification..."
dist/klipdot --version
if dist/klipdot --help > /dev/null; then
    echo "✅ Binary verification passed"
else
    echo "❌ Binary verification failed"
    exit 1
fi

echo ""
echo "🎉 Production setup complete!"
echo ""
echo "📦 Package contents:"
echo "  dist/klipdot           - Optimized binary"
echo "  dist/install.sh        - Installation script"
echo "  dist/deploy.sh         - Production deployment script"
echo "  dist/config-template.json - Configuration template"
echo "  dist/klipdot.service   - Linux systemd service"
echo "  dist/com.klipdot.plist - macOS launchd service"
echo "  dist/klipdot.sha256    - Binary checksum"
echo ""
echo "🚀 To deploy: cd dist && ./deploy.sh"