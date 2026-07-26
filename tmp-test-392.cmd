@echo off
cd /d C:\Users\koosh\OmniRoute-main-snap\apps\bff
bunx vitest run src/index.test.ts src/security-boundary.test.ts src/cors-origins.test.ts
