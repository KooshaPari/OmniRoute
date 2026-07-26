@echo off
cd /d C:\Users\koosh\OmniRoute-main-snap
set LEFTHOOK_EXCLUDE=editorconfig,secret-scan,prettier-markdown
git add apps/bff/src/cors-origins.ts apps/bff/src/cors-origins.test.ts apps/bff/src/middleware/auth.ts apps/bff/src/index.ts apps/bff/src/trpc/router.ts apps/bff/src/security-boundary.test.ts apps/bff/src/index.test.ts apps/web/src/lib/bff-origin.ts apps/web/src/lib/api/client.ts apps/web/src/lib/trpc/client.ts apps/web/src/routes/login/+page.svelte apps/web/src/routes/callback/+page.svelte
git status -sb
git commit -m "fix(v4/#392): cookie trust, CORS allowlist, honest tRPC" -m "Production browser path accepts session cookies without embedding BFF_API_KEY; CORS uses BFF_CORS_ORIGINS; login/callback/clients share bffBaseUrl; non-persistent tRPC mutations return unavailable."
git log -1 --oneline
