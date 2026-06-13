# Context Management Strategy

## The Manager Pattern

**CRITICAL**: Operate as a strategic manager, not a worker. Delegate to subagents.

### Keep in Main Context
- User intent and requirements
- Strategic decisions and trade-offs
- Summaries of completed work
- Critical architectural knowledge

### Delegate to Subagents
- File exploration (>3 files)
- Pattern searches across codebase
- Multi-file implementations
- Long command sequences
- Test execution

---

## Delegation Quick Reference

| Need | Delegate To | Example Prompt |
|------|-------------|----------------|
| Find code patterns | `Explore` | "Find all error handling patterns" |
| Design approach | `Plan` | "Design auth implementation strategy" |
| Run commands | `Bash` | "Run test suite and report failures" |
| Multi-step implementation | `general-purpose` | "Implement and test feature X" |
| Agent/droid tasks | **Native CLI** or **thegent** | See Subagent deployment below |
| Quick isolated fix | DO NOT delegate | Handle directly |

### Parallel vs Sequential

**Parallel** (no dependencies):
- Launch 2-3 explore agents simultaneously for independent searches

**Sequential** (dependent):
1. explore -> receive summary
2. plan based on findings -> receive plan
3. implement approved plan

---

## Subagent swarm (async orchestration)

**If you have subagent/swarm capabilities:** Use them as an **async swarm** so you can keep working and reawaken as tasks finish.

- **Call task agents async.** Do not block on each one. Fire tasks so that as each completes, you are **reawoken** and can re-evaluate, spawn more agents, or do more work yourself. The system can reawake you on each agent completion.
- **Run a swarm.** You can run many task agents in parallel (use best judgment; break down and isolate tasks well). **Max 50 concurrent task agents at a time**—not 5. Scale up when the work is well decomposed and independent.
- **Work in between.** While tasks run async, use your own context to do planning, monitoring, or other work. Monitor spawned agents and react when they complete.
- **Reawaken on completion.** When you go idle, you will be reawoken as each agent completes. Use that to: spawn more agents for the next batch, do follow-up work, or consolidate results. Effectively: call a swarm → stay available → reawake on each completion → spawn more or continue until done.

### Subagent deployment: native CLI + thegent

Use **both** native subagents (when present in CLI tools) and thegent subagents:

- **Native subagents:** Cursor Agent, Gemini CLI, Codex subagent, Copilot CLI, Claude Code—invoke these directly when the tool exposes subagent/agent capabilities (e.g. `cursor agent`, `codex-subagent`).
- **Thegent subagents:** `thegent run gemini`, `thegent run droid`, `thegent run cursor`, `thegent run codex`, `thegent run copilot`, `thegent run claude`—use thegent for unified orchestration, model passthrough, and droid dispatch.

Prefer native when you need tool-specific behavior; use thegent for cross-provider orchestration, droids, or when model/env control is needed. See `docs/reference/THGENT_QUICK_REFERENCE.md`.

---

## Anti-Patterns

| Bad | Good |
|-----|------|
| Reading 10 files to "understand" | Delegate exploration, get summary |
| Editing files for multi-file changes | Delegate to `general-purpose` |
| Sequential explorations one-by-one | Batch parallel explores |
| Asking subagent for "all results" | Ask for "summary" or "key files" |

---

## Context Budget Rule

If task adds >2000 tokens of file content/output, **delegate it**.

---

## Optionality and failure behavior

**Project stance (required):** **Require** dependencies where they belong; **require** clear, loud failures—no silent or “graceful” degradation.

- **Force requirement where it belongs.** Do not make dependencies “optional” just to avoid startup or runtime failure. If a service or config is required for correctness (e.g. go-backend, temporal-host, database), treat it as required and fail when it is missing or down.
- **Fail clearly, not silently.** You **must** use explicit failures (preflight failed, runtime error)—not continuing with reduced functionality, logging-only warnings, or hiding errors. Users and operators **must** see *what* failed (e.g. named items: `go-backend; temporal-host`) and that the process did not silently degrade.
- **Graceful in other ways.** Be “graceful” only via: retries with visible feedback (e.g. “Waiting for X… (2/6)”); error messages that list each failing item (semicolon- or newline-separated); actionable messages and non-obscure stack traces. Do *not* use optionality or silent fallbacks as a substitute for fixing or starting the real dependency.

When adding preflight checks, startup logic, or error handling, follow this stance; do not suggest making required dependencies optional to “fix” failures.

---

## Planner agents: no code in docs or plans

