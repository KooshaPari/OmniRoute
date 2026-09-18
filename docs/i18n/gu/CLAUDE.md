# CLAUDE.md (ગુજરાતી)

🌐 **Languages:** 🇺🇸 [English](../../../CLAUDE.md) · 🇸🇦 [ar](../ar/CLAUDE.md) · 🇦🇿 [az](../az/CLAUDE.md) · 🇧🇬 [bg](../bg/CLAUDE.md) · 🇧🇩 [bn](../bn/CLAUDE.md) · 🇨🇿 [cs](../cs/CLAUDE.md) · 🇩🇰 [da](../da/CLAUDE.md) · 🇩🇪 [de](../de/CLAUDE.md) · 🇬🇷 [el](../el/CLAUDE.md) · 🇪🇸 [es](../es/CLAUDE.md) · 🇪🇪 [et](../et/CLAUDE.md) · 🇮🇷 [fa](../fa/CLAUDE.md) · 🇫🇮 [fi](../fi/CLAUDE.md) · 🇫🇷 [fr](../fr/CLAUDE.md) · 🇮🇪 [ga](../ga/CLAUDE.md) · 🇮🇱 [he](../he/CLAUDE.md) · 🇮🇳 [hi](../hi/CLAUDE.md) · 🇭🇷 [hr](../hr/CLAUDE.md) · 🇭🇺 [hu](../hu/CLAUDE.md) · 🇮🇩 [id](../id/CLAUDE.md) · 🇮🇹 [it](../it/CLAUDE.md) · 🇯🇵 [ja](../ja/CLAUDE.md) · 🇰🇷 [ko](../ko/CLAUDE.md) · 🇱🇹 [lt](../lt/CLAUDE.md) · 🇱🇻 [lv](../lv/CLAUDE.md) · 🇮🇳 [mr](../mr/CLAUDE.md) · 🇲🇾 [ms](../ms/CLAUDE.md) · 🇲🇹 [mt](../mt/CLAUDE.md) · 🇳🇱 [nl](../nl/CLAUDE.md) · 🇳🇴 [no](../no/CLAUDE.md) · 🇵🇭 [phi](../phi/CLAUDE.md) · 🇵🇱 [pl](../pl/CLAUDE.md) · 🇵🇹 [pt](../pt/CLAUDE.md) · 🇧🇷 [pt-BR](../pt-BR/CLAUDE.md) · 🇷🇴 [ro](../ro/CLAUDE.md) · 🇷🇺 [ru](../ru/CLAUDE.md) · 🇸🇰 [sk](../sk/CLAUDE.md) · 🇸🇮 [sl](../sl/CLAUDE.md) · 🇷🇸 [sr](../sr/CLAUDE.md) · 🇸🇪 [sv](../sv/CLAUDE.md) · 🇰🇪 [sw](../sw/CLAUDE.md) · 🇮🇳 [ta](../ta/CLAUDE.md) · 🇮🇳 [te](../te/CLAUDE.md) · 🇹🇭 [th](../th/CLAUDE.md) · 🇹🇷 [tr](../tr/CLAUDE.md) · 🇺🇦 [uk-UA](../uk-UA/CLAUDE.md) · 🇵🇰 [ur](../ur/CLAUDE.md) · 🇻🇳 [vi](../vi/CLAUDE.md) · 🇨🇳 [zh-CN](../zh-CN/CLAUDE.md) · 🇹🇼 [zh-TW](../zh-TW/CLAUDE.md)

---

આ ફાઇલ claude.ai/code સાથે કોડ પર કામ કરતી વખતે માર્ગદર્શન પ્રદાન કરે છે.

## ઝડપી શરૂઆત

```bash
npm install                    # deps સ્થાપિત કરો (.auto-generates .env from .env.example)
npm run dev                    # ડેવ સર્વર http://localhost:20128 પર
npm run build                  # ઉત્પાદન બિલ્ડ (Next.js 16 standalone)
npm run lint                   # ESLint (0 ભૂલો અપેક્ષિત; ચેતવણીઓ પૂર્વ-અસ્તિત્વમાં છે)
npm run typecheck:core         # TypeScript ચેક (સફળ હોવું જોઈએ)
npm run typecheck:noimplicit:core  # કડક ચેક (કોઈ પણ નમ્ર નથી)
npm run test:coverage          # યુનિટ પરીક્ષાઓ + કવરેજ ગેટ (75/75/75/70 — નિવેદનો/લાઇનો/ફંક્શન/શાખાઓ)
npm run check                  # lint + પરીક્ષા સંયુક્ત
npm run check:cycles           # વર્તુળની નિર્ભરતા શોધો
```

