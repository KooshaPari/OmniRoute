@echo off
cd /d C:\Users\koosh\OmniRoute-main-snap
git branch --show-current
gh pr view 433 --repo KooshaPari/OmniRoute --json state,mergeable,mergeStateStatus,url,title
echo ---CHECKS---
gh pr checks 433 --repo KooshaPari/OmniRoute
