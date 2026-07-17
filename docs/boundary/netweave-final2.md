---
repo: "netweave-final2"
role: archive-only
status: archived
last_boundary_review: 2026-07-17
review_cadence: never (archived)
archive_reason: non-phenotype-content
canonical_source: null
absorbing_repo: phenotype-registry (boundary record only)
github_url: "https://github.com/KooshaPari/netweave-final2"
archived_at: 2026-07-17T14:57:25Z
---

# Boundary — netweave-final2 (ARCHIVED)

## Disposition

**ARCHIVED** on GitHub 2026-07-17T14:57:25Z (verified `isArchived=true` via
`gh repo view`).

`KooshaPari/netweave-final2` is a **non-Phenotype** Go traffic-simulation
project — a personal side-project that happens to use the operator's
fleet-style governance hygiene (pinned GitHub Actions, governance bootstrap,
trufflehog workflow, hygiene preservation branches, AI-DD-META badges).
The **content** is outside the Phenotype charter: procedural road-network
generation, agent-based vehicle routing, A*/Dijkstra evaluation, and an
HTML5 Canvas live-viz dashboard. None of those capabilities overlay onto
any of the `DOMAIN_ROLES.md` pillars (graph, LLM routing, observability,
contracts, runtime, mobile).

This boundary doc exists only so the registry retains an auditable record
of why the repo was retired. No source was migrated into the phenotype
monorepo or any substrate repo. The live incarnation of this work is at
`KooshaPari/netweave-3` (see registry row `repo-netweave-3`); `netweave-final2`
is the older snapshot and was named-with-suffix precisely to flag itself
as a frozen intermediate.

## Audit summary

| Aspect | Finding |
|--------|---------|
| Domain | Traffic / urban-mobility simulation (procedural networks + agent routing) |
| Languages | Go 1.18 (backend) + HTML5/Canvas (frontend) + Shell |
| Module path | `github.com/netweave/netweave` *(non-KooshaPari namespace — side-project signal)* |
| Top-level dirs | `cmd/netweave/`, `internal/{canvas,...}`, `web/`, `tests/`, `docs/` |
| Dependencies | `gorilla/websocket`, `llgcode/draw2d`, `golang/freetype`, `golang.org/x/image` *(four small indirect deps; no fleet substrate linkage)* |
| Size | 23.8 MB on disk (~23 MB as reported) |
| Branches | 18 remote branches (governance pin branches: `chore/pin-github-actions-20260*`, `chore/gov-bootstrap-20260502`, `chore/trufflehog-20260502`; hygiene locks: `hygiene/preserve-canonical-20260605`; Cursor PR: `cursor/ci-workflow-configuration-ee06`; recent WIP: `wip/2026-07-17-netweave-base`) |
| Default branch | `chore/pin-github-actions-20260430` *(non-`main` — same governance-hygiene pattern seen across the operator's other `non-Phenotype` personal repos)* |
| License | MIT |
| Work state | **DORMANT · 40%** per README header |
| Last push | 2026-07-17T08:35:14Z *(head activity is on `wip/2026-07-17-netweave-base`)* |
| Phenotype substrate alignment | None — no DOMAIN_ROLES overlay |
| Pillar | None |
| Reuse potential | None — traffic-sim has no place in the Phenotype charter |
| Decision | Archive on GitHub; record in registry; no fork, no transfer |

## Why archive (not absorb)

- **No capability overlap with Phenotype pillars.** Graph theory is
  exercised via `phenotype-router` (LLM routing), `phenotype-contracts`
  (schema graphs), and `phenotype-observability` (trace DAGs). Vehicle
  routing on a synthetic road network is a separate, non-overlapping
  domain with zero consumers in the fleet today.
- **`-final2` suffix is a self-archive marker.** The current live
  incarnation lives at `KooshaPari/netweave-3` (see
  `registry/disposition-index.json` row `repo-netweave-3`,
  `target=phenodocs (docs/netweave/)`). Keeping both alive duplicates
  the personal project without any fleet benefit.
- **Module path is `github.com/netweave/netweave`, not under `KooshaPari/`.**
  That's a side-project namespace signal: it pre-dates the operator's
  move to the KooshaPari GitHub org and was never rebased into the
  Phenotype monorepo convention.
- **Workflow / governance wrapper ≠ Phenotype content.** The repo has
  the same governance badge stack and pinned-Actions hygiene as fleet
  repos, but the payload (traffic viz) is non-Phenotype. The structural
  wrapper doesn't justify keeping the project active.
- **No consumer pulls it.** `go.sum` declares only four small indirect
  deps; nothing in the org manifest `Cargo.toml` / `go.mod` / `pyproject.toml`
  scan cites `netweave-final2` or `github.com/netweave/netweave` as a
  production dep.
- **Default branch is `chore/pin-github-actions-20260430`, not `main`.**
  Same signal as `KDesktopVirt` (registry row `repo-KDesktopVirt`): the
  project sits on a hygiene-pinned branch because the operator doesn't
  actively develop on it.

## What lives where now

| Capability | Lives in |
|------------|----------|
| LLM-request routing | `phenotype-router` / `phenotype-router-spec` (ROUTER substrate) |
| Graph / schema relationships | `phenotype-contracts`, `Tracera` (knowledge substrate) |
| Trace DAG / observability graphs | `PhenoObservability` (`phenotype-tracing`) |
| Live-traffic / vehicle simulation | N/A — retired (was personal, non-Phenotype) |
| HTML landing for NetWeave | `phenodocs/docs/netweave/` *(live incarnation's docs, see `repo-netweave-3`)* |

## Companion repos

- `KooshaPari/netweave-3` — live incarnation. Holds the HTML landing and
  current development; absorbed as `phenodocs (docs/netweave/)` per
  registry row `repo-netweave-3`. Out of scope for this disposition.
- `KooshaPari/netweave` (if it exists separately) — pre-`-final2`
  snapshot, treated as `HOLD_ARCHIVE` per standing operator policy
  for personal project history.

## Outcome

- Source repo `KooshaPari/netweave-final2` archived on GitHub
  (read-only tombstone, `archivedAt: 2026-07-17T14:57:25Z`).
- Registry row `repo-netweave-final2`: new row, disposition
  `ARCHIVE_ONLY`, `fsm=archived`, `target=phenotype-registry
  (docs/boundary/netweave-final2.md)`, `absorbing_repo=KooshaPari/phenotype-registry`,
  `archive_reason=non-phenotype-content`.
- No PR, no fork, no physical transfer. Registry
  `disposition-index.json` carries the audit trail.
- Audit artifact at `audits/absorption-justifications/netweave-final2-2026-07-17.md`
  **(omitted — boundary doc above is the only artifact for this
  archival; precedent mirrors `repo-KDesktopVirt` which also skipped
  a separate audit-justify doc).**

**Next review:** never (archived; tombstone state).
