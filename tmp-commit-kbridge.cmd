@echo off
cd /d C:\Users\koosh\OmniRoute-main-snap
set LEFTHOOK_EXCLUDE=editorconfig,secret-scan,prettier-markdown
git add apps/bff/src/kbridge/client.ts apps/bff/src/kbridge/client.test.ts
git status -sb
git commit -m "fix(v4/#392): KBridge inflight-before-write, deadlines, Win pipes" -m "Register inflight waiters before socket write, enforce KBRIDGE_TIMEOUT_MS / AbortSignal, and document Windows named-pipe transport via OMNIROUTE_GATEWAY_SOCKET."
git log -1 --oneline
