# Absorption — KooshaPari/agent-user-status → phenotype-tooling/crates/agent-user-status

**Status:** ABSORBED 2026-07-17
**Source repo:** `KooshaPari/agent-user-status` @ `112287548359ba5c18ff1e7b047c8334f050532f` (2026-06-20)
**Absorbing repo:** `KooshaPari/phenotype-tooling`
**Absorbing branch:** `salvage/phenotype-tooling-workspace-2026-07-15`
**Absorbing commit:** `29ce5dd4d7baecd4920e5ccedca744eee5422a10`
**Registry row:** `repo-agent-user-status` flipped `AFFIRM/active` → `ABSORB/absorbed`
**Source archive status:** `isArchived=true` (verified via `gh repo view` post-`gh repo archive -y`)

## Source profile

- 615 KB Python project, primary language Python (`>=3.12`), license MIT
- 35 Python source files (`src/agent_user_status/`) + 1 stdio MCP server (`src/mcp/`)
- 12 Swift files in `src/native/macos/` (native monitor bundle, NOT a Swift Package workspace root)
- 6 installable console scripts: `agent-user-status`, `agent-imessage`, `agent-user-statusd`,
  `agent-user-status-cursor-tracker`, `agent-user-status-webcam-eye-tracker`, `agent-imessage-mcp`
- 91 pytest unit tests in `tests/unit/`
- Zero required runtime deps; macOS webcam tracker is an optional `[eye]` extra
  (mediapipe/numpy/opencv-contrib-python/pyobjc-framework-Cocoa)

## Why phenotype-tooling

The original auto-generated audit pointed at `KooshaPari/Agentora` (Rust agent-orchestration
workspace), but the Python source cannot embed in Agentora without breaking its `[workspace]`
semantics. `phenotype-tooling` already hosts Python subpackages via the `crates/phench`
precedent — Python package embedded under `crates/` WITHOUT registering in
`[workspace.members]`. The source's purpose (local user-status / iMessage / MCP-server
runtime for coding agents) is a developer-tooling concern.

## Verification

- `python3 -m compileall -q src/` → exit 0
- `python3 -c "import agent_user_status.bootstrap, agent_user_status.statusd,
  agent_user_status.agent_imessage"` → OK on Python 3.14.6
- `python3 -m pytest tests/ -q` → **91 passed in 6.40s**
- `agent_user_status.cursor_tracker` correctly fails on non-macOS hosts because
  `pyobjc-framework-Cocoa` is macOS-only (listed under `[eye]` optional extra)

## Restore command

```bash
gh repo clone KooshaPari/agent-user-status /tmp/agent-user-status-restore
```

## Audit / boundary references

- `audits/absorption-justifications/agent-user-status-2026-07-17.md` (registry-side)
- `docs/boundary/agent-user-status.md` (boundary doc — to follow)
- `crates/agent-user-status/ABSORPTION.md` (target-side provenance marker)

**End of absorption record.**
