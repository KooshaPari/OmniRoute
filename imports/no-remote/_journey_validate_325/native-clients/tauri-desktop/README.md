# OmniRoute Tauri Desktop

Cross-platform desktop shell target for macOS, Windows, and Linux.

Purpose:

- Embed the static `management-console/` UI.
- Use platform-native tray APIs.
- Bridge to local daemon IPC:
  - macOS/Linux: Unix domain socket.
  - Windows: named pipe.
- Fall back to loopback `/api/management/*` for simple admin reads.

This replaces Electron after management-console parity and daemon lifecycle support are proven.
