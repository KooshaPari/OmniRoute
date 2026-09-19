# CLAUDE.md (Français)

**Languages:** [English](../../../CLAUDE.md) · [ar](../ar/CLAUDE.md) · [az](../az/CLAUDE.md) · [bg](../bg/CLAUDE.md) · [bn](../bn/CLAUDE.md) · [cs](../cs/CLAUDE.md) · [da](../da/CLAUDE.md) · [de](../de/CLAUDE.md) · [el](../el/CLAUDE.md) · [es](../es/CLAUDE.md) · [et](../et/CLAUDE.md) · [fa](../fa/CLAUDE.md) · [fi](../fi/CLAUDE.md) · [ga](../ga/CLAUDE.md) · [gu](../gu/CLAUDE.md) · [he](../he/CLAUDE.md) · [hi](../hi/CLAUDE.md) · [hr](../hr/CLAUDE.md) · [hu](../hu/CLAUDE.md) · [id](../id/CLAUDE.md) · [it](../it/CLAUDE.md) · [ja](../ja/CLAUDE.md) · [ko](../ko/CLAUDE.md) · [lt](../lt/CLAUDE.md) · [lv](../lv/CLAUDE.md) · [mr](../mr/CLAUDE.md) · [ms](../ms/CLAUDE.md) · [mt](../mt/CLAUDE.md) · [nl](../nl/CLAUDE.md) · [no](../no/CLAUDE.md) · [phi](../phi/CLAUDE.md) · [pl](../pl/CLAUDE.md) · [pt](../pt/CLAUDE.md) · [pt-BR](../pt-BR/CLAUDE.md) · [ro](../ro/CLAUDE.md) · [ru](../ru/CLAUDE.md) · [sk](../sk/CLAUDE.md) · [sl](../sl/CLAUDE.md) · [sr](../sr/CLAUDE.md) · [sv](../sv/CLAUDE.md) · [sw](../sw/CLAUDE.md) · [ta](../ta/CLAUDE.md) · [te](../te/CLAUDE.md) · [th](../th/CLAUDE.md) · [tr](../tr/CLAUDE.md) · [uk-UA](../uk-UA/CLAUDE.md) · [ur](../ur/CLAUDE.md) · [vi](../vi/CLAUDE.md) · [zh-CN](../zh-CN/CLAUDE.md) · [zh-TW](../zh-TW/CLAUDE.md)

---

Ce fichier fournit des conseils à Claude Code (claude.ai/code) lors de l'utilisation du code dans ce dépôt.

## Démarrage rapide

```bash
npm install                    # Installer les dépendances (génère automatiquement .env à partir de .env.example)
npm run dev                    # Serveur de développement à http://localhost:20128
npm run build                  # Construction de production (Next.js 16 autonome)
npm run lint                   # ESLint (0 erreurs attendues ; les avertissements sont préexistants)
npm run typecheck:core         # Vérification TypeScript (doit être propre)
npm run typecheck:noimplicit:core  # Vérification stricte (pas d'implicite any)
npm run test:coverage          # Tests unitaires + seuil de couverture (75/75/75/70 — déclarations/lignes/fonctions/branches)
npm run check                  # lint + test combinés
npm run check:cycles           # Détecter les dépendances circulaires
```

### Exécution des tests

```bash
# Fichier de test unique (exécuteur de test natif Node.js — la plupart des tests)
node --import tsx/esm --test tests/unit/your-file.test.ts

# Vitest (serveur MCP, autoCombo, cache)
npm run test:vitest

# Tous les suites
npm run test:all
```

Pour la matrice de tests complète, voir `CONTRIBUTING.md` → "Exécution des tests". Pour une architecture approfondie, voir `AGENTS.md`.

---

## Projet en un coup d'œil

**OmniRoute** — proxy/router AI unifié. Un point de terminaison, 329 fournisseurs LLM, retour automatique.

| Couche            | Emplacement             | Objectif                                                                  |
| ----------------- | ----------------------- | ------------------------------------------------------------------------- |
| Routes API        | `src/app/api/v1/`       | Routeur d'application Next.js — points d'entrée                           |
| Gestionnaires     | `open-sse/handlers/`    | Traitement des requêtes (chat, embeddings, etc)                           |
| Exécuteurs        | `open-sse/executors/`   | Dispatch HTTP spécifique au fournisseur                                   |
| Traducteurs       | `open-sse/translator/`  | Conversion de format (OpenAI↔Claude↔Gemini)                               |
| Transformateur    | `open-sse/transformer/` | API de réponses ↔ Complétions de chat                                     |
| Services          | `open-sse/services/`    | Routage combiné, limites de taux, mise en cache, etc                      |
| Base de données   | `src/lib/db/`           | 110 top-level SQLite domain modules, 130 migrations                       |
| Domaine/Politique | `src/domain/`           | Moteur de politique, règles de coût, logique de retour                    |
| Serveur MCP       | `open-sse/mcp-server/`  | 107 unique tools, 3 transports (stdio / SSE / Streamable HTTP), 32 scopes |
| Serveur A2A       | `src/lib/a2a/`          | Protocole agent JSON-RPC 2.0                                              |
| Compétences       | `src/lib/skills/`       | Cadre de compétences extensible                                           |
| Mémoire           | `src/lib/memory/`       | Mémoire conversationnelle persistante                                     |

Monorepo : `src/` (application Next.js 16), `open-sse/` (espace de travail moteur de streaming), `apps/desktop/` (application de bureau), `tests/`, `bin/` (point d'entrée CLI).

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
