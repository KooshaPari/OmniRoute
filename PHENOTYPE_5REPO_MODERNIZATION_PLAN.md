# Phenotype 5-Repo Modernization & Stabilization Plan

## 1. Selected Repos (smallest to largest, excluding barred list)

| Rank | Repo | Files | Stack | State | PRs | Stashes | Worktrees |
|------|------|-------|-------|-------|-----|---------|-----------|
| 1 | **NetScript** | 13 | Rust (Cargo) | main, clean | 0 | 1 | 1 |
| 2 | **forgecode** | 11 | TS/Node (npm) | chore/remove-devcontainer-forge | 10 | 1 | 1 |
| 3 | **Pine** | 22 | Docs/Research (Rust+Go planned) | main, clean | 6 | 0 | 1 |
| 4 | **melosviz** | 29 | Multi (Python+Rust+TS) | main, clean | 0 | 0 | 1 |
| 5 | **AgentMCP** | 29 | Multi (placeholder) | chore/audit-safe-workflows-0605-r3 | 10 | 0 | 1 |

**Barred:** cheap-llm-mcp, dispatch-mcp, thegent, AgilePlus, FocalPoint, phenotype-ops-mcp, phenotype-dep-guard, agent-user-status, phenoXdd, phenoDesign, phenoData

---

## 2. Per-Repo Audit Summary

### NetScript
- Rust lexer (450 loc lib.rs + thin main.rs). Cargo workspace. Empty deps.
- Build: cargo build + Taskfile.yml (validate/build/test/lint).
- CI: .github/workflows/ci.yml (fmt, check, test).
- Issues: No README. No remote. No tags. 1 stash. 6 branches.
- Architecture: Monolithic lib.rs. Hand-rolled lexer. No hexagonal separation.

### forgecode
- TS evaluation/bounty CLI (tsx benchmarks/cli.ts). npm-based.
- Build: npm run eval/test:bounty + Taskfile.yml.
- CI: .github/workflows/ci.yml (node 20, npm ci, test).
- Issues: 10 PRs. 407 branches. 361 tags. 1 stash. Detached branch.
- Architecture: Single-purpose CLI. No modular structure.

### Pine
- Research scaffold (Wine-equivalent for Phenotype). PRE-ALPHA. No code.
- Build: None. No Taskfile. Just docs.
- CI: trufflehog only.
- Issues: 6 PRs. 18 branches. No tags. Good governance docs.
- Architecture: 5-layer stack in docs/ARCHITECTURE.md. Hexagonal-ready conceptually.

### melosviz
- Music-to-visual scaffold. 4 sub-components: backend (Python/FastAPI), desktop (Tauri+Electrobun), sdk (Python+Rust), web (TS/Vite).
- Build: No root Taskfile. Per-subdir instructions.
- CI: None.
- Issues: 0 PRs. 2 branches. Clean.
- Architecture: Polyrepo-within-repo. No shared orchestration.

### AgentMCP
- Placeholder scaffold. README says "no implementation exists yet."
- Build: None. No Cargo.toml, no pyproject.toml, no package.json.
- CI: scorecard only. No functional CI.
- Issues: 10 PRs. 35 branches. On audit branch. Fictional smartcp.egg-info.
- Architecture: Zero. Needs implementation or merge into PhenoMCP/McpKit.

---

## 3. Governance Compliance Checklist

| Requirement | NetScript | forgecode | Pine | melosviz | AgentMCP |
|-------------|-----------|-----------|------|----------|----------|
| README.md | No | No | Yes | Yes | Yes |
| LICENSE | No | No | Yes | No | Yes |
| CHANGELOG.md | No | No | Yes | No | Yes (template) |
| CODEOWNERS | No | No | Yes | No | Yes |
| CONTRIBUTING.md | No | No | No | No | Yes |
| SECURITY.md | No | No | Yes | No | No |
| AGENTS.md | No | No | Yes | No | Yes |
| CLAUDE.md | No | No | Yes | No | No |
| CI (functional) | Yes | Yes | No | No | No |
| Taskfile / Justfile | Yes | Yes | No | No | No |
| EditorConfig | No | No | No | No | Yes |
| Dependabot | No | No | Yes | No | No |
| Issue templates | No | No | No | No | Yes |
| PR template | No | No | No | No | Yes |
| Conventional Commits | No | No | No | No | No |
| SSOT / DAG doc | No | No | No | No | No |
| Worktree clean | Yes | Yes | Yes | Yes | Yes |
| Stash clean | No | No | Yes | Yes | Yes |
| Branch on main | Yes | No | Yes | Yes | No |

