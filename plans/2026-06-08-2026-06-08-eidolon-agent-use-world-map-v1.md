# Eidolon — Agent-Use World Map

**Date:** 2026-06-08
**Scope:** Local repos on `~/CodeProjects/Phenotype/repos/` + top OSS competitors in the "computer-use" / "device-automation" / "sandboxed-execution" space. This document is a **research-only** world map; no implementation steps have been taken and no code has been modified.

> **Status of this document:** Exploration artifact. Numbers, line counts, and LOC are derived from file reads on the current `main` worktrees and may not reflect in-flight branch changes. All file references are to absolute paths under `~/CodeProjects/Phenotype/repos/`.

---

## 0. Executive summary (TL;DR)

1. **Eidolon today is a thin trait layer + 1 real impl + 5 stubs.** The only non-trivial implementation is `eidolon-desktop/src/macos.rs` (228 lines of Core Graphics). The Windows / Linux / Mobile / Sandbox / Docker subcrates are logging-only stubs with `Ok(())` returns — no real code, but covered by `tokio::test` suites that mostly assert the trait signatures compile.
2. **Five sibling projects overlap Eidolon's scope** and three of them are essentially alive: `KDesktopVirt` (huge, partly broken), `kmobile` (rich CLI/API/MCP server), and the *identical-twin* `PlayCua` / `bare-cua` pair (native Rust binary + Python + C# JSON-RPC stack).
3. **Plan's recommendation: keep Eidolon as the home (Option A), but absorb PlayCua/bare-cua as `eidolon-cua-bridge` subcrates, treat KDesktopVirt as a *salvageable-but-not-a-substrate*, and treat kmobile as a *Phase-1 consumer*.** Consolidate PlayCua and bare-cua (they are the same project under two directory names).
4. **Language is Rust, with FFI to Python (PyO3), Node (napi-rs), and Swift (uniffi).** This is already the de-facto stack; the C#/Python/Node/TS bindings inside the sibling repos are evidence the user already favors this path.
5. **Three open conflicts require user input before any plan-of-attack starts** (see §6): (a) KDesktopVirt's `kvirtualstage` crate name vs. README claim of "merge into KDesktopVirt 2026-04-04"; (b) PlayCua vs bare-cua duplication; (c) whether Eidolon stays a trait library or becomes a binary.

---

## 1. Local repo world map

### 1.1 Eidolon (`~/CodeProjects/Phenotype/repos/Eidolon/`)

| Property | Value | Source |
|---|---|---|
| Purpose | "Unified trait-based device automation for desktop, mobile, and sandbox environments" | `Eidolon/README.md:17` |
| Stack | Rust (edition 2021, MSRV 1.75) | `Eidolon/Cargo.toml:11` |
| Members | 4 crates: `eidolon-core`, `eidolon-desktop`, `eidolon-mobile`, `eidolon-sandbox` | `Eidolon/Cargo.toml:1-7` |
| Maturity — core traits | Real: 3 traits, 4 input/event/viewport/error types | `Eidolon/crates/eidolon-core/src/traits.rs:6-67` |
| Maturity — desktop | **1 real impl** (macOS, 228 LOC of Core Graphics) + **2 stubs** (Windows / Linux, ~60 LOC each) | `Eidolon/crates/eidolon-desktop/src/macos.rs:1-228`; `Eidolon/crates/eidolon-desktop/src/windows.rs:1-60`; `Eidolon/crates/eidolon-desktop/src/linux.rs:1-61` |
| Maturity — mobile | **Stub only** (58 LOC) | `Eidolon/crates/eidolon-mobile/src/lib.rs:1-58` |
| Maturity — sandbox | **Stub only** (62 LOC + 44-LOC Docker trait placeholder) | `Eidolon/crates/eidolon-sandbox/src/lib.rs:1-62`; `Eidolon/crates/eidolon-sandbox/src/docker/mod.rs:1-44` |
| Tests | 4 test files; ~760 LOC of `tokio::test`; tests call the stubs and assert `Ok(())` returns — no end-to-end runtime verification | `Eidolon/crates/eidolon-core/tests/test_core.rs:1-292`; `…/test_desktop.rs:1-142`; `…/test_mobile.rs:1-154`; `…/test_sandbox.rs:1-173` |
| CI | 12 GitHub Actions workflows; org-wide billing-blocked, so local `cargo-deny` + `cargo-audit` only | `Eidolon/.github/workflows/{quality-gate,ci,cargo-deny,cargo-audit,cargo-semver-checks,cargo-machete,codeql,sbom-refresh,scorecard,doc-links,trufflehog,fr-coverage}.yml`; `Eidolon/STATUS.md:5-7` |
| Governance | "Work state: ACTIVE", "Pinned references" header pinned to org supersession list | `Eidolon/README.md:1-6`; `Eidolon/CLAUDE.md:1-75` |
| Release registry | Marked `status = "stub"` for desktop/mobile/sandbox, `alpha` for core | `Eidolon/release-registry.toml:10-38` |

**Trait surface** (from `Eidolon/crates/eidolon-core/src/traits.rs:1-85`):

- `DesktopAutomator` — 5 methods: `get_viewport`, `screenshot`, `pointer`, `text`, `record_event`
- `MobileAutomator` — 6 methods: `get_viewport`, `screenshot`, `tap`, `swipe`, `input_text`, `record_event`
- `SandboxAutomator` — 6 methods: `get_metadata`, `start`, `stop`, `exec`, `resource_usage`, `record_event`

All three traits require `Send + Sync` and are `async_trait`-decorated. Domain types (`PointerInput`, `TextInput`, `Viewport`, `AutomationEvent`, `SandboxMetadata`, `ResourceUsage`) are pure-data structs with `Serialize`/`Deserialize` and live in the same crate.

**Overlap with sibling repos:**
- `KDesktopVirt` (macOS/Windows/Linux) → `eidolon-desktop`; per `Eidolon/docs/EXTRACTION_PLAN.md:9-18` FFmpeg pipeline + security framework are "working", pointer/keyboard input system is "broken". Note: `Eidolon/crates/eidolon-desktop/src/macos.rs:1-228` already implements pointer + text + screenshot via Core Graphics — the macOS-side is *not* blocked on KDesktopVirt.
- `kmobile` (iOS/Android) → `eidolon-mobile`; described as "working interfaces; ready for direct consumption" (`Eidolon/docs/EXTRACTION_PLAN.md:21-29`).
- `KVirtualStage` (Docker / nanoVMs / KVM) → `eidolon-sandbox`; Docker adapter "✅ working" (`Eidolon/docs/EXTRACTION_PLAN.md:33-39`).
- `PlayCua` + `bare-cua` → not mentioned in `EXTRACTION_PLAN.md`; appear as consumer-only references in the broader org.

**Conflict surfaced (do not pick a side here):** `Eidolon/README.md:80` and `Eidolon/docs/EXTRACTION_PLAN.md:31` reference `KVirtualStage` as a source, but `KDesktopVirt/README.md:13` states "KVirtualStage was merged into KDesktopVirt 2026-04-04; eidolon-sandbox now integrates KDesktopVirt directly." The Eidolon `EXTRACTION_PLAN.md` predates the merge and has not been updated.

---

### 1.2 KDesktopVirt (`~/CodeProjects/Phenotype/repos/KDesktopVirt/`)

| Property | Value | Source |
|---|---|---|
| Purpose | "AI Agent Desktop Automation Platform ... Playwright-equivalent for virtualized desktop environments" | `KDesktopVirt/README.md:1-37` |
| Stack | Rust (Tokio, axum, bollard) + optional GStreamer audio + go bindings | `KDesktopVirt/Cargo.toml:15-100` |
| Package name | `kvirtualstage` (per `name = "kvirtualstage"`, `description = "A Playwright-equivalent desktop automation platform for AI agents"`) | `KDesktopVirt/Cargo.toml:4-7` |
| Binaries | `kvs-demo`, `kvs-server`, `kvs-tui`, `kvs-security-validation` | `KDesktopVirt/Cargo.toml:135-152` |
| Library | `lib.name = "kvirtualstage"`, `crate-type = ["cdylib", "rlib"]` (suggests prior C-FFI intent) | `KDesktopVirt/Cargo.toml:153-155` |
| Language bindings | Optional `python-bindings` (`pyo3 = "0.24"`) + `nodejs-bindings` (`napi = "2.0"`) features | `KDesktopVirt/Cargo.toml:30-33`, `KDesktopVirt/Cargo.toml:118-122` |
| Source modules | 50+ files under `src/`, including `automation_engine.rs` (WindMouse engine, natural typing engine), `desktop_control.rs` (VNC/RDP/WebRTC), `ui_automation.rs` (1,417 LOC, accessibility detection), `multimodal_detection.rs`, `ffmpeg_pipeline.rs` | `KDesktopVirt/src/{ui_automation.rs:1-1417, desktop_control.rs:1-1627, lib.rs:1-64}` |
| Tests | None in `src/`. `tests/` directory present but unverified contents. `WORKING_INTERFACES.md` and `ACTUAL_DEMONSTRATION.md` referenced for evidence. | Search for `tests.rs` in `KDesktopVirt` returned 0 matches in the top-level search. |
| CI | **None** — no `.github/` directory | `fs_search` for `.github/|workflows/|tests/|ci\.yml` in `KDesktopVirt` returned only README references; no `.github` directory |
| Self-declared state | "core broken; FFmpeg pipeline + security framework salvageable" per `Eidolon/docs/EXTRACTION_PLAN.md:9-18`; `SOTA.md`, `FINAL_ACHIEVEMENT_SUMMARY.md`, `ACCURACY_ACHIEVEMENT_SUMMARY.md`, `COMPREHENSIVE_PLATFORM_SUMMARY.md` present (suggesting self-promotional evidence) | Listed at `KDesktopVirt/{SOTA.md, FINAL_ACHIEVEMENT_SUMMARY.md, ACCURACY_ACHIEVEMENT_SUMMARY.md, COMPREHENSIVE_PLATFORM_SUMMARY.md}` |

