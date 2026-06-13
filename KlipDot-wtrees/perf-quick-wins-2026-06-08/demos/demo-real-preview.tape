# Real KlipDot functionality demonstration
# Generate with: vhs demo-real-preview.tape

Output real-preview.gif
Set FontSize 14
Set Width 1200
Set Height 700
Set Theme "Catppuccin Mocha"

Type "echo 'KlipDot - Real Functionality Demo'"
Sleep 500ms
Enter
Enter

Type "echo 'Loading ZSH integration...'"
Sleep 500ms
Enter
Type "source ~/.klipdot/zsh-preview-integration.zsh"
Sleep 1s
Enter
Sleep 1s

Type "echo 'Testing image preview with real screenshot...'"
Sleep 1s
Enter
Type "klipdot_quick_preview ~/.klipdot/screenshots/clipboard-2025-07-10T03-04-14.342Z-ee71d43d.png"
Sleep 1s
Enter
Sleep 3s

Type "echo ''"
Enter
Type "echo 'Checking available screenshots...'"
Sleep 1s
Enter
Type "ls -la ~/.klipdot/screenshots/ | head -5"
Sleep 1s
Enter
Sleep 2s

Type "echo ''"
Enter
Type "echo 'Testing clipboard monitoring status...'"
Sleep 1s
Enter
Type "klipdot status"
Sleep 1s
Enter
Sleep 3s

Type "echo ''"
Enter
Type "echo 'Demo complete - KlipDot is intercepting images!'"
Sleep 2s