# CLAUDE.md (한국어)

🌐 **Languages:** 🇺🇸 [English](../../../CLAUDE.md) · 🇸🇦 [ar](../ar/CLAUDE.md) · 🇦🇿 [az](../az/CLAUDE.md) · 🇧🇬 [bg](../bg/CLAUDE.md) · 🇧🇩 [bn](../bn/CLAUDE.md) · 🇨🇿 [cs](../cs/CLAUDE.md) · 🇩🇰 [da](../da/CLAUDE.md) · 🇩🇪 [de](../de/CLAUDE.md) · 🇬🇷 [el](../el/CLAUDE.md) · 🇪🇸 [es](../es/CLAUDE.md) · 🇪🇪 [et](../et/CLAUDE.md) · 🇮🇷 [fa](../fa/CLAUDE.md) · 🇫🇮 [fi](../fi/CLAUDE.md) · 🇫🇷 [fr](../fr/CLAUDE.md) · 🇮🇪 [ga](../ga/CLAUDE.md) · 🇮🇳 [gu](../gu/CLAUDE.md) · 🇮🇱 [he](../he/CLAUDE.md) · 🇮🇳 [hi](../hi/CLAUDE.md) · 🇭🇷 [hr](../hr/CLAUDE.md) · 🇭🇺 [hu](../hu/CLAUDE.md) · 🇮🇩 [id](../id/CLAUDE.md) · 🇮🇹 [it](../it/CLAUDE.md) · 🇯🇵 [ja](../ja/CLAUDE.md) · 🇱🇹 [lt](../lt/CLAUDE.md) · 🇱🇻 [lv](../lv/CLAUDE.md) · 🇮🇳 [mr](../mr/CLAUDE.md) · 🇲🇾 [ms](../ms/CLAUDE.md) · 🇲🇹 [mt](../mt/CLAUDE.md) · 🇳🇱 [nl](../nl/CLAUDE.md) · 🇳🇴 [no](../no/CLAUDE.md) · 🇵🇭 [phi](../phi/CLAUDE.md) · 🇵🇱 [pl](../pl/CLAUDE.md) · 🇵🇹 [pt](../pt/CLAUDE.md) · 🇧🇷 [pt-BR](../pt-BR/CLAUDE.md) · 🇷🇴 [ro](../ro/CLAUDE.md) · 🇷🇺 [ru](../ru/CLAUDE.md) · 🇸🇰 [sk](../sk/CLAUDE.md) · 🇸🇮 [sl](../sl/CLAUDE.md) · 🇷🇸 [sr](../sr/CLAUDE.md) · 🇸🇪 [sv](../sv/CLAUDE.md) · 🇰🇪 [sw](../sw/CLAUDE.md) · 🇮🇳 [ta](../ta/CLAUDE.md) · 🇮🇳 [te](../te/CLAUDE.md) · 🇹🇭 [th](../th/CLAUDE.md) · 🇹🇷 [tr](../tr/CLAUDE.md) · 🇺🇦 [uk-UA](../uk-UA/CLAUDE.md) · 🇵🇰 [ur](../ur/CLAUDE.md) · 🇻🇳 [vi](../vi/CLAUDE.md) · 🇨🇳 [zh-CN](../zh-CN/CLAUDE.md) · 🇹🇼 [zh-TW](../zh-TW/CLAUDE.md)

---

이 파일은 이 리포지토리에서 코드를 작업할 때 Claude Code (claude.ai/code)에 대한 지침을 제공합니다.

## 빠른 시작

```bash
npm install                    # 의존성 설치 (.env.example에서 .env 자동 생성)
npm run dev                    # http://localhost:20128에서 개발 서버 실행
npm run build                  # 프로덕션 빌드 (Next.js 16 독립형)
npm run lint                   # ESLint (0 오류 예상; 경고는 기존)
npm run typecheck:core         # TypeScript 검사 (깨끗해야 함)
npm run typecheck:noimplicit:core  # 엄격 검사 (암시적 any 없음)
npm run test:coverage          # 단위 테스트 + 커버리지 게이트 (75/75/75/70 — 문장/라인/함수/브랜치)
npm run check                  # lint + 테스트 결합
npm run check:cycles           # 순환 의존성 감지
```

### 테스트 실행

```bash
# 단일 테스트 파일 (Node.js 기본 테스트 러너 — 대부분의 테스트)
node --import tsx/esm --test tests/unit/your-file.test.ts

# Vitest (MCP 서버, autoCombo, 캐시)
npm run test:vitest

# 모든 테스트 스위트
npm run test:all
```

전체 테스트 매트릭스는 `CONTRIBUTING.md` → "테스트 실행"을 참조하세요. 심층 아키텍처는 `AGENTS.md`를 참조하세요.

---

## 프로젝트 개요

**OmniRoute** — 통합 AI 프록시/라우터. 하나의 엔드포인트, 329 LLM 제공자, 자동 대체.

| 레이어       | 위치                    | 목적                                                                      |
| ------------ | ----------------------- | ------------------------------------------------------------------------- |
| API 라우트   | `src/app/api/v1/`       | Next.js 앱 라우터 — 진입점                                                |
| 핸들러       | `open-sse/handlers/`    | 요청 처리 (채팅, 임베딩 등)                                               |
| 실행기       | `open-sse/executors/`   | 제공자별 HTTP 디스패치                                                    |
| 변환기       | `open-sse/translator/`  | 형식 변환 (OpenAI↔Claude↔Gemini)                                          |
| 변환기       | `open-sse/transformer/` | 응답 API ↔ 채팅 완성                                                      |
| 서비스       | `open-sse/services/`    | 조합 라우팅, 속도 제한, 캐싱 등                                           |
| 데이터베이스 | `src/lib/db/`           | 110 top-level SQLite domain modules, 130 migrations                       |
| 도메인/정책  | `src/domain/`           | 정책 엔진, 비용 규칙, 대체 논리                                           |
| MCP 서버     | `open-sse/mcp-server/`  | 107 unique tools, 3 transports (stdio / SSE / Streamable HTTP), 32 scopes |
| A2A 서버     | `src/lib/a2a/`          | JSON-RPC 2.0 에이전트 프로토콜                                            |
| 기술         | `src/lib/skills/`       | 확장 가능한 기술 프레임워크                                               |
| 메모리       | `src/lib/memory/`       | 지속적인 대화형 메모리                                                    |

모노레포: `src/` (Next.js 16 앱), `open-sse/` (스트리밍 엔진 작업 공간), `apps/desktop/` (데스크탑 앱), `tests/`, `bin/` (CLI 진입점).

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
