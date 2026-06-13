# KooshaPari Repo Assignment File — 2026-06-08

**Generated:** 2026-06-08
**Purpose:** First 10 repos A–Z (excluding `Atoms*`) for parallel agent work.
**Scope:** 199 remote repos (KooshaPari GitHub org) + 168 local checkouts at `/Users/kooshapari/CodeProjects/Phenotype/repos/`
**Sources:**
- `/tmp/remote-repos.json` — full GitHub org metadata
- `/tmp/local-names.txt` — local directory listing
- `/tmp/platform-analysis.json` — per-repo platform target
- `/tmp/duplication-analysis.md` — cross-/within-project duplications
- `/tmp/library-research.md` — OSS replacement / wrap / fork candidates

---

## How to use this file

1. Pick the next available repo (1, 2, 3, …) that isn't already assigned to another chat.
2. Read its section below (purpose, status, recommended action, blockers).
3. Read the linked subagent reports for full context.
4. Execute the recommended action.

> **Rule:** if a repo is marked `WINDOWS-ONLY`, **skip it**. macOS, Linux, and cross-platform are all valid targets.

---

## Quick-reference table

| # | Repo | Local? | Lang | Platform | Status | Verdict | OSS Action |
|---|------|--------|------|----------|--------|---------|------------|
| 1 | `472-P2-Flame-War` | no | Python | cross | class project | out of scope | **none** (skip) |
| 2 | `acp` | no | unknown | unclear | placeholder | archive | **replace** with `agentclientprotocol/agent-client-protocol` |
| 3 | `agent-devops-setups` | yes | Python/Bun/TS | cross | deprecated | archive | **replace** with `open-policy-agent/opa` + `open-policy-agent/conftest` |
| 4 | `agent-user-status` | yes | Python+Swift | **mac** | active | **keep + productize** | **wrap** with `upptime/upptime` *unless* true agent-presence semantics |
| 5 | `agentapi` (private) | no | Go (intended) | unclear | superseded | archive | **delete** — rebase `agentapi-plusplus` on upstream `coder/agentapi` |
| 6 | `agentapi-plusplus` | yes | Go | cross | active | **keep + productize** | **fork + rebase** on `coder/agentapi` |
| 7 | `AgentMCP` | yes | Python (planned) | unclear | placeholder | archive | **delete** — `modelcontextprotocol/specification` already exists |
| 8 | `agentops-policy-federation` | yes (local-only) | Shell+JSON | cross | stub | archive | **replace** with `open-policy-agent/opa` (bundle federation) |
| 9 | `Agentora` | yes | Rust | cross | active | **keep active** | **wrap** on `rig-rs/rig`; stop being a framework, become an example app |
| 10 | `AgilePlus` | yes | Rust+TS | cross | active | **keep + productize** | **replace** with `github/spec-kit` (biggest LOC win) |

**Distribution:** 4 KEEP (4, 6, 9, 10) · 5 ARCHIVE (2, 3, 5, 7, 8) · 1 SKIP (1)
**mac-friendly:** 8 of 10 · **Windows-only:** 0 · **Cross-platform:** 5 of 10

---

## 1. `472-P2-Flame-War` — *SKIP (class project)*

- **Visibility:** private
- **Local clone:** none
- **Platform:** cross-platform (Python + Streamlit web UI; uvloop excluded only on Windows)
- **Purpose:** CSE 472 NLP class project, "Flame War" — graded work
- **Verdict:** **out of scope** — class project, no consolidation value
- **Action:** do not touch; leave as-is or delete after semester
- **Library research:** n/a (skip)

---

## 2. `acp` — Agent Client Protocol (placeholder)

