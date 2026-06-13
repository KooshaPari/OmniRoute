# KlipDot terminal image preview demo
# Shows actual in-terminal image display using chafa and timg

Output terminal-preview.gif
Set FontSize 14
Set Width 1400
Set Height 800
Set Theme "Catppuccin Mocha"

Type "echo 'KlipDot - Terminal Image Preview Demo'"
Sleep 1s
Enter
Enter

Type "echo 'Demonstrating in-terminal image display:'"
Sleep 1s
Enter
Enter

Type "echo '1. Using chafa for ASCII art preview:'"
Sleep 1s
Enter
Type "chafa ~/.klipdot/screenshots/clipboard-2025-07-10T03-04-14.342Z-ee71d43d.png --size 60x15"
Sleep 1s
Enter
Sleep 4s

Type "echo ''"
Enter
Type "echo '2. Using timg for terminal graphics:'"
Sleep 1s
Enter
Type "timg ~/.klipdot/screenshots/clipboard-2025-07-10T03-04-14.342Z-ee71d43d.png -g60x15"
Sleep 1s
Enter
Sleep 4s

Type "echo ''"
Enter
Type "echo '3. KlipDot quick preview function:'"
Sleep 1s
Enter
Type "source ~/.klipdot/zsh-preview-integration.zsh"
Sleep 500ms
Enter
Type "klipdot_quick_preview ~/.klipdot/screenshots/clipboard-2025-07-10T03-04-14.342Z-ee71d43d.png"
Sleep 1s
Enter
Sleep 3s

Type "echo ''"
Enter
Type "echo 'Terminal image display working!'"
Sleep 2s