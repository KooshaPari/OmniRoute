# VHS tape for Kwality installation demo
#
# This demo shows the complete installation process for Kwality

# Set up the terminal
Output demos/kwality-installation.gif
Set FontSize 14
Set Width 1400
Set Height 900
Set Theme "Molokai"

# Start clean
Hide
Type "clear"
Enter
Show

# Show prerequisites check
Type "go version"
Enter
Sleep 2s

Type "docker --version"
Enter
Sleep 2s

Type "cargo --version"
Enter
Sleep 2s

# Clone the repository (simulated)
Type "# Cloning Kwality repository"
Enter
Type "git clone https://github.com/KooshaPari/kwality.git"
Enter
Sleep 2s

Type "cd kwality"
Enter
Sleep 1s

# Show project structure
Type "ls -la"
Enter
Sleep 3s

# Build the project
Type "make build"
Enter
Sleep 8s

# Install locally
Type "make install-user"
Enter
Sleep 5s

# Verify installation
Type "which kwality-cli"
Enter
Sleep 2s

Type "./kwality-cli --version"
Enter
Sleep 2s

# Test basic functionality
Type "./kwality-cli status"
Enter
Sleep 4s

# Show help
Type "./kwality-cli --help"
Enter
Sleep 4s

Type "echo 'Installation complete! ✅'"
Enter
Sleep 2s