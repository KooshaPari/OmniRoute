# CLAUDE.md (ไทย)

🌐 **Languages:** 🇺🇸 [English](../../../CLAUDE.md) · 🇸🇦 [ar](../ar/CLAUDE.md) · 🇦🇿 [az](../az/CLAUDE.md) · 🇧🇬 [bg](../bg/CLAUDE.md) · 🇧🇩 [bn](../bn/CLAUDE.md) · 🇨🇿 [cs](../cs/CLAUDE.md) · 🇩🇰 [da](../da/CLAUDE.md) · 🇩🇪 [de](../de/CLAUDE.md) · 🇬🇷 [el](../el/CLAUDE.md) · 🇪🇸 [es](../es/CLAUDE.md) · 🇪🇪 [et](../et/CLAUDE.md) · 🇮🇷 [fa](../fa/CLAUDE.md) · 🇫🇮 [fi](../fi/CLAUDE.md) · 🇫🇷 [fr](../fr/CLAUDE.md) · 🇮🇪 [ga](../ga/CLAUDE.md) · 🇮🇳 [gu](../gu/CLAUDE.md) · 🇮🇱 [he](../he/CLAUDE.md) · 🇮🇳 [hi](../hi/CLAUDE.md) · 🇭🇷 [hr](../hr/CLAUDE.md) · 🇭🇺 [hu](../hu/CLAUDE.md) · 🇮🇩 [id](../id/CLAUDE.md) · 🇮🇹 [it](../it/CLAUDE.md) · 🇯🇵 [ja](../ja/CLAUDE.md) · 🇰🇷 [ko](../ko/CLAUDE.md) · 🇱🇹 [lt](../lt/CLAUDE.md) · 🇱🇻 [lv](../lv/CLAUDE.md) · 🇮🇳 [mr](../mr/CLAUDE.md) · 🇲🇾 [ms](../ms/CLAUDE.md) · 🇲🇹 [mt](../mt/CLAUDE.md) · 🇳🇱 [nl](../nl/CLAUDE.md) · 🇳🇴 [no](../no/CLAUDE.md) · 🇵🇭 [phi](../phi/CLAUDE.md) · 🇵🇱 [pl](../pl/CLAUDE.md) · 🇵🇹 [pt](../pt/CLAUDE.md) · 🇧🇷 [pt-BR](../pt-BR/CLAUDE.md) · 🇷🇴 [ro](../ro/CLAUDE.md) · 🇷🇺 [ru](../ru/CLAUDE.md) · 🇸🇰 [sk](../sk/CLAUDE.md) · 🇸🇮 [sl](../sl/CLAUDE.md) · 🇷🇸 [sr](../sr/CLAUDE.md) · 🇸🇪 [sv](../sv/CLAUDE.md) · 🇰🇪 [sw](../sw/CLAUDE.md) · 🇮🇳 [ta](../ta/CLAUDE.md) · 🇮🇳 [te](../te/CLAUDE.md) · 🇹🇷 [tr](../tr/CLAUDE.md) · 🇺🇦 [uk-UA](../uk-UA/CLAUDE.md) · 🇵🇰 [ur](../ur/CLAUDE.md) · 🇻🇳 [vi](../vi/CLAUDE.md) · 🇨🇳 [zh-CN](../zh-CN/CLAUDE.md) · 🇹🇼 [zh-TW](../zh-TW/CLAUDE.md)

---

ไฟล์นี้ให้แนวทางสำหรับ Claude Code (claude.ai/code) เมื่อทำงานกับโค้ดในที่เก็บนี้

## เริ่มต้นอย่างรวดเร็ว

