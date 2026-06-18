# Mobile-next fork plan — KooshaPari forks + Eidolon shim

**Date:** 2026-06-17 23:15 PDT
**Forks created:** `KooshaPari/mobile-cli` (from `mobile-next/mobilecli`), `KooshaPari/mobile-mcp` (from `mobile-next/mobile-mcp`)
**Goal:** Bring mobile-next's SOTA mobile automation stack under KooshaPari ownership, then integrate as the production adapter for Eidolon's `MobileStage` sub-trait.

---

## 1. Why fork?

| Reason | Detail |
|---|---|
| **Vendor independence** | mobile-next is a third-party org; forks give us PR review rights, CI control, and release cadence |
| **Eidolon integration** | Forks become the canonical production adapter for Eidolon's `MobileStage`; mobile-mcp's 27 MCP tools map to Eidolon's `VirtualStage` + `MobileStage` trait methods |
| **KooshaPari canonical home** | Per ADR-029 (Dmouse92 → KooshaPari), all agent-platform-domain artifacts must live on KooshaPari |

---

## 2. `KooshaPari/mobile-cli` — what it absorbs from `mobile-next/mobilecli`

**Upstream:** https://github.com/mobile-next/mobilecli — Go CLI + Objective-C iOS bridge + Java Android agent
**Local clone:** `/tmp/mobile-cli` (cloned today)
**Source layout:**
- `main.go` — entry point
- `cli/` (25 subdirs)
- `commands/` (20 files: apps, boot, crashes, devices, dump, fs, info, input, keys, orientation, reboot, remote, screencapture, screenrecord, screenshot, settings, url, webview)
- `devices/` (32 files: adb.go, android.go, avd.go, common.go, ios/, ios_device_agent.go, ios_device_lldbproxy.go, ios_device_webview.go, ios_fs.go, ios_webview.go, animations_test.go, …)
- `agents/ios/` (Objective-C: agent.m, bridge.h, bridge.m, dispatcher.h, dispatcher.m, server.h, server.m, Makefile)
- `agents/android/` (Java + jvmti_agent.c, Makefile)
- `server/` (HTTP/JSON-RPC/WebSocket server, port 12000)
- `daemon/`, `pkg/`, `rpc/`, `types/`, `utils/`, `test/`, `agents.go`, `docs/`, `assets/`

**Total LOC:** ~2,500 Go + ~1,500 ObjC + ~800 Java + ~600 TS/JSON + ~300 Go test

**Eidolon integration plan (Phase 2, next session):**
- Add a new `--eidolon-mode` flag that, instead of using native adb/xcuitest directly, calls into Eidolon over MCP
- Keep the existing native paths intact (backward compat)
- Eidolon becomes the policy decision point (which device to use, which sandbox to spawn)

---

## 3. `KooshaPari/mobile-mcp` — what it absorbs from `mobile-next/mobile-mcp`

**Upstream:** https://github.com/mobile-next/mobile-mcp — TypeScript MCP server, 5.2k stars, 453 forks, 338 commits
**Local clone:** `/tmp/mobile-mcp` (cloned today)
**Source layout (3,477 LOC across 13 files):**
- `src/server.ts` (844 LOC) — `McpServer` setup + 25 tool registrations
- `src/android.ts` (611 LOC) — Android robot adapter
- `src/webdriver-agent.ts` (454 LOC) — iOS WDA adapter
- `src/ios.ts` (304 LOC) — iOS adapter
- `src/iphone-simulator.ts` (283 LOC) — iOS Simulator adapter
- `src/mobile-device.ts` (221 LOC) — device abstraction
- `src/mobilecli.ts` (199 LOC) — wraps mobilecli binary
- `src/utils.ts` (88 LOC), `src/image-utils.ts` (164 LOC), `src/index.ts` (121 LOC), `src/robot.ts` (147 LOC), `src/logger.ts` (21 LOC), `src/png.ts` (20 LOC)

**27 MCP tools (full inventory from server.ts):**
1. `mobile_list_available_devices`
2. `mobile_get_screen_size`
3. `mobile_get_orientation`
4. `mobile_set_orientation`
5. `mobile_list_apps`
6. `mobile_launch_app`
7. `mobile_terminate_app`
8. `mobile_install_app`
9. `mobile_uninstall_app`
10. `mobile_take_screenshot`
11. `mobile_save_screenshot`
12. `mobile_list_elements_on_screen`
13. `mobile_click_on_screen_at_coordinates`
14. `mobile_double_tap_on_screen`
15. `mobile_long_press_on_screen_at_coordinates`
16. `mobile_swipe_on_screen`
17. `mobile_type_keys`
18. `mobile_press_button`
19. `mobile_open_url`
20. `mobile_start_recording` / `mobile_stop_recording`
21. … (5 more — listed in `src/server.ts` lines 689-827)

