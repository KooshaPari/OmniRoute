# KlipDot working features demonstration
# Shows what actually works in the current implementation

Output working-features.gif
Set FontSize 14
Set Width 1400
Set Height 800
Set Theme "Catppuccin Mocha"

Type "echo 'KlipDot - Working Features Demo'"
Sleep 1s
Enter
Enter

Type "echo 'Feature 1: Screenshot Interception'"
Sleep 1s
Enter
Type "ls -la ~/.klipdot/screenshots/ | head -5"
Sleep 1s
Enter
Sleep 2s

Type "echo ''"
Enter
Type "echo 'Feature 2: Service Status Monitoring'"
Sleep 1s
Enter
Type "klipdot status"
Sleep 1s
Enter
Sleep 3s

Type "echo ''"
Enter
Type "echo 'Feature 3: ZSH Integration Functions'"
Sleep 1s
Enter
Type "source ~/.klipdot/zsh-preview-integration.zsh"
Sleep 500ms
Enter
Type "echo 'Functions loaded: klipdot_quick_preview, tuiimg, rangerimg'"
Sleep 1s
Enter
Sleep 2s

Type "echo ''"
Enter
Type "echo 'Feature 4: Image Information Display'"
Sleep 1s
Enter
Type "latest_img=\\$(ls -t ~/.klipdot/screenshots/*.png | head -1)"
Sleep 500ms
Enter
Type "klipdot_quick_preview \\$latest_img"
Sleep 1s
Enter
Sleep 3s

Type "echo ''"
Enter
Type "echo 'Feature 5: Built-in Help System'"
Sleep 1s
Enter
Type "klipdot --help | head -10"
Sleep 1s
Enter
Sleep 3s

Type "echo ''"
Enter
Type "echo 'KlipDot core functionality demonstrated!'"
Sleep 2s