```bash
npm install                    # ติดตั้ง deps (สร้าง .env จาก .env.example โดยอัตโนมัติ)
npm run dev                    # เซิร์ฟเวอร์พัฒนาอยู่ที่ http://localhost:20128
npm run build                  # สร้างโปรดักชัน (Next.js 16 standalone)
npm run lint                   # ESLint (คาดหวัง 0 ข้อผิดพลาด; คำเตือนเป็นสิ่งที่มีอยู่แล้ว)
npm run typecheck:core         # ตรวจสอบ TypeScript (ควรสะอาด)
npm run typecheck:noimplicit:core  # ตรวจสอบอย่างเข้มงวด (ไม่มี implicit any)
npm run test:coverage          # หน่วยทดสอบ + เกณฑ์การครอบคลุม (75/75/75/70 — คำสั่ง/บรรทัด/ฟังก์ชัน/สาขา)
npm run check                  # lint + ทดสอบรวมกัน
npm run check:cycles           # ตรวจจับการพึ่งพาแบบวงกลม
```

### การรันการทดสอบ

```bash
# ไฟล์ทดสอบเดียว (Node.js native test runner — ทดสอบส่วนใหญ่)
node --import tsx/esm --test tests/unit/your-file.test.ts

# Vitest (MCP server, autoCombo, cache)
npm run test:vitest

# ทุกชุด
npm run test:all
```

สำหรับตารางการทดสอบทั้งหมด ดูที่ `CONTRIBUTING.md` → "การรันการทดสอบ" สำหรับสถาปัตยกรรมเชิงลึก ดูที่ `AGENTS.md`.

---

## โครงการโดยรวม

**OmniRoute** — โปรเซสเซอร์/เราเตอร์ AI ที่รวมเป็นหนึ่ง จุดสิ้นสุดเดียว, ผู้ให้บริการ LLM 329 ราย, การสำรองข้อมูลอัตโนมัติ

| เลเยอร์       | ตำแหน่ง                 | วัตถุประสงค์                                                              |
| ------------- | ----------------------- | ------------------------------------------------------------------------- |
| API Routes    | `src/app/api/v1/`       | Next.js App Router — จุดเข้า                                              |
| Handlers      | `open-sse/handlers/`    | การประมวลผลคำขอ (แชท, การฝัง, ฯลฯ)                                        |
| Executors     | `open-sse/executors/`   | การส่ง HTTP เฉพาะผู้ให้บริการ                                             |
| Translators   | `open-sse/translator/`  | การแปลงรูปแบบ (OpenAI↔Claude↔Gemini)                                      |
| Transformer   | `open-sse/transformer/` | API การตอบกลับ ↔ การเติมแชท                                               |
| Services      | `open-sse/services/`    | การจัดเส้นทางแบบรวม, ขีดจำกัดอัตรา, การแคช, ฯลฯ                           |
| Database      | `src/lib/db/`           | 110 top-level SQLite domain modules, 130 migrations                       |
| Domain/Policy | `src/domain/`           | เอนจินนโยบาย, กฎค่าใช้จ่าย, ลอจิกการสำรองข้อมูล                           |
| MCP Server    | `open-sse/mcp-server/`  | 107 unique tools, 3 transports (stdio / SSE / Streamable HTTP), 32 scopes |
| A2A Server    | `src/lib/a2a/`          | โปรโตคอลตัวแทน JSON-RPC 2.0                                               |
| Skills        | `src/lib/skills/`       | โครงสร้างทักษะที่ขยายได้                                                  |
| Memory        | `src/lib/memory/`       | หน่วยความจำการสนทนาที่คงอยู่                                              |

Monorepo: `src/` (แอป Next.js 16), `open-sse/` (พื้นที่ทำงานเครื่องยนต์สตรีมมิ่ง), `apps/desktop/` (แอปเดสก์ท็อป), `tests/`, `bin/` (จุดเข้า CLI).

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

API routes follow a consistent pattern: `Route → CORS preflight → Zod body validation → Optional auth (extractApiKey/isValidApiKey) → API key policy enforcement → Handler delegation (open-sse)`. ไม่มี middleware ของ Next.js ทั่วไป — การดักจับจะเฉพาะเจาะจงต่อเส้นทาง

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
