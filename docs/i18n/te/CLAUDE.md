# CLAUDE.md (తెలుగు)

**Languages:** [English](../../../CLAUDE.md) · [ar](../ar/CLAUDE.md) · [az](../az/CLAUDE.md) · [bg](../bg/CLAUDE.md) · [bn](../bn/CLAUDE.md) · [cs](../cs/CLAUDE.md) · [da](../da/CLAUDE.md) · [de](../de/CLAUDE.md) · [el](../el/CLAUDE.md) · [es](../es/CLAUDE.md) · [et](../et/CLAUDE.md) · [fa](../fa/CLAUDE.md) · [fi](../fi/CLAUDE.md) · [fr](../fr/CLAUDE.md) · [ga](../ga/CLAUDE.md) · [gu](../gu/CLAUDE.md) · [he](../he/CLAUDE.md) · [hi](../hi/CLAUDE.md) · [hr](../hr/CLAUDE.md) · [hu](../hu/CLAUDE.md) · [id](../id/CLAUDE.md) · [it](../it/CLAUDE.md) · [ja](../ja/CLAUDE.md) · [ko](../ko/CLAUDE.md) · [lt](../lt/CLAUDE.md) · [lv](../lv/CLAUDE.md) · [mr](../mr/CLAUDE.md) · [ms](../ms/CLAUDE.md) · [mt](../mt/CLAUDE.md) · [nl](../nl/CLAUDE.md) · [no](../no/CLAUDE.md) · [phi](../phi/CLAUDE.md) · [pl](../pl/CLAUDE.md) · [pt](../pt/CLAUDE.md) · [pt-BR](../pt-BR/CLAUDE.md) · [ro](../ro/CLAUDE.md) · [ru](../ru/CLAUDE.md) · [sk](../sk/CLAUDE.md) · [sl](../sl/CLAUDE.md) · [sr](../sr/CLAUDE.md) · [sv](../sv/CLAUDE.md) · [sw](../sw/CLAUDE.md) · [ta](../ta/CLAUDE.md) · [th](../th/CLAUDE.md) · [tr](../tr/CLAUDE.md) · [uk-UA](../uk-UA/CLAUDE.md) · [ur](../ur/CLAUDE.md) · [vi](../vi/CLAUDE.md) · [zh-CN](../zh-CN/CLAUDE.md) · [zh-TW](../zh-TW/CLAUDE.md)

---

ఈ ఫైల్ ఈ రిపోజిటరీలో కోడ్‌తో పనిచేసేటప్పుడు Claude Code (claude.ai/code) కు మార్గదర్శకత్వం అందిస్తుంది.

## తక్షణ ప్రారంభం

```bash
npm install                    # డిపెండెన్సీలు ఇన్‌స్టాల్ చేయండి (.env.example నుండి .env ఆటో-జనరేట్ చేస్తుంది)
npm run dev                    # http://localhost:20128 వద్ద డెవ్ సర్వర్
npm run build                  # ఉత్పత్తి నిర్మాణం (Next.js 16 standalone)
npm run lint                   # ESLint (0 తప్పులు ఆశించబడుతున్నాయి; హెచ్చరికలు ముందుగా ఉన్నాయి)
npm run typecheck:core         # TypeScript తనిఖీ (స్వచ్ఛంగా ఉండాలి)
npm run typecheck:noimplicit:core  # కఠినమైన తనిఖీ (ఏదైనా అర్థం లేకుండా లేదు)
npm run test:coverage          # యూనిట్ పరీక్షలు + కవరేజ్ గేట్ (75/75/75/70 — స్టేట్‌మెంట్‌లు/లైన్లు/ఫంక్షన్‌లు/శాఖలు)
npm run check                  # lint + పరీక్షలు కలిపి
npm run check:cycles           # చక్రాకార ఆధారాలను గుర్తించండి
```

### పరీక్షలను నడపడం

```bash
# ఒకే పరీక్ష ఫైల్ (Node.js స్థానిక పరీక్ష రన్నర్ — ఎక్కువ పరీక్షలు)
node --import tsx/esm --test tests/unit/your-file.test.ts

# Vitest (MCP సర్వర్, autoCombo, కాష్)
npm run test:vitest

# అన్ని సూట్లు
npm run test:all
```

