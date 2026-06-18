# Wave H — gateway charter + branch superset — 2026-06-17

**Predecessor:** [wave13-execution-2026-06-17.md](./wave13-execution-2026-06-17.md)  
**ADR:** [ADR-ECO-014](../adrs/ADR-ECO-014-phenotype-gateway-charter.md)

## H0 — Charter

| Deliverable | Status |
|-------------|--------|
| ADR-ECO-014 phenotype-gateway | phenotype-registry #140 (merged) |
| `GATEWAY_FEATURE_PARITY.md` stub | phenotype-registry #140 (merged) |
| disposition-index Cluster H rows | phenotype-registry #140 (merged) |
| ECOSYSTEM_MAP Cluster A reconciliation | phenotype-registry #140 (merged) |

## H1 — agentapi → agentapi-plusplus

| Repo | Action | PR |
|------|--------|-----|
| `agentapi` | Cherry-pick `FUNDING.yml`; disposition `done` | agentapi-plusplus #530 (merged) |
| `agentapi-plusplus` | Absorb agentapi branches | — |

## H2 — agentapi++ branch superset

| Action | PR |
|--------|-----|
| Merge `sync/upstream-v0.12.2` + `complete-sync`; add `docs/UPSTREAM.md` | agentapi-plusplus #531 (merged) |

## H3 — cliproxyapi++ + vibeproxy

| Action | PR |
|--------|-----|
| `VIBEPROXY_ABSORPTION.md` at repo root (docs/ gitignored) | cliproxyapi-plusplus #1024 (merged) |
| vibeproxy disposition → cliproxy++ | registry execution update |

## H4 — bifrost

| Action | PR |
|--------|-----|
| `docs/VENDOR_PIN.md` — vendor fork policy, local-delta only | bifrost #5 (merged) |

## H5 — OmniRoute + argis-extensions

| Item | Status |
|------|--------|
| OmniRoute demoted to interim MVP in ECOSYSTEM_MAP | done (H0) |
| Feature inventory → `GATEWAY_FEATURE_PARITY.md` | done (this PR) |
| argis-extensions classified as plugin plane (`plugins/argis/`) | done |

## H6 — phenotype-gateway scaffold

| Action | PR |
|--------|-----|
| `packages/`, `third_party/`, `spikes/{go,rust,zig,mojo}/`, CI matrix | phenotype-gateway #1 (merged) |

## H7 — landings + backups

| Repo | Action | Status |
|------|--------|--------|
| `projects-landing` | Absorbed at `phenotype-landing/sites/projects-landing/` | done |
| `pheno-sdk` | Package map → [pheno-sdk-package-map.md](../rationalization/pheno-sdk-package-map.md) | done |
| `helios-cli-backup` | Audited vs `helios-cli` (divergent SHAs); DELETE-eligible — user confirm before `gh repo delete` | audited |

## H8 — protected + PhenoLang

| Repo | Action | Status |
|------|--------|--------|
| KodeVibeGo | HOLD_ARCHIVE registry row | done (H0) |
| KVirtualStage | HOLD_ARCHIVE registry row | done (H0) |
| PhenoLang | 28-branch `*/feat/docs-site` triage in phenoUtils index | phenoUtils PR |

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

## H9 — stash supersede + CI (2026-06-18)

| Action | PR | Status |
|--------|-----|--------|
| Fix duplicate `actions/checkout` in scaffold workflow | phenotype-gateway #5 | merged |
| Drop `local-scaffold` stash after supersede | — | done |
| Submodule shallow init on master (`d1620ce`) | — | done |
| Go smoke tests (four forks) | — | in progress |

## Local hygiene

| Item | Action |
|------|--------|
| Canonical OmniRoute | `dev\OmniRoute` (KooshaPari/OmniRoute) |
| Broken OmniRoute clone | `C:\Users\koosh\OmniRoute` — removed 2026-06-18 |
| phenotype-gateway stash | `local-scaffold` superseded by #5 — do not re-apply |
| cliproxyapi-plusplus | cloned to `dev\cliproxyapi-plusplus` |
| vibeproxy | cloned to `dev\vibeproxy` |
| argis-extensions | cloned to `dev\argis-extensions` |
