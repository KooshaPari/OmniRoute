@echo off
cd /d C:\Users\koosh\OmniRoute-main-snap
git push -u origin HEAD
gh pr create --repo KooshaPari/OmniRoute --base main --head fix/v4-kbridge-deadline-inflight-392 --title "fix(v4/#392): KBridge inflight-before-write, deadlines, Win pipes" --body-file tmp-pr-kbridge-body.md