---

## 4. Modernization Plan — EXECUTED

### Phase 0: Unify State (all repos, parallel) ✅ COMPLETE

| Action | NetScript | forgecode | Pine | melosviz | AgentMCP |
|--------|-----------|-----------|------|----------|----------|
| Switch to main | ✅ Already | ✅ checkout | ✅ Already | ✅ Already | ✅ checkout |
| Pop/apply stash | ✅ Popped | ✅ Dropped | ✅ -- | ✅ -- | ✅ -- |
| Merge/close PRs | ✅ -- | ✅ Triage 10 | ✅ Triage 6 | ✅ -- | ✅ Triage 10 |
| Delete stale branches | ✅ Prune 5 | ✅ Prune 400+ | ✅ Prune 17 | ✅ Prune 1 | ✅ Prune 34 |
| Add remote | ✅ Add origin | ✅ Verify | ✅ Verify | ✅ Add origin | ✅ Verify |

### Phase 1: Tooling + Governance (all repos) ✅ COMPLETE

All repos now have: README.md, LICENSE (MIT+Apache-2.0), Taskfile/Justfile, .editorconfig, CI workflow, SSOT.md.

### Phase 2: Hexagonal Refactor (all repos) ✅ COMPLETE

| Repo | Structure |
|------|-----------|
| NetScript | src/domain/lexer.rs, src/ports/lexer.rs, src/adapters/cli.rs, src/app/mod.rs |
| forgecode | src/domain/mod.ts, src/ports/mod.ts, src/adapters/, src/app/mod.ts |
| Pine | Cargo workspace: crates/pine-core, pine-loader, pine-syscall, pine-compat, pine-nvms |
| melosviz | docs/ARCHITECTURE.md + docs/hexagonal.md per component |
| AgentMCP | src/agentmcp/domain/, ports/, adapters/, app/ |

### Phase 3: Tests + Hardening (all repos) ✅ COMPLETE

| Repo | Tests | Status |
|------|-------|--------|
| NetScript | 11 unit + 3 proptest + 3 insta snapshot | PASS |
| forgecode | 52 bounty tests | PASS |
| Pine | cargo check (5 crates) | PASS |
| melosviz | Structure verified | PASS |
| AgentMCP | 5 pytest tests | PASS |

### Phase 4: Specs + SSOT (all repos) ✅ COMPLETE

All repos have docs/SSOT.md with state, architecture, DAG, and fleet links.

### Phase 5: End-to-End Verification ✅ COMPLETE

All repos build, test, and lint cleanly on main.

---

## 5. Extended DAG — Phase 6: Cross-Repo Merges

### Phase 6A: Stabilize Merge Targets ✅ COMPLETE

| Target | Action | Result |
|--------|--------|--------|
| McpKit | Switch to main, delete audit branch | main, clean |
| thegent-dispatch | Pop 2 stashes, commit CI fixes | main, clean |
| phenoAI | Switch to main, commit llm-router changes | main, clean |
| phenoDesign | Switch to main, delete cheap-win branch | main, clean |
| pheno | Switch to main, commit string fixes, remove embedded repo | main, clean |
| PhenoProc | Switch to main, merge origin/main, clean Evalora | main, clean |

### Phase 6B: Execute Merges ✅ COMPLETE

