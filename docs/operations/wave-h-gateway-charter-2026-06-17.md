# Wave H — gateway charter + branch superset — 2026-06-17

**Predecessor:** [wave13-execution-2026-06-17.md](./wave13-execution-2026-06-17.md)  
**ADR:** [ADR-ECO-014](../adrs/ADR-ECO-014-phenotype-gateway-charter.md)

## H0 — Charter (this PR)

| Deliverable | Status |
|-------------|--------|
| ADR-ECO-014 phenotype-gateway | registry #140 |
| `GATEWAY_FEATURE_PARITY.md` stub | this PR |
| disposition-index Cluster H rows | this PR |
| ECOSYSTEM_MAP Cluster A reconciliation | this PR |

## H1 — agentapi → agentapi-plusplus

| Repo | Action | PR |
|------|--------|-----|
| `agentapi` | Cherry-pick `FUNDING.yml`; disposition `done` | agentapi-plusplus #530 |
| `agentapi-plusplus` | Absorb agentapi branches | #TBD |

## H2 — agentapi++ branch superset

**34 remote branches.** Priority: `sync/upstream-v0.12.2` → `complete-sync` (18 ahead) → `backup/*` → `chore/*` batch.

## H3 — cliproxyapi++ + vibeproxy

Proxy plane merge; vibeproxy client absorbed into cliproxy++ path.

## H4 — bifrost

Vendor pin + local-delta only (not full 100-branch merge).

## H5 — OmniRoute + argis-extensions

OmniRoute interim MVP feature inventory; argis → plugin plane.

## H6 — phenotype-gateway scaffold

New repo: submodule pins → `packages/` promotion when spikes mature.

## Protected (no git ops)

| Repo | Rule |
|------|------|
| KodeVibeGo | HOLD_ARCHIVE — never delete/unarchive |
| KVirtualStage | HOLD_ARCHIVE — never delete/unarchive |

## Tier 1 — already done

| Repo | Target | FSM |
|------|--------|-----|
| Traceon | PhenoObservability | done |
| BytePort | phenotype-tooling | done |

## Next queue

| Wave | Item |
|------|------|
| H1 | agentapi FUNDING.yml → agentapi++ |
| H2 | agentapi++ complete-sync merge |
| H6 | phenotype-gateway repo create |
