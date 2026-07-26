@echo off
cd /d C:\Users\koosh\OmniRoute-main-snap
echo ===MERGE433===
gh pr merge 433 --repo KooshaPari/OmniRoute --merge --admin
echo ===MERGE449===
gh pr merge 449 --repo KooshaPari/OmniRoute --merge --admin
echo ===MERGE453===
gh pr merge 453 --repo KooshaPari/OmniRoute --merge --admin
echo ===STATES===
gh pr view 433 --repo KooshaPari/OmniRoute --json state,mergedAt,url
gh pr view 449 --repo KooshaPari/OmniRoute --json state,mergedAt,url
gh pr view 453 --repo KooshaPari/OmniRoute --json state,mergedAt,url
