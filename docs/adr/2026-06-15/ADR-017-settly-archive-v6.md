# ADR-017: `settly-*` archive — full deprecation (V6 Track 5 closure)

**Status:** SUPERSEDED
**Date:** 2026-06-15
**Superseded by:** ADR-031 (Configra absorb, 2026-06-17; phenotype-config → Configra canonical migration)
**Author:** orchestrator (v6 Track 5 closure)
**Refs:**
- ADR-031 (Configra absorb — canonical successor; closure of all `settly-*` work)
- ADR-022 (config two-crate split — V6 predecessor; proposed the split that v7 collapsed into Configra)
- ADR-029 (Dmouse92 → KooshaPari migration; `settly-config` was Dmouse92-archived)

---

## Context (historical)

In the v6 Track 5 closure (2026-06-15), the `settly-*` family was deprecated and archived. The family consisted of:

- `KooshaPari/settly-config` — a Dmouse92-archived config-as-a-service wrapper
- `KooshaPari/settly-rs` — Rust port (incomplete)
- `KooshaPari/settly-ts` — TypeScript SDK (incomplete)

All 3 repos were archived 2026-06-15. The replacement is `phenotype-config` (now folded into `Configra` per ADR-031).

## Decision (historical)

The `settly-*` family is fully deprecated. No new code or work permitted in any `settly-*` repo. Underlying capabilities (config cascade, 12-factor fallback) move to `phenotype-config` (which is itself migrating to `Configra` per ADR-031).

## Why superseded

- ADR-031 (2026-06-17) is the canonical successor: `phenotype-config` folds into `Configra` as the single canonical config repo
- ADR-031 supersedes the v6 "two-crate split" (ADR-022) with a single canonical repo
- The `settly-*` repos remain archived (read-only); the 90-day GitHub retention policy applies

## Cross-references

- ADR-031 (Configra absorb — canonical successor for all config work)
- ADR-022 (config two-crate split — V6 predecessor; now also superseded)
- ADR-029 (Dmouse92 → KooshaPari migration; `settly-config` archived during this sweep)
- ADR-008 (dispatch-mcp as sole MCP server — v6 closure)