# VHS tape for basic Kwality validation demo
#
# This demo shows the complete validation workflow for an AI-generated codebase

# Set up the terminal
Output demos/kwality-basic-validation.gif
Set FontSize 14
Set Width 1400
Set Height 900
Set Theme "Molokai"

# Start clean
Hide
Type "clear"
Enter
Show

# Show directory contents
Type "ls -la"
Enter
Sleep 2s

# Display Kwality CLI version
Type "./kwality-cli --version"
Enter
Sleep 2s

# Show platform status
Type "./kwality-cli status"
Enter
Sleep 4s

# Show available projects
Type "./kwality-cli project list"
Enter
Sleep 3s

# Create a new validation project
Type "./kwality-cli project create demo-ai-project"
Enter
Sleep 3s

# Show validation suites
Type "./kwality-cli suite list"
Enter
Sleep 3s

# Create a validation suite
Type "./kwality-cli suite create"
Enter
Sleep 3s

# Show validation execution
Type "./kwality-cli validate list"
Enter
Sleep 3s

# Show authentication status
Type "./kwality-cli auth status"
Enter
Sleep 2s