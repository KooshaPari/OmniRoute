# CLAUDE.md (Suomi)

**Languages:** [English](../../../CLAUDE.md) · [ar](../ar/CLAUDE.md) · [az](../az/CLAUDE.md) · [bg](../bg/CLAUDE.md) · [bn](../bn/CLAUDE.md) · [cs](../cs/CLAUDE.md) · [da](../da/CLAUDE.md) · [de](../de/CLAUDE.md) · [el](../el/CLAUDE.md) · [es](../es/CLAUDE.md) · [et](../et/CLAUDE.md) · [fa](../fa/CLAUDE.md) · [fr](../fr/CLAUDE.md) · [ga](../ga/CLAUDE.md) · [gu](../gu/CLAUDE.md) · [he](../he/CLAUDE.md) · [hi](../hi/CLAUDE.md) · [hr](../hr/CLAUDE.md) · [hu](../hu/CLAUDE.md) · [id](../id/CLAUDE.md) · [it](../it/CLAUDE.md) · [ja](../ja/CLAUDE.md) · [ko](../ko/CLAUDE.md) · [lt](../lt/CLAUDE.md) · [lv](../lv/CLAUDE.md) · [mr](../mr/CLAUDE.md) · [ms](../ms/CLAUDE.md) · [mt](../mt/CLAUDE.md) · [nl](../nl/CLAUDE.md) · [no](../no/CLAUDE.md) · [phi](../phi/CLAUDE.md) · [pl](../pl/CLAUDE.md) · [pt](../pt/CLAUDE.md) · [pt-BR](../pt-BR/CLAUDE.md) · [ro](../ro/CLAUDE.md) · [ru](../ru/CLAUDE.md) · [sk](../sk/CLAUDE.md) · [sl](../sl/CLAUDE.md) · [sr](../sr/CLAUDE.md) · [sv](../sv/CLAUDE.md) · [sw](../sw/CLAUDE.md) · [ta](../ta/CLAUDE.md) · [te](../te/CLAUDE.md) · [th](../th/CLAUDE.md) · [tr](../tr/CLAUDE.md) · [uk-UA](../uk-UA/CLAUDE.md) · [ur](../ur/CLAUDE.md) · [vi](../vi/CLAUDE.md) · [zh-CN](../zh-CN/CLAUDE.md) · [zh-TW](../zh-TW/CLAUDE.md)

---

Tämä tiedosto tarjoaa ohjeita Claude Code (claude.ai/code) käytettäessä koodia tässä repositoriossa.

## Nopeasti alkuun

```bash
npm install                    # Asenna riippuvuudet (automaattisesti luo .env .env.example:sta)
npm run dev                    # Kehityspalvelin osoitteessa http://localhost:20128
npm run build                  # Tuotantorakennus (Next.js 16 standalone)
npm run lint                   # ESLint (0 virhettä odotettavissa; varoitukset ovat ennestään olemassa)
npm run typecheck:core         # TypeScript-tarkistus (pitäisi olla puhdas)
npm run typecheck:noimplicit:core  # Tiukka tarkistus (ei implisiittistä any)
npm run test:coverage          # Yksikkötestit + kattavuusportti (75/75/75/70 — lauseet/rivit/funktiot/haarat)
npm run check                  # lint + test yhdistettynä
npm run check:cycles           # Havaitse sykliset riippuvuudet
```

### Testien suorittaminen

```bash
# Yksittäinen testitiedosto (Node.js:n natiivinen testirunner — suurin osa testeistä)
node --import tsx/esm --test tests/unit/your-file.test.ts

# Vitest (MCP-palvelin, autoCombo, välimuisti)
npm run test:vitest

# Kaikki testisarjat
npm run test:all
```

Koko testimatriisin näkemiseksi katso `CONTRIBUTING.md` → "Testien suorittaminen". Syvällistä arkkitehtuuria varten katso `AGENTS.md`.

---

## Projekti lyhyesti

**OmniRoute** — yhtenäinen AI-proxy/reititin. Yksi päätepiste, 329 LLM-toimittajaa, automaattinen varajärjestelmä.

| Kerros          | Sijainti                | Tarkoitus                                                                 |
| --------------- | ----------------------- | ------------------------------------------------------------------------- |
| API-reitit      | `src/app/api/v1/`       | Next.js App Router — sisäänkäynnit                                        |
| Käsittelijät    | `open-sse/handlers/`    | Pyyntöjen käsittely (keskustelu, upotukset jne.)                          |
| Suorittajat     | `open-sse/executors/`   | Toimittajakohtainen HTTP-jakelu                                           |
| Kääntäjät       | `open-sse/translator/`  | Muotojen muunnos (OpenAI↔Claude↔Gemini)                                   |
| Muuntaja        | `open-sse/transformer/` | Vastaukset API ↔ Keskustelun täydentäminen                                |
| Palvelut        | `open-sse/services/`    | Combo-reititys, nopeusrajoitukset, välimuisti jne.                        |
| Tietokanta      | `src/lib/db/`           | 110 top-level SQLite domain modules, 130 migrations                       |
| Alue/Politiikka | `src/domain/`           | Politiikkamoottori, kustannussäännöt, varajärjestelmä                     |
| MCP-palvelin    | `open-sse/mcp-server/`  | 107 unique tools, 3 transports (stdio / SSE / Streamable HTTP), 32 scopes |
| A2A-palvelin    | `src/lib/a2a/`          | JSON-RPC 2.0 agenttiprotokolla                                            |
| Taidot          | `src/lib/skills/`       | Laajennettavissa oleva taitokehys                                         |
| Muisti          | `src/lib/memory/`       | Kestävä keskustelumuisti                                                  |

Monorepo: `src/` (Next.js 16 -sovellus), `open-sse/` (suoratoistoalustatyötila), `apps/desktop/` (työpöytäsovellus), `tests/`, `bin/` (CLI-sisäänkäynti).

## Pyyntöputki

```
Asiakas → /v1/chat/completions (Next.js-reitti)
  → CORS → Zod-validointi → auth? → politiikan tarkistus → kehotteen injektoinnin suoja
  → handleChatCore() [open-sse/handlers/chatCore.ts]
    → välimuistin tarkistus → nopeusrajoitus → yhdistelmäreittaus?
      → resolveComboTargets() → handleSingleModel() per kohde
    → translateRequest() → getExecutor() → executor.execute()
      → fetch() upstream → yritä uudelleen w/ backoff
    → vastausten käännös → SSE-virta tai JSON
    → Jos Responses API: responsesTransformer.ts TransformStream
```

API-reitit noudattavat johdonmukaista kaavaa: `Reitti → CORS-esivalmistelu → Zod-kehon validointi → Valinnainen auth (extractApiKey/isValidApiKey) → API-avaimen politiikan täytäntöönpano → Käsittelijän delegointi (open-sse)`. Ei globaalia Next.js-välikkää — keskeytys on reitti-spesifinen.

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
opened while the base tip is red must carry ` base-red inherited: #<issue>` in its body. To
drain an accumulated red state (base tip + red PRs), use the `/sweep-reds` skill.
