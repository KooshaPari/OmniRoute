# CLAUDE.md (Español)

🌐 **Languages:** 🇺🇸 [English](../../../CLAUDE.md) · 🇸🇦 [ar](../ar/CLAUDE.md) · 🇦🇿 [az](../az/CLAUDE.md) · 🇧🇬 [bg](../bg/CLAUDE.md) · 🇧🇩 [bn](../bn/CLAUDE.md) · 🇨🇿 [cs](../cs/CLAUDE.md) · 🇩🇰 [da](../da/CLAUDE.md) · 🇩🇪 [de](../de/CLAUDE.md) · 🇬🇷 [el](../el/CLAUDE.md) · 🇪🇪 [et](../et/CLAUDE.md) · 🇮🇷 [fa](../fa/CLAUDE.md) · 🇫🇮 [fi](../fi/CLAUDE.md) · 🇫🇷 [fr](../fr/CLAUDE.md) · 🇮🇪 [ga](../ga/CLAUDE.md) · 🇮🇳 [gu](../gu/CLAUDE.md) · 🇮🇱 [he](../he/CLAUDE.md) · 🇮🇳 [hi](../hi/CLAUDE.md) · 🇭🇷 [hr](../hr/CLAUDE.md) · 🇭🇺 [hu](../hu/CLAUDE.md) · 🇮🇩 [id](../id/CLAUDE.md) · 🇮🇹 [it](../it/CLAUDE.md) · 🇯🇵 [ja](../ja/CLAUDE.md) · 🇰🇷 [ko](../ko/CLAUDE.md) · 🇱🇹 [lt](../lt/CLAUDE.md) · 🇱🇻 [lv](../lv/CLAUDE.md) · 🇮🇳 [mr](../mr/CLAUDE.md) · 🇲🇾 [ms](../ms/CLAUDE.md) · 🇲🇹 [mt](../mt/CLAUDE.md) · 🇳🇱 [nl](../nl/CLAUDE.md) · 🇳🇴 [no](../no/CLAUDE.md) · 🇵🇭 [phi](../phi/CLAUDE.md) · 🇵🇱 [pl](../pl/CLAUDE.md) · 🇵🇹 [pt](../pt/CLAUDE.md) · 🇧🇷 [pt-BR](../pt-BR/CLAUDE.md) · 🇷🇴 [ro](../ro/CLAUDE.md) · 🇷🇺 [ru](../ru/CLAUDE.md) · 🇸🇰 [sk](../sk/CLAUDE.md) · 🇸🇮 [sl](../sl/CLAUDE.md) · 🇷🇸 [sr](../sr/CLAUDE.md) · 🇸🇪 [sv](../sv/CLAUDE.md) · 🇰🇪 [sw](../sw/CLAUDE.md) · 🇮🇳 [ta](../ta/CLAUDE.md) · 🇮🇳 [te](../te/CLAUDE.md) · 🇹🇭 [th](../th/CLAUDE.md) · 🇹🇷 [tr](../tr/CLAUDE.md) · 🇺🇦 [uk-UA](../uk-UA/CLAUDE.md) · 🇵🇰 [ur](../ur/CLAUDE.md) · 🇻🇳 [vi](../vi/CLAUDE.md) · 🇨🇳 [zh-CN](../zh-CN/CLAUDE.md) · 🇹🇼 [zh-TW](../zh-TW/CLAUDE.md)

---

Este archivo proporciona orientación a Claude Code (claude.ai/code) al trabajar con código en este repositorio.

## Inicio Rápido

```bash
npm install                    # Instalar dependencias (genera automáticamente .env a partir de .env.example)
npm run dev                    # Servidor de desarrollo en http://localhost:20128
npm run build                  # Construcción de producción (Next.js 16 independiente)
npm run lint                   # ESLint (se esperan 0 errores; las advertencias son preexistentes)
npm run typecheck:core         # Verificación de TypeScript (debería estar limpio)
npm run typecheck:noimplicit:core  # Verificación estricta (sin any implícito)
npm run test:coverage          # Pruebas unitarias + puerta de cobertura (75/75/75/70 — declaraciones/líneas/funciones/ramas)
npm run check                  # lint + test combinados
npm run check:cycles           # Detectar dependencias circulares
```

### Ejecución de Pruebas

```bash
# Archivo de prueba único (ejecutor de pruebas nativo de Node.js — la mayoría de las pruebas)
node --import tsx/esm --test tests/unit/your-file.test.ts

# Vitest (servidor MCP, autoCombo, caché)
npm run test:vitest

# Todas las suites
npm run test:all
```

Para la matriz completa de pruebas, consulta `CONTRIBUTING.md` → "Ejecución de Pruebas". Para una arquitectura profunda, consulta `AGENTS.md`.

---

## Proyecto a Simple Vista

**OmniRoute** — proxy/router de IA unificado. Un punto final, 329 proveedores de LLM, retroceso automático.

| Capa             | Ubicación               | Propósito                                                                 |
| ---------------- | ----------------------- | ------------------------------------------------------------------------- |
| Rutas API        | `src/app/api/v1/`       | Enrutador de Aplicaciones Next.js — puntos de entrada                     |
| Manejadores      | `open-sse/handlers/`    | Procesamiento de solicitudes (chat, embeddings, etc)                      |
| Ejecutores       | `open-sse/executors/`   | Despacho HTTP específico del proveedor                                    |
| Traductores      | `open-sse/translator/`  | Conversión de formato (OpenAI↔Claude↔Gemini)                              |
| Transformador    | `open-sse/transformer/` | API de respuestas ↔ Completaciones de Chat                                |
| Servicios        | `open-sse/services/`    | Enrutamiento combinado, límites de tasa, caché, etc                       |
| Base de Datos    | `src/lib/db/`           | 110 top-level SQLite domain modules, 130 migrations                       |
| Dominio/Política | `src/domain/`           | Motor de políticas, reglas de costo, lógica de retroceso                  |
| Servidor MCP     | `open-sse/mcp-server/`  | 107 unique tools, 3 transports (stdio / SSE / Streamable HTTP), 32 scopes |
| Servidor A2A     | `src/lib/a2a/`          | Protocolo de agente JSON-RPC 2.0                                          |
| Habilidades      | `src/lib/skills/`       | Marco de habilidades extensible                                           |
| Memoria          | `src/lib/memory/`       | Memoria conversacional persistente                                        |

Monorepo: `src/` (aplicación Next.js 16), `open-sse/` (espacio de trabajo del motor de streaming), `apps/desktop/` (aplicación de escritorio), `tests/`, `bin/` (punto de entrada CLI).

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
