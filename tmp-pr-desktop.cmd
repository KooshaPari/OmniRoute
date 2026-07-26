@echo off
cd /d C:\Users\koosh\OmniRoute-main-snap
git push -u origin HEAD
gh pr create --repo KooshaPari/OmniRoute --base main --head refactor/desktop-shell-electrobun-not-electron --title "ci(desktop): Electrobun gate; path-filter legacy Electron smoke" --body-file tmp-pr-desktop-body.md