**Key modules and their content (sampled):**

- `KDesktopVirt/src/ui_automation.rs:11-80` defines `UiElement`, `AccessibilityInfo`, `WindMouseConfig` (gravity, wind, min_wait, max_wait, max_step, target_area, tremor_chance, tremor_amount) and `TypingConfig` (base_delay, variance, mistake_chance, correction_delay, burst_typing, pause_chance). This is the *WindMouse* natural-mouse-motion system referenced in `Eidolon/docs/EXTRACTION_PLAN.md:13` as "✅ Working".
- `KDesktopVirt/src/desktop_control.rs:1-80` defines `DesktopControlManager` with VNC / RDP / WebRTC sub-managers, and `QualitySettings` / `SecuritySettings` / `Resolution` / `ColorDepth` types.
- `KDesktopVirt/src/lib.rs:1-64` exposes 40+ modules under `pub use`, including `tts_audio_system_broken` and `tts_audio_system` — both are referenced in `KDesktopVirt/src/lib.rs:34-35` with comments indicating the broken file is intentionally still compiled.
- `KDesktopVirt/src/bin/tui.rs`, `…/bin/demo.rs`, `…/bin/server.rs`, `…/bin/security_validation.rs` (referenced at `KDesktopVirt/Cargo.toml:138-151`) provide the CLI surface.
- `KDesktopVirt/src/automation/aci_agent.rs`, `…/mcp_live.rs`, `…/desktop_recording.rs` (referenced from `KDesktopVirt/src/lib.rs:18`) provide MCP integration, "ACI agent" (likely Anthropic Computer Interface), and recording.

**Maturity assessment:**
- File count: 50+ Rust source files; many over 1,000 LOC.
- Total LOC is large but largely undocumented; a *lot* of self-promotional Markdown at the root (`SOTA.md`, `COMPREHENSIVE_VALIDATION_REPORT.md`, `COMPREHENSIVE_PLATFORM_SUMMARY.md`, `ACCURACY_ACHIEVEMENT_SUMMARY.md`, `AI_INTEGRATION_ANALYSIS.md`, `AUDIT_COMPLIANCE.md`, etc.).
- The presence of *both* `tts_audio_system.rs` *and* `tts_audio_system_broken.rs` in the same `lib.rs` `pub use` list (`KDesktopVirt/src/lib.rs:34-35`) is a maintenance smell and is also called out in `Eidolon/docs/EXTRACTION_PLAN.md:17` as "Do NOT extract".
- The package name `kvirtualstage` while the repo is named `KDesktopVirt` is a name-identity mismatch noted by `KDesktopVirt/README.md:15` ("This repository is `KDesktopVirt`. It is distinct from `KVirtualStage` …"). The Cargo `name = "kvirtualstage"` is a strong signal that the *crate* still bears the old project name; consumers of `kdesktopvirt` on crates.io will not find it under that name.

**Conflict surfaced:** `KDesktopVirt/Cargo.toml:4` declares `name = "kvirtualstage"` while the directory is `KDesktopVirt/`. The `release-registry.toml` for `Eidolon` (`Eidolon/release-registry.toml:34-38`) still lists `source = "KVirtualStage"` for `eidolon-sandbox`. The pre-merge KVirtualStage crate name and the post-merge KDesktopVirt crate name have not been reconciled.

---

### 1.3 kmobile (`~/CodeProjects/Phenotype/repos/kmobile/`)

| Property | Value | Source |
|---|---|---|
| Purpose | "Kompass for Mobile Development — A comprehensive CLI, API, and MCP server for mobile app development and testing automation" | `kmobile/README.md:1-3` |
| Stack | Rust (Tokio, axum, reqwest, plist, sysinfo) + optional eframe/egui TUI | `kmobile/Cargo.toml:1-140` |
| Workspace | `members = [".", "crates/*"]` → top-level bin + 4 subcrates: `kmobile-api`, `kmobile-core`, `kmobile-cli`, `kmobile-mcp` | `kmobile/Cargo.toml:1-3`; `kmobile/crates/*` directory listing |
| Binaries | `kmobile`, `kmobile-mcp`, `kmobile-desktop` (gated by `desktop` feature) | `kmobile/Cargo.toml:120-132` |
| Features | `cli`, `api`, `mcp` (default); `tui` (ratatui); `desktop` (eframe); `audio` | `kmobile/Cargo.toml:133-140` |
| Tests | `crates/*` layout but no `tests/` directory under each crate. The top-level `Cargo.toml` has `assert_cmd` and `wiremock` in `dev-dependencies` (`kmobile/Cargo.toml:111-114`) but no `tests/*.rs` files were found at the top level. | `kmobile/Cargo.toml:111-114` |
| CI | **None** — no `.github/` directory | `fs_search` for `.github/` in `kmobile` returned 0 matches |
| Port traits | `DevicePort`, `ProjectPort`, `SimulatorPort`, `TestingPort` (all `async_trait`) | `kmobile/crates/kmobile-core/src/ports/{device.rs,project.rs,simulator.rs,testing.rs}` |
| `DevicePort` methods | `list_devices`, `connect_device`, `install_app`, `deploy_project`, `run_device_tests` | `kmobile/crates/kmobile-core/src/ports/device.rs:16-27` |

**MCP server:** `kmobile` ships a `kmobile-mcp` binary (`kmobile/Cargo.toml:123-127`) with a comprehensive tool surface — `device_list`, `device_connect`, `device_disconnect`, `device_info`, `device_screenshot`, `device_logs`, `simulator_list/start/stop/reset/install_app/uninstall_app`, `project_init/build/clean/status/dependencies`, `test_run/record/replay/generate/report`, `app_install/uninstall/launch/terminate/background`, `workflow_ci_setup/deploy/signing` — listed in `kmobile/README.md:288-329`.

**Hexagonal architecture:** `crates/kmobile-core` is the domain+ports layer; `crates/kmobile-api`, `crates/kmobile-cli`, `crates/kmobile-mcp` are the adapters (`kmobile/crates/kmobile-core/src/lib.rs:1-13`).

**Maturity assessment:**
- The README is ~1,000 lines and the Cargo.toml pins every realistic dep version. The project has the *shape* of a finished product.
- The actual implementation depth is unclear: `fs_search` for source files in `kmobile/src/` shows 21 files; the `crates/*` subcrates each have a minimal `main.rs` or `lib.rs`. The most substantial files appear to be `mcp_server.rs`, `mcp.rs`, `cli.rs`, `device_bridge.rs`, `simulator_basic.rs`, `device_basic.rs`, `testing.rs` (top-level `src/`).
- No CI; no `tests/`. So in practice the *maturity* is closer to "documented scaffolding" than "production".

**Conflict surfaced:** `kmobile/Cargo.toml:108-109` shows `# mcp = "0.1"` and `# jsonrpc-core = "18.0"` commented out — the user planned to use the `mcp` crate and `jsonrpc-core` but implemented a custom MCP server. This is consistent with the bare-cua/PlayCua pattern (custom JSON-RPC).

---

### 1.4 PlayCua (`~/CodeProjects/Phenotype/repos/PlayCua/`) and bare-cua (`~/CodeProjects/Phenotype/repos/bare-cua/`)

