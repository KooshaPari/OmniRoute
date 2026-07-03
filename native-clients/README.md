# OmniRoute Native Clients

Native client surfaces for OmniRoute that are independent of the legacy Electron and Next dashboard runtime.

Initial targets:

- `macos-tray/`: SwiftUI/AppKit menu-bar controller for local daemon start/stop, status, auth/account signals, and opening the management console.
- Future: Tauri shell can embed `management-console/` for cross-platform desktop packaging.
