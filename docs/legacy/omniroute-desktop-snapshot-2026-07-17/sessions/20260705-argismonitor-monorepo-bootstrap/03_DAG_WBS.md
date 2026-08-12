# 03_DAG_WBS

```
                [Lane E: CI / DX]
                       |
                       v
[Lane A: shared-types] -> [Lane B: apps/web]
                       \-> [Lane C: apps/desktop + crates/gateway]
                       \-> [Lane D: sdk-js + tools/scripts]
                       |
                       v
                [Storage wiring] -> [Parity CI] -> [Tauri build]
```

| Lane | WBS | LOC estimate | Status |
|---|---|---|---|
| A | shared-types Zod schemas | ~600 | done |
| B | apps/web (Hono + SvelteKit) | ~1200 | done (storage persistence TODO) |
| C | apps/desktop + crates/gateway | ~900 | done (icon assets TODO) |
| D | sdk-js + tools/scripts | ~700 | done |
| E | CI + DX + ADRs | ~600 | done |
| F | Storage wiring (next slice) | ~400 | pending |
| G | Parity CI gate | ~300 | pending |
| H | Tauri release build | ~200 | pending |

Critical path: F → G → H.
