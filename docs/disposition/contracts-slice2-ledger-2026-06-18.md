# D-01 slice 2 ledger — auth/policy contracts → Authvault

**Date:** 2026-06-18  
**Row:** #11 `crates/phenotype-contracts`  
**FSM:** `relocating` (unchanged — slices 3–4 pending)

## Slice 2 progress

| Item | Status | Evidence |
|------|--------|----------|
| Auth/policy contract traits landed in Authvault | **done** | [Authvault#88](https://github.com/KooshaPari/Authvault/pull/88) — `rust/phenotype-auth-contracts` |
| Disposition doc | **done** | Authvault `docs/disposition/p4-contracts-slice2-auth-policy.md` |
| Consumer repoint: `phenotype-python-sdk` auth-kit | **done** | [python-sdk#22](https://github.com/KooshaPari/phenotype-python-sdk/pull/22) — vendored generic copy dropped; git-pin `phenotype-auth-contracts` |
| `components.lock` Authvault SHA | **done** | `7cfd8d7` (Authvault#88 merge) |
| phenoShared interim generic traits | **unchanged** | Slice 1 — `Contract`/`Event`/`MetricsHook` remain interim SSOT |
| Row #11 FSM close | **blocked** | Event/bus slice 3 (Eventra) + HTTP/agent slice 4 (Agentora) not landed |

## Decompose status (row #11)

| Slice | Domain | Terminal owner | Status |
|-------|--------|----------------|--------|
| 1 | Port traits / generic contracts | phenoShared (interim) | in_progress — HexaKit#264 |
| 2 | Auth / policy contracts | **Authvault** | **partial done** — Authvault#88 |
| 3 | Event / bus contracts | Eventra | **partial done** — Eventra#19 |
| 4 | HTTP/event adapters | Agentora / substrate | pending |

## Note update (disposition-index row #11)

Proposed `note` append (do not flip `fsm` until all slices land):

```
Decompose per contracts-decompose-plan.md; slice 2 auth/policy → Authvault rust/phenotype-auth-contracts (Authvault#88)
```

## References

- [contracts-decompose-plan.md](./contracts-decompose-plan.md)
- [phenotype-contracts-consumer-manifest.md](./phenotype-contracts-consumer-manifest.md)
- [phase2-relocation-checkpoint-2026-06-18.md](./phase2-relocation-checkpoint-2026-06-18.md)
