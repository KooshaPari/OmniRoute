# VHS demonstration of KlipDot TUI integration features
# Generate with: vhs demo-tui-integration.tape

Output tui-integration.gif
Set FontSize 16
Set Width 1400
Set Height 800
Set Theme "Catppuccin Mocha"

Type "echo 'KlipDot - TUI Integration Demo'"
Sleep 500ms
Enter

Type "echo ''"
Enter

Type "echo 'TUI Applications with Enhanced Image Monitoring'"
Sleep 1s
Enter

Type "echo ''"
Enter

Type "echo '1. Load ZSH integration for enhanced commands'"
Sleep 1s
Enter

Type "source ~/.klipdot/zsh-preview-integration.zsh"
Sleep 500ms
Enter
Sleep 1s

Type "echo ''"
Enter

Type "echo '2. Available TUI enhancement commands:'"
Sleep 1s
Enter

Type "echo '  tuiimg   - Any TUI with image monitoring'"
Sleep 300ms
Enter

Type "echo '  vimimg   - Vim with image detection'"
Sleep 300ms
Enter

Type "echo '  rangerimg - Ranger with live previews'"
Sleep 300ms
Enter

Type "echo '  lfimg    - LF file manager with previews'"
Sleep 300ms
Enter

Type "echo ''"
Enter

Type "echo '3. Test image path detection:'"
Sleep 1s
Enter

Type "echo 'File operation: cp screenshot.png ~/Pictures/'"
Sleep 500ms
Enter
Sleep 1s

Type "echo ''"
Enter

Type "echo '4. Screenshot monitoring active'"
Sleep 1s
Enter

Type "ls ~/.klipdot/screenshots/ | wc -l"
Sleep 500ms
Enter
Sleep 1s

Type "echo ''"
Enter

Type "echo 'TUI Integration Demo Complete!'"
Sleep 2s