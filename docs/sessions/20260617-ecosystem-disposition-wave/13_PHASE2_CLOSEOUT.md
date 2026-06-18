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
| HexaKit AB prune | KooshaPari/HexaKit | [HexaKit#266](https://github.com/KooshaPari/HexaKit/pull/266) merged to `main` | Exclude `phenotype-iter`, `phenotype-string`, `phenotype-validation` from workspace members; git-pin to phenoShared `feat/wave-e2a-utils-reloc`; restore `phenotype-telemetry` path dep; `cargo check -p phenotype-core` green |
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
| HexaKit | `main` | `6406acbf54a3a48c0b830653515ef3616f465b43` |
| Authvault | `main` | `c9ba3a37186122f6e0b1755aedcfbb960ea8b669` |
| phenoShared | `feat/wave-e2a-utils-reloc` | `a603d2b4a20de95251de2534ae8d2e833d7f39fd` |

HexaKit#266 is merged — lock ref is `main`. phenoShared stays on `feat/wave-e2a-utils-reloc` until phenoShared#190 merges; then refresh via `./scripts/pin-components.sh`.

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

- **HexaKit#266** merged — HexaKit lock ref is `main` at `6406acbf`.
- **phenoShared#190** still open — lock pins `feat/wave-e2a-utils-reloc` at `a603d2b` until merge.
- After phenoShared#190 merges: run `pin-components.sh`, set phenoShared ref to `main`, re-run ecosystem validate.
