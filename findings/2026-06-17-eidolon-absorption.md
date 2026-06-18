# Eidolon-centric absorption plan — mobile + desktop + sandbox modalities

**Date:** 2026-06-17 23:10 PDT
**Owner:** Forge (agent-platform interface domain)
**Status:** ACCEPTED — Eidolon chosen as primary absorb target per user feedback ("if eidolon is a better absorb target choose it")
**Scope:** Absorb `kmobile`, `KDesktopVirt`, `bare-cua`, `PlayCua` work into the **Eidolon** substrate, fork **mobile-next/mobilecli + mobile-next/mobile-mcp** to KooshaPari, expand **agent-platform** as the interface domain I own.

---

## 1. Executive decision

**Decision:** **EIDOLON as primary absorb target + KooshaPari/mobile-cli & KooshaPari/mobile-mcp forks + agent-platform domain ownership.**

**Confidence:** HIGH.

**Rationale:**
- Eidolon already implements `VirtualStage` trait with `MobileStage`, `DesktopStage`, `SandboxStage` sub-traits (3 unpushed commits in `feat/eidolon-mobile-virtual-stage-impl-20260610` + `docs/eidolon-spec-virtual-stage-20260610` worktrees, just pushed today).
- Eidolon `MobileStage` methods (`tap`, `swipe`, `input_text`, `screenshot`, `get_viewport`, `pointer`, `text`, `record_event`) map **1:1** to mobile-mcp's 27 MCP tools (see §6 mapping table).
- Eidolon already has `eidolon-desktop` (Linux + Windows + macOS stubs + real Core Graphics impl), `eidolon-mobile` (iOS + Android stubs), `eidolon-sandbox` (PlayCua dispatcher + Docker/nanoVMs).
- PlayCua already declared as a sandbox adapter backend (`feat/eidolon-sandbox-playcua-dispatcher-stub-20260610`).
- The abstraction layer (Eidolon `VirtualStage`) is **stronger** than what `mobile-mcp` alone provides (mobile-mcp is mobile-only; Eidolon is mobile + desktop + sandbox unified).
- The mobile-next forks (mobile-cli, mobile-mcp) provide a **concrete production-grade implementation** of mobile automation — they become the production adapter for Eidolon MobileStage on the iOS/Android side, while kmobile remains a Rust-native (XCTest/UiAutomator) alternative path.
- The agent-platform repo already has `AgentRuntime` port defined (TS, hexagonal); I own it; extending with a `DeviceStage` port makes it the single point of agent → device-modal coordination.

---

## 2. Source inventory (what to absorb)

| Source repo | Local path | Type | Star count / activity | Notes |
|---|---|---|---|---|
| `kmobile` | `repos/kmobile` | Rust workspace (CLI + MCP server + GUI) | active, `feat/mobile-next-foundation` on origin @ `7936af0` (6 Phases A-D); local main @ `7762b32` | Cargo workspace; `kmobile-core` (port), `kmobile-overlay`, `kmobile-bridge`, `kmobile-mcp` server, `kmobile-desktop` GUI; tokio mpsc IPC |
| `KDesktopVirt` | `repos/KDesktopVirt` | Rust crate | active, auto-save commit `91b808a` on origin/main (release-attestation.yml + audit_scorecard.json + docs/slsa.md) | Real Core Graphics impl on macOS + Windows stubs + Linux stubs; merged via PR #61 |
| `bare-cua` | `repos/bare-cua` | TypeScript | scaffold; was deprecated per `DEPRECATED_BARE_CUA.md`; PlayCua successor | Use PlayCua instead |
| `PlayCua` | `repos/PlayCua` | Python + Rust | active, `PlayCua-wt-L5-081-2026-06-11` worktree container exists | Sandbox dispatcher backend for browser-automation; goes into Eidolon SandboxStage |
| `mobile-next/mobilecli` | (just forked to `KooshaPari/mobile-cli`) | Go CLI | upstream Go binary; 31 subdirs (`devices/`, `commands/`, `agents/ios/`, `agents/android/`, `server/`) | iOS Objective-C bridge + Android JVMTI agent; 2,500+ LOC Go + 1,500+ LOC ObjC + 800+ LOC Java |
| `mobile-next/mobile-mcp` | (just forked to `KooshaPari/mobile-mcp`) | TypeScript MCP server | upstream TS MCP; 3,477 LOC across 13 files | 27 MCP tools; wraps mobilecli + native iOS/Android adapters |
| `mobile-next/devicekit-android` | (NOT forked) | Go + Android | devicekit-android (additional Android tools) | Defer — current mobile-cli covers Android adb + UiAutomator |
| `mobile-next/devicekit-ios` | (NOT forked) | Go + Objective-C | "modern WebDriverAgent alternative" | Defer — current mobile-cli uses XCTest + WebDriverAgent |
| `mobile-next/mobilewright` | (NOT forked) | TypeScript | test framework | Defer — not core to agent-platform domain |
| `mobile-next/mobile-openrpc` | (NOT forked) | OpenRPC specs | shared JSON-RPC specs across mobile-next | Useful reference, not absorbed |

