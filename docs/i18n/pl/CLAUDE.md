# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Quick Start

```bash
npm install                    # Install deps (auto-generates .env from .env.example)
npm run dev                    # Dev server at http://localhost:20128
npm run build                  # Production build (Next.js 16 standalone)
npm run lint                   # ESLint (0 errors expected; warnings are pre-existing)
npm run typecheck:core         # TypeScript check (should be clean)
npm run typecheck:noimplicit:core  # Strict check (no implicit any)
npm run test:coverage          # Unit tests + coverage gate (60/60/60/60 — statements/lines/functions/branches)
npm run check                  # lint + test combined
npm run check:cycles           # Detect circular dependencies
```

### Running Tests

```bash
# Single test file (Node.js native test runner — most tests)
node --import tsx/esm --test tests/unit/your-file.test.ts

# Vitest (MCP server, autoCombo, cache)
npm run test:vitest

# All suites
npm run test:all
```

For full test matrix, see `CONTRIBUTING.md` → "Running Tests". For deep architecture, see `AGENTS.md`.

---

## Project at a Glance

**OmniRoute** — unified AI proxy/router. One endpoint, 329 provider catalog entries, auto-fallback when an upstream route is available.

| Layer         | Location                | Purpose                                                                   |
| ------------- | ----------------------- | ------------------------------------------------------------------------- |
| API Routes    | `src/app/api/v1/`       | Next.js App Router — entry points                                         |
| Handlers      | `open-sse/handlers/`    | Request processing (chat, embeddings, etc)                                |
| Executors     | `open-sse/executors/`   | Provider-specific HTTP dispatch                                           |
| Translators   | `open-sse/translator/`  | Format conversion (OpenAI↔Claude↔Gemini)                                  |
| Transformer   | `open-sse/transformer/` | Responses API ↔ Chat Completions                                          |
| Services      | `open-sse/services/`    | Combo routing, rate limits, caching, etc                                  |
| Database      | `src/lib/db/`           | 110 top-level SQLite domain modules, 130 migrations                       |
| Domain/Policy | `src/domain/`           | Policy engine, cost rules, fallback logic                                 |
| MCP Server    | `open-sse/mcp-server/`  | 107 unique tools, 3 transports (stdio / SSE / Streamable HTTP), 32 scopes |
| A2A Server    | `src/lib/a2a/`          | JSON-RPC 2.0 agent protocol                                               |
| Skills        | `src/lib/skills/`       | Extensible skill framework                                                |
| Memory        | `src/lib/memory/`       | Persistent conversational memory                                          |

Monorepo: `src/` (Next.js 16 app), `open-sse/` (streaming engine workspace), `apps/desktop/` (desktop app), `tests/`, `bin/` (CLI entry point).

---

## Request Pipeline

```
Client → /v1/chat/completions (Next.js route)
  → CORS → Zod validation → auth? → policy check → prompt injection guard
  → handleChatCore() [open-sse/handlers/chatCore.ts]
    → cache check → rate limit → combo routing?
      → resolveComboTargets() → handleSingleModel() per target
    → translateRequest() → getExecutor() → executor.execute()
      → fetch() upstream → retry w/ backoff
    → response translation → SSE stream or JSON
    → If Responses API: responsesTransformer.ts TransformStream
```

API routes follow a consistent pattern: `Route → CORS preflight → Zod body validation → Optional auth (extractApiKey/isValidApiKey) → API key policy enforcement → Handler delegation (open-sse)`. No global Next.js middleware — interception is route-specific.

**Combo routing** (`open-sse/services/combo.ts`): 19 public strategies (priority, weighted, fill-first, round-robin, p2c, random, least-used, cost-optimized, reset-aware, reset-window, headroom, strict-random, auto, lkgp, context-optimized, cache-optimized, context-relay, fusion, pipeline). Each target calls `handleSingleModel()` which wraps `handleChatCore()` with per-target error handling and circuit breaker checks. The `fusion` strategy is the exception: it fans out to a panel of models in parallel, then a judge model synthesizes one final answer (`open-sse/services/fusion.ts`). See `docs/routing/AUTO-COMBO.md` for the 13-factor Auto-Combo scoring + the full strategy table and `docs/architecture/RESILIENCE_GUIDE.md` for the 3 resilience layers.