- **Visibility:** public
- **Local clone:** none
- **Platform:** **unclear** (no source code, README is placeholder)
- **Purpose:** namespace squat — remote README says "Status: placeholder — implementation pending"
- **Verdict:** **archive**
- **Recommended OSS action:** **replace** with [`agentclientprotocol/agent-client-protocol`](https://github.com/agentclientprotocol/agent-client-protocol) (3.3k stars, Apache-2.0, v1 of the protocol)
  - Official SDKs: [Rust](https://github.com/agentclientprotocol/rust-sdk), [Python](https://github.com/agentclientprotocol/python-sdk), [TypeScript](https://github.com/agentclientprotocol/typescript-sdk)
  - Quality is impossible to match with a personal stub
  - 100% naming collision = brand confusion forever
- **Work to do:**
  1. Verify the placeholder status by reading `gh repo view KooshaPari/acp`
  2. If confirmed empty, archive it (`gh repo archive KooshaPari/acp`)
  3. Document the replacement in a 1-line ADR entry
- **Blockers:** none

---

## 3. `agent-devops-setups` — *DEPRECATED, archive*

- **Visibility:** public
- **Local clone:** yes (`/Users/kooshapari/CodeProjects/Phenotype/repos/agent-devops-setups`)
- **Platform:** cross-platform (Python tools + VitePress docs + bash make targets; CI on ubuntu-latest)
- **Purpose:** "Shared policy federation and agent Ops setup" — config/scripts/policies for Codex/Cursor/Claude/Droid harnesses
- **Status:** `STATUS: DEPRECATED, superseded by phenoShared`
- **Verdict:** **archive**
- **Recommended OSS action:** **replace** with [`open-policy-agent/opa`](https://github.com/open-policy-agent/opa) + [`open-policy-agent/conftest`](https://github.com/open-policy-agent/conftest)
  - OPA = Rego-based policy engine, Conftest = policy-as-code testing
  - Both Apache-2.0, very active, ~10k stars each
  - Same substitution pattern collapses `agentops-policy-federation` (see #8) → one migration plan
- **Work to do:**
  1. Check `.status` file or `STATUS.md` for the "DEPRECATED" claim
  2. Verify migration to `phenoShared` is complete
  3. If yes, archive the repo
  4. Add a redirect note in `phenoShared` README pointing to OPA+Conftest
- **Blockers:** none

---

## 4. `agent-user-status` — *KEEP + productize (macOS focus)*

- **Visibility:** private
- **Local clone:** yes (`/Users/kooshapari/CodeProjects/Phenotype/repos/agent-user-status`)
- **Platform:** **mac** (native Swift monitor, LaunchAgents, pyobjc-Cocoa, webcam eye tracker)
- **Purpose:** Local privacy-first presence runtime (iMessage, eye, cursor) for AI agents
- **Status:** active, production-ready
- **Verdict:** **keep active** · **strong productization candidate**
- **Recommended OSS action:**
  - **if** the focus is *uptime monitoring* → **replace** with [`upptime/upptime`](https://github.com/upptime/upptime) (15k stars, MIT, GitHub-Actions powered)
  - **if** the focus is true *agent-presence* (webcam, iMessage, LaunchAgents) → **wrap** Upptime and add a mac-native extension
- **Why keep:** no upstream OSS does iMessage + eye tracking + LaunchAgents + macOS camera permissions in one tool
- **Work to do:**
  1. Read `src/native/macos/AgentUserStatusMonitor.swift` to understand the native surface
  2. Identify which 3–5 features are the unique value-add (presence vs uptime)
  3. Pick a positioning: "agent-presence" or "Mac uptime monitor" or both
  4. Write a 1-page productization plan (README, docs site, changelog, release notes)
- **Blockers:** none — but needs someone with macOS focus to drive

---

## 5. `agentapi` (private) — *Verify + likely archive*

- **Visibility:** private
- **Local clone:** none
- **Platform:** **unclear** (remote has only a supersession notice → `agentapi-plusplus`)
- **Purpose:** "AgentAPI - Unified API gateway for AI agent orchestration" — but remote README says "Active development moved to agentapi-pluplus"
- **Status:** **superseded by `agentapi-plusplus`**
- **Verdict:** **verify then likely archive**
- **Recommended OSS action:** **delete** — rebase `agentapi-plusplus` on upstream [`coder/agentapi`](https://github.com/coder/agentapi)
  - Eliminates the 2-repo split
  - `agentapi-plusplus` is 74 commits ahead and already has all the working code
- **Work to do:**
  1. `gh repo view KooshaPari/agentapi` to confirm it's empty/stub
  2. Check if anyone in chats/PRs has asked about the private repo
  3. If confirmed dead: archive (`gh repo archive KooshaPari/agentapi`) and post a 1-line note in `agentapi-plusplus` README
- **Blockers:** none, but verify before archiving (it might be someone's private WIP)

---

## 6. `agentapi-plusplus` — *KEEP + productize*

- **Visibility:** public (FORK of `coder/agentapi`)
- **Local clone:** yes (`/Users/kooshapari/CodeProjects/Phenotype/repos/agentapi-plusplus`)
- **Platform:** cross-platform (release.yml cross-compiles linux/amd64, linux/arm64, **darwin/amd64, darwin/arm64**, windows/amd64)
- **Purpose:** HTTP API for Claude Code, Goose, Aider, Gemini, Amp, Codex (and 6 more — 11 agent CLIs total)
- **Status:** active, 74 commits ahead of upstream, 7 fixes staged for upstream
- **Verdict:** **keep active** · **strong productization candidate**
- **Recommended OSS action:** **fork + rebase** on [`coder/agentapi`](https://github.com/coder/agentapi)
  - Push the 7 staged fixes upstream to reduce divergence
  - Keep `+plusplus` branding as the "value-added" fork
- **Why keep:** no other public project wraps 11 agent CLIs behind one HTTP API
- **Work to do:**
  1. Open PRs for the 7 staged upstream fixes
  2. Rebase on latest upstream `coder/agentapi`
  3. Add a "Supported agents" matrix in the README (11 × OS)
  4. Tag a v1.0.0 release with darwin/arm64 + linux/arm64 binaries
- **Blockers:** none — this is the highest-leverage KEEP in the batch

---

## 7. `AgentMCP` — *ARCHIVE (placeholder, fictional past)*

- **Visibility:** private
- **Local clone:** yes (only empty dirs + `smartcp.egg-info/`)
- **Platform:** **unclear** (no .py source, only metadata listing `mlx`/`mlx-lm` deps)
- **Purpose:** "Namespace placeholder for future Agentic Model Context Protocol"
- **Status:** README admits "no implementation exists yet"; local has only empty auth/server/middleware/tools/config/models dirs
- **Verdict:** **archive immediately**
- **Recommended OSS action:** **delete** — the canonical MCP spec lives at [`modelcontextprotocol/specification`](https://github.com/modelcontextprotocol/specification)
  - Real MCP servers exist in `McpKit`, `dispatch-mcp`, `cheap-llm-mcp`
  - `AgentMCP` adds zero value and creates namespace confusion
- **Work to do:**
  1. Confirm with a 5-second `ls` that local has no .py source
  2. Archive (`gh repo archive KooshaPari/AgentMCP`)
  3. Add a one-line entry to the cross-MCP repo ADR (see duplication report §1.2.2)
- **Blockers:** none

---

## 8. `agentops-policy-federation` — *Local-only stub, archive*

- **Visibility:** **local-only** (not on GitHub at all — `??` in our remote list)
- **Local clone:** yes (`/Users/kooshapari/CodeProjects/Phenotype/repos/agentops-policy-federation`)
- **Platform:** cross-platform (3 bash scripts + JSON manifest)
- **Purpose:** "policy federation" per CLAUDE.md, but actual content is 4 trivial bash pass-through guards (`codex_exec/write/network_guard.sh`)
- **Status:** CLAUDE.md describes a Rust workspace that **does not exist**; local `.git/config` remotes are mispointed (argis-extensions, FocalPoint, phenoShared, worklogs) — likely a worktree artifact
- **Verdict:** **archive**
- **Recommended OSS action:** **replace** with [`open-policy-agent/opa`](https://github.com/open-policy-agent/opa) (bundle federation pattern)
  - Same OSS replacement as #3 — collapse both `agent-devops-setups` AND `agentops-policy-federation` into one OPA+Conftest adoption plan
- **Work to do:**
  1. Verify the local repo has no real source (CLAUDE.md describes fantasy Rust workspace)
  2. If confirmed stub: delete local dir, push a note to `.remember` or `phenoShared` ADR
  3. If real work exists: extract to a `pheno-policy-federation` branch of `phenoShared`
- **Blockers:** none

---

## 9. `Agentora` — *KEEP active (canonical Rust agent SDK)*

- **Visibility:** public
- **Local clone:** yes (`/Users/kooshapari/CodeProjects/Phenotype/repos/Agentora`)
- **Platform:** cross-platform (no `cfg(...)` gates, only cross-platform deps; published to crates.io as `agentkit` 0.1.0)
- **Purpose:** "Rust hexagonal-architecture framework for AI agents" (`agentkit` crate)
- **Status:** active, lowest-level framework in the agent runtime cluster
- **Verdict:** **keep active** — but watch overlap with `PhenoAgent`/`phenoAI`/`thegent`/`Eidolon`
- **Recommended OSS action:** **wrap** on [`rig-rs/rig`](https://github.com/rig-rs/rig) (the de-facto Rust LLM/agent framework)
  - Let Agentora stop being a *framework* and become a *hexagonal example app* on top of `rig-rs/rig`
  - This addresses the 4-repo agent-runtime overlap (Agentora / PhenoAgent / phenoAI / thegent)
- **Work to do:**
  1. Write an ADR-001-style doc mapping the 5-repo agent runtime cluster:
     - `Agentora` = agent SDK (low-level)
     - `PhenoAgent` = daemon + multi-model router (mid-level)
     - `phenoAI` = AI-facing client primitives
     - `thegent` = end-user CLI orchestration
     - `Eidolon` = device automation (adjacent)
  2. Refactor Agentora to wrap `rig-rs/rig` for the LLM primitives
  3. Document the boundary in `/tmp/duplication-analysis.md` §1.2.1
- **Blockers:** none, but biggest leverage is the ADR doc (prevents future confusion)

---

## 10. `AgilePlus` — *KEEP + productize (biggest LOC win)*

- **Visibility:** public
- **Local clone:** yes (`/Users/kooshapari/CodeProjects/Phenotype/repos/AgilePlus`)
- **Platform:** cross-platform (21-crate Cargo workspace + React/TS dashboard + Electrobun desktop for mac/win/linux)
- **Purpose:** "Phenotype-org spec-driven development" — tickets, journeys, governance, gates
- **Status:** active, full stack
- **Verdict:** **keep + productize** · **biggest LOC reduction opportunity in the set**
- **Recommended OSS action:** **replace** with [`github/spec-kit`](https://github.com/github/spec-kit) (GitHub's official spec-driven dev framework, ~30k stars, MIT, very active)
  - Same workflow (specify → plan → tasks → implement)
  - Eliminates ~70% of the spec/governance scaffolding
  - Alternative: [`fission-ai/openspec`](https://github.com/Fission-AI/OpenSpec) for lightweight spec workflows
- **Work to do:**
  1. Read `agileplus/SPEC.md` and the 21 Cargo crates to inventory what's unique vs boilerplate
  2. Compare feature matrix: AgilePlus vs spec-kit
  3. Identify which 3–5 crates are the genuine value-add (likely: governance/policy gates, journey tracking, Electrobun dashboard)
  4. Write migration plan: which crates to delete, which to keep as thin wrappers on spec-kit
- **Blockers:** biggest of any repo here (21 crates to assess)

---

## Appendix A — Cross-project duplications to address (additive, not in the 10)

From `/tmp/duplication-analysis.md`:

### MCP cluster (7 repos, **WORST duplication**)
- `PhenoMCP` / `McpKit` / `MCPForge` / `AgentMCP` / `dispatch-mcp` / `cheap-llm-mcp` / `phenokits-commons` all claim to be the "MCP home"
- `McpKit` already points to `PhenoMCP` as its Python submodule
- **Action:** keep `McpKit` as canonical polyglot; archive `AgentMCP` (see #7) + `MCPForge` + the MCP section of `phenokits-commons`; co-locate `dispatch-mcp` and `cheap-llm-mcp` as `McpKit/servers/`

### Agent runtime cluster (5 repos)
- `Agentora` / `PhenoAgent` / `phenoAI` / `thegent` / `Eidolon` — 4 of 5 use "agent runtime" language
- **Action:** see #9 — write an ADR-001-style boundary doc

### LLM router cluster (4 repos)
- `OmniRoute` (canonical per ADR-001) / `helios-router` (archived) / `phenoRouterMonitor` / `Bifrost` (fork)
- **Action:** verify `helios-router` is actually archived; consolidate `phenoRouterMonitor` into `OmniRoute`

### `thegent-clean-wt-*` (5 repos)
- These are **git worktree branches checked out as siblings**, not real standalone projects
- All 5 share the same 8-line CLAUDE.md template
- **Action:** collapse to single `thegent` repo with named worktrees under `.claude/worktrees/`

---

## Appendix B — Suggested action ordering

| Priority | Repos | Why |
|----------|-------|-----|
| P0 (easy wins) | #2 `acp`, #7 `AgentMCP`, #5 `agentapi` (private) | Confirmed dead/placeholder, archive in 5 min each |
| P1 (deprecation cleanup) | #3 `agent-devops-setups`, #8 `agentops-policy-federation` | Both OPA-replaceable; same migration plan |
| P2 (productize) | #6 `agentapi-plusplus`, #4 `agent-user-status` | High value, can proceed in parallel |
| P3 (boundary docs) | #9 `Agentora` + ADR-001 covering 5-repo agent cluster | Highest leverage investment |
| P4 (biggest LOC win) | #10 `AgilePlus` → spec-kit | Largest migration; needs care |
| Skip | #1 `472-P2-Flame-War` | Out of scope |

---

## Appendix C — Per-repo action checklist (copy-paste)

For each repo the assigned agent should produce a brief report covering:

- [ ] Did the recommended action match reality? (yes / no / partially)
- [ ] Were any blockers discovered? (link to issue or commit)
- [ ] Was a commit made on a `chore/` or `feat/` branch? (paste `git log --oneline -3`)
- [ ] Was a PR opened? (paste URL)
- [ ] Estimated LOC change: `+N / -M` or `0` (no code change)
- [ ] Disk reclaimed (if repo was archived): `du -sh` before / after

---

*This file is the source of truth for the 10 assignments. Subagent reports are at `/tmp/duplication-analysis.md`, `/tmp/library-research.md`, `/tmp/platform-analysis.json` for deeper context.*