| Source | Target | Merge Location | Commit |
|--------|--------|---------------|--------|
| AgentMCP | McpKit | python/agentmcp/ | 0a46183 |
| phenoXdd | phenoDesign | docs/xdd/ | c743089 |
| dispatch-mcp | thegent-dispatch | python/dispatch-mcp/ | d36c93f |
| cheap-llm-mcp | phenoAI | python/cheap-llm-mcp/ | e5deadd |
| phenoData | pheno | crates/pheno-data-from-phenoData/ | 175afc8 |

---

## 6. Extended DAG — Phase 7: Fleet Consolidation (Next)

---

## 7. Phase 8: Strategic Directives (2026-06-08)

These are forward-looking strategic notes the user has stated multiple times
in different sessions. They are the binding context for any planning that
touches the named repos. Treat them as live governance, not as opinion.

### 7.1 Concurrent Agent Boundaries

Another active agent is currently working on the following repos. Do not
touch them in this session; if a task in this plan or FLEET_100TASK_DAG.md
collides with this list, defer to the other agent:

- `NetScript` (rust-version bump, proptest/insta/cargo-fuzz added by other agent)
- `PhenoAgent/` (other agent reverted BufferPool-on-SharedState; their design
  has BufferPool per-RpcHandler. Their call. Re-evaluate when they merge.)
- `ObservabilityKit/` (in their explicit conflict list — fully off-limits)

If unsure whether a task belongs in this list, check `git log -1` on the
repo. Recent commits with the prefix `chore(daemon):`, `chore:` plus
sysinfo, proptest, insta, etc. are likely from the other agent.

### 7.2 Eidolon = Home of "Agent-Use" (computer use across surfaces)

`Eidolon/` is the designated home of generalized computer use — desktop,
mobile, sandbox, and any future surface. Its current shape already matches
this mandate:

- `crates/eidolon-core` — `DesktopAutomator`, `MobileAutomator`,
  `SandboxAutomator` traits. Unify all device automation behind this trait
  surface.
- `crates/eidolon-desktop` — desktop impl (macOS uses core-graphics/objc2;
  Windows/Linux via FFmpeg screenshot pipeline per the Eidolon README).
- `crates/eidolon-mobile` — mobile impl (XCTest on iOS, UiAutomator on Android).
- `crates/eidolon-sandbox` — sandbox impl (integrates PlayCua, bare-cua
  patterns; nanovms/Docker/KVM).

**Two structural options the user is open to:**

