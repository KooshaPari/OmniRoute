# phenotype-registry — AGENTS.md

## Project overview

Master index and **boundary SSOT** for the KooshaPari polyrepo ecosystem. Connects specs, patterns, templates, and rationalization execution plans.

## Stack

- Docs: VitePress (GitHub Pages)
- Validation: `tools/check-ecosystem.ts`, `scripts/validate-ecosystem.sh`

## Before any cross-repo absorption

1. Read `BOUNDARY_OWNERS.md` (canonical owner per capability)
2. Read `docs/rationalization/ZERO_LOOP_ECOSYSTEM_PLAN.md` + assign `ECOSYSTEM_DAG.md` lane
3. Create `docs/sessions/YYYYMMDD-<slug>/` per `SESSION_ARTIFACT_PROTOCOL.md`
4. Open AgilePlus spec (`agileplus specify`) for non-trivial work

## Key paths

| Path | Role |
|------|------|
| `BOUNDARY_OWNERS.md` | Who owns which boundary |
| `LANGUAGE_STACK.md` | Core / edge / deferred repos |
| `RATIONALIZATION_EXECUTION.md` | Merge order + archive shortlist |
| `docs/rationalization/` | Zero-loop plan, DAG, session protocol, boundary shaping |
| `docs/adr/` | ADR-004..006 (staging, AgilePlus, sessions) |

## Rules

- Additive registry entries only — do not remove without archive gate
- Do not delete archived repos for being incomplete/stub/broken
- Deferred schizo tier: GDK, hwLedger, FocalPoint, KaskMan — no rationalization until fleet complete

## AgilePlus mandate

All non-trivial work tracked in [AgilePlus](https://github.com/KooshaPari/AgilePlus). Link spec ID in PR descriptions.
