---
title: CLI Tools
---

# CLI Tools

```sh
omniroute start [--port 20128] [--provider demo]
omniroute demo
omniroute governance check canonical-routing
omniroute audit verify
omniroute --version
```

## `governance check`

Runs the governance hash-chained audit, the threat-model assertions, and the ADR compliance check. Exits 0 on pass, non-zero on fail.

## `audit verify`

Walks the audit chain and verifies each hash. Prints the chain head SHA.
