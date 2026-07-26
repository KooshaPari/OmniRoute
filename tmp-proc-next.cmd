@echo off
cd /d C:\Users\koosh\OmniRoute-main-snap
git branch --show-current
echo ===433===
gh pr view 433 --repo KooshaPari/OmniRoute --json state,mergeable,mergeStateStatus,url,title
echo ===449===
gh pr view 449 --repo KooshaPari/OmniRoute --json state,mergeable,mergeStateStatus,url,title
echo ===CHECKS433===
gh pr checks 433 --repo KooshaPari/OmniRoute 2>&1 | findstr /i "Electron Build Lint check pass fail skip"
echo ===CHECKS449===
gh pr checks 449 --repo KooshaPari/OmniRoute 2>&1 | findstr /i "Build Lint Electron pass fail skip pending"