**Planner agents** (e.g. PM, Analyst, Architect, SM, TEA, UX Designer, Tech Writer) must **never write code**, especially in documentation and plans. Their job is to **equip others**—engineer agents or humans—to create code or act on docs. Write specs, acceptance criteria, architecture decisions, and clear handoffs; do not write implementation. Avoid stuffing docs or plans with code where it is not directly relevant; prefer references, file paths, or brief pseudocode when necessary.

---

## Phased WBS and plans with DAGs

When generating **plans**, **roadmaps**, or **implementation breakdowns**, use a **phased Work Breakdown Structure (WBS)** and model **dependencies as a DAG** (directed acyclic graph).

- **Phases:** Structure work into ordered phases (e.g. Phase 1: Discovery/Scope, Phase 2: Design, Phase 3: Build, Phase 4: Test/Validate, Phase 5: Deploy/Handoff). Each phase contains deliverable-oriented work packages.
- **DAG:** Tasks have explicit **predecessors**; no cycles. List dependencies so execution order is unambiguous (e.g. "Task B depends on A; C depends on B" or a table with **Depends On**).
- **Output:** Prefer a phased WBS (hierarchy by phase) plus a dependency list or small DAG (text or diagram). Optionally a table: **Phase | Task ID | Description | Depends On**.
- **Planner agents:** When producing plans or PRDs, always use phased WBS and DAG-style dependencies so implementers and PMs can schedule and parallelize correctly.

---

## Timescales: agent-led, aggressive estimates

**Assume an agent-driven, agent-led environment.** No user or external human intervention beyond prompts and basic elicitation. Do not emit tasks that require the user or stakeholders to do work.

- **Forbidden in plans:** "Schedule external security audit", "Stakeholder Presentation: Present master plan", "Team Kickoff: Assign owners for Phase 1", "Human checkpoint", "Get approval from X", or any step that assigns work to a human. Agents own execution and handoffs; if a deliverable is needed (e.g. a presentation or owner manifest), agents produce it.
- **Effort in agent terms only:** Reframe all effort as **agent actions** (tool calls, subagent batches). Use **aggressive** wall-clock: err on the side of shorter estimates—if in doubt, use the lower bound.
- **Rough mapping (aggressive):**
  - 1 response / trivial change: 1–2 tool calls, &lt;1 min wall clock
  - Small feature (one endpoint, one component): 3–6 tool calls, 1–3 min wall clock
  - Cross-stack feature (2–3 areas): 8–15 tool calls or 2–3 parallel subagents, 3–8 min wall clock
  - Major refactor or new module: 15–30 tool calls or 3–5 parallel subagents, 8–20 min wall clock
  - Multi-phase initiative: decompose into agent batches; each batch 10–20 min wall clock max; no "days" or "weeks" in execution estimates
- **Forbidden phrasing:** "This will take 2 days", "Schedule a review", "Assign owners", "Present to stakeholders", "Human validation required". Use: "N tool calls", "N parallel subagents", "~M min wall clock", "Agent-produced artifact X".

---

# Project Development Instructions

## Dev environment and agents (rtm dev / make dev)

**The user runs `make dev-tui` in their own terminal** as the primary observation dashboard. **Never** run `make dev`, `make dev-tui`, or `make dev-down` — those are user-only commands that would disrupt their session.

**Services use hot reload** (Air for Go, uvicorn --reload for Python, Vite HMR for frontend). Save files and let watchers pick up changes — do not restart services just because you edited code.

### CLI commands for introspection and manipulation

Use these to operate on the **same running stack** without disrupting the user's TUI:

| Action | Command |
|--------|---------|
| Check all service health | `make dev-status` |
| Restart one service | `make dev-restart SERVICE=go-backend` |
| Tail logs (all) | `make dev-logs` |
| Tail logs (one service) | `make dev-logs SERVICE=python-backend` |
| Raw process list | `process-compose process list --port 18080` |
| Stop one service | `process-compose process stop <name> --port 18080` |
| Start one service | `process-compose process start <name> --port 18080` |

All commands talk to the running process-compose instance via `--port 18080`. The user sees updates live in their TUI.

### When to restart a service

- **Code edits:** Do NOT restart — hot reload handles it.
- **Config/env changes:** Restart the affected service only (`make dev-restart SERVICE=X`).
- **Dependency changes** (go.mod, package.json): Restart the affected service.
- **Service crash:** Check logs first (`make dev-logs SERVICE=X`), then restart if needed.
- **Never restart the whole stack** unless the user explicitly asks.

