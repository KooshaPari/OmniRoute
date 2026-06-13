# VHS demonstration of KlipDot basic preview functionality
# Generate with: vhs demo-basic-preview.tape

Output basic-preview.gif
Set FontSize 16
Set Width 1400
Set Height 800
Set Theme "Catppuccin Mocha"

Type "echo 'KlipDot - Universal Terminal Image Interceptor'"
Sleep 500ms
Enter

Type "echo ''"
Enter

Type "echo 'Basic Image Preview Demo'"
Sleep 1s
Enter

Type "echo ''"
Enter

Type "echo '1. Show KlipDot version and status'"
Sleep 1s
Enter

Type "klipdot --version"
Sleep 500ms
Enter
Sleep 1s

Type "echo ''"
Enter

Type "echo '2. Check available screenshots'"
Sleep 1s
Enter

Type "ls -la ~/.klipdot/screenshots/"
Sleep 500ms
Enter
Sleep 2s

Type "echo ''"
Enter

Type "echo '3. Load ZSH integration'"
Sleep 1s
Enter

Type "source ~/.klipdot/zsh-preview-integration.zsh"
Sleep 500ms
Enter
Sleep 1s

Type "echo ''"
Enter

Type "echo '4. Quick preview function available'"
Sleep 1s
Enter

Type "echo 'klipdot_quick_preview shows file info and dimensions'"
Sleep 500ms
Enter
Sleep 1s

Type "echo ''"
Enter

Type "echo 'KlipDot Basic Preview Demo Complete!'"
Sleep 2s