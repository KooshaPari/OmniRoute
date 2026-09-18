# CLAUDE.md (தமிழ்)

🌐 **Languages:** 🇺🇸 [English](../../../CLAUDE.md) · 🇸🇦 [ar](../ar/CLAUDE.md) · 🇦🇿 [az](../az/CLAUDE.md) · 🇧🇬 [bg](../bg/CLAUDE.md) · 🇧🇩 [bn](../bn/CLAUDE.md) · 🇨🇿 [cs](../cs/CLAUDE.md) · 🇩🇰 [da](../da/CLAUDE.md) · 🇩🇪 [de](../de/CLAUDE.md) · 🇬🇷 [el](../el/CLAUDE.md) · 🇪🇸 [es](../es/CLAUDE.md) · 🇪🇪 [et](../et/CLAUDE.md) · 🇮🇷 [fa](../fa/CLAUDE.md) · 🇫🇮 [fi](../fi/CLAUDE.md) · 🇫🇷 [fr](../fr/CLAUDE.md) · 🇮🇪 [ga](../ga/CLAUDE.md) · 🇮🇳 [gu](../gu/CLAUDE.md) · 🇮🇱 [he](../he/CLAUDE.md) · 🇮🇳 [hi](../hi/CLAUDE.md) · 🇭🇷 [hr](../hr/CLAUDE.md) · 🇭🇺 [hu](../hu/CLAUDE.md) · 🇮🇩 [id](../id/CLAUDE.md) · 🇮🇹 [it](../it/CLAUDE.md) · 🇯🇵 [ja](../ja/CLAUDE.md) · 🇰🇷 [ko](../ko/CLAUDE.md) · 🇱🇹 [lt](../lt/CLAUDE.md) · 🇱🇻 [lv](../lv/CLAUDE.md) · 🇮🇳 [mr](../mr/CLAUDE.md) · 🇲🇾 [ms](../ms/CLAUDE.md) · 🇲🇹 [mt](../mt/CLAUDE.md) · 🇳🇱 [nl](../nl/CLAUDE.md) · 🇳🇴 [no](../no/CLAUDE.md) · 🇵🇭 [phi](../phi/CLAUDE.md) · 🇵🇱 [pl](../pl/CLAUDE.md) · 🇵🇹 [pt](../pt/CLAUDE.md) · 🇧🇷 [pt-BR](../pt-BR/CLAUDE.md) · 🇷🇴 [ro](../ro/CLAUDE.md) · 🇷🇺 [ru](../ru/CLAUDE.md) · 🇸🇰 [sk](../sk/CLAUDE.md) · 🇸🇮 [sl](../sl/CLAUDE.md) · 🇷🇸 [sr](../sr/CLAUDE.md) · 🇸🇪 [sv](../sv/CLAUDE.md) · 🇰🇪 [sw](../sw/CLAUDE.md) · 🇮🇳 [te](../te/CLAUDE.md) · 🇹🇭 [th](../th/CLAUDE.md) · 🇹🇷 [tr](../tr/CLAUDE.md) · 🇺🇦 [uk-UA](../uk-UA/CLAUDE.md) · 🇵🇰 [ur](../ur/CLAUDE.md) · 🇻🇳 [vi](../vi/CLAUDE.md) · 🇨🇳 [zh-CN](../zh-CN/CLAUDE.md) · 🇹🇼 [zh-TW](../zh-TW/CLAUDE.md)

---

இந்த கோப்பு இந்த சேமிப்பகத்தில் குறியீட்டுடன் வேலை செய்யும் போது Claude Code (claude.ai/code) க்கு வழிகாட்டுதலை வழங்குகிறது.

## விரைவான தொடக்கம்

