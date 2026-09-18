# CLAUDE.md (Magyar)

🌐 **Languages:** 🇺🇸 [English](../../../CLAUDE.md) · 🇸🇦 [ar](../ar/CLAUDE.md) · 🇦🇿 [az](../az/CLAUDE.md) · 🇧🇬 [bg](../bg/CLAUDE.md) · 🇧🇩 [bn](../bn/CLAUDE.md) · 🇨🇿 [cs](../cs/CLAUDE.md) · 🇩🇰 [da](../da/CLAUDE.md) · 🇩🇪 [de](../de/CLAUDE.md) · 🇬🇷 [el](../el/CLAUDE.md) · 🇪🇸 [es](../es/CLAUDE.md) · 🇪🇪 [et](../et/CLAUDE.md) · 🇮🇷 [fa](../fa/CLAUDE.md) · 🇫🇮 [fi](../fi/CLAUDE.md) · 🇫🇷 [fr](../fr/CLAUDE.md) · 🇮🇪 [ga](../ga/CLAUDE.md) · 🇮🇳 [gu](../gu/CLAUDE.md) · 🇮🇱 [he](../he/CLAUDE.md) · 🇮🇳 [hi](../hi/CLAUDE.md) · 🇭🇷 [hr](../hr/CLAUDE.md) · 🇮🇩 [id](../id/CLAUDE.md) · 🇮🇹 [it](../it/CLAUDE.md) · 🇯🇵 [ja](../ja/CLAUDE.md) · 🇰🇷 [ko](../ko/CLAUDE.md) · 🇱🇹 [lt](../lt/CLAUDE.md) · 🇱🇻 [lv](../lv/CLAUDE.md) · 🇮🇳 [mr](../mr/CLAUDE.md) · 🇲🇾 [ms](../ms/CLAUDE.md) · 🇲🇹 [mt](../mt/CLAUDE.md) · 🇳🇱 [nl](../nl/CLAUDE.md) · 🇳🇴 [no](../no/CLAUDE.md) · 🇵🇭 [phi](../phi/CLAUDE.md) · 🇵🇱 [pl](../pl/CLAUDE.md) · 🇵🇹 [pt](../pt/CLAUDE.md) · 🇧🇷 [pt-BR](../pt-BR/CLAUDE.md) · 🇷🇴 [ro](../ro/CLAUDE.md) · 🇷🇺 [ru](../ru/CLAUDE.md) · 🇸🇰 [sk](../sk/CLAUDE.md) · 🇸🇮 [sl](../sl/CLAUDE.md) · 🇷🇸 [sr](../sr/CLAUDE.md) · 🇸🇪 [sv](../sv/CLAUDE.md) · 🇰🇪 [sw](../sw/CLAUDE.md) · 🇮🇳 [ta](../ta/CLAUDE.md) · 🇮🇳 [te](../te/CLAUDE.md) · 🇹🇭 [th](../th/CLAUDE.md) · 🇹🇷 [tr](../tr/CLAUDE.md) · 🇺🇦 [uk-UA](../uk-UA/CLAUDE.md) · 🇵🇰 [ur](../ur/CLAUDE.md) · 🇻🇳 [vi](../vi/CLAUDE.md) · 🇨🇳 [zh-CN](../zh-CN/CLAUDE.md) · 🇹🇼 [zh-TW](../zh-TW/CLAUDE.md)

---

Ez a fájl útmutatást nyújt a Claude Code (claude.ai/code) számára, amikor a kóddal dolgozik ebben a tárolóban.

## Gyors kezdés

```bash
npm install                    # Függőségek telepítése (automatikusan generálja a .env fájlt a .env.example-ból)
npm run dev                    # Fejlesztői szerver a http://localhost:20128 címen
npm run build                  # Termelési build (Next.js 16 önálló)
npm run lint                   # ESLint (0 hiba várható; figyelmeztetések már meglévők)
npm run typecheck:core         # TypeScript ellenőrzés (tiszta kell legyen)
npm run typecheck:noimplicit:core  # Szigorú ellenőrzés (nincs implicit any)
npm run test:coverage          # Egységtesztek + lefedettségi küszöb (75/75/75/70 — állítások/sorok/funkciók/ágak)
npm run check                  # lint + teszt kombinálva
npm run check:cycles           # Körkörös függőségek észlelése
```