| Property | Value | Source |
|---|---|---|
| Purpose | "A heavy fork of [trycua/cua] that strips the VM layer and replaces the `computer-server` with a **native Rust binary** that communicates via **stdio JSON-RPC 2.0**" | `PlayCua/README.md:8-19` (== `bare-cua/README.md:8-19`) |
| Stack | Rust native (xcap, enigo, blake3, image, fast_image_resize) + Python (asyncio subprocess) + C# (`BareCua.cs`) | `PlayCua/Cargo.toml:1-27`; `bare-cua/Cargo.toml:1-27` |
| Architecture | Hexagonal (Ports & Adapters) — `domain/`, `ports/`, `adapters/{xcap,enigo,windows,linux,macos,process,analysis}`, `ipc/`, `plugins/`, `app/` | `PlayCua/README.md:82-117` |
| Workspace | `members = ["native"]` | `PlayCua/Cargo.toml:1-3`; `bare-cua/Cargo.toml:1-3` |
| Native binary | `bare-cua-native` (or `playcua-native`?) — README says `bare-cua-native[.exe]`; the binary name in the package is `bare-cua-native` | `PlayCua/native/Cargo.toml:8-10`; `PlayCua/README.md:128` |
| Port traits | `CapturePort` (capture_display, capture_window), `InputPort` (key_event, type_text, mouse_event), `WindowPort` (list_windows, find_window, focus_window), `ProcessPort` (launch, kill, status), `AnalysisPort` (diff, hash) | `PlayCua/native/src/ports/mod.rs:15-63` |
| Adapters | `xcap` (cross-platform fallback), `enigo` (cross-platform fallback), `windows/{wgc,sendinput,enumwin}`, `linux/{x11capture,uinput,ewmh}`, `macos/{cgcapture,cgevent,nsworkspace}`, `process_adapter`, `analysis_adapter` | `PlayCua/native/src/adapters/mod.rs:5-18` |
| Python client | `python/bare_cua/computer.py` (246 LOC) — async subprocess wrapper, screenshots, mouse, keyboard, window management, process management, image analysis | `PlayCua/python/bare_cua/computer.py:1-246` |
| Python agent | `python/bare_cua/agent.py` (referenced) — ComputerAgent with model='claude-sonnet-4-5' | `PlayCua/python/bare_cua/agent.py` (existence confirmed via `PlayCua/README.md:170-179`) |
| C# binding | `bindings/csharp/BareCua.cs` | `PlayCua/bindings/csharp/BareCua.cs` |
| OpenRPC spec | `contracts/openrpc.json` (14 methods) | `PlayCua/README.md:220-238`; `PlayCua/contracts/openrpc.json` |
| Tests | `native/tests/unit/analysis_tests.rs`; `python/tests/test_computer.py`; `tests/smoke_test.rs` | `PlayCua/{native/tests/unit/analysis_tests.rs, python/tests/test_computer.py, tests/smoke_test.rs}` |
| CI | **None** — no `.github/` | `fs_search` for `.github/` in `PlayCua` returned 0 matches |
| Status | "TBD - GitHub Actions billing-blocked org-wide" | `PlayCua/STATUS.md:1-19` (identical to `bare-cua/STATUS.md:1-19`) |

**Concrete file evidence for cross-platform implementation:**
- `PlayCua/native/Cargo.toml:33-54`:
  - `cfg(windows)` → `windows` crate v0.62 with `Win32_Foundation`, `Win32_UI_WindowsAndMessaging`, `Win32_UI_Input_KeyboardAndMouse`, `Win32_System_Threading`, `Win32_Graphics_Gdi`, `Win32_Graphics_Direct3D11`, `Win32_Graphics_Dxgi`, `Win32_Graphics_Dxgi_Common`, `Graphics_Capture`, `Graphics_DirectX`, `Graphics_DirectX_Direct3D11`, `Win32_System_WinRT_Direct3D11`, `Win32_System_WinRT_Graphics_Capture`, `Win32_System_Com`, `Foundation`, `Foundation_Collections` — direct WGC (Windows.Graphics.Capture) usage, not enigo.
  - `cfg(target_os = "linux")` → `x11rb = "0.13"`.
- `PlayCua/native/src/adapters/windows/wgc.rs` (existence confirmed via `fs_search`) — WGC adapter.
- `PlayCua/native/src/adapters/linux/uinput.rs`, `…/ewmh.rs`, `…/x11capture.rs` — Linux uinput + EWMH + x11capture.
- `PlayCua/native/src/adapters/macos/cgcapture.rs`, `…/cgevent.rs`, `…/nsworkspace.rs` — macOS CG/CGEvent/NSWorkspace.

**14 JSON-RPC methods** (from `PlayCua/README.md:220-238`): `ping`, `screenshot`, `input.key`, `input.type`, `input.click`, `input.scroll`, `input.move`, `windows.list`, `windows.focus`, `windows.find`, `process.launch`, `process.kill`, `process.status`, `analysis.diff`, `analysis.hash`.

**PlayCua == bare-cua? — STRONG EVIDENCE they are the same project:**

| Evidence | PlayCua | bare-cua |
|---|---|---|
| README | `PlayCua/README.md:1-310` byte-for-byte identical to `bare-cua/README.md:1-310` | same |
| Cargo.toml workspace | `PlayCua/Cargo.toml:1-27` | `bare-cua/Cargo.toml:1-27` byte-for-byte identical |
| Cargo.toml native | `PlayCua/native/Cargo.toml:1-60` | `bare-cua/native/Cargo.toml:1-60` (same file count, same content) |
| CLAUDE.md | `PlayCua/CLAUDE.md:1-60` — line 1: `# CLAUDE.md — PlayCua` | `bare-cua/CLAUDE.md:1-60` — line 1: `# CLAUDE.md — PlayCua` (says "PlayCua" inside bare-cua!) |
| Directory listings | `PlayCua/{native,python,bindings/csharp,contracts,sandbox,…}` — 80 files | `bare-cua/{native,python,bindings/csharp,contracts,sandbox,…}` — 80 files (same paths) |
| STATUS.md | `PlayCua/STATUS.md` | `bare-cua/STATUS.md` identical |
| SPEC.md, PLAN.md, CHANGELOG.md, VERSION | identical content | identical content |
| CI badge in README | `https://github.com/KooshaPari/PlayCua/actions` | `https://github.com/KooshaPari/PlayCua/actions` (uses the PlayCua badge URL even in the bare-cua README) |

**Conclusion:** `PlayCua` and `bare-cua` are *the same project* — one of them is likely a clone, mirror, or worktree of the other. The CI badge URL (`PlayCua/README.md:10`) is the strongest signal: `bare-cua/README.md:10` still points to `KooshaPari/PlayCua` for build status. *Surface this conflict for user input — do not pick a side.*

---

### 1.5 Other repos in the workspace that intersect the agent-use / device-automation / sandboxed-execution space

| Repo | Why it touches this space | Source |
|---|---|---|
| `Dino/` ("Diplomacy is Not an Option" — Unity game) | A *consumer* of bare-cua/PlayCua. Has `docs/playcua-backends.md`, `docs/sessions/playcua_phase3_5_spec.md`, `docs/sessions/playCUA_integration_audit.md`, `scripts/start-playcua.ps1`, `scripts/companion-playwright/`. This is the C# Unity game referenced in `PlayCua/README.md:181-194` ("DINOForge integration"). | `Dino/{docs/playcua-backends.md, scripts/start-playcua.ps1, scripts/companion-playwright/}` |
| `HeliosCLI/` | Contains `codex-rs/windows-sandbox-rs` (a codex-RL fork with Rust sandbox), `codex-rs/core/src/seatbelt.rs`, `codex-rs/core/src/seatbelt_permissions.rs`, `codex-rs/core/src/seatbelt_platform_defaults.sbpl` (macOS sandbox profiles). This is OpenAI's Codex CLI's sandbox layer — relevant for "sandboxed execution" patterns. | `HeliosCLI/codex-rs/{windows-sandbox-rs/src/lib.rs, core/src/seatbelt.rs, core/src/seatbelt_platform_defaults.sbpl}` |
| `HeliosLab/` | Has `docs/tests/playwright.config.ts` and `docs/tests/e2e/docsite.spec.ts`. *Not* a computer-use framework — only uses Playwright for *doc-site* e2e tests. | `HeliosLab/{docs/tests/playwright.config.ts, docs/tests/e2e/docsite.spec.ts}` |
| `phenoAI/` | LLM router + MCP server (`phenoAI/crates/mcp-server/src/lib.rs`). Relevant as a *consumer* of MCP-enabled tool servers (KDesktopVirt, kmobile) but not a CUA framework itself. | `phenoAI/crates/mcp-server/src/lib.rs` |
| `phenoDesign/`, `agileplus-agents/`, `argis-extensions/`, `phenoXdd/`, `phenoShared/`, `phenoKits/`, `phenoLang/`, `phenoRuntime/`, `phenoEvents/`, `phenoSchema/`, `phenoHandbook/`, `phenoPlugins/`, `phenoVCS/`, `phenoContracts/`, `phenoProc/`, `phenoObservability/`, `phenoProject/`, `phenoUtils/`, `phenoResearchEngine/`, `phenoData/`, `phenoForge/` | Phenotype org infrastructure collections; not device-automation. Search for `playwright\|computer use\|cua\|desktop\|automation` returned no matches in any of them. | (verified by absence in `fs_search` results) |