```bash
npm install                    # சார்புகளை நிறுவவும் (.env.example இலிருந்து .env ஐ தானாக உருவாக்குகிறது)
npm run dev                    # http://localhost:20128 இல் டெவ் சர்வர்
npm run build                  # உற்பத்தி கட்டமைப்பு (Next.js 16 தனித்தனி)
npm run lint                   # ESLint (0 பிழைகள் எதிர்பார்க்கப்படுகின்றன; எச்சரிக்கைகள் முன்னதாகவே உள்ளன)
npm run typecheck:core         # TypeScript சரிபார்ப்பு (சுத்தமாக இருக்க வேண்டும்)
npm run typecheck:noimplicit:core  # கடுமையான சரிபார்ப்பு (எந்த implicit any இல்லை)
npm run test:coverage          # யூனிட் சோதனைகள் + கவரேஜ் கேட் (75/75/75/70 — அறிக்கைகள்/வரிசைகள்/செயல்பாடுகள்/கிளைகள்)
npm run check                  # lint + சோதனை ஒன்றிணைக்கப்பட்டது
npm run check:cycles           # சுற்றுப்பாதை சார்ந்த சார்புகளை கண்டறியவும்
```

### சோதனைகளை இயக்குதல்

```bash
# ஒற்றை சோதனை கோப்பு (Node.js உள்ளூர் சோதனை இயக்கி — பெரும்பாலான சோதனைகள்)
node --import tsx/esm --test tests/unit/your-file.test.ts

# Vitest (MCP சர்வர், autoCombo, cache)
npm run test:vitest

# அனைத்து சோதனைகள்
npm run test:all
```

முழு சோதனை மேட்ரிக்ஸ் க்காக, `CONTRIBUTING.md` → "சோதனைகளை இயக்குதல்" ஐப் பார்க்கவும். ஆழமான கட்டமைப்பிற்காக, `AGENTS.md` ஐப் பார்க்கவும்.

---

## திட்டம் ஒரு பார்வையில்

**OmniRoute** — ஒருங்கிணைந்த AI பிராக்சி/ரூட்டர். ஒரு முடிவிடம், 329 LLM வழங்குநர்கள், தானாகவே fallback.

| அடுக்கு       | இடம்                    | நோக்கம்                                                                   |
| ------------- | ----------------------- | ------------------------------------------------------------------------- |
| API Routes    | `src/app/api/v1/`       | Next.js ஆப் ரூட்டர் — நுழைவு புள்ளிகள்                                    |
| Handlers      | `open-sse/handlers/`    | கோரிக்கைகளை செயலாக்குதல் (சாட், எம்பெட்டிங்ஸ், மற்றும் பிற)               |
| Executors     | `open-sse/executors/`   | வழங்குநர்-சிறப்பு HTTP அனுப்புதல்                                         |
| Translators   | `open-sse/translator/`  | வடிவ மாற்றம் (OpenAI↔Claude↔Gemini)                                       |
| Transformer   | `open-sse/transformer/` | பதில்கள் API ↔ சாட் முழுமைகள்                                             |
| Services      | `open-sse/services/`    | காம்போ ரூட்டிங், விகித வரம்புகள், கச்சா, மற்றும் பிற                      |
| Database      | `src/lib/db/`           | 110 top-level SQLite domain modules, 130 migrations                       |
| Domain/Policy | `src/domain/`           | கொள்கை இயந்திரம், செலவுக் கட்டுப்பாடுகள், fallback உள்கட்டமைப்பு          |
| MCP Server    | `open-sse/mcp-server/`  | 107 unique tools, 3 transports (stdio / SSE / Streamable HTTP), 32 scopes |
| A2A Server    | `src/lib/a2a/`          | JSON-RPC 2.0 முகவர் புரொட்டோக்கால்                                        |
| Skills        | `src/lib/skills/`       | விரிவாக்கத்திற்குரிய திறன் கட்டமைப்பு                                     |
| Memory        | `src/lib/memory/`       | நிலையான உரையாடல் நினைவகம்                                                 |

Monorepo: `src/` (Next.js 16 ஆப்), `open-sse/` (ஸ்ட்ரீமிங் இயந்திர வேலைப்பாடு), `apps/desktop/` (டெஸ்க்டாப் ஆப்), `tests/`, `bin/` (CLI நுழைவு புள்ளி).

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
