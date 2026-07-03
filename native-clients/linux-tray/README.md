# OmniRoute Linux Tray

Linux support is first-class.

Target shape:

- Tauri or Wails tray shell.
- Unix domain socket for privileged local daemon commands.
- systemd user service integration for daemon lifecycle.
- AppIndicator tray where supported; desktop window fallback elsewhere.
- Reuse `management-console/` for the full web UI inside a desktop shell.

Initial contract:

```text
socket: $XDG_RUNTIME_DIR/omniroute/daemon.sock
http:   http://localhost:20128/api/management/*
ws:     ws://localhost:20128/api/management/events
```