పూర్తి పరీక్ష మ్యాట్రిక్స్ కోసం, `CONTRIBUTING.md` → "పరీక్షలను నడపడం" చూడండి. లోతైన నిర్మాణం కోసం, `AGENTS.md` చూడండి.

---

## ప్రాజెక్ట్ ఒక చూపులో

**OmniRoute** — ఏకీకృత AI ప్రాక్సీ/రౌటర్. ఒక ఎండ్‌పాయింట్, 329 LLM ప్రొవైడర్లు, ఆటో-ఫాల్బ్యాక్.

| పొర              | స్థానం                  | ఉద్దేశ్యం                                                                 |
| ---------------- | ----------------------- | ------------------------------------------------------------------------- |
| API రూట్లు       | `src/app/api/v1/`       | Next.js యాప్ రౌటర్ — ప్రవేశ బిందువులు                                     |
| హ్యాండ్లర్లు     | `open-sse/handlers/`    | అభ్యర్థన ప్రాసెసింగ్ (చాట్, ఎంబెడింగ్స్, మొదలైనవి)                        |
| ఎగ్జిక్యూటర్లు   | `open-sse/executors/`   | ప్రొవైడర్-స్పెసిఫిక్ HTTP డిస్పాచ్                                        |
| అనువాదకులు       | `open-sse/translator/`  | ఫార్మాట్ మార్పిడి (OpenAI↔Claude↔Gemini)                                  |
| ట్రాన్స్‌ఫార్మర్ | `open-sse/transformer/` | స్పందనలు API ↔ చాట్ పూర్తి చేయడం                                          |
| సేవలు            | `open-sse/services/`    | కాంబో రౌటింగ్, రేటు పరిమితులు, కాషింగ్, మొదలైనవి                          |
| డేటాబేస్         | `src/lib/db/`           | 110 top-level SQLite domain modules, 130 migrations                       |
| డొమైన్/పాలసీ     | `src/domain/`           | పాలసీ ఇంజిన్, ఖర్చు నియమాలు, ఫాల్బ్యాక్ లాజిక్                            |
| MCP సర్వర్       | `open-sse/mcp-server/`  | 107 unique tools, 3 transports (stdio / SSE / Streamable HTTP), 32 scopes |
| A2A సర్వర్       | `src/lib/a2a/`          | JSON-RPC 2.0 ఏజెంట్ ప్రోటోకాల్                                            |
| నైపుణ్యాలు       | `src/lib/skills/`       | విస్తరించదగిన నైపుణ్య ఫ్రేమ్‌వర్క్                                        |
| మెమరీ            | `src/lib/memory/`       | స్థిరమైన సంభాషణ మెమరీ                                                     |

Monorepo: `src/` (Next.js 16 యాప్), `open-sse/` (స్ట్రీమింగ్ ఇంజిన్ వర్క్‌స్పేస్), `apps/desktop/` (డెస్క్‌టాప్ యాప్), `tests/`, `bin/` (CLI ప్రవేశ బిందువు).

## అభ్యర్థన పైప్‌లైన్

```
Client → /v1/chat/completions (Next.js మార్గం)
  → CORS → Zod ధృవీకరణ → auth? → విధానం తనిఖీ → ప్రాంప్ట్ ఇంజెక్షన్ గార్డ్
  → handleChatCore() [open-sse/handlers/chatCore.ts]
    → కాష్ తనిఖీ → రేటు పరిమితి → కాంబో రూటింగ్?
      → resolveComboTargets() → handleSingleModel() ప్రతి లక్ష్యానికి
    → translateRequest() → getExecutor() → executor.execute()
      → fetch() అప్‌స్ట్రీమ్ → తిరిగి ప్రయత్నించండి w/ బ్యాకాఫ్
    → స్పందన అనువాదం → SSE స్ట్రీమ్ లేదా JSON
    → If Responses API: responsesTransformer.ts TransformStream
```

API మార్గాలు ఒక సుసంగత నమూనాను అనుసరిస్తాయి: `Route → CORS ప్రీఫ్లైట్ → Zod శరీర ధృవీకరణ → ఐచ్ఛిక auth (extractApiKey/isValidApiKey) → API కీ విధానం అమలు → హ్యాండ్లర్ డెలిగేషన్ (open-sse)`. ఏ గ్లోబల్ Next.js మిడ్‌లెయిర్ లేదు — అంతరాయము మార్గానికి ప్రత్యేకంగా ఉంటుంది.

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
