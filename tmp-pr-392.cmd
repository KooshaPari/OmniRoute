@echo off
cd /d C:\Users\koosh\OmniRoute-main-snap
git push -u origin HEAD
gh pr create --repo KooshaPari/OmniRoute --base main --head fix/v4-shell-auth-origin-trpc-392 --title "fix(v4/#392): cookie trust, CORS allowlist, honest tRPC" --body-file tmp-pr-392-body.md
