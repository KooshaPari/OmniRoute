# Zero-Shot / Zero-Loop Orchestration

**Status:** Active  
**Date:** 2026-06-17  
**Authority:** phenotype-registry (INDEX spine)  
**Related:** [boundary-shaping.md](./boundary-shaping.md), [DOMAIN_ROLES.md](./DOMAIN_ROLES.md), [STACK_POLICY.md](./STACK_POLICY.md)

Defines how agent sessions execute **one disposition row** without apex re-dispatch, branch wars, or SSOT rediscovery.

---

## Definitions

| Term | Meaning |
|------|---------|
| **Zero-shot** | Apex completes one disposition row in one session cluster from the Agent Context Bundle alone |
| **Zero-loop** | No re-dispatch; FSM transitions are forward-only except `blocked → ready` after fix |
| **AACP** | Agent context packet — session-scoped envelope with bundle URIs, `owns[]`, `forbidden_paths[]`, `verify[]` |

---

## Agent Context Bundle (preload order)

1. `docs/rationalization/boundary-shaping.md`
2. `docs/rationalization/DOMAIN_ROLES.md`
3. `docs/rationalization/STACK_POLICY.md`
4. This document
5. `registry/domain-roles.json`
6. `registry/disposition-index.json` — **one row**
7. `registry/components.lock` — target repo pin
8. `HexaKit/docs/boundary/DISPOSITION.md` — row detail
9. Target repo `BOUNDARY.md`
10. `docs/sessions/20260617-ecosystem-disposition-wave/03_DAG_WBS.md`
11. Active `tasks/WP*.md` with `verify:` frontmatter
12. `HexaKit/docs/operations/crate-relocation-runbook.md`
13. Harness preflight checklist (below)
14. `registry/lanes/<lane_id>.json` if dispatched

---

## Disposition FSM

```
pending → gated → ready → claimed → in_progress → for_review → done
                              ↓                      ↓
                           blocked ←─────────────────┘
```

States stored in `registry/disposition-index.json` per `disposition_id`.

---

## Harness routing

| Lane class | Worktree | Primary harness | Lock |
|------------|----------|-----------------|------|
| MUTATE_RELOCATE | Required | forge / cursor-agent | 1/repo + `~/.cargo` global |
| MUTATE_SCAFFOLD | Single branch | any | 1/repo |
| READ_AUDIT | Optional | forge fanout | none |
| LONG_VERIFY | worktree | thegent `--owner` | session |

AgilePlus owns plan/DAG/merge. Adapters: **forge** (primary), cursor-agent, thegent, codex-fork (downstream).

See [HexaKit harness-api](https://github.com/KooshaPari/HexaKit/blob/main/docs/contracts/harness-api.md).

---

## Preflight checklist

- [ ] `git config safe.directory` for Admin-owned clones
- [ ] `gh pr merge --squash` (repos disallow merge commits)
- [ ] PowerShell: use file/Python for base64 UTF-8, not `Substring` on decoded strings
- [ ] Subagent types: `code-explorer` / `generalPurpose` (not `explore`)
- [ ] Global cargo lock: declare serial lane if another Rust build active
- [ ] Branch protection: solo maintainer — no external reviewer required
- [ ] Load disposition row from index — do not improvise target repo
- [ ] File overlap: run morph-style serializer before parallel mutating lanes

---

## Forbidden loops

- Apex re-reads DISPOSITION table without index row
- Second dispatch for same `lane_id` without `blocked` transition
- Merge retry without fixing `verify` failure
- Mutating paths outside `owns[]`
- Creating lang-bucket SDK code (`phenotype-{lang}-sdk`)

---

## Exit gate (per row)

- [ ] PR merged (squash)
- [ ] `verify[]` commands green
- [ ] `disposition-index.json` → `done`
- [ ] `components.lock` pin updated for target repo
- [ ] `docs/sessions/.../EVIDENCE.md` appended
- [ ] Watcher audit pass (independent of executing agent)
- [ ] Apex prompt count ≤ 1

---

## Scorecard (ADR-ECO-012)

| Metric | Target |
|--------|--------|
| Apex prompts per row | ≤1 |
| Re-dispatch loops | 0 |
| Post-merge CI failures | 0 |
| Row pending→relocated | <4h wall |

---

## Journey 3 reference (AgilePlus)

```bash
agileplus queue --status
agileplus implement batch --features <ids> --max-agents 12
agileplus validate batch --features <ids> --strict
agileplus ship batch --target main
```

---

## Related

- Session DAG: [docs/sessions/20260617-ecosystem-disposition-wave/03_DAG_WBS.md](../sessions/20260617-ecosystem-disposition-wave/03_DAG_WBS.md)
- [registry/disposition-index.json](../../registry/disposition-index.json)
- [registry/chokepoints.json](../../registry/chokepoints.json)