### પરીક્ષાઓ ચલાવવી

```bash
# એકલ પરીક્ષા ફાઇલ (Node.js નેટિવ પરીક્ષા રનર — સૌથી વધુ પરીક્ષાઓ)
node --import tsx/esm --test tests/unit/your-file.test.ts

# Vitest (MCP સર્વર, autoCombo, કેશ)
npm run test:vitest

# તમામ સૂટ
npm run test:all
```

પૂર્ણ પરીક્ષા મેટ્રિક્સ માટે, `CONTRIBUTING.md` → "પરીક્ષાઓ ચલાવવી" જુઓ. ઊંડા આર્કિટેક્ચર માટે, `AGENTS.md` જુઓ.

---

## પ્રોજેક્ટ એક નજરમાં

**OmniRoute** — એકીકૃત AI પ્રોક્સી/રાઉટર. એક એન્ડપોઈન્ટ, 329 LLM પ્રદાતાઓ, ઓટો-ફોલબેક.

| સ્તર          | સ્થાન                   | ઉદ્દેશ્ય                                                                  |
| ------------- | ----------------------- | ------------------------------------------------------------------------- |
| API Routes    | `src/app/api/v1/`       | Next.js એપ્લિકેશન રાઉટર — પ્રવેશ બિંદુઓ                                   |
| Handlers      | `open-sse/handlers/`    | વિનંતી પ્રક્રિયા (ચેટ, એમ્બેડિંગ્સ, વગેરે)                                |
| Executors     | `open-sse/executors/`   | પ્રદાતા-વિશિષ્ટ HTTP વિતરણ                                                |
| Translators   | `open-sse/translator/`  | ફોર્મેટ રૂપાંતરણ (OpenAI↔Claude↔Gemini)                                   |
| Transformer   | `open-sse/transformer/` | પ્રતિસાદ API ↔ ચેટ પૂર્ણતાઓ                                               |
| Services      | `open-sse/services/`    | કોમ્બો રાઉટિંગ, દર મર્યાદાઓ, કેશિંગ, વગેરે                                |
| Database      | `src/lib/db/`           | 110 top-level SQLite domain modules, 130 migrations                       |
| Domain/Policy | `src/domain/`           | નીતિ એન્જિન, ખર્ચના નિયમો, ફોલબેક લોજિક                                   |
| MCP Server    | `open-sse/mcp-server/`  | 107 unique tools, 3 transports (stdio / SSE / Streamable HTTP), 32 scopes |
| A2A Server    | `src/lib/a2a/`          | JSON-RPC 2.0 એજન્ટ પ્રોટોકોલ                                              |
| Skills        | `src/lib/skills/`       | વિસ્તરણશીલ કુશળતા ફ્રેમવર્ક                                               |
| Memory        | `src/lib/memory/`       | સતત સંવાદ મેમરી                                                           |

મોનોરેપો: `src/` (Next.js 16 એપ્લિકેશન), `open-sse/` (સ્ટ્રીમિંગ એન્જિન કાર્યસ્થળ), `apps/desktop/` (ડેસ્કટોપ એપ્લિકેશન), `tests/`, `bin/` (CLI પ્રવેશ બિંદુ).

## વિનંતી પાઇપલાઇન

```
Client → /v1/chat/completions (Next.js માર્ગ)
  → CORS → Zod માન્યતા → auth? → નીતિ ચકાસણી → પ્રોમ્પ્ટ ઇન્જેક્શન ગાર્ડ
  → handleChatCore() [open-sse/handlers/chatCore.ts]
    → કેશ ચકાસણી → દર મર્યાદા → કોમ્બો રૂટિંગ?
      → resolveComboTargets() → handleSingleModel() પ્રતિ લક્ષ્ય
    → translateRequest() → getExecutor() → executor.execute()
      → fetch() upstream → retry w/ backoff
    → પ્રતિસાદ અનુવાદ → SSE સ્ટ્રીમ અથવા JSON
    → જો Responses API: responsesTransformer.ts TransformStream
```

API માર્ગો એક સંગ્રહિત પેટર્નનું પાલન કરે છે: `Route → CORS preflight → Zod body validation → વૈકલ્પિક auth (extractApiKey/isValidApiKey) → API કી નીતિ અમલ → Handler delegation (open-sse)` . કોઈ વૈશ્વિક Next.js માધ્યમ નથી — અવરોધન માર્ગ-વિશિષ્ટ છે.

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
