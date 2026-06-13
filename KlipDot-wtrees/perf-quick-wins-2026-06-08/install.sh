#!/bin/bash

# KlipDot Installation Script
# Supports macOS, Linux, and Windows with ZSH/Bash

set -e

KLIPDOT_DIR="$HOME/.klipdot"
INSTALL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "🚀 Installing KlipDot..."

# Detect OS
OS="$(uname -s)"
case "${OS}" in
    Linux*)     MACHINE=Linux;;
    Darwin*)    MACHINE=Mac;;
    CYGWIN*|MINGW32*|MSYS*|MINGW*) MACHINE=Windows;;
    *)          MACHINE="UNKNOWN:${OS}"
esac

echo "📋 Detected OS: $MACHINE"

# Detect Shell
SHELL_TYPE="$(basename "$SHELL")"
echo "🐚 Detected Shell: $SHELL_TYPE"

# Build the binary
echo "🔨 Building klipdot binary..."
cargo build --release

# Determine install location
if [ -d "$HOME/bin" ] && [[ ":$PATH:" == *":$HOME/bin:"* ]]; then
    INSTALL_DIR="$HOME/bin"
    echo "📁 Installing to user directory: $INSTALL_DIR"
elif [ -d "$HOME/.local/bin" ] && [[ ":$PATH:" == *":$HOME/.local/bin:"* ]]; then
    INSTALL_DIR="$HOME/.local/bin"
    echo "📁 Installing to user directory: $INSTALL_DIR"
elif [ -w "/usr/local/bin" ]; then
    INSTALL_DIR="/usr/local/bin"
    echo "📁 Installing to system directory: $INSTALL_DIR"
else
    # Default to user bin directory
    INSTALL_DIR="$HOME/bin"
    mkdir -p "$INSTALL_DIR"
    echo "📁 Installing to user directory: $INSTALL_DIR"
    echo "⚠️  Make sure $INSTALL_DIR is in your PATH"
    echo "Add this to your shell profile: export PATH=\"$INSTALL_DIR:\$PATH\""
fi

# Copy binary
echo "📦 Installing klipdot binary..."
cp target/release/klipdot "$INSTALL_DIR/"
chmod +x "$INSTALL_DIR/klipdot"

# Create klipdot directories
echo "📁 Creating klipdot directories..."
mkdir -p "$KLIPDOT_DIR"
mkdir -p "$KLIPDOT_DIR/screenshots"
mkdir -p "$KLIPDOT_DIR/hooks"
mkdir -p "$KLIPDOT_DIR/temp"
mkdir -p "$KLIPDOT_DIR/logs"

# Create default configuration
echo "⚙️  Creating default configuration..."
# Let klipdot generate its own config to ensure compatibility
if [ -f "$KLIPDOT_DIR/config.json" ]; then
    echo "✅ Configuration already exists"
else
    # Create empty config - klipdot will generate defaults
    echo '{}' > "$KLIPDOT_DIR/config.json"
    echo "✅ Created default configuration"
fi

# Create shell integration files
echo "🔧 Setting up shell integration..."

# ZSH integration
cat > "$KLIPDOT_DIR/hooks/zsh-integration.zsh" << 'EOF'
# KlipDot ZSH Integration
# This file is automatically sourced by ZSH

# Start klipdot service if not running
if ! pgrep -f "klipdot.*start" > /dev/null 2>&1; then
    klipdot start --daemon > /dev/null 2>&1 &
fi

# Helper function to handle image pastes
klipdot_handle_paste() {
    local paste_content
    if command -v pbpaste > /dev/null 2>&1; then
        paste_content="$(pbpaste)"
    elif command -v xclip > /dev/null 2>&1; then
        paste_content="$(xclip -selection clipboard -o)"
    elif command -v wl-paste > /dev/null 2>&1; then
        paste_content="$(wl-paste)"
    fi
    
    # Check if content looks like an image path
    if [[ "$paste_content" =~ \.(png|jpg|jpeg|gif|bmp|webp|svg)$ ]]; then
        echo "$paste_content"
    fi
}

# Command aliases with klipdot integration
alias kpaste='klipdot_handle_paste'
EOF

# Bash integration
cat > "$KLIPDOT_DIR/hooks/bash-integration.bash" << 'EOF'
# KlipDot Bash Integration
# This file is automatically sourced by Bash

# Start klipdot service if not running
if ! pgrep -f "klipdot.*start" > /dev/null 2>&1; then
    klipdot start --daemon > /dev/null 2>&1 &
fi

# Helper function to handle image pastes
klipdot_handle_paste() {
    local paste_content
    if command -v pbpaste > /dev/null 2>&1; then
        paste_content="$(pbpaste)"
    elif command -v xclip > /dev/null 2>&1; then
        paste_content="$(xclip -selection clipboard -o)"
    elif command -v wl-paste > /dev/null 2>&1; then
        paste_content="$(wl-paste)"
    fi
    
    # Check if content looks like an image path
    if [[ "$paste_content" =~ \.(png|jpg|jpeg|gif|bmp|webp|svg)$ ]]; then
        echo "$paste_content"
    fi
}

# Command aliases with klipdot integration
alias kpaste='klipdot_handle_paste'
EOF

# Install shell hooks
echo "🐚 Installing shell hooks..."
case "$SHELL_TYPE" in
    zsh)
        SHELL_RC="$HOME/.zshrc"
        HOOK_LINE="source $KLIPDOT_DIR/hooks/zsh-integration.zsh"
        ;;
    bash)
        SHELL_RC="$HOME/.bashrc"
        HOOK_LINE="source $KLIPDOT_DIR/hooks/bash-integration.bash"
        ;;
    *)
        echo "⚠️  Unknown shell type: $SHELL_TYPE"
        echo "You may need to manually add shell integration"
        SHELL_RC=""
        ;;
esac

if [ -n "$SHELL_RC" ]; then
    if [ -f "$SHELL_RC" ]; then
        if ! grep -q "klipdot" "$SHELL_RC"; then
            echo "" >> "$SHELL_RC"
            echo "# KlipDot Integration" >> "$SHELL_RC"
            echo "$HOOK_LINE" >> "$SHELL_RC"
            echo "✅ Added klipdot integration to $SHELL_RC"
        else
            echo "✅ KlipDot integration already exists in $SHELL_RC"
        fi
    else
        echo "⚠️  $SHELL_RC not found, creating with klipdot integration"
        echo "# KlipDot Integration" > "$SHELL_RC"
        echo "$HOOK_LINE" >> "$SHELL_RC"
    fi
fi

# Verify installation
echo "🔍 Verifying installation..."
if command -v klipdot > /dev/null 2>&1; then
    echo "✅ klipdot is available in PATH"
    echo "Version: $(klipdot --version)"
else
    echo "⚠️  klipdot not found in PATH. You may need to:"
    echo "   1. Restart your shell"
    echo "   2. Add $INSTALL_DIR to your PATH"
fi

echo ""
echo "🎉 Installation complete!"
echo ""
echo "📋 Next steps:"
echo "   1. Restart your shell or run: source $SHELL_RC"
echo "   2. Start klipdot: klipdot start"
echo "   3. Check status: klipdot status"
echo ""
echo "📚 Common commands:"
echo "   klipdot start     # Start the service"
echo "   klipdot status    # Check status"
echo "   klipdot config    # Show configuration"
echo "   klipdot cleanup   # Clean old screenshots"
echo "   klipdot --help    # Show help"