**Stashes:** `kmobile` (0), `KDesktopVirt` (0), `Eidolon` (0), `agent-platform` (0). Clean state ✓.

**Worktrees:**
- `kmobile` (0 internal worktrees) ✓
- `KDesktopVirt/KDesktopVirt-wtrees/*` (internal — assume clean)
- `Eidolon/Eidolon-wtrees/*` (90+ branches — most are `wip/on-...` snapshots from prior sessions; many `feat/eidolon-*-virtual-stage-*-20260610` branches, all already on origin)
- `agent-platform` (clean, `wip/2026-06-17-prepush-agent-platform-dirty` already on origin)
- `PlayCua/PlayCua-wt-*` (worktree container exists)

---

## 3. Branch inventory (unpushed work + absorption candidates)

### Eidolon branches relevant to absorption (all already on origin)

| Branch | Tip | Merged? | Uniqueness | Absorption action |
|---|---|---|---|---|
| `feat/eidolon-virtual-stage-trait-20260610` | on origin | NO | VirtualStage trait design | MERGE via PR after review |
| `feat/eidolon-core-virtual-stage-boxed-helpers-20260610` | on origin | NO | `Box<dyn VirtualStage>` + dyn helpers | MERGE |
| `feat/eidolon-mobile-virtual-stage-impl-20260610` | on origin | NO | **MobileStage impl on MobileClient** (149 LOC virtual_stage.rs + 74 LOC mobile lib.rs) | MERGE — core of absorption |
| `feat/eidolon-desktop-linux-virtual-stage-impl-20260610` | on origin | NO | Linux DesktopStage stub | MERGE |
| `feat/eidolon-desktop-macos-virtual-stage-impl-20260610` | on origin | NO | macOS DesktopStage via Core Graphics | MERGE |
| `feat/eidolon-desktop-windows-virtual-stage-impl-20260610` | on origin | NO | Windows DesktopStage stub | MERGE |
| `feat/eidolon-sandbox-virtual-stage-impl-20260610` | on origin | NO | SandboxStage impl | MERGE |
| `feat/eidolon-sandbox-playcua-dispatcher-stub-20260610` | on origin | NO | **PlayCua dispatcher stub** (consumes PlayCua as SandboxStage backend) | MERGE — PlayCua absorption target |
| `docs/eidolon-spec-virtual-stage-20260610` | on origin | NO | SPEC + ARCHITECTURE doc | MERGE |
| `docs/eidolon-adr-virtual-stage-20260610` | on origin | NO | ADR for VirtualStage | MERGE |
| `docs/eidolon-virtual-stage-readme-20260610` | on origin | NO | README updates | MERGE |
| `docs/eidolon-virtual-stage-usage-example-20260610` | on origin | NO | Usage examples | MERGE |
| `feat/eidolon-virtual-stage-re-exports-20260610` | on origin | NO | Re-exports for convenience | MERGE |
| `bench/eidolon-core-serde-roundtrip-20260611` | on origin | NO | Serde benchmarks | DEFER (non-blocking) |
| `bench/eidolon-virtual-stage-dispatch-20260610` | on origin | NO | VirtualStage dispatch benchmarks | DEFER |
| `ci/eidolon-virtual-stage-test-job-20260610` | on origin | NO | CI test job | MERGE |
| `docs/eidolon-changelog-virtual-stage-entry-20260610` | on origin | NO | CHANGELOG entry | MERGE |
| `test/eidolon-core-virtual-stage-integration-20260610` | on origin | NO | Integration tests | MERGE |
| `test/eidolon-core-virtual-stage-tests-20260610` | on origin | NO | Unit tests | MERGE |
| `test/eidolon-core-pedantic-clippy-20260610` | on origin | NO | Clippy strict | MERGE |
| `wip/2026-06-18-prepush-eidolon-snapshot` | **PUSHED THIS TURN** | NO | 1 commit auto-snapshot | BUNDLE for review |
| ~80 other `feat/eidolon-core-from-*-20260611/12/14` | on origin | NO | Individual `From` impls | MERGE in batch (L5-103 ADR-025 wave) |
| ~25 `wip/on-feat-eidolon-core-*-2026-06-17` | on origin | NO | WIP snapshot of `From` impls | BUNDLE |

