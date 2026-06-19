# D-01 slice 3 ledger — event/bus contracts → Eventra

**Date:** 2026-06-18  
**Row:** #11 `crates/phenotype-contracts`  
**FSM:** `relocating` (unchanged — slice 4 pending)

## Slice 3 progress

| Item | Status | Evidence |
|------|--------|----------|
| Event/bus contract traits landed in Eventra | **done** | [Eventra#19](https://github.com/KooshaPari/Eventra/pull/19) — `rust/phenotype-event-contracts` |
| Disposition doc | **done** | Eventra `docs/disposition/p4-contracts-slice3-event-bus.md` |
| Consumer repoint: HexaKit `EventBus` outbound port | **pending** | Git-pin `phenotype-event-contracts` from Eventra |
| phenoShared interim generic traits | **unchanged** | Slice 1 — `MetricsHook` remain interim SSOT |
| Row #11 FSM close | **blocked** | HTTP/agent slice 4 (Agentora) not landed |

## Decompose status (row #11)

| Slice | Domain | Terminal owner | Status |
|-------|--------|----------------|--------|
| 1 | Port traits / generic contracts | phenoShared (interim) | in_progress — HexaKit#264 |
| 2 | Auth / policy contracts | **Authvault** | **partial done** — Authvault#88 |
| 3 | Event / bus contracts | **Eventra** | **partial done** — Eventra#19 |
| 4 | HTTP/event adapters | Agentora / substrate | pending |

## Note update (disposition-index row #11)

Proposed `note` append (do not flip `fsm` until all slices land):

```
Decompose per contracts-decompose-plan.md; slice 2 auth/policy → Authvault rust/phenotype-auth-contracts (Authvault#88); slice 3 event/bus → Eventra rust/phenotype-event-contracts (Eventra#19)
```

## References

- [contracts-decompose-plan.md](./contracts-decompose-plan.md)
- [contracts-slice2-ledger-2026-06-18.md](./contracts-slice2-ledger-2026-06-18.md)
- [phenotype-contracts-consumer-manifest.md](./phenotype-contracts-consumer-manifest.md)
- [phase2-relocation-checkpoint-2026-06-18.md](./phase2-relocation-checkpoint-2026-06-18.md)
