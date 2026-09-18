# CLAUDE.md (עברית)

🌐 **Languages:** 🇺🇸 [English](../../../CLAUDE.md) · 🇸🇦 [ar](../ar/CLAUDE.md) · 🇦🇿 [az](../az/CLAUDE.md) · 🇧🇬 [bg](../bg/CLAUDE.md) · 🇧🇩 [bn](../bn/CLAUDE.md) · 🇨🇿 [cs](../cs/CLAUDE.md) · 🇩🇰 [da](../da/CLAUDE.md) · 🇩🇪 [de](../de/CLAUDE.md) · 🇬🇷 [el](../el/CLAUDE.md) · 🇪🇸 [es](../es/CLAUDE.md) · 🇪🇪 [et](../et/CLAUDE.md) · 🇮🇷 [fa](../fa/CLAUDE.md) · 🇫🇮 [fi](../fi/CLAUDE.md) · 🇫🇷 [fr](../fr/CLAUDE.md) · 🇮🇪 [ga](../ga/CLAUDE.md) · 🇮🇳 [gu](../gu/CLAUDE.md) · 🇮🇳 [hi](../hi/CLAUDE.md) · 🇭🇷 [hr](../hr/CLAUDE.md) · 🇭🇺 [hu](../hu/CLAUDE.md) · 🇮🇩 [id](../id/CLAUDE.md) · 🇮🇹 [it](../it/CLAUDE.md) · 🇯🇵 [ja](../ja/CLAUDE.md) · 🇰🇷 [ko](../ko/CLAUDE.md) · 🇱🇹 [lt](../lt/CLAUDE.md) · 🇱🇻 [lv](../lv/CLAUDE.md) · 🇮🇳 [mr](../mr/CLAUDE.md) · 🇲🇾 [ms](../ms/CLAUDE.md) · 🇲🇹 [mt](../mt/CLAUDE.md) · 🇳🇱 [nl](../nl/CLAUDE.md) · 🇳🇴 [no](../no/CLAUDE.md) · 🇵🇭 [phi](../phi/CLAUDE.md) · 🇵🇱 [pl](../pl/CLAUDE.md) · 🇵🇹 [pt](../pt/CLAUDE.md) · 🇧🇷 [pt-BR](../pt-BR/CLAUDE.md) · 🇷🇴 [ro](../ro/CLAUDE.md) · 🇷🇺 [ru](../ru/CLAUDE.md) · 🇸🇰 [sk](../sk/CLAUDE.md) · 🇸🇮 [sl](../sl/CLAUDE.md) · 🇷🇸 [sr](../sr/CLAUDE.md) · 🇸🇪 [sv](../sv/CLAUDE.md) · 🇰🇪 [sw](../sw/CLAUDE.md) · 🇮🇳 [ta](../ta/CLAUDE.md) · 🇮🇳 [te](../te/CLAUDE.md) · 🇹🇭 [th](../th/CLAUDE.md) · 🇹🇷 [tr](../tr/CLAUDE.md) · 🇺🇦 [uk-UA](../uk-UA/CLAUDE.md) · 🇵🇰 [ur](../ur/CLAUDE.md) · 🇻🇳 [vi](../vi/CLAUDE.md) · 🇨🇳 [zh-CN](../zh-CN/CLAUDE.md) · 🇹🇼 [zh-TW](../zh-TW/CLAUDE.md)

---

הקובץ הזה מספק הנחיות ל-Claude Code (claude.ai/code) כאשר עובדים עם קוד במאגר זה.

## התחלה מהירה

```bash
npm install                    # התקנת תלותים (יוצר אוטומטית .env מ-.env.example)
npm run dev                    # שרת פיתוח ב-http://localhost:20128
npm run build                  # בניית הפקה (Next.js 16 עצמאי)
npm run lint                   # ESLint (0 שגיאות צפויות; אזהרות קיימות מראש)
npm run typecheck:core         # בדיקת TypeScript (אמור להיות נקי)
npm run typecheck:noimplicit:core  # בדיקה מחמירה (בלי implicit any)
npm run test:coverage          # בדיקות יחידה + שער כיסוי (75/75/75/70 — משפטים/שורות/פונקציות/סניפים)
npm run check                  # lint + בדיקות משולבות
npm run check:cycles           # זיהוי תלותיות מעגליות
```

### הרצת בדיקות

```bash
# קובץ בדיקה בודד (רץ בדיקות מקורי של Node.js — רוב הבדיקות)
node --import tsx/esm --test tests/unit/your-file.test.ts

# Vitest (שרת MCP, autoCombo, cache)
npm run test:vitest

# כל הסוויטות
npm run test:all
```

למטריצת הבדיקות המלאה, ראה `CONTRIBUTING.md` → "הרצת בדיקות". לארכיטקטורה מעמיקה, ראה `AGENTS.md`.

---

## פרויקט במבט חטוף

**OmniRoute** — פרוקסי/נתב AI מאוחד. נקודת קצה אחת, 329 ספקי LLM, חזרה אוטומטית.

| שכבה          | מיקום                   | מטרה                                                                      |
| ------------- | ----------------------- | ------------------------------------------------------------------------- |
| API Routes    | `src/app/api/v1/`       | נתב אפליקציית Next.js — נקודות כניסה                                      |
| Handlers      | `open-sse/handlers/`    | עיבוד בקשות (צ'אט, הטמעות, וכו')                                          |
| Executors     | `open-sse/executors/`   | הפצת HTTP ספציפית לספק                                                    |
| Translators   | `open-sse/translator/`  | המרת פורמטים (OpenAI↔Claude↔Gemini)                                       |
| Transformer   | `open-sse/transformer/` | API תגובות ↔ השלמות צ'אט                                                  |
| Services      | `open-sse/services/`    | ניתוב קומבו, מגבלות קצב, קאשינג, וכו'                                     |
| Database      | `src/lib/db/`           | 110 top-level SQLite domain modules, 130 migrations                       |
| Domain/Policy | `src/domain/`           | מנוע מדיניות, כללי עלות, לוגיקת חזרה                                      |
| MCP Server    | `open-sse/mcp-server/`  | 107 unique tools, 3 transports (stdio / SSE / Streamable HTTP), 32 scopes |
| A2A Server    | `src/lib/a2a/`          | פרוטוקול JSON-RPC 2.0 של סוכן                                             |
| Skills        | `src/lib/skills/`       | מסגרת מיומנויות ניתנת להרחבה                                              |
| Memory        | `src/lib/memory/`       | זיכרון שיחה מתמשך                                                         |

מונורפו: `src/` (אפליקציית Next.js 16), `open-sse/` (מרחב עבודה של מנוע סטרימינג), `apps/desktop/` (אפליקציית שולחן עבודה), `tests/`, `bin/` (נקודת כניסה ל-CLI).

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
