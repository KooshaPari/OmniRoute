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
- **phenoShared** on `main` at `95d74795` — utils branch merged; lock refreshed.
- Gateway H9 smoke failures logged in phenotype-gateway#6 — follow-up spike fixes.

---

## Phase 6–7 closeout scorecard (ADR-ECO-012)

**Date:** 2026-06-18  
**Scope:** Agent stack boundary docs + fleet lock refresh + archive gates

| Metric | Target | Actual | Pass |
|--------|--------|--------|------|
| Apex prompts per row | ≤1 | 1 (fan-out Phase 6/7) | ✓ |
| Re-dispatch loops | 0 | 0 | ✓ |
| Post-merge CI failures | 0 | 0 on merged gateway batch | ✓ |
| Row pending→relocated | <4h wall | ~8h (network + cliproxy gitignore) | ⚠ |
| Registry FSM sync lag | same session | disposition-index gateway rows `done` | ✓ |
| components.lock fresh | post-main SHAs | refreshed 2026-06-18 (main refs) | ✓ |

### Phase 6 agent stack

| Item | Status | PR / action |
|------|--------|-------------|
| agentapi-plusplus `docs/BOUNDARY.md` | PR open | [#538](https://github.com/KooshaPari/agentapi-plusplus/pull/538) |
| cliproxyapi-plusplus `docs/BOUNDARY.md` | PR open | [#1029](https://github.com/KooshaPari/cliproxyapi-plusplus/pull/1029) |
| bifrost `docs/DISPOSITION.md` | PR open | [#8](https://github.com/KooshaPari/bifrost/pull/8) |
| PhenoSpecs `018-agent-platform` | PR open | [#91](https://github.com/KooshaPari/PhenoSpecs/pull/91) |
| Agentora PhenoProc gap-port | **merged** | #78 workspace, #79 gap port, #80 substrate SDK-ify; `cargo check --workspace` green |
| vibeproxy archive | **done** | `gh repo archive` 2026-06-18 |
| helioscope archive | **done** | `gh repo archive` 2026-06-18 → helios-cli redirect |

### components.lock pins (post-main refresh)

| Component | ref | SHA |
|-----------|-----|-----|
| phenotype-registry | `main` | `ea31bc43e18d702af6b4645993d8eb81ba6c7d5f` |
| HexaKit | `main` | `6406acbf54a3a48c0b830653515ef3616f465b43` |
| phenoShared | `main` | `95d74795c77f7c554be2b5e42e8e3378cdab77bf` |
| substrate | `main` | `6e8b35f85697b1b1dc95d5f37451dfa4f7a6af3f` |
| TestingKit | `main` | `73d0de4a23536cd37ed51721e6a9ff8011996c8c` |
| PhenoObservability | `main` | `1e5aa5cc6f7eec9d1b9c5fd49e9a8d55e352065a` |

### AgilePlus validate.md

Branch `wip/preserve-agileplus-brand-rename-20260605` exists but **no root `validate.md`** (only `crates/agileplus-cli/src/commands/validate.rs`). Merge skipped — file not found.

**Batch verdict:** Phase 7 fleet stamp refreshed; Phase 6 boundary docs in PRs; archives complete.
