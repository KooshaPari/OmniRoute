# KlipDot actual usage demonstration
# Generate with: vhs demo-actual-usage.tape

Output actual-usage.gif
Set FontSize 14
Set Width 1400
Set Height 800
Set Theme "Catppuccin Mocha"

# Real KlipDot usage demo
Type "# KlipDot - Real Usage Demo"
Sleep 1s
Enter
Type "clear"
Enter

Type "# 1. Check KlipDot version and status"
Sleep 1s
Enter
Type "klipdot --version"
Sleep 1s
Enter
Sleep 2s

Type "klipdot status"
Sleep 1s
Enter
Sleep 3s

Type "# 2. Load ZSH integration with real functions"
Sleep 1s
Enter
Type "source ~/.klipdot/zsh-preview-integration.zsh"
Sleep 1s
Enter
Sleep 1s

Type "# 3. Test image preview with actual screenshot"
Sleep 1s
Enter
Type "ls ~/.klipdot/screenshots/ | head -1"
Sleep 1s
Enter
Sleep 1s

Type "latest_screenshot=$(ls -t ~/.klipdot/screenshots/*.png | head -1)"
Sleep 1s
Enter
Type "echo \"Previewing: $latest_screenshot\""
Sleep 1s
Enter
Sleep 1s

Type "klipdot_quick_preview \"$latest_screenshot\""
Sleep 1s
Enter
Sleep 3s

Type "# 4. Test image path detection in command line"
Sleep 1s
Enter
Type "echo \"Image path test: $latest_screenshot\""
Sleep 1s
Enter
Sleep 2s

Type "# 5. Show Alt+I keybinding function"
Sleep 1s
Enter
Type "# Type an image path and press Alt+I for preview:"
Sleep 1s
Enter
Type "~/.klipdot/screenshots/demo.png"
Sleep 2s
Type " # <-- Press Alt+I here"
Sleep 2s
Enter

Type "# Demo complete - KlipDot intercepts real images!"
Sleep 3s