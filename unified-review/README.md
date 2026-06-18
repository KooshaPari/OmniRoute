# Unified Review

> Single unified AI code review surface across Copilot, CodeRabbit, Cursor, Forge (OmniRoute), and KiloCode — queue-managed, not replaced.

## What this is

A GitHub App that sits in front of multiple AI code review tools and:

1. **Picks one tool per PR** (sticky for the PR's lifetime) using a quota-aware weighted random selector.
2. **Routes incremental reviews** to the same tool on each new commit, computing delta diffs.
3. **Normalizes findings** to a P0–P3 severity scale, deduplicates by `(file, line, message)`.
4. **Posts a single Check Run** to GitHub on behalf of whichever tool was selected — so users see one voice, not five.
5. **Never replaces** the existing tools; it coordinates them. Add as many as you like.

## Architecture

```
PR event → GitHub App webhook → Random Selector → Quota check → Tool Adapter
   → normalize → dedupe → postCheckRun (single voice)
```

## Setup

```bash
cp .env.example .env.local
# Fill in GITHUB_APP_ID, GITHUB_PRIVATE_KEY, GITHUB_WEBHOOK_SECRET

npm install
npm run dev
```

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api` | Service info |
| `GET` | `/api/health` | Live quota status |
| `POST` | `/api/webhook` | GitHub webhook receiver |
| `POST` | `/api/review` | Manually trigger a review |

## Adding a new reviewer

1. Add a config entry to `loadConfig()` in `src/lib/config.ts`.
2. Add the tool name to `Tool` enum in `src/lib/types.ts`.
3. Create an adapter in `src/lib/adapters/`.
4. Register in `src/lib/adapters/index.ts`.

That's it — the selector, quota manager, and poster pick it up automatically.

## Free tiers / throughput padding

The system is designed to rotate between paid and free-tier tools to maximize throughput. KiloCode (free), Forge (local, only your own API costs), and CodeQL (GAS-included) all run at zero or near-zero cost. The selector biases toward the highest-remaining-quota tool, so when a paid tier runs out, free tools absorb the load automatically.

## File map

```
src/
  app/
    layout.tsx              — Next.js root
    page.tsx                — Dashboard
    api/
      route.ts              — GET /api
      webhook/route.ts      — POST /api/webhook
      health/route.ts       — GET /api/health
      review/route.ts       — POST /api/review (manual)
  lib/
    types.ts                — Shared types + Zod schemas
    config.ts               — Tool config loader
    selector.ts             — Sticky random tool selector
    quota.ts                — Redis-backed rate limiter
    aggregator.ts           — Severity normalization + dedup
    poster.ts               — GitHub Check Run / PR Review poster
    engine.ts               — Orchestrator
    github.ts               — Octokit helpers (App auth, diff, labels)
    adapters/
      base.ts               — Adapter base class
      forge.ts              — Forge Code via OmniRoute
      cloud.ts              — Copilot, CodeRabbit, Cursor, KiloCode
    __tests__/
      unified.test.ts       — Core logic tests
```

## Tests

```bash
npm test
```