---

## 2. Remote + OSS competitor world map

> **Web sources verified during this research (2026-06-08):** URLs cited inline below. All claims attributed.

### 2.1 Anthropic Computer Use

- **Source:** https://docs.anthropic.com/en/docs/agents-and-tools/computer-use (now redirects to `/docs/en/agents-and-tools/tool-use/computer-use-tool`).
- **License / language:** Closed API; the *reference implementation* at `https://github.com/anthropics/anthropic-quickstarts/tree/main/computer-use-demo` is MIT/Apache and written in Python.
- **Status:** Beta. Latest beta header: `computer-use-2025-11-24` (for Claude Opus 4.8 / 4.7 / 4.6, Sonnet 4.6, Opus 4.5); older `computer-use-2025-01-24` for Sonnet 4.5, Haiku 4.5, Opus 4.1, Sonnet 4, Opus 4 (the latter three are deprecated per the doc). Source: Anthropic computer-use docs, retrieved 2026-06-08.
- **Action set (Basic):** `screenshot`, `left_click`, `type`, `key`, `mouse_move`.
- **Action set (Enhanced 2025-01-24):** adds `scroll`, `left_click_drag`, `right_click`, `middle_click`, `double_click`, `triple_click`, `left_mouse_down`, `left_mouse_up`, `hold_key`, `wait`.
- **Action set (Enhanced 2025-11-24):** adds `zoom` (region-of-screen zoom for higher accuracy) when `enable_zoom: true`.
- **Display parameters:** `display_width_px`, `display_height_px`, `display_number` (X11), `enable_zoom`.
- **Constraint on image size:** 1,568 px on longest edge, ~1.15 MP total. Claude Opus 4.8 / 4.7 support up to 2,576 px on long edge.
- **Architecture (from docs):** "A virtual X11 display server (using Xvfb) that renders the desktop interface Claude will see through screenshots and control with mouse/keyboard actions" + a Mutter + Tint2 desktop + Linux applications (Firefox, LibreOffice) + tool implementations + agent loop, all in a Docker container.
- **Token cost:** "system prompt overhead: 466–499 tokens", "input tokens per tool definition: 735 tokens" for Claude 4.x.
- **Overlap with Eidolon trait surface:** **Substantial.** `screenshot` ↔ `DesktopAutomator::screenshot`; `left_click`/`scroll`/`mouse_move` ↔ `DesktopAutomator::pointer`; `type`/`key`/`hold_key` ↔ `DesktopAutomator::text`; `screenshot` / `left_click` *could* be expressed as a subset of `MobileAutomator::screenshot` + `tap`. The Anthropic tool is *not* a library; it is an *API contract*. Eidolon could plausibly be wrapped behind it via the same transport (NDJSON), or be a *substrate* that an Anthropic-driven agent loop calls.

### 2.2 OpenAI Operator / CUA

