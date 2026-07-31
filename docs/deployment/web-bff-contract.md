# Web-to-BFF deployment contract

Public SvelteKit web deployments require `PUBLIC_OMNIROUTE_BFF_URL` to contain the HTTPS origin of the separately deployed BFF. The value is public configuration, not a credential; browser requests use session authentication and must never receive `BFF_API_KEY`.

Desktop packaging injects the same public origin after it starts the local BFF. Vite development on port `4321` defaults to `http://localhost:4322` for the local pair only.

If the value is absent in a public deployment, the web UI displays an explicit configuration alert. Same-origin `/api/auth/*`, `/api/dashboard/*`, and `/api/trpc/*` requests return HTTP 503 with `BFF_NOT_CONFIGURED`; they must not be interpreted as a deployed BFF or silently return 404.

Deploy the BFF independently with `BFF_CORS_ORIGINS` containing the web origin and production `BFF_API_KEY` configured server-side. Do not deploy SQLite state, provider credentials, browser automation, or native device workers to Vercel.