**Eidolon integration plan (Phase 1, next session):**
- Replace the iOS/Android native impls in mobile-mcp with **MCP calls into Eidolon** (over stdio)
- mobile-mcp becomes a thin **adapter** that exposes Eidolon's `MobileStage` methods as MCP tools
- The native iOS/Android code stays in mobile-cli (still used by Eidolon for direct device interaction)

**Why this design:**
- Eidolon is the canonical interface for `MobileStage` (27 tools → ~6 core methods, ~21 extension methods)
- mobile-mcp becomes the **thin MCP wrapper** that doesn't need to re-implement device logic
- mobile-cli becomes the **direct device driver** that Eidolon calls via RPC
- This separates policy (Eidolon) from mechanism (mobile-cli) from agent surface (mobile-mcp)

---

## 4. mobile-next repos NOT forked (deferred)

| Repo | Reason | Decision |
|---|---|---|
| `mobile-next/devicekit-android` | mobilecli already covers Android adb + UiAutomator | DEFER — fork only if gap emerges |
| `mobile-next/devicekit-ios` | mobilecli already covers iOS XCTest + WebDriverAgent | DEFER — fork only if gap emerges |
| `mobile-next/mobilewright` | Test framework (npm init mobilewright), not core automation | DEFER — out of agent-platform scope |
| `mobile-next/mobilewright-examples` | Sample projects | DEFER |
| `mobile-next/create-mobilewright` | Scaffolding tool | DEFER |
| `mobile-next/react-device-view` | React UI for rendering device streams | DEFER — UI, out of scope |
| `mobile-next/playground` | Misc | DEFER |
| `mobile-next/Milliways-ios` | Sample app | IGNORE — not useful |
| `mobile-next/mobile-openrpc` | OpenRPC specs | READ-ONLY reference (use for protocol alignment) |
| `mobile-next/.github` | Org-level config | IGNORE — mobile-next-internal |

---

## 5. CI / governance for the forks

Per ADR-029 + L5-104 + ADR-027 (Git LFS 3-tier policy):
- Apply KooshaPari org workflow templates
- Add `CODEOWNERS` pointing to KooshaPari/agent-platform team
- Adopt `claude.md` from Eidolon as the per-repo agent context
- Add `AGENTS.md` describing the Eidolon integration plan
- Adopt conventional commits (already used by mobile-next)
- Sync with upstream weekly via `git fetch upstream` + manual review

---

## 6. PR plan (execution backlog)

### PR 1 — KooshaPari/mobile-mcp: adopt Eidolon as backend
- Replace `src/ios.ts`, `src/android.ts`, `src/iphone-simulator.ts` native impls with a new `src/eidolon.ts` adapter
- New adapter calls into Eidolon over MCP (stdio) — `eidolon mcp serve` is the upstream
- Tool implementations delegate to Eidolon `VirtualStage` + `MobileStage` methods
- Mobile-cli still called for app management (install/launch/terminate) — keep `src/mobilecli.ts` calls

### PR 2 — KooshaPari/mobile-cli: add --eidolon-mode flag
- New flag `--eidolon-mode` switches the CLI to call into Eidolon for input dispatch
- Default behavior unchanged (direct adb/xcuitest)
- Allows Eidolon to be the policy layer; mobile-cli becomes the mechanism layer

### PR 3 — KooshaPari/mobile-cli + mobile-mcp: AGENTS.md + governance
- Add `AGENTS.md` describing Eidolon integration
- Add `CODEOWNERS` pointing to agent-platform team
- Adopt KooshaPari org workflow templates

### PR 4 (deferred) — KooshaPari/mobile-mcp: replace 25 native tools with Eidolon-backed shims
- After PR 1 lands, gradually replace each native impl with Eidolon delegation
- Long-term: mobile-mcp becomes ~200 LOC of pure shim; all real work is in Eidolon

---

## 7. Risk + mitigation

| Risk | Severity | Mitigation |
|---|---|---|
| mobile-next upstream breaks API | MEDIUM | Pin upstream commit hash; review before each sync; tests catch breakage |
| Eidolon shim introduces latency | LOW | mobile-cli still does direct calls; Eidolon is opt-in |
| Community fork diverges from mobile-next | LOW | Weekly sync with upstream; surface any divergence in PR |
| License compatibility | LOW | mobilecli is FSL-1.1-Apache-2.0 (functional source license + Apache fallback); need to confirm with KooshaPari legal before commercial use |
