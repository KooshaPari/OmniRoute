# Branch Archaeology — OmniRoute fork lineage

## Upstream

- **Origin**: `github.com/omniroute/omniroute` (taken private 2024)
- **Last public commit**: v3.8.43
- **ForkPoint**: `v3.8.43` (commit `bf69ea09d`)

## Local line

| Branch | Last commit | Purpose |
|---|---|---|
| `fix/omniroute-unscoped` | `f08104d61` | active modernization stack |
| `feat/dispatch-binding-tiers` | `87c8068f5` | polyglot FFI/binding tier work |
| `fix/electrobun-contract-deps` | `bf69ea09d` | electrobun contract refresh |

## Modernization lineage (since 2026-07-05)

1. **2026-07-05 · omnibus PR-A through PR-T** (original `omniroute-upstream-work` checkout, 21 PRs)
2. **2026-07-17 · polyglot integration** (Bifrost backend consolidation, FFI choreography)
3. **2026-07-18 · Qdrant → sqlite-vec facade** (PR-1, 521→165 LOC)
4. **2026-07-21 · Opossum step-2 + Cargo workspace** (PR-P, FIX-E architecture)
5. **2026-07-24 · Decomposition + identity SSOT** (PR-6/7/8/9, #437)

## Capability provenance (`.fork-identity.json`)

```
name: @kooshapari/omniroute
version: 3.8.49-koosha.0
releaseChannel: stable
sidecars: redis=embedded-via-keyv, qdrant=removed, mitm=in-process-worker
```
