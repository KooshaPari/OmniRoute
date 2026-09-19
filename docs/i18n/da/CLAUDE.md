# CLAUDE.md (Dansk)

**Languages:** [English](../../../CLAUDE.md) · [ar](../ar/CLAUDE.md) · [az](../az/CLAUDE.md) · [bg](../bg/CLAUDE.md) · [bn](../bn/CLAUDE.md) · [cs](../cs/CLAUDE.md) · [de](../de/CLAUDE.md) · [el](../el/CLAUDE.md) · [es](../es/CLAUDE.md) · [et](../et/CLAUDE.md) · [fa](../fa/CLAUDE.md) · [fi](../fi/CLAUDE.md) · [fr](../fr/CLAUDE.md) · [ga](../ga/CLAUDE.md) · [gu](../gu/CLAUDE.md) · [he](../he/CLAUDE.md) · [hi](../hi/CLAUDE.md) · [hr](../hr/CLAUDE.md) · [hu](../hu/CLAUDE.md) · [id](../id/CLAUDE.md) · [it](../it/CLAUDE.md) · [ja](../ja/CLAUDE.md) · [ko](../ko/CLAUDE.md) · [lt](../lt/CLAUDE.md) · [lv](../lv/CLAUDE.md) · [mr](../mr/CLAUDE.md) · [ms](../ms/CLAUDE.md) · [mt](../mt/CLAUDE.md) · [nl](../nl/CLAUDE.md) · [no](../no/CLAUDE.md) · [phi](../phi/CLAUDE.md) · [pl](../pl/CLAUDE.md) · [pt](../pt/CLAUDE.md) · [pt-BR](../pt-BR/CLAUDE.md) · [ro](../ro/CLAUDE.md) · [ru](../ru/CLAUDE.md) · [sk](../sk/CLAUDE.md) · [sl](../sl/CLAUDE.md) · [sr](../sr/CLAUDE.md) · [sv](../sv/CLAUDE.md) · [sw](../sw/CLAUDE.md) · [ta](../ta/CLAUDE.md) · [te](../te/CLAUDE.md) · [th](../th/CLAUDE.md) · [tr](../tr/CLAUDE.md) · [uk-UA](../uk-UA/CLAUDE.md) · [ur](../ur/CLAUDE.md) · [vi](../vi/CLAUDE.md) · [zh-CN](../zh-CN/CLAUDE.md) · [zh-TW](../zh-TW/CLAUDE.md)

---

Denne fil giver vejledning til Claude Code (claude.ai/code) når der arbejdes med kode i dette repository.

## Hurtig Start

```bash
npm install                    # Installer afhængigheder (auto-genererer .env fra .env.example)
npm run dev                    # Dev server på http://localhost:20128
npm run build                  # Produktionsbygning (Next.js 16 standalone)
npm run lint                   # ESLint (0 fejl forventet; advarsler er forudgående)
npm run typecheck:core         # TypeScript tjek (skal være rent)
npm run typecheck:noimplicit:core  # Streng tjek (ingen implicit any)
npm run test:coverage          # Enhedstest + dækning gate (75/75/75/70 — udsagn/linjer/funktioner/grene)
npm run check                  # lint + test kombineret
npm run check:cycles           # Registrer cirkulære afhængigheder
```

### Kørsel af Tests

```bash
# Enkelt testfil (Node.js native test runner — de fleste tests)
node --import tsx/esm --test tests/unit/your-file.test.ts

# Vitest (MCP server, autoCombo, cache)
npm run test:vitest

# Alle sæt
npm run test:all
```

For fuld testmatrix, se `CONTRIBUTING.md` → "Kørsel af Tests". For dyb arkitektur, se `AGENTS.md`.

---

## Projektet i Et Overblik

**OmniRoute** — samlet AI proxy/router. Én endpoint, 329 LLM udbydere, auto-fallback.

| Lag            | Placering               | Formål                                                                    |
| -------------- | ----------------------- | ------------------------------------------------------------------------- |
| API Ruter      | `src/app/api/v1/`       | Next.js App Router — indgangspunkt                                        |
| Handlere       | `open-sse/handlers/`    | Anmodningsbehandling (chat, indlejring, osv.)                             |
| Udførere       | `open-sse/executors/`   | Udbyder-specifik HTTP dispatch                                            |
| Oversættere    | `open-sse/translator/`  | Format konvertering (OpenAI↔Claude↔Gemini)                                |
| Transformer    | `open-sse/transformer/` | Svar API ↔ Chat Fuldførelser                                              |
| Tjenester      | `open-sse/services/`    | Combo routing, hastighedsbegrænsninger, caching, osv.                     |
| Database       | `src/lib/db/`           | 110 top-level SQLite domain modules, 130 migrations                       |
| Domæne/Politik | `src/domain/`           | Politisk motor, omkostningsregler, fallback logik                         |
| MCP Server     | `open-sse/mcp-server/`  | 107 unique tools, 3 transports (stdio / SSE / Streamable HTTP), 32 scopes |
| A2A Server     | `src/lib/a2a/`          | JSON-RPC 2.0 agentprotokol                                                |
| Færdigheder    | `src/lib/skills/`       | Udvidelig færdighedsramme                                                 |
| Hukommelse     | `src/lib/memory/`       | Vedholdende samtalehukommelse                                             |

Monorepo: `src/` (Next.js 16 app), `open-sse/` (streaming engine arbejdsområde), `apps/desktop/` (desktop app), `tests/`, `bin/` (CLI indgangspunkt).

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
opened while the base tip is red must carry ` base-red inherited: #<issue>` in its body. To
drain an accumulated red state (base tip + red PRs), use the `/sweep-reds` skill.
