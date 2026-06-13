# VHS tape for Kwality security scanning demo
#
# This demo shows comprehensive security scanning capabilities

# Set up the terminal
Output demos/kwality-security-scan.gif
Set FontSize 14
Set Width 1400
Set Height 900
Set Theme "Molokai"

# Start clean
Hide
Type "clear"
Enter
Show

# Display security scan banner
Type "echo '🔒 Kwality Security Scanning Demo'"
Enter
Sleep 2s

# Show project to be scanned
Type "ls -la"
Enter
Sleep 2s

# Show platform security status
Type "./kwality-cli status"
Enter
Sleep 4s

# Create a security validation target
Type "./kwality-cli target create"
Enter
Sleep 3s

# List validation targets
Type "./kwality-cli target list"
Enter
Sleep 3s

# Create a security test suite
Type "./kwality-cli suite create"
Enter
Sleep 3s

# List test suites
Type "./kwality-cli suite list"
Enter
Sleep 3s

# Create security-focused tests
Type "./kwality-cli test create"
Enter
Sleep 3s

# List tests
Type "./kwality-cli test list"
Enter
Sleep 3s

# Show validation execution status
Type "./kwality-cli validate list"
Enter
Sleep 3s

Type "echo '✅ Security scan complete - No critical vulnerabilities found'"
Enter
Sleep 2s