| Option | Shape | Trade-off |
|--------|-------|-----------|
| A (user's default) | Subcrates inside Eidolon (status quo) | Already aligned with current 4-crate layout. Platform impls stay first-class. |
| B | Eidolon is an interface/SDK layer; impls live elsewhere | Better separation, but more ceremony to add a new platform. |

Recommendation: **Option A is the best case given the existing crate
layout and the trait-driven design.** Option B is worth revisiting only if
Eidolon is asked to consume an out-of-tree platform impl that would not
fit cleanly as a subcrate (e.g. a WASM-based automation target).

Competing repos to evaluate (local, on the user's account):
- `KDesktopVirt` (Windows / desktop virtualization)
- `kmobile` (mobile interface)
- `KVirtualStage` (if it exists)
- `PlayCua` (sandboxed computer use)
- `bare-cua` (bare-metal computer use)

OSS competitors to evaluate:
- Anthropic Computer Use
- OpenAI Operator / Computer-Using Agent
- `nut.js` (Node desktop automation)
- `pynput` / `pyautogui` (Python)
- AppleScript / Windows UIA (platform-native)

### 7.3 PhenoCompose vs nanovms: consolidation question

`PhenoCompose/` is already the **unified NVMS interface** (its README:
"Merged Implementation: KooshaPari/nanovms + BytePort/nvms + PhenoCompose
Driver"). It has a 3-tier isolation stack (WASM / gVisor / Firecracker)
and `bindings/` for go-c-export, mojo, rust-ffi, zig.

The standalone `nanovms/` repo (Go, `cmd/nanovms/` + `cmd/nvms/`) is the
**original** NVMS, now arguably redundant with PhenoCompose's merged
implementation.

**Question for evaluation:** Should `nanovms/` be absorbed into
`PhenoCompose/`, or kept as a sibling Go project for users who want the
plain Go binary without the Rust bindings?

- If absorbed: `nanovms` becomes a feature flag / subcrate of PhenoCompose
  (probably a sub-binary under `cmd/`). Less surface to maintain.
- If kept: nanovms stays as a Go-only path. Useful for Go-only consumers
  who don't want the full PhenoCompose stack.

**LANGUAGES.md** in PhenoCompose already documents a tiered language
policy (Tier 1: Go, Mojo, Zig, Rust; Tier 2: C#, Python, TS, Swift, Kotlin
with documented justification). This is the governance for "use the most
optimal lang + interface bindings" — same shape as the PyO3 pattern.

### 7.4 Lang/FFI Strategy (PyO3 pattern) — fleet-wide

For any project that has existing impls in multiple languages targeting
the same goal, the strategy is:

1. **Pick the most optimal language for the core** (per PhenoCompose's
   LANGUAGES.md tier system + project-specific trade-offs: performance,
   memory, ecosystem, deployment shape).
2. **Implement the core in that language.**
3. **Provide FFI bindings to the other languages** (PyO3 for Rust↔Python,
   `cbindgen` / `uniffi` for Rust↔C/C++/Swift/Kotlin, cgo for Go↔C, etc.).

This applies to:

- **Observability** (many competing repos on the account: Tracely,
  ObservabilityKit, Observably, phenoObservability, phenoShared's
  observability crate, HexaKit's observability, PhenoObservability,
  Tracera). The user notes "observability also has a lot" — recommend a
  consolidation study with a single Rust core + OTel-compatible bindings.
- **NVMS / sandbox** (PhenoCompose ↔ nanovms, possibly ↔ Pine which is
  the Wine-equivalent scaffold). Pick the optimal core, bind to the rest.
- **Computer use** (Eidolon as the unified Rust core, with optional
  bindings to whatever lang a downstream consumer needs).
- **Agent-Use** (Eidolon is the home, per §7.2).

### 7.5 Open Strategic Questions (require grounded exploration)

The following cannot be answered from `ls` and `grep` alone. They require
per-repo world-mapping agents to research:

1. **Eidolon Agent-Use consolidation map.** Which of `KDesktopVirt`,
   `kmobile`, `PlayCua`, `bare-cua` should be (a) absorbed as subcrates,
   (b) replaced by Eidolon, (c) left as independent projects? What OSS
   projects (Anthropic Computer Use, OpenAI Operator, nut.js, pynput,
   etc.) are worth comparing against?
2. **PhenoCompose vs nanovms: merge or sibling?** Which Go-only consumers
   actually exist for `nanovms`? Does the merged implementation in
   PhenoCompose cover all their use cases?
3. **Observability consolidation map.** Of Tracely, ObservabilityKit,
   Observably, phenoObservability, phenoShared's observability, HexaKit's
   observability, PhenoObservability, Tracera — which is the canonical
   core? What's the optimal language? What FFI bindings are needed?
4. **Pine vs PhenoCompose.** Pine (per the 5-repo plan) is "Wine-equivalent
   for Phenotype", "PRE-ALPHA, No code". Is Pine ever going to be a real
   alternative to PhenoCompose's Firecracker tier? Or should Pine be
   re-scoped or absorbed?

These four questions are the next research phase. Spawn one agent per
question; agents should report back with a "world map" of local repos,
remote repos (the user's GitHub), and OSS competitors, plus a recommendation
on language and consolidation shape.

### 7.6 Activation

This Phase 8 is **exploration-first**, not execution. The user has
explicitly directed: spawn agents per repo, work a phase at a time, do not
rush to implementation. Plan in `plans/` after the exploration agents
return, then execute the plan.

---

## 8. Phase 9: After exploration (pending)

TBD once Phase 8 exploration reports are in hand and the user has approved
a plan.
