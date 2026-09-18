# CLAUDE.md (বাংলা)

🌐 **Languages:** 🇺🇸 [English](../../../CLAUDE.md) · 🇸🇦 [ar](../ar/CLAUDE.md) · 🇦🇿 [az](../az/CLAUDE.md) · 🇧🇬 [bg](../bg/CLAUDE.md) · 🇨🇿 [cs](../cs/CLAUDE.md) · 🇩🇰 [da](../da/CLAUDE.md) · 🇩🇪 [de](../de/CLAUDE.md) · 🇬🇷 [el](../el/CLAUDE.md) · 🇪🇸 [es](../es/CLAUDE.md) · 🇪🇪 [et](../et/CLAUDE.md) · 🇮🇷 [fa](../fa/CLAUDE.md) · 🇫🇮 [fi](../fi/CLAUDE.md) · 🇫🇷 [fr](../fr/CLAUDE.md) · 🇮🇪 [ga](../ga/CLAUDE.md) · 🇮🇳 [gu](../gu/CLAUDE.md) · 🇮🇱 [he](../he/CLAUDE.md) · 🇮🇳 [hi](../hi/CLAUDE.md) · 🇭🇷 [hr](../hr/CLAUDE.md) · 🇭🇺 [hu](../hu/CLAUDE.md) · 🇮🇩 [id](../id/CLAUDE.md) · 🇮🇹 [it](../it/CLAUDE.md) · 🇯🇵 [ja](../ja/CLAUDE.md) · 🇰🇷 [ko](../ko/CLAUDE.md) · 🇱🇹 [lt](../lt/CLAUDE.md) · 🇱🇻 [lv](../lv/CLAUDE.md) · 🇮🇳 [mr](../mr/CLAUDE.md) · 🇲🇾 [ms](../ms/CLAUDE.md) · 🇲🇹 [mt](../mt/CLAUDE.md) · 🇳🇱 [nl](../nl/CLAUDE.md) · 🇳🇴 [no](../no/CLAUDE.md) · 🇵🇭 [phi](../phi/CLAUDE.md) · 🇵🇱 [pl](../pl/CLAUDE.md) · 🇵🇹 [pt](../pt/CLAUDE.md) · 🇧🇷 [pt-BR](../pt-BR/CLAUDE.md) · 🇷🇴 [ro](../ro/CLAUDE.md) · 🇷🇺 [ru](../ru/CLAUDE.md) · 🇸🇰 [sk](../sk/CLAUDE.md) · 🇸🇮 [sl](../sl/CLAUDE.md) · 🇷🇸 [sr](../sr/CLAUDE.md) · 🇸🇪 [sv](../sv/CLAUDE.md) · 🇰🇪 [sw](../sw/CLAUDE.md) · 🇮🇳 [ta](../ta/CLAUDE.md) · 🇮🇳 [te](../te/CLAUDE.md) · 🇹🇭 [th](../th/CLAUDE.md) · 🇹🇷 [tr](../tr/CLAUDE.md) · 🇺🇦 [uk-UA](../uk-UA/CLAUDE.md) · 🇵🇰 [ur](../ur/CLAUDE.md) · 🇻🇳 [vi](../vi/CLAUDE.md) · 🇨🇳 [zh-CN](../zh-CN/CLAUDE.md) · 🇹🇼 [zh-TW](../zh-TW/CLAUDE.md)

---

এই ফাইলটি এই রেপোজিটরিতে কোডের সাথে কাজ করার সময় Claude Code (claude.ai/code) এর জন্য নির্দেশিকা প্রদান করে।

## দ্রুত শুরু

