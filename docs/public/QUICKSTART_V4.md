---
title: v4 local Quickstart
audience: user
status: reviewed-source
sourceOfTruth:
  - apps/web/package.json
  - apps/bff/package.json
  - apps/bff/src/index.ts
  - apps/web/src/routes/+page.svelte
  - tests/e2e/smoke.spec.ts
---

# Run the v4 web app and BFF locally

This Quickstart proves only the current local web shell, BFF health route, and anonymous home page. It does not configure a provider, claim an external deployment, or test an authenticated API request.

## Prerequisites

- Git
- Bun 1.3.14, matching the current v4 CI pin
- A shell that supports POSIX-style environment assignment for the BFF command below
- local ports 4321 and 4322 available

## 1. Get a clean checkout

```sh
git clone https://github.com/KooshaPari/OmniRoute.git
cd OmniRoute
git switch main
```

Confirm that the worktree is clean before continuing:

```sh
git status --short
```

The command should print nothing.

## 2. Install the locked v4 dependencies

```sh
bun install --frozen-lockfile --cwd packages/api-contracts --ignore-scripts
bun install --frozen-lockfile --cwd apps/bff --ignore-scripts
bun install --frozen-lockfile --cwd apps/web --ignore-scripts
```

These are the package-local install forms used by the current v4 CI. This Quickstart does not require provider credentials.

## 3. Start the BFF

In terminal 1:

```sh
PORT=4322 bun run --cwd apps/bff start
```

Verify the implemented health route:

```sh
curl --fail --silent http://localhost:4322/healthz
```

The JSON response has `status` equal to `ok` and `service` equal to `argismonitor-bff`.

## 4. Start the web app

In terminal 2:

```sh
bun run --cwd apps/web dev
```

The current web package pins its development server to port 4321.

## 5. Run the anonymous home smoke

In terminal 3:

```sh
curl --fail --silent http://localhost:4321/ | grep -F "Welcome to argismonitor v4"
```

You can also open <http://localhost:4321/>. The first heading is `Welcome to argismonitor v4`, and the BFF health panel should become `healthy` after the browser reaches the local health route.

The checked-in `tests/e2e/smoke.spec.ts` asserts the same `Welcome to argismonitor v4` heading as the implemented route and this Quickstart.

## 6. Teardown

Press `Ctrl+C` in the web and BFF terminals. Then verify that both local listeners are gone:

```sh
curl --fail http://localhost:4321/ || true
curl --fail http://localhost:4322/healthz || true
```

Both requests should fail after teardown.

## Troubleshooting

### Port 4321 is already in use

Stop the existing process using port 4321. Do not change the port for this smoke: the package script and BFF CORS configuration explicitly use `http://localhost:4321`.

### The page loads but BFF health says unreachable

Confirm that terminal 1 is still running with `PORT=4322`, then retry:

```sh
curl --fail --silent http://localhost:4322/healthz
```

The home source fetches that exact URL.

### Install fails with a frozen-lockfile error

Do not remove `--frozen-lockfile` or regenerate locks as part of the Quickstart. Confirm you are on current `main` with a clean worktree and retry. A lock mismatch is a repository state problem that should be reported rather than silently rewritten.

## Provenance validation

Run:

```sh
node scripts/docs/validate-v4-quickstart.mjs
```

The validator checks the documented package commands, ports, health route/response, home heading, and smoke-test heading against current source.
