# OmniRoute Management Transports

The management plane is layered by deployment need:

```text
static/browser console -> /api/management/* REST + /events SSE
native tray/desktop    -> local IPC/RPC first, REST fallback
enterprise cockpit     -> GraphQL/read aggregation later, WS/SSE for live streams
```

## Local IPC endpoints

```text
macOS:   /tmp/omniroute-daemon.sock
Linux:   $XDG_RUNTIME_DIR/omniroute/daemon.sock
Windows: \\.\pipe\omniroute-daemon
```

## RPC frame

Frames are newline-delimited JSON so the same codec works over Unix sockets, Windows named pipes, and loopback streams.

```json
{"protocol":"omniroute.management.rpc","version":1,"request":{"id":"1","command":"daemon.status"}}
```

REST remains the compatibility surface. Privileged lifecycle operations should prefer IPC/RPC so local clients do not depend on browser cookies or public loopback HTTP.
