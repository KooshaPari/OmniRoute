# Boundary — KooshaPari/agent-user-status (ABSORBED 2026-07-17)

**Boundary status:** `absorbed`
**Absorbing repo:** `KooshaPari/phenotype-tooling` (`crates/agent-user-status/`)
**Source repo:** `KooshaPari/agent-user-status` (archived on GitHub 2026-07-17)

## Role

Local, privacy-first user-status / iMessage / MCP-server / native-monitor runtime
for Codex / Claude coding agents. See source README for the long-term architecture
goal (typed local event bus, hot/warm encrypted state store, native collectors, agent
policy engine).

## Domain

`agent-control / status-runtime` — bridges input streams, output streams,
environment state, and agent-session context so agents know when to wait, summarize,
handhold, or defer.

## Stack

- Python `>=3.12` (single-package, console-script installable)
- Swift (macOS native monitor bundle; not a Swift Package workspace)
- stdio MCP server (`mcp/agent_imessage_mcp.py`)

## Surface that the absorbing repo exposes

`KooshaPari/phenotype-tooling/crates/agent-user-status/`:

| Capability             | Entry point                                          |
|------------------------|------------------------------------------------------|
| Bootstrap / installer  | `agent-user-status install\|uninstall\|doctor\|setup-eye-tracker` |
| Local status backend   | `agent-user-statusd` (`statusd.py`)                  |
| iMessage / sessions    | `agent-imessage ...`                                  |
| Cursor tracker (macOS) | `agent-user-status-cursor-tracker`                    |
| Webcam eye tracker     | `agent-user-status-webcam-eye-tracker` (`eye` extra)  |
| stdio MCP server       | `agent-imessage-mcp`                                  |

## Boundary inheritance

- Privacy boundary (raw frames rejected, derived signals only): unchanged
- macOS-only opt-in webcam: unchanged
- CLI scoped messaging (closed recipient roles only): unchanged

## Provenance

- `audits/absorption-justifications/agent-user-status-2026-07-17.md` (registry)
- `docs/absorption/agent-user-status/README.md` (registry)
- `crates/agent-user-status/ABSORPTION.md` (target)
- registry row id: `repo-agent-user-status`

**End of boundary record.**
