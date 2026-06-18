# ADR-031: Configra as canonical config repo name (supersedes ADR-022 naming split)

**Status:** ACCEPTED
**Date:** 2026-06-17
**Author:** orchestrator (claude opus 4.7) + forge subagent
**L5-104.7** — Phase 3 T19
**Supersedes:** ADR-022 (config consolidation two-crate split)
**Refs:**
- `findings/2026-06-17-L5-104-7-configra-absorb-plan.md` (this ADR's decision log)
- SSOT.md row "Canonical config (Rust)"
- AGENTS.md § "App-level repo triage"

---

## Context

Three repos have the word "config" in their name on KooshaPari:

| Repo | Created | LoC | State | ADR |
|---|---|---|---|---|
| `KooshaPari/Configra` | 2026-03-25 | 0 LoC (hygiene/governance only, 123 commits) | ACTIVE | none |
| `KooshaPari/phenotype-config` | 2026-06-17 | 100% Rust, full SLSA/audit | ACTIVE | ADR-022 |
| `KooshaPari/Conft` | (TS edge) | TS bindings | ACTIVE | ADR-022 |

ADR-022 (2026-06-15) chose a **two-crate split**: `phenotype-config` (Rust core) + `Conft` (TS edge). On 2026-06-17, a third option was identified: **rename the existing `phenotype-config` → `Configra`** to align with the original 2026-03-25 config framework intent.

## Decision

**`Configra` becomes the canonical config repo name. All config work consolidates there.**

| Repo | New state | Reason |
|---|---|---|
| `KooshaPari/Configra` | **CANONICAL** — receives all Rust core code + docs from `phenotype-config` | Original framework intent; most history (123 commits, 90 days) |
| `KooshaPari/phenotype-config` | **DEPRECATED** — freeze, redirect README → Configra, archive 2026-07-15 | Redundant after absorb |
| `KooshaPari/Conft` | **KEEP** — TS bindings edge (per ADR-022 split) | Different language; distinct concern |

## Migration plan (T19 sub-tasks)

| # | Task | Repo | Effort |
|---|---|---|---|
| T19.1 | Clone Configra + phenotype-config locally; diff code | local | 10 min |
| T19.2 | Author `migrate-config.md` (Configra gets `phenotype-config` source) | Configra | 20 min |
| T19.3 | Copy `phenotype-config/*` (Rust source, SPEC, CI) → `Configra/` | Configra | 30 min |
| T19.4 | Open PR on `KooshaPari/Configra` (squash + force-merge) | Configra | 5 min |
| T19.5 | Update `phenotype-config` README → "DEPRECATED, see Configra" | phenotype-config | 5 min |
| T19.6 | Open PR on `KooshaPari/phenotype-config` (deprecation notice) | phenotype-config | 5 min |
| T19.7 | Update SSOT.md, AGENTS.md, STATUS.md references | monorepo | 10 min |
| T19.8 | Conft (TS edge) unaffected — no PR needed | — | 0 min |

**Total: 8 sub-tasks, ~1.5h, 2 PRs (one per affected repo)**

## Conft (TS edge) — unaffected

Conft is a different language (TypeScript), different concern (UI bindings), and serves a distinct audience (frontend devs). It is **not absorbed** into Configra. ADR-022's split remains valid for the Rust/TS edge separation.

## Consequence

- One canonical Rust config repo (Configra), one canonical TS edge (Conft)
- ADR-022 is superseded by ADR-031 for **naming** only; the Rust/TS split decision remains in force via this ADR's reference to ADR-022
- All future config work goes to `Configra` (Rust) or `Conft` (TS)
- `phenotype-config` is archived on 2026-07-15 (28-day grace period)

## Notes

- Configra's existing 123-commit hygiene history is preserved (no squashing); the Rust core code is added as a new commit series on top
- No data loss; no semantic change to the 12-factor config cascade or SLSA build provenance
- The 5 W7 config PRs (#222-231, mostly CI/doc fixes) apply to **both** `phenotype-config` (now) and `Configra` (after absorb); the absorb PR applies those changes