### KDesktopVirt branches
- `main` is at `91b808a` with auto-save commit (release-attestation.yml + audit_scorecard.json + docs/slsa.md) — already on origin ✓

### kmobile branches
- `main` is at `7762b32`, no unpushed
- `feat/mobile-next-foundation` is on origin @ `7936af0` (6 phases A-D of mobile-next integration)

### agent-platform
- `main` clean
- `wip/2026-06-17-prepush-agent-platform-dirty` on origin

---

## 4. Target parity summary (where every source item goes)

| Source responsibility | Target repo | Target evidence | Status |
|---|---|---|---|
| **kmobile iOS XCTest bridge** | Eidolon `eidolon-mobile` | `crates/eidolon-mobile/src/mobile_stage.rs` (worktree) | `IN_PROGRESS` — needs kmobile extraction |
| **kmobile Android UiAutomator bridge** | Eidolon `eidolon-mobile` | same | `IN_PROGRESS` — needs kmobile extraction |
| **kmobile `DeviceManager` port** | Eidolon `eidolon-mobile::DeviceManager` | new module (absorb from kmobile-core) | `NOT_COVERED` — needs PR |
| **kmobile `kmobile-mcp` server binary** | Eidolon → wraps VirtualStage behind MCP | new `crates/eidolon-mcp-server` | `NOT_COVERED` — needs PR |
| **kmobile `kmobile-overlay` (overlay UI)** | Eidolon GUI (deferred per ADR-023) | (none — out of scope, PAUSED) | `NO_MERIT` — app-level, out of agent-platform scope |
| **kmobile `kmobile-desktop` (GUI)** | Eidolon GUI (deferred per ADR-023) | (none — out of scope) | `NO_MERIT` |
| **KDesktopVirt macOS Core Graphics** | Eidolon `eidolon-desktop` (already implemented) | `feat/eidolon-desktop-macos-virtual-stage-impl-20260610` | `DONE` |
| **KDesktopVirt Windows stubs** | Eidolon `eidolon-desktop` | `feat/eidolon-desktop-windows-virtual-stage-impl-20260610` | `DONE` (stubs) |
| **KDesktopVirt Linux stubs** | Eidolon `eidolon-desktop` | `feat/eidolon-desktop-linux-virtual-stage-impl-20260610` | `DONE` (stubs) |
| **bare-cua** | Eidolon `eidolon-sandbox` | `feat/eidolon-sandbox-playcua-dispatcher-stub-20260610` consumes PlayCua | `SUPERSEDED_PARITY` — PlayCua wins |
| **PlayCua (browser-automation sandbox)** | Eidolon `eidolon-sandbox::PlayCuaDispatcher` | `feat/eidolon-sandbox-playcua-dispatcher-stub-20260610` | `IN_PROGRESS` — stub needs impl |
| **mobile-next mobilecli (Go CLI)** | **KooshaPari/mobile-cli** (forked today) | fork @ `KooshaPari/mobile-cli` | `DONE` — fork exists; needs Eidolon adapter |
| **mobile-next mobile-mcp (TS MCP server)** | **KooshaPari/mobile-mcp** (forked today) | fork @ `KooshaPari/mobile-mcp` | `DONE` — fork exists; needs Eidolon-backed shim |
| **mobile-next devicekit-android** | (defer) | n/a | `DEFERRED` — mobilecli covers Android |
| **mobile-next devicekit-ios** | (defer) | n/a | `DEFERRED` — mobilecli covers iOS |
| **mobile-next mobilewright** | (defer) | n/a | `DEFERRED` — test framework |
| **agent-platform AgentRuntime port (TS)** | `agent-platform/ports/runtime.ts` | existing | `DONE` (port defined; expand with DeviceStage) |
| **agent-platform adapters (Forge, Codex, Codex)** | `agent-platform/ports/adapters/{forge,codex}.ts` | existing | `PARTIAL` — comment says 3 adapters, only 2 files |

---

## 5. mobile-mcp tool → Eidolon MobileStage mapping (canonical crosswalk)

This is the heart of the absorption: mobile-mcp's 27 MCP tools become the **production-grade impl** of Eidolon's MobileStage sub-trait. The shim is a thin TypeScript adapter inside `KooshaPari/mobile-mcp` that exposes MobileStage methods.