---

## Worktree isolation — Claude Code specifics

The full mandatory worktree protocol (base-branch confirmation, `.claude/worktrees/` canonical
path, `cp -al` node_modules, teardown rules) is in `AGENTS.md` → Git Workflow → "Worktree
isolation". Claude-Code-specific points:

- Confirm the base branch with the operator via `AskUserQuestion` (Hard Rule #19) unless they
  already told you.
- Prefer the native `EnterWorktree` tool — it already creates worktrees under
  `.claude/worktrees/` (the canonical path). Create the worktree with the documented `git
worktree add` command, then call `EnterWorktree` with its `path`.

## Cross-session safety — Claude Code specifics

Hard Rules #19/#21/#22 (in `AGENTS.md`) govern parallel sessions. Operational reminders for this
harness:

- **Replicate the `git stash` ban verbatim in the prompt of every subagent that touches git**
  (Agent tool / Workflow scripts) — subagents do not inherit this file, and the recorded
  recurrence of the stash incident came through a subagent.
- Before merging or pushing to any PR you did not create _this session_, run `git worktree list`
  and re-check `gh pr view <N> --json state,headRefOid` (Hard Rule #22b).
- End every session with the main checkout on the branch it started on.

## Superpowers / planning artifacts — path overrides

The `_tasks/` convention is defined in `AGENTS.md` → "Planning & Research Artifacts". The
superpowers skills ship with defaults that point at `docs/…` — those defaults are **overridden
here**. When a superpowers skill announces a path like "saved to `docs/superpowers/plans/…`",
rewrite it to the `_tasks/…` equivalent before writing:

| Artifact (skill)                   | Default (do NOT use)      | Save here instead                                             |
| ---------------------------------- | ------------------------- | ------------------------------------------------------------- |
| Plans (`writing-plans`)            | `docs/superpowers/plans/` | `_tasks/superpowers/plans/YYYY-MM-DD-<feature>.md`            |
| Specs / design (`brainstorming`)   | `docs/superpowers/specs/` | `_tasks/superpowers/specs/YYYY-MM-DD-<topic>-design.md`       |
| Research (`deep-research`, ad-hoc) | `docs/research/`          | `_tasks/research/…`                                           |
| Hand-offs (`/handoff`)             | —                         | `_tasks/hands-off/<YYYY-MM-DD>_<branch>_v<versão>_sess-<id>/` |

Commit those artifacts inside the `_tasks/` repo (`git -C _tasks …`), never in the main repo.

## Scratch / temporary files — use `_artifacts/`, not `/tmp`

This project overrides the harness's default session scratchpad (`/tmp/claude-*/…`). Write
temporary/working files — exports, generated zips, one-off intermediate outputs, anything you'd
otherwise put in `/tmp` — to `/home/diegosouzapw/dev/proxys/OmniRoute/_artifacts/` instead.

- `_artifacts/` is a root `_*` path: already gitignored (`AGENTS.md` → "Root `_*` paths"), lives
  on disk only, never tracked.
- Reason: keeping scratch output inside the project (vs `/tmp`) makes it trivial for the operator
  to find and delete everything temporary in one place, instead of hunting across ephemeral
  session-specific `/tmp` directories that vanish or accumulate untracked.
- Do **not** confuse this with `_tasks/` (Hard Rule #23, its own private git repo for durable
  plans/specs/research/hand-offs) — `_artifacts/` is for disposable working files only, nothing
  here needs to survive or be versioned.

## Base-green before opening PRs

Before cutting a branch or opening a PR, run the base-green check (`AGENTS.md` → Git Workflow →
"Base-green check"; project skills reference it as `.agents/skills/_shared/base-green.md`). A PR
opened while the base tip is red must carry `⚠️ base-red inherited: #<issue>` in its body. To
drain an accumulated red state (base tip + red PRs), use the `/sweep-reds` skill.
