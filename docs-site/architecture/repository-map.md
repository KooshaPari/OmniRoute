---
title: Repository Map
---

# Repository Map

High-level tour of the OmniRoute codebase. For exhaustive module-level docs, see `docs/architecture/CODEBASE_DOCUMENTATION.md`.

```
OmniRoute/
├── src/                    # TypeScript source
│   ├── router/             # Routing decision logic
│   ├── providers/          # Provider plugin loader
│   ├── server/             # HTTP server (OpenAI-compatible)
│   ├── db/                 # SQLite store
│   ├── auth/               # API key + scope check
│   └── governance/         # Audit chain, governance checks
├── open-sse/               # OpenAI SSE streaming shim
├── tests/                  # Bun test runner
├── docs/                   # Existing docs (preserved as-is)
├── docs-site/              # This VitePress site
├── deploy/                 # Docker / K8s / Caddy / systemd
├── plans/                  # RFCs, recovery specs, WBS plans
└── demo/                   # GUI/visual demo program
```