### Logs

- One log file per service under **`.process-compose/logs/`**. Logs are **ephemeral** (truncated on each `make dev` / `make dev-tui` start).
  - Examples: `.process-compose/logs/go-backend.log`, `.process-compose/logs/python-backend.log`, `.process-compose/logs/frontend.log`, `.process-compose/logs/caddy.log`
- **Lifecycle markers:** Each app service log includes injected `[LIFECYCLE] START <service> <timestamp>` at start and `[LIFECYCLE] STOP <service> <timestamp> exit=<code>` on exit so restarts are obvious.
- Prefer reading logs via `make dev-logs SERVICE=X` or the log files directly. Never attach to the user's TUI terminal.

## Package Manager

**Always use `bun` instead of `npm` for all package management tasks.**

- Install: `bun install` (not `npm install`)
- Run scripts: `bun run <script>` (not `npm run <script>`)
- Add dependencies: `bun add <package>` (not `npm install <package>`)
- Dev dependencies: `bun add -d <package>` (not `npm install --save-dev <package>`)

## Native services over Docker; local OSS/free only

**Prefer native services over Docker** for development and tooling. Run Postgres, Redis, Caddy, Prometheus, etc. as **native processes** (e.g. via `make install-native` and process-compose). Use Docker only when native install is not feasible (e.g. CI, production image) or explicitly required. Do not recommend Docker-first for local dev when native orchestration is available.

**Strictly prefer local, OSS, and free.** Do **not** recommend paid online services (SaaS, cloud APIs, paid tiers) when local or free alternatives exist. Prefer: self-hosted, open-source, free-tier, or local tooling. If a feature requires external services, prefer OSS/self-hosted or free options first; document paid options only as fallback and label them clearly. No "use service X (paid)" as the default recommendation.

---

AgilePlus Governance

- This repo uses AgilePlus for spec-driven development
- Feature specs live in `agileplus-specs/` (AgilePlus native format)
- Spec docs (PRD.md, ADR.md, FUNCTIONAL_REQUIREMENTS.md, PLAN.md) are maintained at repo root
- See the AgilePlus documentation for governance workflows

---

## Documentation Organization

**CRITICAL**: All project documentation follows a strict organization structure.

### Root-Level Files (Keep in Root)

Only these files should remain in the project root:
- `README.md` - Main project documentation
- `CHANGELOG.md` - Project changelog
- `AGENTS.md` - AI agent instructions
- `CLAUDE.md` / `claude.md` - Claude-specific instructions
- `00_START_HERE.md` - Getting started guide (if applicable)

### Documentation Structure

All other `.md` files must be organized in `docs/` subdirectories:

```
docs/
├── guides/              # Implementation guides and how-tos
│   └── quick-start/     # Quick start guides
├── reports/             # Completion reports, summaries, status reports
├── research/            # Research summaries, indexes, analysis
├── reference/           # Quick references, API references
└── checklists/          # Implementation checklists, verification lists
```

### File Organization Rules

**When creating or moving documentation:**

1. **Quick Starts** → `docs/guides/quick-start/`
   - Files matching `*QUICK_START*.md` or `*QUICKSTART*.md`

2. **Quick References** → `docs/reference/`
   - Files matching `*QUICK_REFERENCE*.md` or `*QUICK_REF*.md`

3. **Implementation Guides** → `docs/guides/`
   - Files matching `*IMPLEMENTATION_GUIDE*.md` or `*GUIDE*.md`
   - General implementation documentation

4. **Completion Reports** → `docs/reports/`
   - Files matching `*COMPLETE*.md`, `*COMPLETION*.md`, `*SUMMARY*.md`, `*REPORT*.md`
   - Phase completion files (`PHASE_*.md`)
   - Test-related reports (`*TEST*.md`)

5. **Research Files** → `docs/research/`
   - Files matching `*RESEARCH*.md` or `*INDEX*.md`

6. **Checklists** → `docs/checklists/`
   - Files matching `*CHECKLIST*.md`

### AI Agent Instructions

**When working as Claude:**

- **NEVER** create `.md` files in the project root (except the allowed files above)
- **ALWAYS** place new documentation in the appropriate `docs/` subdirectory
- **VERIFY** file location before creating documentation
- **MOVE** misplaced files to correct subdirectories if found
- **REFERENCE** this structure when users ask about documentation organization

### Maintenance

- Use the `organize_docs.sh` script to reorganize misplaced files
- Keep root directory clean and organized
- Reference this structure in all documentation creation workflows

