# SSOT — phenotype-registry

## Capability & Intent SSOT

> **Authority**: this section is the single source of truth for *what each repo in the fleet does, owns, and does NOT own* (capability / intent / boundary). When any other doc — `docs/registries.md`, README, the bound prompts, or the per-repo `docs/intent/<repo>.md` — contradicts this section, **this section wins**. Cross-referenced from [`docs/registries.md`](./registries.md) § "phenotype-registry (this repo) — Capability & Intent SSOT".

### Canonical artifacts (4 files — L7-001 → L7-008 chain)

| File | Role | What it answers |
|------|------|-----------------|
| `docs/intent/<repo>.md` | Canonical intent statement | "Why does this repo exist, and what is 'done'?" |
| `docs/boundary/<repo>.md` | In-scope / out-of-scope / crossings | "What does this repo own vs NOT own?" |
| `_bindings.json` (curation-data) | Curated prompt hash list — provenance | "Which user prompts ground this intent?" |
| `ECOSYSTEM_MAP.md` (this repo) | Role row in §1 taxonomy | "Where does this repo sit in the fleet?" |

Contract sources: [`docs/intent/README.md`](./intent/README.md) (L7-001) + [`docs/boundary/_template.md`](./boundary/_template.md) (L7-001).

### Maintenance commands (3)

```bash
python3 scripts/render-per-repo.py --force              # regenerate intent+boundary from _bindings.json
python3 scripts/propagate-intent-to-repos.py --force    # copy rendered files to monorepo per-repo docs/
python3 scripts/regen-ecosystem-map.py                  # regenerate ECOSYSTEM_MAP.md from current taxonomy
```

All three are idempotent. The first two are wired into the weekly launchd job (see Cadence). The third runs on ad-hoc topology change.

### Cadence

- **Weekly** — Mon 09:00 PDT (L7 chain refresh + 71-pillar audit per ADR-041) — `com.phenotype.weekly-refresh` runs scrape → resolve-collision --preserve-archived → render → propagate.
- **Ad-hoc** — Saturday (manual): topology changes (new repo, archive, absorption, role reclassification).

### Stub-filled repos (11 — full prose, L7-004)

| Repo | Source |
|------|--------|
| Paginary | L7-004 Subagent K (2026-06-18) |
| PhenoCompose | L7-004 Subagent K |
| PhenoDesign | L7-004 Subagent K |
| agentapi-plusplus | L7-004 Subagent K |
| argis-extensions | L7-004 Subagent K |
| forgecode | L7-004 Subagent K |
| phenoObservability | L7-004 Subagent K |
| vibeproxy-monitoring-unified | L7-004 Subagent K |
| Agentora | L7-004 extraction-targets (prose fill 2026-06-19) |
| agentmcp-hex | L7-004 extraction-targets |
| phenotype-mcp-asset | L7-004 extraction-targets |

Per-repo char counts + crossings: [`worklogs/L7-004-stub-prose-2026-06-18.json`](../../phenotype-registry-curation-data/worklogs/L7-004-stub-prose-2026-06-18.json) + [`worklogs/L7-004-extraction-targets-2026-06-18.json`](../../phenotype-registry-curation-data/worklogs/L7-004-extraction-targets-2026-06-18.json). Remaining ~100 intent + ~100 boundary files still have TODO prose (L7-005+).

### Audit trail

[`worklogs/`](../../phenotype-registry-curation-data/worklogs/) (in `phenotype-registry-curation-data`) is the canonical audit trail for the L7 chain:

- `L7-001-intent-boundary-curation-2026-06-17.json` — initial contract + 82-repo sweep (45,091 records, 7 sources)
- `L7-002-collision-resolution-2026-06-18.json` — canonical-name collision resolution
- `L7-003-ecosystem-reconciliation-2026-06-18.json` — taxonomy reconciliation
- `L7-004-{curation-push,stub-prose,extraction-targets,template-prefix-binding}-2026-06-18.json` — stub prose + 3.2GB push
- `L7-006-post-resume-consolidation-2026-06-20.json` — HeliosCLI archive, alias fix
- `L7-007-archived-marker-pass-2026-06-20.json` — `archived: true` flag for 12 archived repos (preserves provenance)
- `L7-008-weekly-refresh-validation-2026-06-20.json` — launchd wiring + HeliosCLI fix verification

### Cross-references

- Per-repo contract: [`docs/intent/README.md`](./intent/README.md) + [`docs/boundary/_template.md`](./boundary/_template.md)
- Canonical-name resolution: [`ALIASES.md`](../../ALIASES.md) (46 entries)
- Launchd job: `~/Library/LaunchAgents/com.phenotype.weekly-refresh.plist`
- Roll-up: [`ECOSYSTEM_MAP.md`](../../ECOSYSTEM_MAP.md) §1 role table

## State
- Default branch: main
- Last verified: 2026-06-08
- CI status: green
- Open PRs: 0
- Open branches: 1 (main)
- Stashes: 0

## Dependencies
- Rust: N/A
- Node: 20
- Python: N/A

## Architecture
- Hexagonal: in progress
- Ports: N/A
- Adapters: N/A
- Domain: N/A

## Next Steps
1. [x] P0: State unification
2. [x] P1: Tooling + governance
3. [ ] P2: Hexagonal refactor
4. [ ] P3: Add tests
5. [ ] P4: Add CI

## Fleet Links
- Parent: Phenotype
- Related: phenotype-hub
- Consumes: N/A
- Merged into: N/A
