# KlipDot clipboard workflow demonstration
# Generate with: vhs demo-clipboard-workflow.tape

Output clipboard-workflow.gif
Set FontSize 14
Set Width 1200
Set Height 700
Set Theme "Catppuccin Mocha"

Type "echo 'KlipDot - Clipboard Workflow Demo'"
Sleep 500ms
Enter
Enter

Type "echo 'Step 1: Start KlipDot service'"
Sleep 1s
Enter
Type "klipdot start"
Sleep 2s
Enter
Sleep 2s

Type "echo ''"
Enter
Type "echo 'Step 2: Check service status'"
Sleep 1s
Enter
Type "klipdot status"
Sleep 1s
Enter
Sleep 3s

Type "echo ''"
Enter
Type "echo 'Step 3: Copy image to clipboard (simulated)'"
Sleep 1s
Enter
Type "# In real usage: Take screenshot with Cmd+Shift+3/4/5"
Sleep 1s
Enter
Type "# Image automatically appears in ~/.klipdot/screenshots/"
Sleep 1s
Enter

Type "echo ''"
Enter
Type "echo 'Step 4: Check intercepted screenshots'"
Sleep 1s
Enter
Type "ls -t ~/.klipdot/screenshots/ | head -3"
Sleep 1s
Enter
Sleep 2s

Type "echo ''"
Enter
Type "echo 'Step 5: Preview latest screenshot'"
Sleep 1s
Enter
Type "latest=$(ls -t ~/.klipdot/screenshots/*.png | head -1)"
Sleep 500ms
Enter
Type "klipdot_quick_preview $latest"
Sleep 1s
Enter
Sleep 3s

Type "echo ''"
Enter
Type "echo 'Workflow complete! Images auto-replaced with file paths.'"
Sleep 2s