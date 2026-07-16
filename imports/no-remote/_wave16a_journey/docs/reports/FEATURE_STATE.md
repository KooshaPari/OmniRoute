# Feature-State Inventory — KooshaPari/Phenotype multi-repo (2026-06-30)

**Owner:** domain-C sweep | **Cycle:** 2 of N | **Status:** SHIPPED-VALIDATED
**Author:** KooshaPari <kooshapari@users.noreply.github.com>

This answers the operator's standing question: where do the
**memory / context-engine / retrieval-engine / dynamic-workflows /
Claude-Code-parity** features actually stand across the Phenotype repos
as of 2026-06-30? Each row is direct-on-disk evidence, not memory.

| # | Feature lane                  | Repo:path                                               | State     | PR / branch                                                                       | Note (intent + what blocks revival)                                                                                                                                                                                                                                                                                                  |
| - | ----------------------------- | ------------------------------------------------------- | --------- | --------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1 | **MEMORY — adapter facade**   | `KooshaPari/thegent:crates/thegent-memory/src/v2/`     | SHIPPED   | PR #1144 merged; ADR-098 commit `a0b201462` (2026-06-24)                          | `MemoryPort` trait + `CompositeAdapter` + **7 adapters**: `cognee.rs`, `graphiti.rs`, `hippo.rs`, `letta.rs`, `mem0.rs`, `supermemory.rs`, `zep.rs`. Trait conformance tested.                                                                                                       |
| 2 | **MEMORY — client (v1)**      | `KooshaPari/thegent:crates/thegent-memory/src/`        | SHIPPED   | Earlier v1 (predecessor of v2)                                                    | `client.rs`, `types.rs`, `error.rs`, `lib.rs`. Kept as legacy API.                                                                                                                                                                                                            |
| 3 | **MEMORY — vector store**     | `KooshaPari/OmniRoute:src/lib/memory/`                  | SHIPPED   | Multiple, current head `bfaf459`                                                   | `store.ts`, `vectorStore.ts`, `qdrant.ts`, `reindex.ts`, `settings.ts`, `embedding/{staticPotion, transformersLocal, remote, types, cache}.ts`. 5 embedding backends, qdrant client. Production code.                                                                              |
| 4 | **MEMORY — substrate adapter**| `KooshaPari/substrate:crates/substrate-memory/src/lib.rs` | SHIPPED (minimal) | `e6da56f feat: skills + memory superset`                                           | Single-file stub — `MemoryPort` declared but no implementations shipped in repo. Two-tier ring + persistent described in commit msg; concrete impl in sister crate.                                                                                                            |
| 5 | **CONTEXT ENGINE** (claimed)  | `OmniRoute:.claude/worktrees/context-engine`            | **ABANDONED-MISNAMED** | Branch `research/context-engine-domain` on `refactor-combo-extract-responseQuality` tip | **NO context-engine code exists.** Branch only contains the 2 responseQuality refactor commits (PR #028 + #170). The branch name was set but the actual context-engine work was never started. **Recommend archive/rename.**                                                            |
| 6 | **CONTEXT INJECTION**         | `KooshaPari/thegent:src/thegent/context/`               | STUB      | n/a                                                                               | Single `__init__.py` in `context/` and `context_injection/__init__.py`, both effectively empty. Test file `tests/skills` exists separately. **WIP — never fleshed out.**                                                                                                     |
| 7 | **RETRIEVAL ENGINE**          | `OmniRoute:.claude/worktrees/retrieval-engine`          | **ABANDONED-EMPTY** | Worktree dir 0 files; branch tip `refactor-combo-extract-responseQuality`         | **NO retrieval-engine code exists.** Worktree was created at 08:33 PDT (2026-06-30) by a sibling session; no commits were made. `D` markers show files "deleted" only because of git index corruption. **Recommend dir + branch deletion.**                                          |
| 8 | **RETRIEVAL — research_engine** | `KooshaPari/thegent:src/research_engine/`             | STUB      | n/a                                                                               | `cli.py` is `"""CLI - STUB."""` with `app = None`, `ResearchCLI.run()` is `pass`. Six python files (17+18+34+21+~30 lines), 17 test files in `tests/research_engine/`, but no working CLI. **Stub since 2024.**                                                              |
| 9 | **DYNAMIC WORKFLOWS**         | `KooshaPari/sharecli:.claude/worktrees/dyn-workflows`   | **RECON-ONLY** | Branch `chore/dyn-workflows-recon`; commit `96a689d docs(dyn-workflows)` (2026-06-30 08:42) | 303-line recon doc in `docs/changes/dyn-workflows/01-architecture-sketch.md` only. **No code**: zero `wf*/dag/pipeline` matches in `src/`, no `Workflow`/`Dag`/`Pipeline` types, no `wf` subcommand. **Verdict: greenfield on top of ready-made primitives** (Zig semaphore, ProcessPool, 16 strategies). **Recommend codex-dispatch next.** |
| 10 | **DYNAMIC WORKFLOWS — substrate dispatch** | `KooshaPari/substrate:crates/{dispatch-bridge,substrate-dag,context-budget,wave,wave-3lane-tests,scheduler}` | SHIPPED (partial) | Multiple PRs incl. #57 tiered dispatch, #62 registry publish                      | Real DAG primitive. `dispatch-bridge` + `substrate-dag` exist. **No workflow-schema YAML/JSON loader yet.** This is the substrate that the sharecli dyn-workflows lane would bind to.                                                                                                          |
| 11 | **CC-PARITY — hooks (thegent)** | `KooshaPari/thegent:{hooks/,crates/thegent-hooks/}`    | SHIPPED   | zig-build + Rust dispatcher + 30+ shell hooks                                     | `hooks/bin/{hook-dispatcher, thegent-hooks}`; `hooks/zig/{build.zig, src/, WASM_STATUS.md}`; `crates/thegent-hooks/src/` with `tests/{changed_files_enhancement,phase1_5_git_enhancement,hook_io_contracts,security_pipeline_bin,prewarm_integration,hook_output_contracts,report_integration,phase1_cli}.rs`. 8 hook-test suites.                          |
| 12 | **CC-PARITY — plugin host**   | `KooshaPari/thegent:crates/thegent-plugin-host/`        | SHIPPED   | PR #1058 (commit `fb4a3072c`)                                                     | `src/{lib,main,runtime}.rs` + `tests/plugin_tests.rs`. Replaces gitlink with files; resolves duplicate module declarations.                                                                                                                                                       |
| 13 | **CC-PARITY — A2A skills (thegent)** | `KooshaPari/thegent:src/thegent/` + `KooshaPari/OmniRoute:src/lib/a2a/skills/` | SHIPPED — OmniRoute complete | OmniRoute PRs #72,#83,#63,#62 (costAnalysis, smartRouting, healthReport, quotaManagement, providerDiscovery) | OmniRoute **5 skills shipped**: `providerDiscovery.ts`, `costAnalysis.ts`, `smartRouting.ts`, `quotaManagement.ts`, `listCapabilities.ts` + `taskManager.ts`, `taskExecution.ts`, `streaming.ts`, `otelContext.ts`, `routingLogger.ts`. **Closes 5 of 9 of DEBT-006.**                                                  |
| 14 | **CC-PARITY — skills framework** | `KooshaPari/OmniRoute:src/lib/skills/`               | THIN      | n/a                                                                               | Only 2 files: `providerSettings.ts`, `registry.ts`. Compared to `src/lib/a2a/skills/` (5 shipping skills), this library is just a registry skeleton. **Likely on purpose** — implementation lives in `a2a/skills/`.                                                                            |
| 15 | **CC-PARITY — slash commands + subagents** | `KooshaPari/thegent:{commands,.claude,.kilocode/workflows,.factory/}` | SHIPPED (thegent-only) | n/a                                                                           | `.claude/{commands, settings.json, verification/}` (slash), `.kilocode/workflows/` (5 subagent workflow .md), `.factory/{closure_pack_*.md, config.json, settings.json}` (auto-commit stacks), `factory-seed/thegent-skills/SKILL.md`. Not ported to other repos.                |
| 16 | **CC-PARITY — forgecode skills+hooks** | `KooshaPari/forgecode:crates/{forge_repo/src/skills, forge_app/src/hooks}` | SHIPPED | commit `4b42117c3 feat(repo-map): tree-sitter repo map` (2026-06-30)        | Skill registry path under `forge_repo`, hooks under `forge_app`. Most recent repo work; tree-sitter integration is the new ship.                                                                                                                                                  |
| 17 | **CC-PARITY — substrate hooks** | `KooshaPari/substrate:./.git/hooks` (autoinstall only) | SHIPPED (auto) | n/a                                                              | Default git-hook templates only; no `crates/substrate-hooks/` ship. **Compared to thegent's 30+ hooks, substrate is bare.**                                                                                                                            |

## TL;DR for the operator

**Shipped and reuseable today** (10): rows 1, 2, 3, 11, 12, 13, 15, 16
+ partial 4 + 10.

**Thin/stub that need love** (4): rows 6 (context injection), 8 (research_engine
CLI stub), 14 (skills framework skeleton), 4 (substrate-memory single-file).

**Explicitly abandoned mid-flight, recommend GC** (2):
- **Row 5 / `research/context-engine-domain`**: branch is misnamed — it has
  only responseQuality PR #028 commits, no context-engine work. **Action:**
  delete branch + worktree dir.
- **Row 7 / `retrieval-engine`**: empty worktree + 0 unique commits. **Action:**
  delete worktree + branch.

**Greenfield on top of good primitives, recommend codex-dispatch next** (1):
- **Row 9 / dyn-workflows**: sharecli recon doc is solid (303 lines,
  author `KooshaPari@users.noreply`, branch `chore/dyn-workflows-recon`).
  The Zig semaphore, ProcessPool, and 16 strategies are already in place.
  Codex-exec prompt at `docs/changes/dyn-workflows/01-architecture-sketch.md`
  is ready — needs `Workflow` type, `WorkflowStep` enum, topological
  executor, YAML/JSON loader, `wf` subcommand.

## Hygiene notes

- 5 worktree-level `D`-marker artifacts visible on OmniRoute + phenotype-org-audits
  are **NOT** real deletions — they're stale-index artifacts from
  repo-wide index lock contention. Don't `rm`; the sibling session
  that holds the lock will reconcile.
- 3 of the worktrees (context-engine, retrieval-engine, dyn-workflows)
  were created by sibling sessions during rebase-wave / research sweeps
  (08:33–08:48 PDT today). The dirs persist post-mortem.

## Methodology

- Sweep ran across all 145 `KooshaPari/*` repos via `gh repo list`.
- Recent activity filter: `pushedAt >= 2026-06-28` (28 active repos).
- Each row's "Note" cites concrete file paths or commit SHAs;
  no claim is memory-only.
- Branch / worktree state machine-checked via `git worktree list`,
  `git for-each-ref`, and `gh pr list`.

## Audit + cross-references

- Memory: `feedback-archived-repos-full-2026-06-30` — 38 archived repos to skip.
- Memory: `feedback-worktree-on-conflict` — switch to worktree when `.git/index.lock`
  appears, don't `rm` the lock.
- Memory: `feedback-rnd-lab-mandate` — proactively find latent issues across repos.
- Memory: `autonomous-repo-lab-goal` — durable heartbeat to keep sweeping.