- **Source:** OpenAI's Operator product is closed-source; the underlying model is sometimes called "CUA" (Computer-Using Agent) per https://openai.com/index/introducing-operator/ (referenced in research; not re-fetched). The OpenAI agent ecosystem is not yet a public OSS competitor with a published trait surface.
- **Overlap with Eidolon:** Cannot be assessed at the trait level because OpenAI has not published a per-platform adapter contract. In practice, OpenAI Operator runs in a remote browser-virtualization environment (similar to Anthropic's reference impl). Treating it as a *product* competitor, not a *library* competitor.
- **Verdict:** **Cannot be wrapped** in the sense of FFI binding, but could be a *peer* in the same product category. Eidolon's value prop is local / on-host automation; OpenAI's is remote / hosted.

### 2.3 trycua / cua (`https://github.com/trycua/cua`)

- **Status:** 17.8k stars, 3,488 commits, very active. Verified 2026-06-08.
- **Stack:** Python primary API (`pip install cua`); Rust core; macOS / Linux / Windows / Android sandboxes; cloud + local (QEMU) backends.
- **License:** License present in repo (LICENSE.md) — not re-fetched for license type, but the project is fully open.
- **API surface (Python):** `Sandbox.ephemeral(Image.linux() / .macos() / .windows() / .android())`; `sb.shell.run("echo hello")`, `sb.screenshot()`, `sb.mouse.click(x, y)`, `sb.keyboard.type("...")`, `sb.mobile.gesture((x1,y1), (x2,y2))`. This is the *agent*-facing API and overlaps Eidolon's `DesktopAutomator` + `MobileAutomator` + `SandboxAutomator` almost one-for-one.
- **Tooling pieces:** `cua-driver` (background computer-use on macOS and Windows, with Linux pre-release); `cua-bench` (benchmarks / RL envs on OSWorld, ScreenSpot, Windows Arena); `lume` (macOS virtualization).
- **Overlap with Eidolon trait surface:** **Very strong.** `screenshot()`, `mouse.click(x, y)`, `keyboard.type("...")` are 1:1 with `DesktopAutomator::{screenshot, pointer, text}`. `mobile.gesture(...)` is 1:1 with `MobileAutomator::{tap, swipe}`. `shell.run(...)` is 1:1 with `SandboxAutomator::exec`. The *agentic* difference is that trycua ships an LLM loop; Eidolon is a substrate.
- **Wrapping strategy:** Eidolon *could* provide a thin adapter that implements the trait by calling into `cua-driver` (or a similar substrate). Or, conversely, `cua` could be wrapped as an `eidolon-desktop`/`eidolon-mobile`/`eidolon-sandbox` implementation. Either direction is plausible.
- **This is bare-cua/PlayCua's upstream.** `PlayCua/README.md:15` explicitly says "A heavy fork of [trycua/cua] that strips the VM layer and replaces the `computer-server` with a **native Rust binary**." The downstream design lessons — ports/adapters, JSON-RPC, polyglot, OpenRPC contract — are all direct ports.

### 2.4 nut.js (`https://github.com/nut-tree/nut.js`)

- **Status:** 2.8k stars, 973 commits, mature, monorepo (`core/`, `providers/`, `e2e/window-test/`). Verified 2026-06-08.
- **Stack:** TypeScript / Node.js, native bindings per OS, pnpm workspaces.
- **License:** Public source; the author recently removed packages from npm "as announced in the blog post 'i give up'" (verbatim from the README; "still open source ... still free to use, you'll just have to build it from sources"). So the npm-distributed artifact is no longer trivially installable; users must build from source.
- **API surface (modules per README):** Clipboard, Keyboard, Mouse, Window, Screen. Each is a separate provider package. Screen includes `findOnScreen` (image match), `waitFor` (image/text/window), `highlight` (region).
- **Overlap with Eidolon trait surface:** **Strong, especially for `DesktopAutomator`**. Keyboard + Mouse + Window map directly to `pointer` + `text` + viewport. Screen's `screenshot` maps to `DesktopAutomator::screenshot`. Image matching (template matching via `@nut-tree/template-matcher`) has no direct Eidolon equivalent — this is a feature Eidolon would need to add or expose via a separate trait.
- **Wrapping strategy:** Feasible — a Node-side `eidolon-desktop` adapter could call into `nut.js` providers via NAPI bindings. The fact that `nut.js` itself is in transition (npm removal) is a *risk*; falling back to source builds is non-trivial.

### 2.5 pynput (`https://github.com/moses-palmer/pynput`)

- **Status:** 2.2k stars, 796 commits, mature. Verified 2026-06-08.
- **Stack:** Pure Python with ctypes bindings per OS; LGPL-3.0 (`COPYING.LGPL` at root).
- **API surface:** "This library allows you to control and monitor input devices. Currently, mouse and keyboard input and monitoring are supported." Specifically: `pynput.mouse.Controller` and `pynput.keyboard.Controller` (synthetic events), and `pynput.mouse.Listener` / `pynput.keyboard.Listener` (event hooks).
- **Overlap with Eidolon trait surface:** **Partial** — input only. No screenshot, no viewport, no windows. License is LGPL-3.0 which is *viral* and would be a problem for an MIT/Apache-licensed Eidolon distribution. Not a primary target for Eidolon wrapping.

### 2.6 pyautogui (`https://github.com/asweigart/pyautogui`)

- **Status:** 12.6k stars, 408 commits, mature. Verified 2026-06-08.
- **Stack:** Pure Python, BSD-3-Clause.
- **API surface:** `pyautogui.size()`, `.position()`, `.moveTo(x, y)`, `.click()`, `.click(x, y)`, `.moveTo(x, y, duration=2, tween=easeInOutQuad)`, `.write('Hello world!', interval=0.25)`, `.press('esc')`, `.hotkey('ctrl', 'c')`, `.screenshot()`, `.screenshot('path.png')`, `.locateOnScreen('button.png')`, `.locateCenterOnScreen('button.png')`, `.alert/.confirm/.prompt/.password`.
- **Dependencies per platform (from README):** Windows: no deps. macOS: `pyobjc-core` and `pyobjc`. Linux: `python3-xlib` and Pillow.
- **Overlap with Eidolon trait surface:** **Strong for `DesktopAutomator` (input + screenshot); partial for image-locate (Eidolon has no equivalent).** PyAutoGUI's `locateOnScreen` (template matching) is the missing feature.
- **Wrapping strategy:** Plausible as a Python-side Eidolon adapter; PyAutoGUI's Pillow dependency already covers PNG. The lack of a window-list API is a real gap.

### 2.7 pyobjc / AppleScript (macOS bridge)

- **Source:** Not re-fetched in this research. The pyautogui README explicitly cites `pyobjc-core` and `pyobjc` as the macOS dependency, and the pyautogui history shows pyobjc as the underlying Cocoa bridge.
- **Overlap with Eidolon:** Eidolon's `eidolon-desktop/src/macos.rs:7-10` uses `core-graphics` (the Rust equivalent of CoreGraphics, which pyobjc wraps). Functionally similar; the pyobjc route is more mature for Accessibility/AppleScript bridging. Eidolon's current macOS path is "synthetic events" only; it does not use Apple's Accessibility API (no `objc2-app-kit` usage in pointer/text yet — `Eidolon/crates/eidolon-desktop/Cargo.toml:18-20` only declares the dep).

### 2.8 Selenium (`https://github.com/SeleniumHQ/selenium`)

- **Status:** 34.2k stars, 34,568 commits, mature, multi-language monorepo (`common/`, `cpp/`, `dotnet/`, `java/`, `javascript/`, `py/`, `rb/`, `rust/`). Verified 2026-06-08.
- **Stack:** Java + JavaScript (webdriver) at the core; client libraries for .NET, Java, JS, Python, Ruby, *and a Rust directory present* (`rust/`). Bazel build.
- **API surface:** WebDriver W3C spec — `driver.get(url)`, `driver.findElement(...)`, `element.click()`, etc. Browser automation *only* — not desktop, not mobile, not sandbox.
- **Overlap with Eidolon trait surface:** **Weak.** Eidolon doesn't currently model browser automation; Selenium doesn't model OS-level input. The conceptual overlap is small (Playwright is a closer "modern" peer of Selenium and is more relevant to Eidolon's eventual `eidolon-web` future — see ADR-001 long-term).
- **Wrapping strategy:** Not a direct wrap target. If Eidolon adds a `BrowserAutomator` trait later, Selenium/Playwright are the natural backends.

### 2.9 Playwright (`https://github.com/microsoft/playwright`)

- **Status:** 90.5k stars, 17,180 commits, mature, TypeScript-first monorepo. Verified 2026-06-08.
- **Stack:** TypeScript / Node.js; owns a patched Chromium + Firefox + WebKit.
- **API surface:** `page.goto(url)`, `page.getByRole('button', { name: 'Submit' }).click()`, `page.screenshot()`, `page.locator(...).fill(...)`. Plus a `@playwright/mcp` package (`npx @playwright/mcp@latest`) that exposes the same capabilities as MCP tools. Plus `@playwright/cli` for coding-agent integration.
- **Overlap with Eidolon trait surface:** **Browser-only** — analogous to Selenium. No OS-level input, no mobile, no sandbox.
- **Relevance:** Playwright is the *default* browser-automation surface that Eidolon's future `eidolon-web` would integrate with. The existence of `@playwright/mcp` shows the *agent* community has already settled on "browser automation = MCP tool" as the integration pattern — the same pattern Eidolon should adopt for desktop.

### 2.10 Microsoft UI Automation (Windows)

- **Source:** https://learn.microsoft.com/en-us/windows/win32/winauto/entry-uiauto-win32. Verified 2026-06-08.
- **Stack:** COM-based Win32 API (UIAutomationCore.dll); managed wrapper via `System.Windows.Automation` in .NET Framework. "UI Automation is designed for experienced C/C++ developers … COM objects and interfaces, Unicode, and Windows API programming."
- **API shape:** Accessibility-first; traverse the UI tree via `IUIAutomation::GetRootElement`, find by condition, invoke patterns (`InvokePattern`, `ValuePattern`, etc.).
- **Overlap with Eidolon trait surface:** **None directly** — UIAutomation is *semantic* (queries the accessibility tree) whereas `DesktopAutomator` is *synthetic* (sends events at coordinates). UIAutomation is the *better* path for reliable, accessible element targeting. Eidolon does not currently use UIAutomation.
- **Wrapping strategy:** A future `eidolon-desktop/src/windows_uia.rs` could use the `windows` crate v0.62 (already a dep of `PlayCua/native/Cargo.toml:33-51`) to call UIAutomation from Rust.

### 2.11 Android UiAutomator (mobile)

- **Source:** Not re-fetched; general knowledge + `Eidolon/docs/EXTRACTION_PLAN.md:27` cites "UiAutomator framework wrappers from kmobile/android/uiautomator/".
- **API surface:** Java/Kotlin; `UiDevice`, `UiSelector`, `UiObject`; command-line `uiautomator dump`; runs as an instrumentation test in an APK.
- **Overlap with Eidolon trait surface:** Direct — `MobileAutomator::{tap, swipe, input_text, screenshot}` map to `UiDevice.click(x,y)`, `UiDevice.swipe(...)`, `UiDevice.setText(...)`, `UiDevice.takeScreenshot()`. Eidolon's `eidolon-mobile/src/native/mod.rs:17-23` already declares the trait placeholder `AndroidTestAdapter`.
- **Wrapping strategy:** Eidolon-mobile's iOS XCTest + Android UiAutomator path is the most natural Phase-1 implementation; `kmobile` is cited as the working source.

### 2.12 XCTest / XCUITest (iOS)

- **Source:** Not re-fetched; general knowledge + `Eidolon/docs/EXTRACTION_PLAN.md:24` cites "XCTest framework helpers from kmobile/ios/test_support/".
- **API shape:** Objective-C / Swift; `XCUIApplication`, `XCUIElement`, `XCUIScreen`. Bound to the host's Xcode toolchain.
- **Overlap with Eidolon trait surface:** Direct — `MobileAutomator::{tap, swipe, input_text, screenshot}` map to `XCUIElement.tap()`, `.swipeUp()`, `.typeText(...)`, `XCUIScreen.main.screenshot()`. Eidolon-mobile declares `IosTestAdapter` at `Eidolon/crates/eidolon-mobile/src/native/mod.rs:8-14`.
- **Wrapping strategy:** Idiomatic Phase-1 work — shell out to `xcodebuild test` with a UI-test target and parse the result, or use the `objc2` / `objc2-app-kit` crates (already a dep of Eidolon at `Eidolon/crates/eidolon-desktop/Cargo.toml:18-20`) to drive XCUITest programmatically.

---

### 2.13 Quick comparison matrix

| Tool | Lang | License | Trait overlap with Eidolon | Wrappable? | Maturity |
|---|---|---|---|---|---|
| Anthropic Computer Use | Closed API | n/a | Strong (event surface) | No (API), yes (reference impl) | Beta, 2025-11 header |
| OpenAI Operator | Closed | n/a | Unknown (no public trait) | No | Production |
| trycua/cua | Python+Rust | Open (LICENSE.md) | **Very strong** | Yes (could be the substrate) | 17.8k stars, active |
| nut.js | TypeScript+Node | Open (no npm) | Strong (input, screen, window) | Yes (NAPI) | 2.8k, maintainer in transition |
| pynput | Python | **LGPL-3.0** | Partial (input only) | License friction | 2.2k, mature |
| pyautogui | Python | BSD-3 | Strong (input, screen, no windows) | Yes | 12.6k, mature |
| pyobjc | Python | MIT | n/a (substrate) | Yes (substrate, not wrapper) | Apple, mature |
| Selenium | Multi | Apache-2.0 | Browser only | Yes (future `eidolon-web`) | 34.2k, mature |
| Playwright | TypeScript | Apache-2.0 | Browser only (+ MCP variant) | Yes (future `eidolon-web`) | 90.5k, mature |
| MS UI Automation | C/C++/COM | Closed (Windows) | None (semantic, not synthetic) | Substrate, not wrapper | Microsoft, mature |
| Android UiAutomator | Java/Kotlin | Apache-2.0 | Direct (mobile) | Substrate for `eidolon-mobile` | Google, mature |
| XCTest / XCUITest | Obj-C/Swift | Apache-2.0 | Direct (mobile) | Substrate for `eidolon-mobile` | Apple, mature |

---

## 3. Eidolon's current implementation depth

> **Method:** Direct read of every `.rs` file in the four crates; counts via file line totals. "Stub-density" = (lines that contain only `Ok(())` / `log::info!` and no real work) / (total LOC of impl file).

### 3.1 `eidolon-core` (6 files)

| File | LOC | What it is |
|---|---|---|
| `crates/eidolon-core/src/lib.rs` | 19 | Module re-exports |
| `crates/eidolon-core/src/error.rs` | 7 | Re-export of `phenotype_errors` |
| `crates/eidolon-core/src/event.rs` | 65 | `AutomationEvent` + `EventPayload` enum + constructors |
| `crates/eidolon-core/src/input.rs` | 53 | `PointerInput` + `TextInput` + constructors |
| `crates/eidolon-core/src/traits.rs` | 85 | `DesktopAutomator`, `MobileAutomator`, `SandboxAutomator`, `SandboxMetadata`, `ResourceUsage` |
| `crates/eidolon-core/src/viewport.rs` | 37 | `Viewport` + `desktop_fhd` / `mobile_fhd` / `tablet_qhd` constructors |
| **Subtotal** | **266** |  |
| `crates/eidolon-core/tests/test_core.rs` | 292 | 27 `#[test]` functions covering viewport/input/event/serialization |

**Quality:** All `Serialize`/`Deserialize` round-trips verified; all constructors tested. No `todo!()` / `unimplemented!()` in core. **Real, ready code.**

### 3.2 `eidolon-desktop` (4 files + 1 test file)

| File | LOC | Real impl? | Stub-density |
|---|---|---|---|
| `crates/eidolon-desktop/src/lib.rs` | 58 | cfg-gated `DesktopClient` type alias + cross-platform fallback stub | Mixed |
| `crates/eidolon-desktop/src/macos.rs` | **228** | **YES** — real Core Graphics impl (screenshot via `CGDisplay::image`, mouse via `CGEvent::new_mouse_event`, keyboard via `CGEvent::new_keyboard_event`) | **~5%** (only the "TODO: use NSScreen backingScaleFactor" line at `macos.rs:31`) |
| `crates/eidolon-desktop/src/windows.rs` | 60 | **NO** — every method is `// TODO: SendInput` + `log::info!` + `Ok(())` | **~85%** |
| `crates/eidolon-desktop/src/linux.rs` | 61 | **NO** — same pattern: `// TODO: xdotool` / `// TODO: xwd` / `log::info!` + `Ok(())` | **~85%** |
| `crates/eidolon-desktop/tests/test_desktop.rs` | 142 | 16 `#[tokio::test]`; every test calls the stub and asserts `is_ok()` — none exercise real OS input |
| **Subtotal impl** | **349** | (1 real, 2 stubs) |

**Critical observation:** The macOS impl uses `core-graphics` 0.25 (a thin CG wrapper) and converts BGRA → RGBA manually (lines 67–76). This is *real* working code; it is not a stub. The two TODO comments in the macOS file are limited to "use NSScreen backingScaleFactor" — i.e., `dpr` is hard-coded to 1.0 (`Eidolon/crates/eidolon-desktop/src/macos.rs:32`).

### 3.3 `eidolon-mobile` (2 files + 1 test file)

| File | LOC | Real impl? | Stub-density |
|---|---|---|---|
| `crates/eidolon-mobile/src/lib.rs` | 58 | **NO** — `MobileClient` with `log::info!` + `Ok(())`; has `// TODO: Integrate iOS XCTest / Android UiAutomator` at line 30 | **~90%** |
| `crates/eidolon-mobile/src/native/mod.rs` | 26 | Trait placeholders only (`IosTestAdapter`, `AndroidTestAdapter`) — no `impl` blocks | **100%** |
| `crates/eidolon-mobile/tests/test_mobile.rs` | 154 | 18 `#[tokio::test]`; tests stubs only |
| **Subtotal impl** | **84** | 0 real, 2 stubs/placeholders |

### 3.4 `eidolon-sandbox` (2 files + 1 test file)

| File | LOC | Real impl? | Stub-density |
|---|---|---|---|
| `crates/eidolon-sandbox/src/lib.rs` | 62 | **NO** — `SandboxClient` with hard-coded metadata stubs and `log::info!` for start/stop/exec | **~95%** |
| `crates/eidolon-sandbox/src/docker/mod.rs` | 44 | Trait placeholder `DockerOrchestrator` only — no `impl`, no bollard/shell-out | **100%** |
| `crates/eidolon-sandbox/tests/test_sandbox.rs` | 173 | 22 `#[tokio::test]`; tests stubs only |
| **Subtotal impl** | **106** | 0 real, 2 stubs/placeholders |

### 3.5 Summary scorecard

| Crate | Real impl | Stubs | Trait placeholders | Test coverage |
|---|---|---|---|---|
| `eidolon-core` | n/a (pure traits + types) | n/a | n/a | Excellent (27 tests) |
| `eidolon-desktop` | 1 (macOS, 228 LOC) | 2 (Win 60, Lin 61) | n/a | 16 tests, all hit stubs |
| `eidolon-mobile` | 0 | 1 (58 LOC) | 1 (26 LOC) | 18 tests, all hit stubs |
| `eidolon-sandbox` | 0 | 1 (62 LOC) | 1 (44 LOC) | 22 tests, all hit stubs |
| **Totals** | **228 LOC real** | **241 LOC stub** | **70 LOC placeholder** | **83 tests** |

**Honest reading:** Eidolon today is a *skeleton* — 1 of 5 platform impls is real, the other 4 are placeholders that compile and pass tests but do nothing. The trait definitions and event/viewport/input types are production-quality. The impl density is ~49% (228 real / 469 total impl LOC).

---

## 4. Language / FFI recommendation

> **Constraint:** the user has stated a preference for "the most optimal language for the core + interface bindings to other languages (PyO3 pattern)."

### 4.1 Candidate core languages

| Language | Strengths | Weaknesses for Eidolon | Verdict |
|---|---|---|---|
| **Rust** (current) | Strong async (Tokio), safe FFI, first-class FFI ecosystem (PyO3, napi-rs, uniffi, cbindgen, neon). Trait-driven design is idiomatic. Pattern already in use across all 5 sibling projects. | Compile times, learning curve, lifetime ergonomics for some OS-level APIs. | **RECOMMENDED** — language is right; ecosystem is right; the trait design in `eidolon-core/src/traits.rs` is idiomatic Rust. |
| **Zig** | Comptime FFI is excellent; C interop is first-class; smaller binary surface. | Tiny FFI ecosystem (no PyO3-equivalent); no first-class async runtime; no native napi-rs; small community. | NOT recommended. The 0.x ecosystem can't support Eidolon's polyglot ambition. |
| **Go** | cgo works; goroutines are pleasant; cross-compile is good. | No first-class FFI binding to Python/JS/Swift (must handcraft); no PyO3; no uniffi; no napi-rs. cgo is slow and unsafe. | NOT recommended. FFI is a long-term maintenance burden. |
| **C++** | Lingua franca; every OS API has a C++ wrapper. | Unsafe; no first-class async; no modern FFI to high-level languages. | NOT recommended. Already too many C++ ports of OS APIs to maintain. |
| **Python** | pyautogui-style end-user-friendly; rapid prototyping; broad adoption. | Slow; GIL; unsafe FFI; no static type safety for OS-level work. | NOT recommended as *core* — but ideal as *primary binding language*. |
| **TypeScript / Node** | Rich ecosystem (Playwright, nut.js, electron, xcap bindings via NAPI). | FFI to OS-level (CoreGraphics, WGC, CGEvent) is hard; no first-class FFI to Python; weak cross-compile story. | NOT recommended as *core* — but ideal as *secondary binding language*. |

### 4.2 FFI binding priorities

Given that Eidolon's *consumers* in the user's org include:
- **Dino (Unity, C#)** — needs a C# binding to drive the CUA stack
- **kmobile, KDesktopVirt, PlayCua, bare-cua** — all already ship Python bindings
- **phenoAI (MCP server)** — wants to be an MCP tool *provider*, not a consumer
- **Anthropic / OpenAI / trycua** — all agent-loop integrations are Python-first

The FFI surface to ship in order:

1. **Python via PyO3** — first priority. Evidence: `KDesktopVirt/Cargo.toml:31` already declares `pyo3 = "0.24"` as an optional dep; `bare-cua/SPEC.md:14-16` lists "Python bindings (PyO3)" as a Phase-3 deliverable; `trycua/cua` is Python-first; `pyautogui` ecosystem is Python.
2. **Node via napi-rs** — second priority. Evidence: `KDesktopVirt/Cargo.toml:32-33` declares `napi = "2.0"` + `napi-derive`; `PlayCua/bindings/csharp/BareCua.cs` and `PlayCua/python/bare_cua/computer.py` are both client-side language bindings; future `@playwright/mcp`-style MCP servers in TypeScript need a Node binding.
3. **Swift via uniffi** — third priority. Evidence: Eidolon already pulls `objc2`, `objc2-foundation`, `objc2-app-kit` (`Eidolon/crates/eidolon-desktop/Cargo.toml:18-20`) for macOS-native work; Swift consumers in the macOS/iOS space would prefer a SwiftPM package; `uniffi` is the Mozilla-generated path.
4. **C# via P/Invoke or uniffi** — fourth priority. Evidence: `PlayCua/bindings/csharp/BareCua.cs` is already a C# binding to the bare-cua JSON-RPC binary; Dino (Unity) is the consumer. For Unity, P/Invoke against a `cdylib` is more idiomatic than uniffi.
5. **C ABI via cbindgen** — fifth priority. Defensive, so any future language (Kotlin, Ruby, Go) can bind.

**Net recommendation: Rust core + PyO3 + napi-rs + uniffi (Swift) + cbindgen (C).** This is already the de-facto stack in the user's ecosystem; standardizing Eidolon on it is the lowest-risk, highest-leverage move.

---

## 5. Consolidation recommendation

> **Criterion:** *"Does Eidolon already implement what this repo does, plus the trait shape means we can plug it in without a refactor?"*

### 5.1 Decision matrix

| Repo | (a) Absorb as subcrate | (b) Leave independent | (c) Replace with Eidolon | Recommendation |
|---|---|---|---|---|
| **KDesktopVirt** | NO. Too large (50+ files, 10k+ LOC), `kvirtualstage` crate name mismatch, self-declared partly broken (per `Eidolon/docs/EXTRACTION_PLAN.md:9-18` and the dual `tts_audio_system.rs` / `tts_audio_system_broken.rs`). The salvageable pieces (FFmpeg pipeline, security framework, WindMouse engine) are *not* what Eidolon's traits currently need — Eidolon's macOS impl already uses `core-graphics` directly, not FFmpeg. | YES, with a contract. KDesktopVirt is its own product surface (Playwright-equivalent for virtualized desktop) and has its own consumers (Dino, MCP servers, Kube/Helm charts). Eidolon should treat KDesktopVirt as a *peer* and add an `eidolon-desktop` *adapter* that calls into it. | NO. KDesktopVirt's scope (full Linux desktop in Docker, video recording, TTS, MCP) is much wider than Eidolon's `DesktopAutomator` trait. | **(b) Leave independent**, but add a thin `eidolon-desktop` *adapter* that wraps KDesktopVirt as a `DesktopAutomator` impl. |
| **kmobile** | NO. kmobile has its own hexagonal core (`crates/kmobile-core` with `DevicePort`, `ProjectPort`, `SimulatorPort`, `TestingPort`) and a real MCP server. Absorbing it would force a trait merge that neither side has the bandwidth for. | YES, with a contract. kmobile is the *only* working mobile-automation stack in the user's org; the Eidolon `MobileAutomator` trait was explicitly designed to be filled in by kmobile's XCTest/UiAutomator adapters (per `Eidolon/docs/EXTRACTION_PLAN.md:21-29`). | NO. kmobile's scope (project init, builds, signing, deploy, CI) is wider than Eidolon's `MobileAutomator`. | **(b) Leave independent**, then in `eidolon-mobile` add an `AndroidUiAutomatorClient` and `IosXcTestClient` that *shell out* to kmobile's CLI/API/MCP server — i.e., `eidolon-mobile` becomes a thin RPC wrapper around kmobile. |
| **PlayCua** | **YES, but only as the desktop impl.** PlayCua/bare-cua's port surface (`CapturePort`, `InputPort`, `WindowPort`, `ProcessPort`, `AnalysisPort`) maps cleanly to Eidolon's `DesktopAutomator` + process-management needs. The OpenRPC contract can become the wire contract for an `eidolon-desktop` adapter that spawns `bare-cua-native` and speaks NDJSON. | NO. PlayCua is too narrowly scoped (desktop only) to live as an independent product; it's a substrate, not a product. | NO. Eidolon doesn't have a working *Windows WGC* or *Linux uinput* impl today; PlayCua does. Eidolon can't *replace* PlayCua until those impls exist. | **(a) Absorb as subcrate** — specifically as `crates/eidolon-cua-bridge` (or `eidolon-desktop-cua`) that depends on `eidolon-core` and wraps the `bare-cua-native` binary via stdio JSON-RPC. The OpenRPC spec becomes a contract that Eidolon honors. |
| **bare-cua** | **Same as PlayCua.** | **Same as PlayCua.** | **Same as PlayCua.** | **(a) Absorb — and deprecate one of the two directory names.** The two repos are byte-identical at the README + Cargo.toml level (see §1.4); keeping both is repo sprawl. **Strong recommendation: keep one (PlayCua is the upstream per CI badges), archive the other (bare-cua) as a redirect.** |

### 5.2 What "absorb" means in practice (not a plan to execute now)

If/when the user approves (b) + (a)+(a) above, the resulting Eidolon workspace would look like:

```
Eidolon/
  crates/
    eidolon-core/           (unchanged — 3 traits, types)
    eidolon-desktop/        (existing macOS impl + Win/Linux stubs)
    eidolon-mobile/         (existing stub; add kmobile RPC client)
    eidolon-sandbox/        (existing stub; add Docker + KVM impls)
    eidolon-cua-bridge/     (NEW — wraps bare-cua-native via stdio JSON-RPC)
  bindings/                 (NEW — PyO3, napi-rs, uniffi, cbindgen outputs)
```

KDesktopVirt and kmobile remain independent repos but each gains an *adapter crate* that implements Eidolon's traits by calling into their existing APIs.

---

## 6. Risks and open questions (require user input)

> **Surfaced conflicts** (do not pick a side without user confirmation):

1. **PlayCua vs bare-cua — same project, two directory names.** Evidence: byte-identical `README.md`, `Cargo.toml`, `CLAUDE.md` (bare-cua's says "PlayCua"), `STATUS.md`, `SPEC.md`, `PLAN.md`. CI badges in both READMEs point to `KooshaPari/PlayCua`. **Question for user:** which directory is canonical, and is the other a stale mirror, a worktree, or an intentional fork? If the latter, what's the divergence policy?

2. **KDesktopVirt's `kvirtualstage` crate name vs. its directory and its own README.** The crate is `kvirtualstage` (`KDesktopVirt/Cargo.toml:4`); the directory is `KDesktopVirt/`; the README says "KVirtualStage was merged into KDesktopVirt 2026-04-04" (`KDesktopVirt/README.md:13`). The Eidolon `release-registry.toml` still says `source = "KVirtualStage"` for `eidolon-sandbox` (`Eidolon/release-registry.toml:38`). **Question for user:** is the crate name staying as `kvirtualstage` for crates.io compatibility, or is a rename planned? Should `eidolon-sandbox` consume `KDesktopVirt` or `kvirtualstage` once integration begins?

3. **Eidolon as a library vs. a binary.** Today Eidolon is a pure library (`Eidolon/Cargo.toml:1-27` declares no `[[bin]]`). The user said "Eidolon currently has 4 crates" — implying library-only. But PlayCua/bare-cua shows a *binary + IPC* shape is more practical for AI-agent consumption. **Question for user:** should Eidolon ship a `eidolon-server` binary (JSON-RPC / MCP) alongside the library, or remain library-only and let consumers embed it?

4. **Stub vs. real impl commitment.** Of the 5 platform impls, 4 are stubs. The macOS impl is real. **Question for user:** which impls should be filled in first — Windows (WGC + UIAutomation), Linux (uinput + X11), iOS (XCUITest), Android (UiAutomator), or Sandbox (Docker + nanoVMs)? The current `EXTRACTION_PLAN.md:9-39` lists priorities but the user may have different priorities now (especially given the consolidation discussion).

5. **OpenAI / Anthropic / trycua competitor positioning.** Anthropic's Computer Use (`computer-use-2025-11-24` beta header as of 2026-06-08) and trycua/cua (17.8k stars, 3,488 commits) are the most credible competitors. **Question for user:** is Eidolon meant to be (i) a substrate that agent loops call (like trycua), (ii) a Rust re-implementation of an agent loop (like Anthropic's reference impl), or (iii) a thin SDK that any agent loop can embed? The current trait design is closest to (i), but the polyglot ambition suggests (iii).

6. **Org-wide CI is billing-blocked.** Every repo's `STATUS.md` says "TBD - GitHub Actions billing-blocked org-wide" (verbatim, e.g. `Eidolon/STATUS.md:5`, `PlayCua/STATUS.md:5`, `bare-cua/STATUS.md:5`). The 12 Eidolon workflows (`Eidolon/.github/workflows/*`) are therefore unenforced. **Risk:** any consolidation plan must account for the fact that CI gates are aspirational, not enforced, today.

7. **Test depth is shallow.** Eidolon's 83 tests all call stubs and assert `Ok(())` (e.g., `Eidolon/crates/eidolon-sandbox/tests/test_sandbox.rs:80-93` asserts `exec("ls -la")` returns the literal string `"stub output"`). **Risk:** a "passing" test suite gives false confidence. **Question for user:** should Phase-1 work include an integration test matrix against a real Linux Xvfb, real Android emulator, and real iOS simulator?

---

## 7. Proposed plan of attack (NOT to be executed; for user review only)

> The following phases are a *plan*, not a directive. No code will change as a result of this document. Each phase lists **objective**, **scope** (which files/repos), and **verification criteria** so the user can decide what to greenlight.

### Phase 0 — Reconcile PlayCua vs bare-cua (and the KDesktopVirt crate-name mismatch)

- **Objective:** Resolve the duplicated-project conflict and the `kvirtualstage` crate-name conflict before any further consolidation.
- **Scope:**
  - `~/CodeProjects/Phenotype/repos/PlayCua/` and `~/CodeProjects/Phenotype/repos/bare-cua/`
  - `~/CodeProjects/Phenotype/repos/KDesktopVirt/Cargo.toml`
  - `~/CodeProjects/Phenotype/repos/Eidolon/release-registry.toml`
  - `~/CodeProjects/Phenotype/repos/Eidolon/docs/EXTRACTION_PLAN.md`
- **Verification criteria:**
  - User has confirmed which directory is canonical for the "PlayCua" project and whether the other is a mirror/worktree/fork.
  - User has confirmed whether `KDesktopVirt` keeps the `kvirtualstage` crate name or renames to `kdesktopvirt`.
  - `Eidolon/release-registry.toml` `source = "KVirtualStage"` line is updated (or annotated) to reflect the post-merge reality.
  - `Eidolon/docs/EXTRACTION_PLAN.md` is updated to remove the `KVirtualStage` reference.

### Phase 1 — Fill in the 4 missing platform impls behind the existing traits (no new repos, no new binaries)

- **Objective:** Bring every `*Automator` trait to "real implementation, not stub" status for the host platform the user works on (most likely macOS host, Linux CI, plus at least one mobile).
- **Scope (recommended ordering by least-risk):**
  1. `eidolon-desktop/src/windows.rs` → `windows` crate + WGC capture + `SendInput` for input. Reuse `xcap` (already a `PlayCua/native/Cargo.toml:26` dep) for cross-platform fallback.
  2. `eidolon-desktop/src/linux.rs` → `x11rb` (already a `PlayCua/native/Cargo.toml:54` dep) + `uinput` for input; `xcap` fallback.
  3. `eidolon-mobile/src/native/{ios.rs,android.rs}` → shell out to `kmobile mcp` (SSE transport, port 8931 per `kmobile/README.md:259-272`) and translate the JSON-RPC calls into the existing `IosTestAdapter` / `AndroidTestAdapter` trait methods.
  4. `eidolon-sandbox/src/docker/mod.rs` → `bollard` crate (already a `KDesktopVirt/Cargo.toml:53` dep) wrapping the Docker socket; translate into `DockerOrchestrator` trait methods.
- **Verification criteria:**
  - `cargo test --workspace` passes with the new impls.
  - At least one *integration* test per impl that runs against a real OS surface (Xvfb for Linux, ADB for Android, Docker for sandbox, a WGC handle for Windows). Note that Eidolon's current test suite is 100% stub-only; this phase replaces stubs with real tests.
  - `Eidolon/release-registry.toml` `status` field updated from `"stub"` to `"alpha"` or `"beta"` per crate.

### Phase 2 — Add an `eidolon-cua-bridge` subcrate (PlayCua/bare-cua as a desktop impl)

- **Objective:** Provide a real Windows + Linux desktop impl today (without re-implementing WGC / uinput) by wrapping the `bare-cua-native` binary over stdio JSON-RPC.
- **Scope:**
  - New crate `Eidolon/crates/eidolon-cua-bridge/`.
  - Add to `Eidolon/Cargo.toml:1-7` `members`.
  - Implement `DesktopAutomator` by calling `bare-cua-native` (the JSON-RPC binary already lives in `PlayCua/native/`).
  - Honor the `PlayCua/contracts/openrpc.json` 14-method contract.
- **Verification criteria:**
  - `eidolon_cua_bridge::DesktopClient` passes the existing `Eidolon/crates/eidolon-desktop/tests/test_desktop.rs` tests (some test relaxation may be needed because the binary is an external process).
  - A new integration test spawns `bare-cua-native`, takes a screenshot, and asserts the PNG decodes correctly.
  - The crate is feature-gated on the `bare-cua-native` binary being on `$PATH` or under a known `target/` path; CI downloads a prebuilt or builds from source.

### Phase 3 — Bindings: Python (PyO3) and Node (napi-rs)

- **Objective:** Ship the first polyglot bindings, mirroring the user's stated "PyO3 pattern" preference and the existing KDesktopVirt feature flags (`KDesktopVirt/Cargo.toml:118-122`).
- **Scope:**
  - New crate `Eidolon/crates/eidolon-py/` (PyO3, gated on `python-bindings` feature).
  - New crate `Eidolon/crates/eidolon-node/` (napi-rs, gated on `nodejs-bindings` feature).
  - Mirror the trait surface 1:1; expose `async` methods as Python coroutines / Node `Promise`s.
- **Verification criteria:**
  - `pip install -e .` (Python) and `npm install` (Node) both succeed from the Eidolon workspace.
  - Python: `import eidolon; eidolon.DesktopClient().screenshot("/tmp/x.png")` writes a real PNG on a macOS host.
  - Node: `const e = require('eidolon'); await e.desktop().screenshot('/tmp/x.png')` does the same.
  - The bindings re-export Eidolon's `AutomationEvent` as `eidolon.events.AutomationEvent` (Python) and `eidolon.AutomationEvent` (Node) with `toJson` / `fromJson` round-trips.

### Phase 4 (optional) — Optional: Swift (uniffi) + C (cbindgen), and `eidolon-server` MCP binary

- **Objective:** Close the polyglot loop for macOS/iOS (Swift) and C# (P/Invoke for Unity/Dino), and ship an MCP server binary that any agent loop can call.
- **Scope:**
  - `Eidolon/crates/eidolon-uniffi/` (UniFFI proc-macro on the trait surface).
  - `Eidolon/crates/eidolon-cdylib/` (cbindgen output).
  - `Eidolon/crates/eidolon-server/` (JSON-RPC / MCP server binary).
  - Update `Eidolon/CLAUDE.md` and `Eidolon/AGENTS.md` to reflect the new binary surface.
- **Verification criteria:**
  - A Swift package generated by `uniffi` compiles on macOS 14+ and exposes `DesktopClient`, `MobileClient`, `SandboxClient` as Swift classes.
  - The C header is consumable from C# via `DllImport`.
  - `eidolon-server` registers as an MCP server (stdio transport) and a tool list (`desktop.screenshot`, `mobile.tap`, `sandbox.exec`) round-trips correctly with the Claude API.

### Phase 5 (optional) — Re-baseline tests, docs, CI

- **Objective:** Eidolon is no longer a skeleton; the docs, tests, and CI reflect real impls.
- **Scope:**
  - `Eidolon/docs/EXTRACTION_PLAN.md` — rewrite as a "what's done / what's next" doc.
  - `Eidolon/crates/*/tests/*.rs` — replace stub-only tests with integration tests.
  - `Eidolon/.github/workflows/*` — turn on the disabled workflows; add a cross-platform matrix.
  - `Eidolon/STATUS.md` and `Eidolon/release-registry.toml` — bump to `beta`.
- **Verification criteria:**
  - `cargo test --workspace` runs against real OS surfaces in CI (at least macOS + Linux).
  - All 12 workflows are green on `main`.
  - The release registry is consistent with the actual code.

---

## 8. One-paragraph summary for the user

Eidolon today is a thin, well-designed Rust trait layer (4 crates, ~700 LOC of impl, of which only `eidolon-desktop/src/macos.rs` is real — the other 4 platform impls are stubs that pass tests but do nothing). Five sibling repos in the user's org — `KDesktopVirt` (large, partly broken, kvirtualstage crate), `kmobile` (rich CLI/API/MCP server, hexagonal core, no CI), `PlayCua` and `bare-cua` (byte-identical, native Rust binary + Python + C# JSON-RPC stack with OpenRPC contract), and `Dino` (Unity consumer of bare-cua) — overlap Eidolon's scope. The single biggest immediate cleanup is **PlayCua == bare-cua**: they are the same project under two directory names and should be merged. Beyond that, Eidolon should *absorb PlayCua as a subcrate* (`eidolon-cua-bridge` wrapping the `bare-cua-native` binary), *leave KDesktopVirt and kmobile independent* but write thin adapter crates that consume them via Eidolon's traits, and *ship PyO3 + napi-rs + uniffi bindings* on top of the existing Rust core. The biggest open question is whether Eidolon should stay library-only or also ship a server binary (MCP/JSON-RPC) — that decision gates whether Phase 4 is in scope. Three conflicts (PlayCua/bare-cua duplication, the `kvirtualstage` crate name, the stub vs. real impl commitment) and one structural question (library vs. binary) need user input before any phase can start; the proposed 5-phase plan above is offered for review, not for execution.
