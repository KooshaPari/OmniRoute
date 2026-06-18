# agent-platform interface domain — ownership plan

**Date:** 2026-06-17 23:20 PDT
**Repo:** `KooshaPari/agent-platform` (currently thin TS reference repo)
**Owner:** Forge (this turn's assignment)
**Domain scope:** All agent → device-modal coordination in the Phenotype fleet.

---

## 1. What is the agent-platform interface domain?

The interface domain I own covers the **canonical ports** that every agent (Claude, Codex, Codex, Forge, etc.) uses to interact with every device-modal substrate (mobile, desktop, sandbox, browser). The domain is the "what does an agent need to talk to a device?" layer — it does NOT implement the devices themselves.

**Current state:** `KooshaPari/agent-platform` has a thin TypeScript reference implementation:
- `ports/runtime.ts` — `AgentRuntime` port with `ForgeRuntime`, `CodexRuntime`, `CodexRuntime` adapters (per the doc comment — but only 2 adapter files exist)
- `ports/adapters/codex.ts`, `ports/adapters/forge.ts`
- `ports/tests/runtime.test.ts`
- `Cargo.lock` — **orphan** (no top-level Cargo.toml) — see §6
- `Cargo.toml` — **MISSING** (the lock exists but no manifest)

**Goal:** Expand to a proper substrate home for all agent-runtime AND device-modal ports.

---

## 2. Architecture (target state)

```
┌─────────────────────────────────────────────────────────────────┐
│  AGENT (Claude, Codex, Codex, Forge, custom)                    │
│  Holds: AgentRuntime + DeviceStage (NEW)                        │
└────────────┬─────────────────────────────────┬──────────────────┘
             │                                 │
             ▼                                 ▼
┌────────────────────────────┐  ┌──────────────────────────────────┐
│ AgentRuntime port          │  │ DeviceStage port (NEW)            │
│ (existing, runtime.ts)     │  │ (new, device_stage.ts)            │
│  • ForgeRuntime adapter    │  │  • DesktopStage sub-port          │
│  • CodexRuntime adapter    │  │  • MobileStage sub-port           │
│  • CodexRuntime adapter    │  │  • SandboxStage sub-port          │
│    (3rd missing — fix)     │  │  • BrowserStage sub-port          │
│  Methods:                  │  │                                  │
│   exec(req) -> Response    │  │  Methods:                        │
│   stream(req) -> Tokens    │  │   get_viewport() -> Viewport     │
│   cancel(id) -> ()         │  │   screenshot(path) -> ()         │
└────────────────────────────┘  │   pointer(event) -> ()           │
                                │   text(event) -> ()              │
                                │   record_event(event) -> ()      │
                                │   + sub-traits:                  │
                                │     DesktopStage::window_manage  │
                                │     MobileStage::tap/swipe/input │
                                │     SandboxStage::start/stop/exec│
                                │     BrowserStage::navigate/eval  │
                                └───┬──────────────────┬───────────┘
                                    │                  │
                                    ▼                  ▼
┌─────────────────────────────────┐ ┌──────────────────────────────────┐
│ Eidolon (Rust)                  │ │ KooshaPari/mobile-mcp (TS)       │
│ VirtualStage impl + adapters    │ │ MobileStage MCP wrapper          │
│  • eidolon-mobile (iOS/Android) │ │ KooshaPari/mobile-cli (Go)       │
│  • eidolon-desktop (macOS/etc)  │ │ Direct device driver             │
│  • eidolon-sandbox (PlayCua)    │ │ chrome-devtools-mcp (browser)    │
│  • eidolon-mcp-server (new)     │ │ PlayCua (browser automation)     │
└─────────────────────────────────┘ └──────────────────────────────────┘
```

---

## 3. Substrate placement (per ADR-023)

`agent-platform` is **`phenotype-*-framework`** substrate — it has opinions about how agents interact with devices (inversion of control). It is NOT a pure library (`pheno-*-lib`) and NOT a polyglot SDK (`phenotype-*-sdk`).

Per ADR-023 Rule 3.1 quality bar:
- Spec: `agent-platform/SPEC.md` (to be authored)
- Docs: README + 1 concept doc
- Test matrix: unit + integration + MCP roundtrip
- Observability: OTLP export via `pheno-tracing` (ADR-012)
- Coverage gate: 70% (framework level)
- CI gate: `pheno-ci-templates`
- Worklog v2.1: with `device:` field

---

## 4. PR plan (execution backlog)

### PR 1 — `KooshaPari/agent-platform`: add `DeviceStage` port
- Add `ports/device_stage.ts` mirroring the shape of `runtime.ts`
- Define `DeviceStage` as the umbrella trait with 4 sub-traits: `DesktopStage`, `MobileStage`, `SandboxStage`, `BrowserStage`
- Each sub-trait has the minimum method set derived from Eidolon's `VirtualStage` + the actual mobile-mcp / chrome-devtools-mcp / PlayCua surface
- All methods async; all return Result/Task

### PR 2 — `KooshaPari/agent-platform`: fix the missing 3rd adapter
- The doc comment in `runtime.ts` claims 3 adapters (ForgeRuntime, CodexRuntime, CodexRuntime) but only `forge.ts` and `codex.ts` exist
- Add the 3rd adapter — most likely `codex.ts` (Codex CLI) — to match the comment

### PR 3 — `KooshaPari/agent-platform`: add `DesktopStage` adapter
- Wraps Eidolon's `eidolon-desktop` (via MCP or native binding)
- Implements `DesktopStage` sub-trait

### PR 4 — `KooshaPari/agent-platform`: add `MobileStage` adapter
- Wraps `KooshaPari/mobile-mcp` (via MCP)
- Implements `MobileStage` sub-trait — delegates to mobile-mcp's 27 tools

### PR 5 — `KooshaPari/agent-platform`: add `SandboxStage` adapter
- Wraps Eidolon's `eidolon-sandbox` (which wraps PlayCua)
- Implements `SandboxStage` sub-trait

### PR 6 — `KooshaPari/agent-platform`: add `BrowserStage` adapter
- Wraps `chrome-devtools-mcp` (or `PlayCua` if desktop browser)
- Implements `BrowserStage` sub-trait

### PR 7 — `KooshaPari/agent-platform`: SPEC.md + AGENTS.md + governance
- Add `SPEC.md` describing the framework shape
- Add `AGENTS.md` for agent context
- Add `CODEOWNERS`
- Adopt KooshaPari org workflow templates

---

## 5. Cross-cutting concerns

### Dependency on Eidolon
- Eidolon is the canonical `VirtualStage` impl
- agent-platform's `DeviceStage` port is the TypeScript mirror
- For TypeScript → Rust bridging, use napi-rs or wasm-bindgen (defer choice)
- For TypeScript → MCP, use the standard MCP SDK

### Dependency on mobile-mcp
- agent-platform's `MobileStage` adapter wraps mobile-mcp
- mobile-mcp itself wraps Eidolon (per the mobile-next fork plan)
- So the call chain becomes: agent → agent-platform:DeviceStage → mobile-mcp → Eidolon:VirtualStage → device

### Dependency on chrome-devtools-mcp
- agent-platform's `BrowserStage` adapter wraps chrome-devtools-mcp
- Consider forking `ChromeDevTools/chrome-devtools-mcp` to `KooshaPari/chrome-devtools-mcp` for governance control

---

## 6. The Cargo.lock orphan

**Issue:** `KooshaPari/agent-platform` has `Cargo.lock` (47KB) but no top-level `Cargo.toml`. The lock lists Rust crates but the repo is fundamentally TypeScript.

**Most likely explanation:** The lock was accidentally committed from a previous Rust workspace experiment, then the workspace was deleted but the lock remained.

**Two options:**
1. **Delete Cargo.lock** — cleanest; agent-platform is TS-only, no Rust artifacts
2. **Add Cargo.toml workspace + convert to a hybrid Rust+TS substrate** — useful if we want to publish a Rust binding for the AgentRuntime trait

**Recommendation:** Option 1 (delete Cargo.lock) — agent-platform is fundamentally a TS framework; we can publish Rust bindings separately as `pheno-agent-platform` if needed.

**Action:** PR 1 includes deletion of orphan Cargo.lock.

---

## 7. SOTA landscape (for the agent-platform domain)

Per the GitHub MCP-server topic page (https://github.com/topics/mcp-server, 18,449 repos):
- **Top stars:** n8n (193k), gemini-cli (105k), UI-TARS-desktop (36.7k, bytedance — multimodal CUA), chrome-devtools-mcp (43.9k), github-mcp-server (30.8k)
- **Most relevant:** chrome-devtools-mcp (browser SOTA), UI-TARS-desktop (multimodal CUA SOTA), mobile-mcp (mobile SOTA)

**agent-platform's competitive position:**
- Eidolon already covers desktop + mobile + sandbox via `VirtualStage`
- KooshaPari/mobile-mcp covers mobile via MCP
- We need: browser (chrome-devtools-mcp), CUA modality (UI-TARS-style)
- Combined: agent-platform becomes the **single interface** for an agent to control any device-modal — which is the meta-layer that doesn't exist anywhere else in the SOTA

**Why this matters:** Every major agent framework (Claude Code, Codex, Codex, Forge) has its own device-control surface; none of them have a unified port. agent-platform provides that port.

---

## 8. Risks

| Risk | Severity | Mitigation |
|---|---|---|
| TS → Rust bridging complexity | MEDIUM | Use MCP (works today); napi-rs is future optimization |
| Eidolon shim latency | LOW | Mobile-cli still does direct calls; Eidolon is opt-in |
| Adapter divergence across runtimes (Forge vs Codex vs Codex) | MEDIUM | Strict port test matrix ensures all adapters behave identically |
| SOTA landscape moves fast | MEDIUM | Weekly sync with mobile-next + chrome-devtools-mcp upstream; track UI-TARS for CUA modality |

---

## 9. References

- `agent-platform/ports/runtime.ts` — existing AgentRuntime port
- `agent-platform/ports/adapters/{forge,codex}.ts` — existing adapters
- `agent-platform/ports/tests/runtime.test.ts` — existing tests
- Eidolon `VirtualStage` trait: `Eidolon-wtrees/eidolon-mobile-virtual-stage-impl-20260610/crates/eidolon-core/src/virtual_stage.rs`
- ADR-023 (agent-effort governance): `docs/adr/2026-06-15/ADR-023-agent-effort-governance.md`
- ADR-029 (Dmouse92 → KooshaPari): `docs/adr/2026-06-17/ADR-029-dmouse92-to-kooshapari.md`
- Companion doc: `findings/2026-06-17-eidolon-absorption.md`
- Companion doc: `findings/2026-06-17-mobile-next-fork-plan.md`
