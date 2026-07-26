@echo off
cd /d C:\Users\koosh\OmniRoute-main-snap
gh pr merge 454 --repo KooshaPari/OmniRoute --merge --admin
gh issue close 392 --repo KooshaPari/OmniRoute --comment "Closed: #449 auth/CORS/tRPC, #453 KBridge, #433 Electrobun gate, #454 origin sweep + Bun package gate. Shell integrity acceptance met for RC-A11."
