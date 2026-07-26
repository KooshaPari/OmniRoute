@echo off
cd /d C:\Users\koosh\OmniRoute-main-snap
set LEFTHOOK_EXCLUDE=editorconfig,secret-scan,prettier-markdown
git add .github/workflows/ci.yml .github/workflows/desktop-electrobun.yml apps/desktop/README.md desktop-electrobun/README.md
git commit -m "ci(desktop): path-filter Electron smoke; promote Electrobun gate" -m "Electron Package Smoke now runs only when electron/ changes on PRs. Electrobun remains the ADR-ECO-015 canonical desktop spike; workflow also watches apps/desktop and main pushes."
git status -sb
git log -1 --oneline
