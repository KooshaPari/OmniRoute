#!/bin/bash

# Kwality Installation Script
# Installs Kwality binaries and adds them to PATH

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
INSTALL_DIR="$HOME/.kwality"
BIN_DIR="$INSTALL_DIR/bin"
CONFIG_DIR="$INSTALL_DIR/config"

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Create installation directories
create_directories() {
    log_info "Creating installation directories..."
    mkdir -p "$BIN_DIR"
    mkdir -p "$CONFIG_DIR"
    log_success "Created directories: $INSTALL_DIR"
}

# Install binaries
install_binaries() {
    log_info "Installing Kwality binaries..."
    
    # Copy main binaries
    if [ -f "./kwality" ]; then
        cp "./kwality" "$BIN_DIR/"
        chmod +x "$BIN_DIR/kwality"
        log_success "Installed kwality binary"
    else
        log_error "kwality binary not found. Run 'make build' first."
        exit 1
    fi
    
    if [ -f "./kwality-cli" ]; then
        cp "./kwality-cli" "$BIN_DIR/"
        chmod +x "$BIN_DIR/kwality-cli"
        log_success "Installed kwality-cli binary"
    else
        log_warning "kwality-cli binary not found. Building from source..."
        make build-cli || log_warning "Failed to build kwality-cli"
    fi
    
    # Copy claude-flow wrapper if it exists
    if [ -f "./claude-flow" ]; then
        cp "./claude-flow" "$BIN_DIR/"
        chmod +x "$BIN_DIR/claude-flow"
        log_success "Installed claude-flow wrapper"
    fi
}

# Install runtime validator
install_runtime_validator() {
    log_info "Installing Rust runtime validator..."
    
    if [ -d "./engines/runtime-validator" ]; then
        cd "./engines/runtime-validator"
        if command -v cargo &> /dev/null; then
            cargo build --release
            if [ -f "./target/release/runtime-validator" ]; then
                cp "./target/release/runtime-validator" "$BIN_DIR/"
                chmod +x "$BIN_DIR/runtime-validator"
                log_success "Installed runtime-validator binary"
            else
                log_warning "Runtime validator build failed"
            fi
        else
            log_warning "Cargo not found. Skipping runtime validator installation."
        fi
        cd ../..
    else
        log_warning "Runtime validator source not found"
    fi
}

# Add to PATH
setup_path() {
    log_info "Setting up PATH configuration..."
    
    # Detect shell
    SHELL_NAME=$(basename "$SHELL")
    
    case "$SHELL_NAME" in
        "bash")
            PROFILE_FILE="$HOME/.bashrc"
            if [ -f "$HOME/.bash_profile" ]; then
                PROFILE_FILE="$HOME/.bash_profile"
            fi
            ;;
        "zsh")
            PROFILE_FILE="$HOME/.zshrc"
            ;;
        "fish")
            PROFILE_FILE="$HOME/.config/fish/config.fish"
            ;;
        *)
            PROFILE_FILE="$HOME/.profile"
            ;;
    esac
    
    # Add PATH entry if not already present
    PATH_ENTRY="export PATH=\"$BIN_DIR:\$PATH\""
    
    if [ -f "$PROFILE_FILE" ] && grep -q "$BIN_DIR" "$PROFILE_FILE"; then
        log_info "PATH already configured in $PROFILE_FILE"
    else
        echo "" >> "$PROFILE_FILE"
        echo "# Kwality Platform" >> "$PROFILE_FILE"
        echo "$PATH_ENTRY" >> "$PROFILE_FILE"
        log_success "Added Kwality to PATH in $PROFILE_FILE"
    fi
    
    # Create symlinks for system-wide access (optional)
    if command -v sudo &> /dev/null; then
        read -p "Install system-wide symlinks? (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            sudo ln -sf "$BIN_DIR/kwality" /usr/local/bin/kwality || log_warning "Failed to create system symlink"
            sudo ln -sf "$BIN_DIR/kwality-cli" /usr/local/bin/kwality-cli || log_warning "Failed to create CLI symlink"
            log_success "Created system-wide symlinks"
        fi
    fi
}