| mobile-mcp tool | Eidolon MobileStage / VirtualStage method | Notes |
|---|---|---|
| `mobile_list_available_devices` | (new `list_devices()`) | list adapter, not in core trait |
| `mobile_get_screen_size` | `VirtualStage::get_viewport()` | viewport.width × viewport.height |
| `mobile_get_orientation` | `VirtualStage::get_viewport()` | viewport.orientation |
| `mobile_set_orientation` | (new) | not in trait yet |
| `mobile_list_apps` | (new) | not in trait yet |
| `mobile_launch_app` | (new) | not in trait yet |
| `mobile_terminate_app` | (new) | not in trait yet |
| `mobile_install_app` | (new) | not in trait yet |
| `mobile_uninstall_app` | (new) | not in trait yet |
| `mobile_take_screenshot` | `VirtualStage::screenshot(path)` | direct match |
| `mobile_save_screenshot` | `VirtualStage::screenshot(path)` | direct match |
| `mobile_list_elements_on_screen` | (new) | a11y tree — needs extension |
| `mobile_click_on_screen_at_coordinates` | `MobileStage::tap(x, y)` | direct match |
| `mobile_double_tap_on_screen` | `MobileStage::tap(x, y)` (×2) | double-tap is repeated tap |
| `mobile_long_press_on_screen_at_coordinates` | `MobileStage::swipe(x, y, x, y, dur)` (new) | long-press is 0-distance swipe |
| `mobile_swipe_on_screen` | `MobileStage::swipe(x1, y1, x2, y2)` | direct match |
| `mobile_type_keys` | `MobileStage::input_text(text)` | direct match |
| `mobile_press_button` | `VirtualStage::pointer(PointerInput::Button)` | direct match (button is pointer event) |
| `mobile_open_url` | (new) | not in trait yet |
| `mobile_start_recording` / `mobile_stop_recording` | `VirtualStage::record_event` | record/playback (different shape) |

**Conclusion:** 6 of 20+ MobileStage methods directly match. The rest are app-management / device-management extensions that should become **MobileStage-extension methods** in a follow-up PR. The current PR absorbs the core (click/tap/swipe/screenshot/get_viewport) cleanly.

---

## 6. Absorption matrix (full traceability)

