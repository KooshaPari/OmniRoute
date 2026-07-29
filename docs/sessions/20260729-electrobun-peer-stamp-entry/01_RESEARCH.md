# Research

- `desktop-electrobun/src/main.ts` launched only `server.js` from the Next
  standalone directory.
- `electron/lib/resolveServerEntry.js` already chooses `server-ws.mjs` first.
- `tests/unit/electron-resolve-server-entry.test.ts` documents that the wrapper
  enables local-only routes such as AgentBridge, MCP, and services.

The Electrobun shell now follows that established policy through a small,
independently testable resolver.