# Install configuration
install_config() {
    log_info "Installing configuration files..."
    
    # Copy production templates
    if [ -f "./.env.production.template" ]; then
        cp "./.env.production.template" "$CONFIG_DIR/"
        log_success "Installed production environment template"
    fi
    
    # Copy Docker configurations
    if [ -f "./docker-compose.production.yml" ]; then
        cp "./docker-compose.production.yml" "$CONFIG_DIR/"
        log_success "Installed production Docker Compose configuration"
    fi
    
    # Copy Kubernetes configurations
    if [ -f "./k8s/kwality-deployment.production.yaml" ]; then
        cp "./k8s/kwality-deployment.production.yaml" "$CONFIG_DIR/"
        log_success "Installed production Kubernetes configuration"
    fi
    
    # Copy secret generation script
    if [ -f "./scripts/generate-secrets.sh" ]; then
        cp "./scripts/generate-secrets.sh" "$BIN_DIR/"
        chmod +x "$BIN_DIR/generate-secrets.sh"
        log_success "Installed secret generation script"
    fi
}

# Verify installation
verify_installation() {
    log_info "Verifying installation..."
    
    # Test binary execution
    if "$BIN_DIR/kwality" --version &> /dev/null; then
        log_success "Kwality binary is working"
    else
        log_warning "Kwality binary test failed"
    fi
    
    # Test PATH access
    export PATH="$BIN_DIR:$PATH"
    if command -v kwality &> /dev/null; then
        log_success "Kwality is accessible via PATH"
    else
        log_warning "Kwality not in PATH. You may need to restart your shell."
    fi
    
    # Display version
    VERSION=$("$BIN_DIR/kwality" --version 2>/dev/null || echo "unknown")
    log_info "Installed version: $VERSION"
}

# Create desktop integration (Linux/macOS)
create_desktop_integration() {
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        log_info "Creating desktop integration for Linux..."
        
        DESKTOP_FILE="$HOME/.local/share/applications/kwality.desktop"
        mkdir -p "$(dirname "$DESKTOP_FILE")"
        
        cat > "$DESKTOP_FILE" << EOF
[Desktop Entry]
Name=Kwality
Comment=AI Codebase Validation Platform
Exec=$BIN_DIR/kwality
Icon=applications-development
Terminal=true
Type=Application
Categories=Development;
EOF
        
        log_success "Created desktop entry"
        
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        log_info "macOS detected - binaries available via terminal"
        
        # Remove quarantine attributes on macOS
        if command -v xattr &> /dev/null; then
            xattr -d com.apple.quarantine "$BIN_DIR"/* 2>/dev/null || true
            log_success "Removed quarantine attributes"
        fi
    fi
}

# Display completion message
show_completion() {
    echo
    log_success "Kwality installation completed successfully!"
    echo
    echo "📍 Installation Directory: $INSTALL_DIR"
    echo "🔧 Binary Location: $BIN_DIR"
    echo "⚙️  Configuration: $CONFIG_DIR"
    echo
    echo "🚀 Quick Start:"
    echo "   1. Restart your terminal or run: source $PROFILE_FILE"
    echo "   2. Generate secrets: kwality generate-secrets"
    echo "   3. Start platform: kwality server"
    echo "   4. Or use Docker: cd $CONFIG_DIR && docker-compose -f docker-compose.production.yml up"
    echo
    echo "📚 Documentation:"
    echo "   - Production Guide: docs/PRODUCTION-DEPLOYMENT-GUIDE.md"
    echo "   - Security Guide: docs/PRODUCTION-SECURITY-GUIDE.md"
    echo "   - API Documentation: https://kwality.yourdomain.com/docs"
    echo
    echo "🔗 Useful Commands:"
    echo "   kwality --help          # Show help"
    echo "   kwality version         # Show version"
    echo "   kwality health          # Check system health"
    echo "   kwality-cli validate    # Validate codebase"
    echo
    log_info "Happy validating! 🛡️"
}

# Main installation function
main() {
    echo
    log_info "Kwality AI Codebase Validation Platform Installer"
    log_info "================================================="
    echo
    
    # Check prerequisites
    if ! command -v make &> /dev/null; then
        log_error "Make is required but not installed."
        exit 1
    fi
    
    # Run installation steps
    create_directories
    install_binaries
    install_runtime_validator
    install_config
    setup_path
    create_desktop_integration
    verify_installation
    show_completion
}

# Handle cleanup on exit
cleanup() {
    if [ $? -ne 0 ]; then
        log_error "Installation failed. Check the errors above."
        echo "For help, visit: https://github.com/KooshaPari/kwality/issues"
    fi
}
trap cleanup EXIT

# Run installation
main "$@"