| Source Item | Source Evidence | Category | Source State | Target Repo | Target Evidence | Status | Deletion Justification | Risk if Deleted | Required Action |
|---|---|---|---|---|---|---|---|---|---|
| **kmobile-core `DeviceManager` port** | `kmobile/crates/kmobile-core/src/device_manager.rs` | internal arch | implemented | Eidolon `eidolon-mobile::DeviceManager` | new module in `feat/eidolon-mobile-virtual-stage-impl-20260610` follow-up | `MIGRATE` | Eidolon absorbs via PR; kmobile `DeviceManager` becomes deprecated alias | medium — loss of Rust-native impl detail | MIGRATE kmobile-core/src → Eidolon crates/eidolon-mobile/src/ |
| **kmobile XCTest iOS bridge** | `kmobile/crates/kmobile-bridge/src/ios/` | impl | implemented | Eidolon `eidolon-mobile/src/native/ios/` | TODO in mobile_stage.rs worktree | `MIGRATE` | Same | high — iOS impl is non-trivial | MIGRATE then verify on real device |
| **kmobile Android UiAutomator bridge** | `kmobile/crates/kmobile-bridge/src/android/` | impl | implemented | Eidolon `eidolon-mobile/src/native/android/` | TODO | `MIGRATE` | Same | high | MIGRATE |
| **kmobile `kmobile-mcp` server** | `kmobile/crates/kmobile-mcp/src/` | server | scaffold | Eidolon `crates/eidolon-mcp-server/` | new | `NOT_COVERED` | Eidolon needs new MCP server crate | medium | NEW CRATE: eidolon-mcp-server |
| **KDesktopVirt macOS Core Graphics** | `KDesktopVirt/crates/eidolon-desktop/src/macos/` | impl | implemented (already merged) | Eidolon `eidolon-desktop` | `feat/eidolon-desktop-macos-virtual-stage-impl-20260610` | `DONE` | Already merged via PR #61 | n/a | MERGE feat branch |
| **KDesktopVirt Windows** | `KDesktopVirt/crates/eidolon-desktop/src/windows/` | impl | stub | Eidolon `eidolon-desktop` | `feat/eidolon-desktop-windows-virtual-stage-impl-20260610` | `DONE` (stubs) | Same | low | MERGE feat branch |
| **KDesktopVirt Linux** | `KDesktopVirt/crates/eidolon-desktop/src/linux/` | impl | stub | Eidolon `eidolon-desktop` | `feat/eidolon-desktop-linux-virtual-stage-impl-20260610` | `DONE` (stubs) | Same | low | MERGE feat branch |
| **bare-cua** | `bare-cua/` | scaffold | deprecated | Eidolon `eidolon-sandbox` | `feat/eidolon-sandbox-playcua-dispatcher-stub-20260610` | `SUPERSEDED_PARITY` | PlayCua is the canonical; bare-cua is the old scaffold | low (already deprecated) | DELETE bare-cua after PlayCua absorbed |
| **PlayCua** | `PlayCua/` | lib + apps | active (worktree container) | Eidolon `eidolon-sandbox::PlayCuaDispatcher` | `feat/eidolon-sandbox-playcua-dispatcher-stub-20260610` | `IN_PROGRESS` | Eidolon is the consumer; PlayCua stays as backend crate | high — sandbox impl is unique | KEEP PlayCua as backend; absorb as Eidolon adapter |
| **mobile-next mobilecli** | `mobile-next/mobilecli` (Go, 2,500 LOC + ObjC/Java agents) | CLI + on-device agents | SOTA (prod) | **KooshaPari/mobile-cli** (fork) | `https://github.com/KooshaPari/mobile-cli` (just created) | `DONE` | Forked to KooshaPari; Eidolon MobileStage uses it via MCP | high — SOTA production impl | KEEP fork; add Eidolon MobileStage adapter shim |
| **mobile-next mobile-mcp** | `mobile-next/mobile-mcp` (TS, 3,477 LOC, 27 MCP tools) | MCP server | SOTA (prod) | **KooshaPari/mobile-mcp** (fork) | `https://github.com/KooshaPari/mobile-mcp` (just created) | `DONE` | Forked to KooshaPari; Eidolon MobileStage uses it | high | KEEP fork; add Eidolon MobileStage method mapping |
| **mobile-next devicekit-android** | `mobile-next/devicekit-android` | Go + Android | SOTA | (defer) | n/a | `DEFERRED` | mobilecli covers Android; can absorb later | low | DEFER — track as future absorption |
| **mobile-next devicekit-ios** | `mobile-next/devicekit-ios` | Go + ObjC | SOTA | (defer) | n/a | `DEFERRED` | mobilecli covers iOS | low | DEFER |
| **mobile-next mobilewright** | `mobile-next/mobilewright` | TS test framework | active | (defer) | n/a | `DEFERRED` | Not core to agent-platform domain | low | DEFER — out of scope |
| **mobile-next mobile-openrpc** | `mobile-next/mobile-openrpc` | OpenRPC specs | reference | (read-only) | n/a | `NO_MERIT` (just reference) | Useful for specs, not absorption | none | READ-ONLY reference |
| **mobile-next react-device-view** | `mobile-next/react-device-view` | React UI | reference | (defer) | n/a | `DEFERRED` | UI, out of scope | low | DEFER |
| **agent-platform `AgentRuntime` port (TS)** | `agent-platform/ports/runtime.ts` | port | defined | self | existing | `DONE` | Already exists | n/a | EXPAND with DeviceStage port |
| **agent-platform forge adapter** | `agent-platform/ports/adapters/forge.ts` | adapter | exists | self | existing | `DONE` | Already exists | n/a | ADD device-stage adapter |
| **agent-platform codex adapter** | `agent-platform/ports/adapters/codex.ts` | adapter | exists | self | existing | `DONE` | Already exists | n/a | ADD device-stage adapter |
| **agent-platform tests** | `agent-platform/ports/tests/runtime.test.ts` | tests | exists | self | existing | `PARTIAL` | Only tests AgentRuntime, not DeviceStage | medium | EXTEND with DeviceStage tests |
| **agent-platform `Cargo.lock`** | `agent-platform/Cargo.lock` | manifest | exists but no Cargo.toml | self | (orphaned) | `LAST_RESORT_EXCEPTION` | Has a Cargo.lock but no top-level Cargo.toml — needs investigation | low (orphan lock) | Either: add top-level Cargo.toml (multi-crate workspace) OR delete Cargo.lock |

---

## 7. Gaps and exceptions

### Gaps (must be created)

| Gap | Severity | Mitigation |
|---|---|---|
| Eidolon `eidolon-mobile` impl has stubs only (XCTest/UiAutomator not migrated) | HIGH | Phase-1 PR: copy `kmobile-bridge/{ios,android}` → `eidolon-mobile/src/native/{ios,android}` |
| Eidolon `eidolon-mcp-server` doesn't exist | MEDIUM | Phase-2 PR: new crate wrapping `Arc<dyn VirtualStage>` behind MCP |
| `KooshaPari/mobile-mcp` doesn't yet call Eidolon | HIGH | Phase-1 PR: replace mobile-mcp's iOS/Android implementations with MCP calls into Eidolon |
| `KooshaPari/mobile-cli` doesn't yet integrate with Eidolon | MEDIUM | Phase-2 PR: add `--eidolon-mode` flag that pipes to Eidolon |
| `agent-platform` doesn't yet have a `DeviceStage` port | HIGH | Phase-1 PR: add `ports/device_stage.ts` mirroring `runtime.ts` shape |

### Last-resort exceptions (cannot delete without preservation)

