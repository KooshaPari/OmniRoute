# Phase 2 closeout — Wave E2a AB prune

**Date:** 2026-06-18  
**Session:** `20260617-ecosystem-disposition-wave`  
**Registry branch:** `feat/phase2-closeout`

---

## Scope

Close Phase 2 disposition rows after HexaKit wave AB prune and phenoShared utils relocation land. Sync registry FSM state and fleet SHA pins.

## Delivered (upstream)

| Lane | Repo | PR / branch | Outcome |
|------|------|-------------|---------|
| HexaKit AB prune | KooshaPari/HexaKit | [HexaKit#266](https://github.com/KooshaPari/HexaKit/pull/266) on `feat/phase2-e2a-wave-ab-prune` | Exclude `phenotype-iter`, `phenotype-string`, `phenotype-validation` from workspace members; git-pin to phenoShared `feat/wave-e2a-utils-reloc`; restore `phenotype-telemetry` path dep; `cargo check -p phenotype-core` green |
| Utils relocation | KooshaPari/phenoShared | `feat/wave-e2a-utils-reloc` | Canonical homes for iter/string/validation crates |
| Crypto / casbin | KooshaPari/Authvault | `main` | `phenotype-crypto` and `phenotype-casbin-wrapper` pins repointed to Authvault main (Wave C) |
| MCP edge | KooshaPari/substrate | substrate#28 | Rust MCP canonical; Python `py-pheno-mcp` redirect closed |

## Registry updates (this PR)

### disposition-index.json

| Row | Change |
|-----|--------|
| id 30 (`phenotype-port-traits`) | `fsm: pending` → `done`; PR HexaKit#266 |
| `py-pheno-mcp` | `target: PhenoMCP` → `substrate`; `fsm: pending` → `done`; PR substrate#28 |

### components.lock pins

| Component | ref | SHA |
|-----------|-----|-----|
| HexaKit | `feat/phase2-e2a-wave-ab-prune` | `faeb7bad7d482cfdf0871583a98b985ac78aa38a` |
| phenoShared | `feat/wave-e2a-utils-reloc` | `a603d2b4a20de95251de2534ae8d2e833d7f39fd` |

Pins use feature-branch refs until HexaKit#266 and phenoShared utils PR merge to `main`; then refresh refs back to `main` via `./scripts/pin-components.sh`.

## Verification

```bash
# Registry meta
jq empty registry/disposition-index.json registry/components.lock

# Optional fleet pin drift (after main merges)
./scripts/pin-components.sh --check
```

## Remaining Phase 2+ rows (not in this closeout)

- id 11 `phenotype-contracts` — `fsm: relocating`
- id 51 `libs/nexus` — `fsm: pending`
- Gateway cluster H rows still `in_progress` (bifrost, argis, phenotype-gateway, PhenoLang)

## Blockers / follow-ups

- **HexaKit#266** still **OPEN** at closeout authoring — no GitHub merge commit yet; lock pins PR head SHA.
- **phenoShared** utils branch not merged to `main` — lock pins branch tip.
- After both merge: run `pin-components.sh`, set refs to `main`, re-run ecosystem validate.
