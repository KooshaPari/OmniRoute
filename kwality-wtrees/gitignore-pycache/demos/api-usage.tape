# VHS tape for Kwality API usage demo
#
# This demo shows API server and REST endpoint usage

# Set up the terminal
Output demos/kwality-api-usage.gif
Set FontSize 14
Set Width 1400
Set Height 900
Set Theme "Molokai"

# Start clean
Hide
Type "clear"
Enter
Show

# Display API demo banner
Type "echo '🌐 Kwality API Usage Demo'"
Enter
Sleep 2s

# Show CLI API configuration
Type "./kwality-cli status"
Enter
Sleep 4s

# Show authentication commands
Type "./kwality-cli auth --help"
Enter
Sleep 3s

# Demonstrate authentication status
Type "./kwality-cli auth status"
Enter
Sleep 3s

# Show project management via API
Type "./kwality-cli project --help"
Enter
Sleep 3s

# List projects via API
Type "./kwality-cli project list"
Enter
Sleep 3s

# Show validation commands
Type "./kwality-cli validate --help"
Enter
Sleep 3s

# Show validation execution
Type "./kwality-cli validate list"
Enter
Sleep 3s

# Show test management
Type "./kwality-cli test --help"
Enter
Sleep 3s

# Create a test via API
Type "./kwality-cli test create"
Enter
Sleep 3s

# Show target management
Type "./kwality-cli target list"
Enter
Sleep 3s

Type "echo '✅ API demo complete'"
Enter
Sleep 2s