```bash
npm install                    # নির্ভরতাগুলি ইনস্টল করুন (auto-generates .env from .env.example)
npm run dev                    # ডেভ সার্ভার http://localhost:20128 এ
npm run build                  # প্রোডাকশন বিল্ড (Next.js 16 standalone)
npm run lint                   # ESLint (0 ত্রুটি প্রত্যাশিত; সতর্কতা পূর্ব-বিদ্যমান)
npm run typecheck:core         # TypeScript পরীক্ষা (পরিষ্কার হওয়া উচিত)
npm run typecheck:noimplicit:core  # কঠোর পরীক্ষা (কোনও ইম্প্লিসিট অ্যানি নেই)
npm run test:coverage          # ইউনিট পরীক্ষা + কভারেজ গেট (75/75/75/70 — বিবৃতি/লাইন/ফাংশন/শাখা)
npm run check                  # lint + পরীক্ষা একত্রিত
npm run check:cycles           # বৃত্তাকার নির্ভরতাগুলি সনাক্ত করুন
```

### পরীক্ষাগুলি চালানো

```bash
# একক পরীক্ষার ফাইল (Node.js নেটিভ পরীক্ষার রানার — বেশিরভাগ পরীক্ষা)
node --import tsx/esm --test tests/unit/your-file.test.ts

# Vitest (MCP সার্ভার, autoCombo, ক্যাশ)
npm run test:vitest

# সমস্ত স্যুট
npm run test:all
```

সম্পূর্ণ পরীক্ষার ম্যাট্রিক্সের জন্য, দেখুন `CONTRIBUTING.md` → "পরীক্ষাগুলি চালানো"। গভীর স্থাপত্যের জন্য, দেখুন `AGENTS.md`।

---

## প্রকল্পের সংক্ষিপ্ত বিবরণ

**OmniRoute** — একক AI প্রক্সি/রাউটার। একটি এন্ডপয়েন্ট, 329 LLM প্রদানকারী, স্বয়ংক্রিয় ফ fallback।

| স্তর          | অবস্থান                 | উদ্দেশ্য                                                                  |
| ------------- | ----------------------- | ------------------------------------------------------------------------- |
| API রুট       | `src/app/api/v1/`       | Next.js অ্যাপ রাউটার — প্রবেশ পয়েন্ট                                     |
| হ্যান্ডলার    | `open-sse/handlers/`    | অনুরোধ প্রক্রিয়াকরণ (চ্যাট, এম্বেডিংস, ইত্যাদি)                          |
| এক্সিকিউটর    | `open-sse/executors/`   | প্রদানকারী-নির্দিষ্ট HTTP ডিসপ্যাচ                                        |
| অনুবাদক       | `open-sse/translator/`  | ফরম্যাট রূপান্তর (OpenAI↔Claude↔Gemini)                                   |
| ট্রান্সফর্মার | `open-sse/transformer/` | প্রতিক্রিয়া API ↔ চ্যাট সম্পূর্ণতা                                       |
| পরিষেবাগুলি   | `open-sse/services/`    | কম্বো রাউটিং, হার সীমা, ক্যাশিং, ইত্যাদি                                  |
| ডেটাবেস       | `src/lib/db/`           | 110 top-level SQLite domain modules, 130 migrations                       |
| ডোমেইন/নীতী   | `src/domain/`           | নীতি ইঞ্জিন, খরচের নিয়ম, ফ fallback লজিক                                 |
| MCP সার্ভার   | `open-sse/mcp-server/`  | 107 unique tools, 3 transports (stdio / SSE / Streamable HTTP), 32 scopes |
| A2A সার্ভার   | `src/lib/a2a/`          | JSON-RPC 2.0 এজেন্ট প্রোটোকল                                              |
| দক্ষতা        | `src/lib/skills/`       | সম্প্রসারণযোগ্য দক্ষতা ফ্রেমওয়ার্ক                                       |
| মেমরি         | `src/lib/memory/`       | স্থায়ী কথোপকথন মেমরি                                                     |

মনোরেপো: `src/` (Next.js 16 অ্যাপ), `open-sse/` (স্ট্রিমিং ইঞ্জিন কর্মক্ষেত্র), `apps/desktop/` (ডেস্কটপ অ্যাপ), `tests/`, `bin/` (CLI প্রবেশ পয়েন্ট)।

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