---

## Documentation Organization

**CRITICAL**: All project documentation follows a strict organization structure.

### Root-Level Files (Keep in Root)

Only these files should remain in the project root:
- `README.md` - Main project documentation
- `CHANGELOG.md` - Project changelog
- `AGENTS.md` - AI agent instructions
- `CLAUDE.md` - This file (Claude-specific instructions)
- `00_START_HERE.md` - Getting started guide (if applicable)

### Documentation Structure

All other `.md` files must be organized in `docs/` subdirectories:

```
docs/
├── guides/              # Implementation guides and how-tos
│   └── quick-start/     # Quick start guides
├── reports/             # Completion reports, summaries, status reports
├── research/            # Research summaries, indexes, analysis
├── reference/           # Quick references, API references
└── checklists/          # Implementation checklists, verification lists
```

### File Organization Rules

**When creating or moving documentation:**

1. **Quick Starts** → `docs/guides/quick-start/`
   - Files matching `*QUICK_START*.md` or `*QUICKSTART*.md`

2. **Quick References** → `docs/reference/`
   - Files matching `*QUICK_REFERENCE*.md` or `*QUICK_REF*.md`

3. **Implementation Guides** → `docs/guides/`
   - Files matching `*IMPLEMENTATION_GUIDE*.md` or `*GUIDE*.md`
   - General implementation documentation

4. **Completion Reports** → `docs/reports/`
   - Files matching `*COMPLETE*.md`, `*COMPLETION*.md`, `*SUMMARY*.md`, `*REPORT*.md`
   - Phase completion files (`PHASE_*.md`)
   - Test-related reports (`*TEST*.md`)

5. **Research Files** → `docs/research/`
   - Files matching `*RESEARCH*.md` or `*INDEX*.md`

6. **Checklists** → `docs/checklists/`
   - Files matching `*CHECKLIST*.md`

### AI Agent Instructions

**When working as Claude:**

- **NEVER** create `.md` files in the project root (except the allowed files above)
- **ALWAYS** place new documentation in the appropriate `docs/` subdirectory
- **VERIFY** file location before creating documentation
- **MOVE** misplaced files to correct subdirectories if found
- **REFERENCE** this structure when users ask about documentation organization

### Maintenance

- Use the `organize_docs.sh` script to reorganize misplaced files
- Keep root directory clean and organized
- Reference this structure in all documentation creation workflows


## Development Philosophy

### Extend, Never Duplicate

- NEVER create a v2 file. Refactor the original.
- NEVER create a new class if an existing one can be made generic.
- NEVER create custom implementations when an OSS library exists.
- Before writing ANY new code: search the codebase for existing patterns.

### Primitives First

- Build generic building blocks before application logic.
- A provider interface + registry is better than N isolated classes.
- Template strings > hardcoded messages. Config-driven > code-driven.

### Research Before Implementing

- Check project deps (`pyproject.toml`) for existing libraries.
- Search PyPI before writing custom code.
- For non-trivial algorithms: check GitHub for 80%+ implementations to fork/adapt.

---

## Library Preferences (DO NOT REINVENT)

| Need | Use | NOT |
|------|-----|-----|
| Retry/resilience | tenacity | Custom retry loops |
| HTTP client | httpx | Custom wrappers |
| Logging | loguru + structlog | print() or logging.getLogger |
| Config | pydantic-settings | Manual env parsing |
| CLI | typer | argparse |
| Validation | pydantic | Manual if/else |
| Rate limiting | tenacity + asyncio.Semaphore | Custom rate limiter class |
| Serialization | msgspec / msgpack | manual json or unsafe alternatives |
| Database ORM | SQLAlchemy (async) | Raw SQL strings |
| API framework | FastAPI + uvicorn | Flask / custom ASGI |
| MCP tools | fastmcp | Custom MCP protocol handling |
| Workflow orchestration | temporalio | Custom job queues |

---

## Code Quality Non-Negotiables

- Zero new lint suppressions without inline justification
- All new code must pass: `ruff check`, `ty check`, tests
- Max function: 40 lines. Max cognitive complexity: 15.
- No stub implementations in committed code
- Hook-backed enforcement: `suppression-blocker.sh`, `post-edit-checker.sh`, `complexity-ratchet.sh`

---

## Verifiable Constraints

