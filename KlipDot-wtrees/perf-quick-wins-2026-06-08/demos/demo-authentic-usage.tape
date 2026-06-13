# KlipDot Authentic Usage Demo - Real Commands Only
# Generate with: vhs demo-authentic-usage.tape

Output authentic-usage.gif
Set FontSize 14
Set Width 1200
Set Height 800
Set Theme "Molokai"

# Clear and show title
Type "clear"
Enter
Sleep 500ms

# 1. Version check - real klipdot execution
Type "klipdot --version"
Sleep 1s
Enter
Sleep 2s

# 2. Show help to demonstrate real functionality
Type "klipdot --help"
Sleep 1s
Enter
Sleep 4s

# 3. Check current status
Type "klipdot status"
Sleep 1s
Enter
Sleep 3s

# 4. Start klipdot service
Type "klipdot start --daemon"
Sleep 1s
Enter
Sleep 3s

# 5. Check status after start
Type "klipdot status"
Sleep 1s
Enter
Sleep 2s

# 6. Show configuration
Type "klipdot config"
Sleep 1s
Enter
Sleep 3s

# 7. List available screenshots if any
Type "ls ~/.klipdot/screenshots/ 2>/dev/null || echo 'No screenshots directory yet'"
Sleep 1s
Enter
Sleep 2s

# 8. Show klipdot directory structure
Type "ls -la ~/.klipdot/ 2>/dev/null || echo 'KlipDot directory not initialized'"
Sleep 1s
Enter
Sleep 2s

# 9. Install shell hooks (if available)
Type "klipdot install 2>/dev/null || echo 'Install command not available'"
Sleep 1s
Enter
Sleep 2s

# 10. Stop the service
Type "klipdot stop"
Sleep 1s
Enter
Sleep 2s

# 11. Final status check
Type "klipdot status"
Sleep 1s
Enter
Sleep 2s

# Done
Type "# Real KlipDot functionality demonstrated!"
Sleep 2s