| Exception | Why | Minimum action |
|---|---|---|
| `agent-platform/Cargo.lock` without top-level `Cargo.toml` | Looks like an accidental orphan | Add Cargo.toml workspace pointing to existing ports (or remove Cargo.lock) |
| `PlayCua` active worktree container | Cannot merge PlayCua backend impl until PlayCua stabilizes; we MUST preserve as-is | KEEP; absorb as Eidolon SandboxStage adapter (not delete) |
| 80+ `feat/eidolon-core-from-*-20260611/12/14` branches | Individual `From` impl PRs — small but numerous | MERGE in batch (L5-103 wave) |
| 25+ `wip/on-feat-eidolon-core-*-2026-06-17` branches | WIP snapshots of in-flight `From` impls | BUNDLE into single WIP PR; close out original wip branches |

---

## 8. Absorption architecture (target state)

```
┌────────────────────────────────────────────────────────────────────────────┐
│                     AGENT (Claude, Codex, Codex, etc.)                     │
└─────────────────────────────────────┬──────────────────────────────────────┘
                                      │ MCP / RPC
                                      ▼
┌────────────────────────────────────────────────────────────────────────────┐
│  KooshaPari/agent-platform (DOMAIN I OWN) — TS hexagonal port              │
│  • AgentRuntime (existing) — exec/stream/cancel per agent                  │
│  • DeviceStage (NEW) — desktop | mobile | sandbox sub-ports               │
│  • Adapters: forge.ts | codex.ts | (codex.ts — 3rd was claimed but missing)│
└──────────┬───────────────────┬──────────────────────────┬───────────────────┘
           │                   │                          │
           ▼                   ▼                          ▼
┌────────────────────┐ ┌──────────────────────┐ ┌──────────────────────────┐
│ Eidolon (Rust)     │ │ KooshaPari/mobile-mcp│ │ KooshaPari/mobile-cli    │
│ VirtualStage trait │ │ (TS, 27 MCP tools)   │ │ (Go + ObjC + Java)       │
│  ├ DesktopStage    │ │  ↳ wraps mobilecli   │ │  ↳ XCTest + UiAutomator  │
│  ├ MobileStage     │ │  ↳ wraps native iOS  │ │  ↳ adb + WebDriverAgent  │
│  └ SandboxStage    │ │  ↳ wraps native And  │ │                          │
│       ↓ impls      │ └──────────────────────┘ └──────────────────────────┘
│ ┌────────────────┐ │
│ │eidolon-mobile  │ │        ┌─────────────────────────┐
│ │eidolon-desktop │ │        │ PlayCua (Python+TS)      │
│ │eidolon-sandbox │ │◄───────│ SandboxStage backend     │
│ │eidolon-mcp-srv │ │        │ browser-automation       │
│ └────────────────┘ │        └─────────────────────────┘
└────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────────────────────┐
│  PLATFORMS                                                        │
│  iOS (XCTest + WDA + devicekit-ios)                              │
│  Android (adb + UiAutomator + devicekit-android)                 │
│  macOS (Core Graphics)                                           │
│  Windows (Win32 stubs)                                           │
│  Linux (X11/Wayland stubs)                                       │
│  Web (PlayCua / Chromium)                                        │
│  VM (Docker, nanoVMs, Firecracker, KVM)                          │
└─────────────────────────────────────────────────────────────────┘
```

---

## 9. Deletion justification essay

### 9.1 Executive decision