| Metric | Threshold | Enforcement |
|--------|-----------|-------------|
| Test coverage | >= 90% | `pytest --cov-fail-under=90` |
| Cyclomatic complexity | <= 10 per function | complexity-ratchet hook |
| Cognitive complexity | <= 15 per function | complexity-ratchet hook |
| Code duplication | < 5% | jscpd threshold |
| Security findings | 0 high/critical | bandit + gitleaks + semgrep |
| Architecture boundaries | import-linter enforced | `lint-imports` |
| Docstring coverage | >= 85% | interrogate |

---

## Opinionated Quality Enforcement
- We want opinionated rules that enforce opinionated styling to a strict degree.
- This is an exclusively agent/vibecoded project; programmatic enforcement must guard against bad quality and antipatterns.
- Rather than disables or ignores, fix code properly.

## Multi-Actor Coordination
- **Debounce Commands**: Use `make lint`, `make test`, `make quality`, `make validate`. They are wrapped in `smart-command.sh` to prevent concurrent execution conflicts between multiple agents.
- **Shared Service Management**: `process-compose` is the source of truth. Use `make dev-status` to check health and `make dev-restart SERVICE=X` for graceful restarts.
- **Hold-if-Running Logic**: App services and infrastructure use wrappers that allow multiple actors to share processes without force-killing.
- **Lock Directory**: Active command locks are stored in `.process-compose/locks/`.
- **Naming Explosion Consolidation**: Prefer consolidated Makefile/Taskfile targets over a multitude of specialized ones.

## Phenotype Org Cross-Project Reuse Protocol <!-- PHENOTYPE_SHARED_REUSE_PROTOCOL -->

- Treat this repository as part of the broader Phenotype organization project collection, not an isolated codebase.
- During research and implementation, actively identify code that is sharable, modularizable, splittable, or decomposable for reuse across repositories.
- When reusable logic is found, prefer extraction into existing shared modules/projects first; if none fit, propose creating a new shared module/project.
- Include a `Cross-Project Reuse Opportunities` section in plans with candidate code, target shared location, impacted repos, and migration order.
- For cross-repo moves or ownership-impacting extractions, ask the user for confirmation on destination and rollout, then bake that into the execution plan.
- Execute forward-only migrations: extract shared code, update all callers, and remove duplicated local implementations.
## CI Completeness Policy

- Always evaluate and fix ALL CI check failures on a PR, including pre-existing failures inherited from main.
- Never dismiss a CI failure as "pre-existing" or "unrelated to our changes" — if it fails on the PR, fix it in the PR.
- This includes: build, lint, test, docs build, security scanning (CodeQL), code review gates (CodeRabbit), workflow guard checks, and any other CI jobs.
- When a failure is caused by infrastructure outside the branch (e.g., rate limits, external service outages), implement or improve automated retry/bypass mechanisms in CI workflows.
- After fixing CI failures, verify locally where possible (build, vet, tests) before pushing.

## Phenotype Git and Delivery Workflow Protocol <!-- PHENOTYPE_GIT_DELIVERY_PROTOCOL -->

- Use branch-based delivery with pull requests; do not rely on direct default-branch writes where rulesets apply.
- Prefer stacked PRs for multi-part changes so each PR is small, reviewable, and independently mergeable.
- Keep PRs linear and scoped: one concern per PR, explicit dependency order for stacks, and clear migration steps.
- Enforce CI and required checks strictly: do not merge until all required checks and policy gates are green.
- Resolve all review threads and substantive PR comments before merge; do not leave unresolved reviewer feedback.
- Follow repository coding standards and best practices (typing, tests, lint, docs, security) before requesting merge.
- Rebase or restack to keep branches current with target branch and to avoid stale/conflicting stacks.
- When a ruleset or merge policy blocks progress, surface the blocker explicitly and adapt the plan (for example: open PR path, restack, or split changes).
## Phenotype Long-Term Stability and Non-Destructive Change Protocol <!-- PHENOTYPE_LONGTERM_STABILITY_PROTOCOL -->

- Optimize for long-term platform value over short-term convenience; choose durable solutions even when implementation complexity is higher.
- Classify proposed changes as `quick_fix` or `stable_solution`; prefer `stable_solution` unless an incident response explicitly requires a temporary fix.
- Do not use deletions/reversions as the default strategy; prefer targeted edits, forward fixes, and incremental hardening.
- Prefer moving obsolete or superseded material into `.archive/` over destructive removal when retention is operationally useful.
- Prefer clean manual merges, explicit conflict resolution, and auditable history over forceful rewrites, force merges, or history-destructive workflows.
- Prefer completing unused stubs into production-quality implementations when they represent intended product direction; avoid leaving stubs ignored indefinitely.
- Do not merge any PR while any check is failing, including non-required checks, unless the user gives explicit exception approval.
- When proposing a quick fix, include a scheduled follow-up path to a stable solution in the same plan.
## Child-Agent and Delegation Policy
- Use child agents liberally for scoped discovery, audits, multi-repo scans, and implementation planning before direct parent-agent edits.
- Prefer delegating high-context or high-churn tasks to subagents, and keep parent-agent changes focused on integration and finalization.
- Reserve parent-agent direct writes for the narrowest, final decision layer.

