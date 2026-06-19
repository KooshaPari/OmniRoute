# ADR-035B: Event-bus substrate consolidation

**Date:** 2026-06-18
**Status:** PROPOSED (awaiting human review)
**Deciders:** @KooshaPari (sole owner), fleet audit circle
**Supersedes:** none
**Superseded by:** none
**Note on numbering:** Originally numbered ADR-035 in the task prompt; re-numbered to **ADR-035B** in the v8 sweep (2026-06-18) to resolve a numbering collision with `ADR-035-configra-migration-gates.md` (the canonical ADR-035 in this directory's `INDEX.md`) and to be consistent with the existing `ADR-035A-hwledger-reclassification.md` suffix convention. The substance of the decision is unchanged.
**Related:** ADR-023 (app-level repo triage), ADR-029 (Dmouse92 → KooshaPari migration), ADR-031 (Configra absorb — same DRY-absorption pattern), ADR-036/037/038/039/040 (v8 substrate-canonical sweep), deletion-justification audit 2026-06-18

---

## Context

The Phenotype fleet has 9+ distinct event-related implementations across 6 abstraction layers, each overlapping but none of them canonical:

- **3 top-level repos** (independent, public on GitHub):
  - `phenotype-bus` (private) — in-memory pub/sub + DLQ + outbox, ~1.1k LOC
  - `PhenoEvents` (public) — SQLite outbox + DLQ + idempotency + schema registry + v7 UUID envelopes
  - `Eventra` (public) — event-sourcing framework, aggregates + commands + projections
- **6 sub-crates inside monorepos**:
  - `pheno/crates/phenotype-event-bus` — small re-implementation of phenotype-bus
  - `phenoShared/crates/phenotype-event-sourcing` — SHA-256 hash chain + snapshots + DDD layers (23 .rs files, the most mature)
  - `pheno/crates/phenotype-event-sourcing` — blake3 hash-chain variant + `AsyncEventStore` trait
  - `focus-events` — connector event schema (different domain: data-source emissions)
  - `agileplus-events` — AgilePlus framework internal events
  - `HexaKit/crates/phenotype-event-bus` — MIGRATED stub (per `MIGRATED.md`, no code)

This proliferation violates the **DRY principle** and ADR-023's "no random `phenoShared`" substrate placement rule. It creates measurable maintenance burden: 9 build matrices to keep green, 9 supply-chain attack surfaces, 9 onboarding paths for "I want to use events", and divergent hash-algorithm choices (SHA-256 vs blake3) that fragment the event-store API surface.

The fleet owner (KooshaPari) has directed consolidation via "adoption of the events repo" (PhenoEvents) and DRY absorption of overlapping repos. This ADR is the formal record of that decision.

## Decision

We adopt a **three-substrate event model**. Every new event-related code lands in one of these three. No exceptions.

### 1. `PhenoEvents` (crate `pheno-events`) is the canonical **event bus substrate**

For moving events between processes/services with persistence, ordering, and at-least-once delivery guarantees.

- **Owns:** SQLite outbox, DLQ, idempotency keys, schema registry, checkpointed projections, v7 UUID envelopes, the in-memory bus adapter (lifted from `phenotype-bus`).
- **Absorbs:**
  - `phenotype-bus` (in-memory pub/sub → `phenoEvents/src/bus/in_memory.rs`) — pattern is small and orthogonal to PhenoEvents' persistence layer.
  - `pheno/crates/phenotype-event-bus` (sub-crate, small) — added in a follow-up PR.
- **Rationale:** PhenoEvents is already public, has the broadest feature set (outbox + DLQ + idempotency + schema registry), and is the repo the user explicitly named for adoption.

### 2. `phenoShared/crates/phenotype-event-sourcing` is the canonical **event-sourcing engine**

For using events as the source of truth in DDD aggregates (CQRS/ES pattern).

- **Owns:** SHA-256 hash chain, snapshot management, full DDD layer split (`domain/` / `application/` / `adapters/`), `Aggregate` trait + `Command` + `CommandHandler` service.
- **Absorbs:**
  - `Eventra` — event-sourcing framework with aggregates, commands, projections. Architectural bugs (missing `impl Aggregate`, broken `ProjectionRunner::run`, phantom adapter claims) are fixed first via PR #18 before pattern lift.
  - `pheno/crates/phenotype-event-sourcing` — the blake3 variant. **The hash-algorithm divergence is reconciled to SHA-256** (see Acceptance criteria §2) for cross-store compatibility. The blake3-specific `AsyncEventStore` trait is preserved as a feature flag `async-store` if it has downstream consumers; otherwise discarded.
- **Rationale:** `phenoShared`'s version is materially more mature (23 .rs files with full DDD layers + hash-chain tests) than `Eventra` (15 .rs files with broken architecture as of pre-PR-#18). Lifting `Eventra`'s aggregate/command pattern into phenoShared rather than the reverse preserves the more battle-tested hash chain.

### 3. `focus-events` remains as a separate **connector event schema**

For normalized events emitted by data connectors (e.g., file-watcher, git, calendar, IMAP). Different domain from bus/ES:

- A connector event has a fixed, declarative shape (source, timestamp, payload).
- A bus event is opaque bytes with a routing key.
- An ES event is a domain fact with semantic meaning for an aggregate.

**No absorption.** `focus-events` is owned by the data-connector circle, not the event-bus circle.

## What this means for each repo

| Repo | Action | Rationale |
|---|---|---|
| `phenotype-bus` | **ARCHIVE** (after lift) | In-memory pattern already lifted to PhenoEvents; remaining Wave-1 duplicates + 10 broken tests deleted pre-archive. |
| `PhenoEvents` | **KEEP + ENHANCE** | Canonical event bus; gains `InMemoryBus` adapter, `version()`/`name()` helpers, `audit.yml`/`deny.yml`/`cliff.toml`. |
| `Eventra` | **DEPRECATE → archive after migrate** | Event-sourcing engine; architectural bugs fixed in PR #18, then Aggregate/Command/CommandHandler pattern lifted to phenoShared, then archive. |
| `pheno/crates/phenotype-event-bus` | **DEPRECATE → delete path** | Sub-crate; bus substrate lives in PhenoEvents. No in-flight consumers confirmed before deletion. |
| `phenoShared/crates/phenotype-event-sourcing` | **KEEP + ENHANCE** | Canonical event-sourcing engine; gains Aggregate pattern from Eventra, gains async-store feature flag from blake3 variant. |
| `pheno/crates/phenotype-event-sourcing` | **RECONCILE → delete path** | blake3 variant; migrate useful surface to phenoShared (default to SHA-256, keep blake3 as opt-in feature flag), then delete. |
| `focus-events` | **KEEP** | Different domain (connector schema); not in scope for this ADR. |
| `agileplus-events` | **KEEP** | Part of AgilePlus framework; not a fleet-wide substrate. |
| `HexaKit/crates/phenotype-event-bus/` | **DELETE PATH** | MIGRATED stub; per `MIGRATED.md`, no code in the directory. |

## Migration plan

### Phase 1 (DONE 2026-06-18)
- [x] Audit 3 top-level repos + 6 sub-crates (deletion-justification audit, this turn)
- [x] Identify `phenotype-bus` for archival after in-memory lift
- [x] Identify `Eventra` for migration to phenoShared (event-sourcing engine)
- [x] Identify `pheno/crates/phenotype-event-sourcing` blake3 variant for reconciliation
- [x] Open `Eventra#18` to fix 6 architectural bugs (impl Aggregate, fix ProjectionRunner::run, etc.)
- [x] Cherry-pick 7 tests from Eventra wip branches → `Eventra#18`
- [x] Update `Eventra` README to remove phantom adapter claims → `Eventra#18`

### Phase 2 (IN PROGRESS 2026-06-18)
- [ ] PhenoEvents: add `InMemoryBus` adapter (lift from `phenotype-bus/src/in_memory.rs`)
- [ ] PhenoEvents: lift `version()` / `name()` helpers + `audit.yml` / `deny.yml` / `cliff.toml` from `phenotype-bus`
- [ ] PhenoEvents: remove dead `jsonschema` dep
- [ ] `phenotype-bus`: delete `ports/` directory (unused), Wave-1 duplicate modules, 10 broken tests
- [ ] `phenotype-bus`: archive via GitHub UI (Settings → Danger Zone → Archive, since `delete_repo` would be a 90-day soft-delete tombstone that loses git history references)

### Phase 3 (PROPOSED 2026-06-19)
- [ ] Lift `Eventra` `Aggregate` pattern + `Command` + `CommandHandlerService` to `phenoShared/crates/phenotype-event-sourcing/src/aggregate/`
- [ ] Archive `Eventra` (after migration lands; the 6 bugs fixed in PR #18 stand as the last KP commit on `Eventra` main)
- [ ] Migrate `pheno/crates/phenotype-event-sourcing` blake3 code to phenoShared (default to SHA-256, add blake3 as a feature flag `hash-blake3` if any consumer wants it)
- [ ] Delete `pheno/crates/phenotype-event-sourcing` (after migration)
- [ ] Delete `pheno/crates/phenotype-event-bus` (after confirming no in-flight consumers via fleet audit)
- [ ] Delete `HexaKit/crates/phenotype-event-bus/` (the MIGRATED stub directory)

### Phase 4 (FOLLOW-UP)
- [ ] Add 71-pillar audit entries for `PhenoEvents` (post-merge) to confirm it reaches fleet quality bar (target: 24/30 = 80% on the 30-pillar subset that applies to a headless lib; full 71-pillar is 35/71)
- [ ] Add `pheno-ci-templates` workflow for `PhenoEvents` (lift `audit.yml` + `deny.yml`)
- [ ] Document the consolidation in `phenotype-registry` (the cross-repo catalog; one entry per canonical substrate)
- [ ] Re-run fleet 71-pillar audit on the next Monday cadence (per ADR-048) and verify the consolidation shows a measurable L4 / L20 / L21 score lift

## Consequences

### Positive
- 9+ event-related implementations → **3 canonical substrates** (`PhenoEvents` + `phenoShared/phenotype-event-sourcing` + `focus-events`).
- All event-bus consumers have exactly one canonical bus to import from — no more "which bus do I use?" onboarding ambiguity.
- All event-sourcing consumers have exactly one canonical engine — no more SHA-256 vs blake3 fork.
- Reduced CI time: 9 build matrices → 3 (estimated ~3× faster on event-touching PRs).
- Reduced supply-chain attack surface: 9 dependency sets → 3 to monitor for CVEs.
- Onboarding clarity: a one-line rule — *"if you want events, use `PhenoEvents` (bus) or `phenoShared/phenotype-event-sourcing` (ES) or `focus-events` (connector)"*.
- Aligns with the v8 substrate-canonical sweep (ADR-036 tracing, ADR-037 mcp-router, ADR-038 hexagonal L4): every domain gets exactly one canonical substrate.

### Negative
- Migration effort: 3 top-level repos + 6 sub-crates need patches and archive operations (estimated ~3 subagents × 2 days).
- **Breaking change** for any external consumer importing `phenotype-bus` or `Eventra` directly. Mitigation: deprecation warnings in the source for ≥30 days, GitHub README deprecation banner, migration guide in `phenotype-registry/docs/event-migration.md`.
- The `phenoShared/crates/phenotype-event-sourcing` vs `pheno/crates/phenotype-event-sourcing` divergence (SHA-256 vs blake3) is unresolved in the user's task brief — **defaulting to SHA-256** for cross-store compatibility (this matches `phenoShared` and matches `Eventra`'s post-fix direction).
- Eventra PR #18 fixes 6 architectural bugs but does not add tests for the lifted Aggregate pattern; that test debt moves to phenoShared.

### Risks

| ID | Severity | Description | Mitigation |
|---|---|---|---|
| **R1** | high | Breaking change for downstream consumers of `phenotype-bus` and `Eventra`. | 30-day deprecation warnings + GitHub README banner + migration guide in `phenotype-registry`. |
| **R2** | medium | Loss of niche features in the blake3 variant (e.g., the `AsyncEventStore` trait, the `hash_blake3` configuration). | Add the feature as an opt-in `async-store` and `hash-blake3` Cargo feature flag in `phenoShared` before deleting the source crate. |
| **R3** | low | Merge conflicts during parallel lifts (PhenoEvents + phenoShared + Eventra all in flight). | Sequence Phase 2 → Phase 3; use separate branches per repo; bot self-merge per the v8 governance pattern. |
| **R4** | low | `pheno/` monorepo submodule pointer drift on deletion of `pheno/crates/phenotype-event-sourcing` and `phenotype-event-bus`. | Verify `phenoShared` and `pheno` are on independent submodules before deleting; if they share a submodule, do the deletion in the submodule's HEAD and bump the parent pointer in a separate commit. |
| **R5** | low | The `InMemoryBus` adapter lifted from `phenotype-bus` may have a subtly different ordering guarantee than PhenoEvents' other adapters. | Add a property-based test (e.g., `proptest` for causal ordering) covering all bus adapters in a single test file post-lift. |

## Acceptance criteria

This ADR is accepted when **all** of the following are true:

1. **PhenoEvents has the lifted `InMemoryBus` adapter**, `version()` / `name()` helpers, and the 3 new CI workflows (`audit.yml` + `deny.yml` + `cliff.toml`).
2. **`phenotype-bus` is archived** on GitHub (read-only marker; not deleted, to preserve git history for in-flight branches).
3. **Eventra is either migrated to phenoShared** (Aggregate/Command/CommandHandlerService lifted, 6 bugs fixed in PR #18) **OR has its 6 architectural bugs fixed** in a merged PR — whichever lands first; the other follows.
4. **The 6 sub-crate repos are inventoried** in `findings/2026-06-18-event-bus-consolidation-inventory.md` and have a documented disposition (KEEP / KEEP+ENHANCE / DELETE / RECONCILE).
5. **The 71-pillar audit shows PhenoEvents at grade B+ or higher** (≥ 24/30 on the 30-pillar subset that applies to a headless lib; full 71-pillar is ≥ 35/71) on the next weekly sweep (per ADR-048 cadence).
6. **Migration guide** published at `phenotype-registry/docs/event-migration.md` covering the `phenotype-bus` → `PhenoEvents` and `Eventra` → `phenoShared` paths.

## References

- **Audit findings:** deletion-justification audit 2026-06-18 (3 top-level repos + 6 sub-crates; this ADR's context section)
- **Eventra architectural cleanup PR:** <https://github.com/KooshaPari/Eventra/pull/18>
- **ADR-023** — app-level repo triage (Rule 3: extract app substrate to `pheno-*-lib` / `phenotype-*-sdk` / `phenotype-*-framework` / federated service; "no random `phenoShared`")
- **ADR-029** — Dmouse92 → KooshaPari migration (precedent: absorb + archive pattern)
- **ADR-031** — Configra absorb (precedent: 8 source repos → 1 canonical; same DRY-absorption pattern)
- **ADR-036 / 037 / 038 / 039 / 040** — v8 substrate-canonical sweep (tracing, mcp-router, hexagonal L4, pheno-flake, coverage gates)
- **ADR-048** — 71-pillar weekly cadence (governs when the post-merge PhenoEvents audit is captured)
- **`AGENTS.md`** § "Active ADRs" table — add this row to v8 wave
- **`AGENTS.md`** § "App-level repo triage" — substrate placement rule (rule 3.1) governs the new `phenoShared/phenotype-event-sourcing` enhancements