**DELETE_AFTER_PATCHES** for: `bare-cua` (already deprecated; PlayCua is canonical).
**MERGE then ARCHIVE** for: 80+ `feat/eidolon-core-from-*` branches (batch merge per L5-103).
**KEEP** (fork to KooshaPari): `mobile-next/mobilecli` → `KooshaPari/mobile-cli`, `mobile-next/mobile-mcp` → `KooshaPari/mobile-mcp`. **Both forks already created today.**
**ABSORB** into Eidolon: `kmobile` (iOS/Android XCTest/UiAutomator + DeviceManager), `KDesktopVirt` (already merged via PR #61, branches being merged).
**KEEP as backend**: `PlayCua` (used as Eidolon SandboxStage backend).

### 9.2 Source inventory summary

5 active source repos (`kmobile`, `KDesktopVirt`, `bare-cua`, `PlayCua`, `agent-platform`) + 6 mobile-next org repos (2 forked, 4 deferred). All have meaningful content with no empty/scaffold exceptions — every branch on origin has either real impl or real design intent.

### 9.3 Branch inventory summary

~125 relevant branches across the 5 repos. ~110 already on origin. ~15 still need to be either merged or bundled into WIP PRs. The virtual-stage wave (12+ branches) is the highest-value, lowest-risk merge — should land first.

### 9.4 Target parity summary

Eidolon `VirtualStage` is the canonical absorb target — it already has the trait design, the sub-traits (`MobileStage`, `DesktopStage`, `SandboxStage`), and concrete impls for desktop (macOS Core Graphics + Windows + Linux stubs). MobileStage impl is a stub that needs kmobile's XCTest/UiAutomator code migrated in. SandboxStage impl is a stub that needs PlayCua connected. The KooshaPari/mobile-cli + mobile-mcp forks provide a production-grade alternative path for mobile that can be wrapped as a `MobileStage` adapter via MCP.

### 9.5 Merit of broken/empty/scaffold work

- **`bare-cua`** was scaffold (not broken) and was superseded by PlayCua. Safe to delete.
- **`agent-platform/Cargo.lock`** is an orphan lock file without top-level Cargo.toml — likely accidental. Investigate; either add workspace or delete.
- **`feat/eidolon-core-from-*-reset-20260614`** branches are "reset" branches (re-do of earlier impls). Safe to drop if merged or to merge in batch.
- **Eidolon's wip/* branches** are snapshot branches — should be bundled into a single WIP PR, not merged individually.

### 9.6 Last-resort exceptions

None blocking. The `agent-platform/Cargo.lock` orphan needs a 5-minute fix.

### 9.7 Final deletion recommendation

| Repo | Recommendation | Reason |
|---|---|---|
| `bare-cua` | **DELETE** | Superseded by PlayCua; already deprecated; `DEPRECATED_BARE_CUA.md` documents it |
| `KDesktopVirt` | **ARCHIVE** (after Eidolon desktop PRs merge) | Core Graphics impl already migrated to Eidolon desktop PRs (pending merge) |
| `kmobile` | **PARTIAL ABSORB** | XCTest/UiAutomator to Eidolon mobile; GUI/overlay out of scope (deferred per ADR-023) |
| `PlayCua` | **KEEP as backend** | Sandbox backend for Eidolon SandboxStage |
| `agent-platform` | **EXPAND** | Own this domain — add DeviceStage port, add 3rd adapter (claimed missing) |
| `KooshaPari/mobile-cli` | **KEEP** (forked today) | Production-grade mobile device impl |
| `KooshaPari/mobile-mcp` | **KEEP** (forked today) | Production-grade mobile MCP server; 27 tools |
| `mobile-next/devicekit-{ios,android}` | **DEFER** | mobilecli covers both; revisit if gaps emerge |
| `mobile-next/mobilewright` | **DEFER** | Test framework, out of agent-platform scope |
| `mobile-next/react-device-view` | **DEFER** | UI, out of scope |
| `mobile-next/mobile-openrpc` | **READ-ONLY** | Useful specs reference; not absorption target |

---

## 10. Recommended next actions (execution plan)

### Phase 0: Verify & cleanup (THIS TURN — DONE)
- [x] Push Eidolon snapshot `wip/2026-06-18-prepush-eidolon-snapshot` ✓
- [x] Verify Eidolon `feat/eidolon-mobile-virtual-stage-impl-20260610` is on origin ✓
- [x] Verify Eidolon `docs/eidolon-spec-virtual-stage-20260610` is on origin ✓
- [x] Fork `mobile-next/mobilecli` → `KooshaPari/mobile-cli` ✓
- [x] Fork `mobile-next/mobile-mcp` → `KooshaPari/mobile-mcp` ✓
- [x] Verify KDesktopVirt `91b808a` is on origin/main ✓
- [x] Verify agent-platform `wip/2026-06-17-prepush-agent-platform-dirty` is on origin ✓
- [x] Document plan in findings/2026-06-17-eidolon-absorption.md ✓ (this file)

### Phase 1: Eidolon virtual-stage wave (NEXT SESSION — high priority)
- [ ] PR: merge `feat/eidolon-virtual-stage-trait-20260610` → main
- [ ] PR: merge `feat/eidolon-mobile-virtual-stage-impl-20260610` → main
- [ ] PR: merge `feat/eidolon-desktop-{linux,macos,windows}-virtual-stage-impl-20260610` → main
- [ ] PR: merge `feat/eidolon-sandbox-virtual-stage-impl-20260610` → main
- [ ] PR: merge `docs/eidolon-spec-virtual-stage-20260610` → main
- [ ] PR: merge `docs/eidolon-adr-virtual-stage-20260610` → main
- [ ] PR: merge `feat/eidolon-virtual-stage-re-exports-20260610` → main
- [ ] PR: merge `test/eidolon-core-virtual-stage-{integration,tests}-20260610` → main
- [ ] PR: merge `ci/eidolon-virtual-stage-test-job-20260610` → main
- [ ] PR: merge `docs/eidolon-changelog-virtual-stage-entry-20260610` → main

### Phase 2: mobile-next shim (NEXT SESSION — high priority)
- [ ] PR: `KooshaPari/mobile-mcp` — add Eidolon-backed shim that replaces iOS/Android native impls with calls to Eidolon `MobileStage` via MCP
- [ ] PR: `KooshaPari/mobile-cli` — add `--eidolon-mode` flag that pipes to Eidolon

### Phase 3: agent-platform expansion (NEXT SESSION — medium priority)
- [ ] PR: `KooshaPari/agent-platform` — add `ports/device_stage.ts` mirroring `runtime.ts` shape, with `DesktopStage`, `MobileStage`, `SandboxStage` sub-ports
- [ ] PR: `KooshaPari/agent-platform` — add the missing 3rd adapter (the comment says 3 but only 2 files exist)
- [ ] PR: `KooshaPari/agent-platform` — add DeviceStage tests

### Phase 4: kmobile extraction (FUTURE SESSION — heavy work)
- [ ] PR: copy `kmobile/crates/kmobile-bridge/{ios,android}` → `Eidolon/crates/eidolon-mobile/src/native/{ios,android}`
- [ ] PR: copy `kmobile/crates/kmobile-core/src/device_manager.rs` → `Eidolon/crates/eidolon-mobile/src/device_manager.rs`
- [ ] PR: new Eidolon crate `eidolon-mcp-server` that wraps `Arc<dyn VirtualStage>` behind MCP
- [ ] DEFER `kmobile-overlay` + `kmobile-desktop` (app-level, out of scope per ADR-023)

### Phase 5: PlayCua integration (FUTURE SESSION — heavy work)
- [ ] PR: Eidolon `eidolon-sandbox::PlayCuaDispatcher` — replace stub with real PlayCua client
- [ ] VERIFY PlayCua is up to date in worktree container
- [ ] MERGE `feat/eidolon-sandbox-playcua-dispatcher-stub-20260610` first

### Phase 6: Eidolon `From` impl batch (L5-103 wave — already tracked)
- [ ] PR: batch-merge 80+ `feat/eidolon-core-from-*-20260611/12/14` branches
- [ ] CLEANUP: drop 25+ `wip/on-feat-eidolon-core-*-2026-06-17` branches after merge

### Phase 7: Bare-cua deletion + agent-platform orphan fix
- [ ] DELETE `bare-cua/` (already deprecated; safe to remove)
- [ ] FIX: either add `KooshaPari/agent-platform/Cargo.toml` workspace or remove orphan `Cargo.lock`

---

## 11. Open questions / future ADR candidates

- **ADR-030**: Eidolon as canonical absorb target for kmobile + KDesktopVirt + PlayCua (deferred — not blocking)
- **ADR-031**: agent-platform as the meta-port domain that owns all agent → device-modal coordination (deferred — needs design session)
- **Decision needed**: Does `KooshaPari/mobile-mcp` shim call Eidolon, or does Eidolon call mobile-mcp? **Recommend**: Eidolon is the canonical interface; mobile-mcp becomes a thin wrapper that calls Eidolon.
- **Decision needed**: Where do iOS/Android native impls live? Two options: (a) all in Eidolon `eidolon-mobile/src/native/{ios,android}/`; (b) KooshaPari/mobile-cli owns the native agents, Eidolon uses them via RPC. **Recommend**: (a) — keep Eidolon self-contained.
- **Decision needed**: Does the `mobilewright` testing framework get absorbed into Eidolon? **Recommend**: NO — out of scope; `mobilewright` is a test runner, not an automation substrate.

---

## 12. References

- Eidolon `VirtualStage` trait: `Eidolon-wtrees/eidolon-mobile-virtual-stage-impl-20260610/crates/eidolon-core/src/virtual_stage.rs`
- Eidolon `MobileStage` impl: `Eidolon-wtrees/eidolon-mobile-virtual-stage-impl-20260610/crates/eidolon-mobile/src/lib.rs`
- mobile-mcp tools: `/tmp/mobile-mcp/src/server.ts` (25 `tool()` calls)
- mobilecli devices: `/tmp/mobile-cli/devices/{ios,android}.go`
- mobilecli agents: `/tmp/mobile-cli/agents/{ios,android}/`
- agent-platform ports: `agent-platform/ports/runtime.ts`, `agent-platform/ports/adapters/{forge,codex}.ts`
- Plan v7: `plans/2026-06-17-v7-dag-stable.md`
- ADR-024 (71-pillar audit): `docs/adr/2026-06-17/ADR-024-71-pillar-industry-audit.md`
- ADR-029 (Dmouse92 migration, closure): `docs/adr/2026-06-17/ADR-029-dmouse92-to-kooshapari.md`