## Child Agent Usage
- Use child agents liberally for discovery-heavy, migration-heavy, and high-context work.
- Delegate broad scans, decomposition, and implementation waves to subagents before final parent-agent integration.
- Keep the parent lane focused on deterministic integration and finalization.
- Preserve explicit handoffs and cross-agent context in session notes and audits.


## CI Completeness Policy

- Always evaluate and fix ALL CI check failures on a PR, including pre-existing failures inherited from main.
- Never dismiss a CI failure as "pre-existing" or "unrelated to our changes" — if it fails on the PR, fix it in the PR.
- This includes: build, lint, test, docs build, security scanning (CodeQL), code review gates (CodeRabbit), workflow guard checks, and any other CI jobs.
- When a failure is caused by infrastructure outside the branch (e.g., rate limits, external service outages), implement or improve automated retry/bypass mechanisms in CI workflows.
- After fixing CI failures, verify locally where possible (build, vet, tests) before pushing.

## Phenotype Git and Delivery Workflow Protocol <!-- PHENOTYPE_GIT_DELIVERY_PROTOCOL -->

- Use branch-based delivery with pull requests; do not rely on direct default-branch writes where rulesets apply.
- Prefer stacked PRs for multi-part changes so each PR is small, reviewable, and independently mergeable.
- Keep PRs linear and scoped: one concern per PR, explicit dependency order for stacks, and clear migration steps.
- Enforce CI and required checks strictly: do not merge until all required checks and policy gates are green.
- Resolve all review threads and substantive PR comments before merge; do not leave unresolved reviewer feedback.
- Follow repository coding standards and best practices (typing, tests, lint, docs, security) before requesting merge.
- Rebase or restack to keep branches current with target branch and to avoid stale/conflicting stacks.
- When a ruleset or merge policy blocks progress, surface the blocker explicitly and adapt the plan (for example: open PR path, restack, or split changes).

## Phenotype Org Cross-Project Reuse Protocol <!-- PHENOTYPE_SHARED_REUSE_PROTOCOL -->

- Treat this repository as part of the broader Phenotype organization project collection, not an isolated codebase.
- During research and implementation, actively identify code that is sharable, modularizable, splittable, or decomposable for reuse across repositories.
- When reusable logic is found, prefer extraction into existing shared modules/projects first; if none fit, propose creating a new shared module/project.
- Include a `Cross-Project Reuse Opportunities` section in plans with candidate code, target shared location, impacted repos, and migration order.
- For cross-repo moves or ownership-impacting extractions, ask the user for confirmation on destination and rollout, then bake that into the execution plan.
- Execute forward-only migrations: extract shared code, update all callers, and remove duplicated local implementations.

## Phenotype Long-Term Stability and Non-Destructive Change Protocol <!-- PHENOTYPE_LONGTERM_STABILITY_PROTOCOL -->

- Optimize for long-term platform value over short-term convenience; choose durable solutions even when implementation complexity is higher.
- Classify proposed changes as `quick_fix` or `stable_solution`; prefer `stable_solution` unless an incident response explicitly requires a temporary fix.
- Do not use deletions/reversions as the default strategy; prefer targeted edits, forward fixes, and incremental hardening.
- Prefer moving obsolete or superseded material into `.archive/` over destructive removal when retention is operationally useful.
- Prefer clean manual merges, explicit conflict resolution, and auditable history over forceful rewrites, force merges, or history-destructive workflows.
- Prefer completing unused stubs into production-quality implementations when they represent intended product direction; avoid leaving stubs ignored indefinitely.
- Do not merge any PR while any check is failing, including non-required checks, unless the user gives explicit exception approval.
- When proposing a quick fix, include a scheduled follow-up path to a stable solution in the same plan.

## Worktree Discipline

- Feature work goes in `.worktrees/<topic>/`
- Legacy `PROJECT-wtrees/` and `repo-wtrees/` roots are for migration only and must not receive new work.
- Canonical repository remains on `main` for final integration and verification.
