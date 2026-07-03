# OmniRoute Windows Tray

Windows support is first-class.

Target shape:

- Tauri or Wails tray shell.
- Windows named pipe for privileged local daemon commands.
- Windows Service integration for start/stop/restart.
- Fallback loopback REST/RPC endpoint for non-privileged admin reads.
- Reuse `management-console/` for the full web UI inside a desktop shell.

Initial contract:

```text
pipe: \\.\pipe\omniroute-daemon
http: http://localhost:20128/api/management/*
ws:   ws://localhost:20128/api/management/events
```