### Tesztek futtatása

```bash
# Egyetlen tesztfájl (Node.js natív tesztfuttató — a legtöbb teszt)
node --import tsx/esm --test tests/unit/your-file.test.ts

# Vitest (MCP szerver, autoCombo, cache)
npm run test:vitest

# Minden tesztcsomag
npm run test:all
```

A teljes tesztmátrixért lásd a `CONTRIBUTING.md` → "Tesztek futtatása" részt. A mély architektúráért lásd az `AGENTS.md`-t.

---

## Projekt áttekintése

**OmniRoute** — egységes AI proxy/router. Egy végpont, 329 LLM szolgáltató, automatikus visszaesés.

| Réteg          | Helyszín                | Cél                                                                       |
| -------------- | ----------------------- | ------------------------------------------------------------------------- |
| API Útvonalak  | `src/app/api/v1/`       | Next.js App Router — belépési pontok                                      |
| Kezelők        | `open-sse/handlers/`    | Kérés feldolgozás (chat, beágyazások, stb.)                               |
| Végrehajtók    | `open-sse/executors/`   | Szolgáltató-specifikus HTTP küldés                                        |
| Fordítók       | `open-sse/translator/`  | Formátum átalakítás (OpenAI↔Claude↔Gemini)                                |
| Átalakító      | `open-sse/transformer/` | Válaszok API ↔ Chat Befejezések                                           |
| Szolgáltatások | `open-sse/services/`    | Kombinált útvonalak, sebességkorlátok, gyorsítótárazás, stb.              |
| Adatbázis      | `src/lib/db/`           | 110 top-level SQLite domain modules, 130 migrations                       |
| Domain/Szabály | `src/domain/`           | Szabálymotor, költségszabályok, visszaesési logika                        |
| MCP Szerver    | `open-sse/mcp-server/`  | 107 unique tools, 3 transports (stdio / SSE / Streamable HTTP), 32 scopes |
| A2A Szerver    | `src/lib/a2a/`          | JSON-RPC 2.0 ügynök protokoll                                             |
| Készségek      | `src/lib/skills/`       | Kiterjeszthető készségkeretrendszer                                       |
| Memória        | `src/lib/memory/`       | Tartós beszélgetési memória                                               |

Monorepo: `src/` (Next.js 16 alkalmazás), `open-sse/` (streaming engine munkaterület), `apps/desktop/` (asztali alkalmazás), `tests/`, `bin/` (CLI belépési pont).

## Kérés Pipeline

```
Client → /v1/chat/completions (Next.js útvonal)
  → CORS → Zod validáció → auth? → irányelv ellenőrzés → prompt injekció védelem
  → handleChatCore() [open-sse/handlers/chatCore.ts]
    → cache ellenőrzés → sebességkorlátozás → combo routing?
      → resolveComboTargets() → handleSingleModel() célonként
    → translateRequest() → getExecutor() → executor.execute()
      → fetch() upstream → újrapróbálkozás visszatartással
    → válasz fordítás → SSE stream vagy JSON
    → Ha Responses API: responsesTransformer.ts TransformStream
```

Az API útvonalak következetes mintát követnek: `Útvonal → CORS előzetes ellenőrzés → Zod testtartalom validáció → Opcionális auth (extractApiKey/isValidApiKey) → API kulcs irányelv érvényesítése → Handler delegálás (open-sse)`. Nincs globális Next.js middleware — az elfogás útvonal-specifikus.

**Combo routing** (`open-sse/services/combo.ts`): 19 public strategies (priority, weighted, fill-first, round-robin, p2c, random, least-used, cost-optimized, reset-aware, reset-window, headroom, strict-random, auto, lkgp, context-optimized, cache-optimized, context-relay, fusion, pipeline). Each target calls `handleSingleModel()`, which wraps `handleChatCore()` with per-target error handling and circuit-breaker checks. See `docs/routing/AUTO-COMBO.md` for the 13-factor Auto-Combo scoring and `docs/architecture/RESILIENCE_GUIDE.md` for the 3 resilience layers.

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
