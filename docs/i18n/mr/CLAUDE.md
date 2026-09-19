# CLAUDE.md (मराठी)

**Languages:** [English](../../../CLAUDE.md) · [ar](../ar/CLAUDE.md) · [az](../az/CLAUDE.md) · [bg](../bg/CLAUDE.md) · [bn](../bn/CLAUDE.md) · [cs](../cs/CLAUDE.md) · [da](../da/CLAUDE.md) · [de](../de/CLAUDE.md) · [el](../el/CLAUDE.md) · [es](../es/CLAUDE.md) · [et](../et/CLAUDE.md) · [fa](../fa/CLAUDE.md) · [fi](../fi/CLAUDE.md) · [fr](../fr/CLAUDE.md) · [ga](../ga/CLAUDE.md) · [gu](../gu/CLAUDE.md) · [he](../he/CLAUDE.md) · [hi](../hi/CLAUDE.md) · [hr](../hr/CLAUDE.md) · [hu](../hu/CLAUDE.md) · [id](../id/CLAUDE.md) · [it](../it/CLAUDE.md) · [ja](../ja/CLAUDE.md) · [ko](../ko/CLAUDE.md) · [lt](../lt/CLAUDE.md) · [lv](../lv/CLAUDE.md) · [ms](../ms/CLAUDE.md) · [mt](../mt/CLAUDE.md) · [nl](../nl/CLAUDE.md) · [no](../no/CLAUDE.md) · [phi](../phi/CLAUDE.md) · [pl](../pl/CLAUDE.md) · [pt](../pt/CLAUDE.md) · [pt-BR](../pt-BR/CLAUDE.md) · [ro](../ro/CLAUDE.md) · [ru](../ru/CLAUDE.md) · [sk](../sk/CLAUDE.md) · [sl](../sl/CLAUDE.md) · [sr](../sr/CLAUDE.md) · [sv](../sv/CLAUDE.md) · [sw](../sw/CLAUDE.md) · [ta](../ta/CLAUDE.md) · [te](../te/CLAUDE.md) · [th](../th/CLAUDE.md) · [tr](../tr/CLAUDE.md) · [uk-UA](../uk-UA/CLAUDE.md) · [ur](../ur/CLAUDE.md) · [vi](../vi/CLAUDE.md) · [zh-CN](../zh-CN/CLAUDE.md) · [zh-TW](../zh-TW/CLAUDE.md)

---

या फाइलमध्ये या रेपॉजिटरीमध्ये कोडवर काम करताना Claude Code (claude.ai/code) साठी मार्गदर्शन दिले आहे.

## जलद प्रारंभ

```bash
npm install                    # निर्भरता स्थापित करा (.auto-generates .env from .env.example)
npm run dev                    # विकास सर्व्हर http://localhost:20128 वर
npm run build                  # उत्पादन बिल्ड (Next.js 16 स्वतंत्र)
npm run lint                   # ESLint (0 त्रुटी अपेक्षित; चेतावण्या पूर्वीच आहेत)
npm run typecheck:core         # TypeScript तपासणी (स्वच्छ असावी)
npm run typecheck:noimplicit:core  # कठोर तपासणी (कोणतीही अप्रत्यक्ष नाही)
npm run test:coverage          # युनिट चाचण्या + कव्हरेज गेट (75/75/75/70 — विधान/रेषा/कार्ये/शाखा)
npm run check                  # lint + चाचणी एकत्रित
npm run check:cycles           # वर्तुळाकार अवलंबन शोधा
```

### चाचण्या चालवणे

```bash
# एकल चाचणी फाइल (Node.js स्थानिक चाचणी धावक — बहुतेक चाचण्या)
node --import tsx/esm --test tests/unit/your-file.test.ts

# Vitest (MCP सर्व्हर, autoCombo, कॅश)
npm run test:vitest

# सर्व सूट
npm run test:all
```

पूर्ण चाचणी मॅट्रिक्ससाठी, `CONTRIBUTING.md` पहा → "चाचण्या चालवणे". गहन आर्किटेक्चरसाठी, `AGENTS.md` पहा.

---

## प्रकल्पाचा आढावा

**OmniRoute** — एकत्रित AI प्रॉक्सी/राउटर. एक एंडपॉइंट, 329 LLM प्रदाते, स्वयंचलित फॉलबॅक.

| स्तर          | स्थान                   | उद्देश                                                                    |
| ------------- | ----------------------- | ------------------------------------------------------------------------- |
| API मार्ग     | `src/app/api/v1/`       | Next.js अॅप राउटर — प्रवेश बिंदू                                          |
| हँडलर्स       | `open-sse/handlers/`    | विनंती प्रक्रिया (चॅट, एम्बेडिंग, इ.)                                     |
| कार्यान्वयक   | `open-sse/executors/`   | प्रदाता-विशिष्ट HTTP वितरण                                                |
| भाषांतरक      | `open-sse/translator/`  | स्वरूप रूपांतरण (OpenAI↔Claude↔Gemini)                                    |
| ट्रान्सफार्मर | `open-sse/transformer/` | प्रतिसाद API ↔ चॅट पूर्णता                                                |
| सेवा          | `open-sse/services/`    | कॉम्बो राउटिंग, दर मर्यादा, कॅशिंग, इ.                                    |
| डेटाबेस       | `src/lib/db/`           | 110 top-level SQLite domain modules, 130 migrations                       |
| डोमेन/नीती    | `src/domain/`           | नीती इंजिन, खर्च नियम, फॉलबॅक लॉजिक                                       |
| MCP सर्व्हर   | `open-sse/mcp-server/`  | 107 unique tools, 3 transports (stdio / SSE / Streamable HTTP), 32 scopes |
| A2A सर्व्हर   | `src/lib/a2a/`          | JSON-RPC 2.0 एजंट प्रोटोकॉल                                               |
| कौशल्य        | `src/lib/skills/`       | विस्तारणीय कौशल्य फ्रेमवर्क                                               |
| मेमरी         | `src/lib/memory/`       | कायमचे संवादात्मक मेमरी                                                   |

मोनोरेपो: `src/` (Next.js 16 अॅप), `open-sse/` (स्ट्रीमिंग इंजिन कार्यक्षेत्र), `apps/desktop/` (डेस्कटॉप अॅप), `tests/`, `bin/` (CLI प्रवेश बिंदू).

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
