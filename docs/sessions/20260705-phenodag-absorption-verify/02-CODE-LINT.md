# Code Lint — phenodag import check (the lint is "nothing should import from phenodag anymore")

**Date:** 2026-07-05 08:27Z

## Result: clean (no external imports)

Verified by:
```
rg "use phenodag|from phenodag|require\\(.phenodag" Tracera/ AgilePlus/ -t rust -t go -t ts
```
Returns: 0 matches.

## What IS in the consuming repos (legitimate, not external imports)

### Tracera
8 files in `crates/tracera-server/src/queue/` reference "phenodag" — these are the IMPLEMENTATION:
- `claim.rs` — atomic-claim port (Go → Rust)
- `dedup.rs` — fuzzy-dedup port
- `lifecycle.rs` — task lease lifecycle
- `heartbeat.rs` — lease TTL heartbeat
- `status.rs` — task status state machine
- `scanner.rs` — directory scanner
- `beads_compat.rs` — beads engine compatibility layer
- `export.rs` — task export to JSONL

Plus:
- `docs/specs/008-phenodag-absorption.md` — the spec doc itself (intentional)

### AgilePlus
3 files reference "phenodag":
- `docs/specs/008-phenodag-absorption.md` — the spec doc (intentional)
- `docs/adr/0008-intent-graph-ontology.md` — the ADR cross-link
- `AtomsBot/README.md`, `GDK/README.md`, `AtomsBot-wtrees/README.md` — strict-pause banners that mention phenodag in the "absorbed" list

### Other
- `phenodag/README.md` — the redirector itself
- `phenodag/CHANGELOG.md` — documents the move

## Conclusion

No external phenodag imports remain in Tracera or AgilePlus. The references that exist are
intentional (implementation, spec, ADR, banner). The "include at spec levels" standard is met.
