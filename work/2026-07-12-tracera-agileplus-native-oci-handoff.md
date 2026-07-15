# Tracera + AgilePlus Forward Handoff

> Unique manager-owned handoff. Do not merge into `work/WORK.md` until the operator requests a one-by-one merge. Every row carries state, owner, dependency, deliverable, and recheckable evidence.

## Top Bracket

`[Tracera:WIP, AgilePlus:WIP, AppleOCI:VERIFY, WSLC:VERIFY, Caddy:PLAN, Vercel:PLAN, PyEdge:BOUNDARY, BunTS7:PLAN]`

## Objective

Finish Tracera and AgilePlus functional requirements and defect gaps end to end; migrate the Tracera core away from Python toward Rust/Go/Zig/Mojo where evidence supports it; keep Python to FastMCP and minimal edge adapters; move TypeScript toward Bun/TS 7 preview; verify native OCI on Apple Container and WSL Container; deploy through Caddy/Tailscale/OpenSSH/pheno to the home desktop and Vercel/serverless where compatible; install and health-check local clients.

## Current Evidence Baseline

| surface                | state  | evidence                                                                                      | owner     | next transition                         |
| ---------------------- | ------ | --------------------------------------------------------------------------------------------- | --------- | --------------------------------------- |
| root ledger            | wip    | `work/WORK.md` exists; not modified in this pass                                              | root      | merge only on operator request          |
| Tracera                | wip    | `Tracera/` and `pheno/Tracera/` both exist; dirty trees require containment                   | tracera   | canonical repo selection + full gate    |
| AgilePlus              | wip    | `AgilePlus/` and `pheno/agileplus/` both exist                                                | agileplus | canonical repo selection + deploy proof |
| Python core retirement | plan   | no completion claim until boundary inventory is current                                       | tracera   | classify every Python import            |
| native OCI             | verify | Apple Container and WSLC scripts exist in prior handoff history; current checkout needs rerun | platform  | rerun build/up/health                   |
| frontend               | plan   | Bun workspace surfaces exist in Tracera                                                       | frontend  | run Bun unit/build/type gates           |
| Vercel                 | plan   | no current deployment proof in this checkout                                                  | release   | inspect config, deploy only after gates |
| local clients          | plan   | macOS/Windows install paths not reverified this turn                                          | clients   | package/install/health smoke            |

## 2026-07-14 Control-Plane Evidence

| id          | state | evidence                                                    | result                                                                          | next                                 |
| ----------- | ----- | ----------------------------------------------------------- | ------------------------------------------------------------------------------- | ------------------------------------ |
| ORG-003     | ok    | `python -m unittest -v work/tests/test_ledger_import.py`    | 2/2 pass: idempotence, duplicate-root recovery, and orphan dependency rejection | add drift/reconciliation tests       |
| ORG-006     | wip   | `python -m work.tools.ledger_import`                        | WorkDB seeded from `forward-work.json` and `qa-matrix.json`                     | preserve full source state/QA fields |
| ORG-007     | wip   | `sqlite3 work/agileplus-work.db 'pragma foreign_key_check'` | no foreign-key violations reported                                              | add freshness/metadata verifier      |
| AUD-WBS-003 | ok    | importer output                                             | `projects=1 modules=6 features=7 work_packages=7 dependencies=4 evidence=19`    | make import/export diff stable       |

The importer lives at `work/tools/ledger_import.py`; its regression tests are
`work/tests/test_ledger_import.py`. It intentionally does not modify `work/WORK.md`.

Remaining importer hardening is explicit: reconcile stale source-removed evidence and preserve the
complete QA/state provenance in WorkDB metadata before treating cockpit state as authoritative.

## Canonical Checkout Evidence

| project   | canonical path | origin                                    | branch                                       | HEAD        | dirty entries | decision                             |
| --------- | -------------- | ----------------------------------------- | -------------------------------------------- | ----------- | ------------: | ------------------------------------ |
| Tracera   | `Tracera/`     | `git@github.com:KooshaPari/Tracera.git`   | `feat/spec-008-p1-claim-heartbeat-lifecycle` | `c726e4849` |            57 | use this path; preserve current work |
| AgilePlus | `AgilePlus/`   | `git@github.com:KooshaPari/AgilePlus.git` | `feat/dashboard-ux-audit-p0`                 | `b288ac6`   |            27 | use this path; preserve current work |

Evidence command: `git -C <repo> remote get-url origin; git -C <repo> branch --show-current; git -C <repo> rev-parse --short HEAD; git -C <repo> status --short | wc -l`.

## 2026-07-14 Runtime / Deploy Gap Evidence

| gap                                     | severity | current evidence                                                                                                                    | owner    | exit evidence                                      |
| --------------------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------- | -------- | -------------------------------------------------- |
| Tracera Rust formatting drift           | P1       | `just format` reports diffs in `tracera-edge/src/lib.rs`, `tracera-server/src/cost_tracking.rs`, and `tracera-server/src/ingest.rs` | Tracera  | clean `cargo fmt --check` after ownership review   |
| Tracera Bun test gate is non-existent   | P0       | frontend root has no `test`; web app test is `echo "No tests configured"`                                                           | frontend | real Bun test script + nontrivial tests            |
| Tracera workflow commands are untracked | P1       | `Justfile` and `AGENTS.md` are dirty/untracked                                                                                      | Tracera  | committed command surface + CI proof               |
| Tracera Compose cannot build as written | P0       | `docker-compose.yml` parses but references missing `Dockerfile`; only `Dockerfile.local` exists                                     | platform | `docker compose build` proof                       |
| Tracera selfhost secret boundary        | blocked  | Compose needs `CF_TUNNEL_TOKEN` interpolation                                                                                       | platform | supplied secret + redacted deploy proof            |
| Apple native OCI                        | verify   | `/usr/local/bin/container` exists                                                                                                   | platform | build/run/digest/health evidence                   |
| Caddy                                   | verify   | `/opt/homebrew/bin/caddy` exists                                                                                                    | platform | config validate + route smoke                      |
| WSLC / Traefik                          | absent   | command discovery found neither                                                                                                     | platform | install/availability decision before deploy        |
| AgilePlus root Vercel surface           | absent   | no root Vercel config found                                                                                                         | release  | explicit incompatible/alternative surface decision |

The immediate critical path is: real Tracera Bun test surface -> committed workflow surface ->
Dockerfile/Compose repair -> native OCI build and health -> Caddy route smoke -> WSLC availability ->
Vercel/serverless compatibility decision -> desktop install proof.

## Org-Level Phased WBS

State values: `todo|wip|ok|blocked|hold|defer`. Evidence must be a command, file, commit, URL, or test result.

| id | phase | owner | state | depends_on | deliverable | evidence | next_transition |
| ORG-001 | control | root | wip | - | canonical bracket and ledger policy | this file + `work/WORK.md` | reconcile repo copies |
| ORG-002 | control | root | todo | ORG-001 | ownership map for all active repos | `git -C <repo> branch --show-current` | enumerate repos |
| ORG-003 | control | root | todo | ORG-002 | protected dirty-path inventory | `git -C <repo> status --short` | snapshot all owners |
| ORG-004 | control | root | todo | ORG-002 | cross-project dependency tree | this file DAG | map contracts |
| ORG-005 | control | root | todo | ORG-003 | stale-claim detector | machine check script | add verifier |
| ORG-006 | quality | QA owner | todo | ORG-004 | org QA rubric and scorecard | QA matrix below | define thresholds |
| ORG-007 | quality | QA owner | todo | ORG-006 | evidence freshness policy | timestamps + command logs | enforce in CI |
| ORG-008 | release | release owner | todo | ORG-006 | release-readiness checklist | release artifact | gate deployments |
| ORG-009 | runtime | platform owner | todo | ORG-004 | runtime ownership matrix | language matrix below | approve boundaries |
| ORG-010 | handoff | root | todo | ORG-001..009 | merge packet into `WORK.md` | operator-directed diff | merge one file at a time |

## Project WBS: Tracera

| id | state | owner | depends_on | deliverable | evidence | next_transition |
| TRC-001 | todo | tracera | ORG-002 | choose canonical Tracera checkout | `git -C Tracera remote -v` + `git -C pheno/Tracera remote -v` | record winner |
| TRC-002 | todo | tracera | TRC-001 | freeze protected dirty paths | `git status --short` | write allowlist |
| TRC-003 | todo | tracera | TRC-001 | inventory all FR/spec references | `rg -n "FR-|FR |requirement|acceptance" Tracera pheno/Tracera` | classify |
| TRC-004 | todo | tracera | TRC-003 | build FR-to-test matrix | generated NDJSON/MD | add missing tests |
| TRC-005 | todo | tracera | TRC-004 | run Rust gate | `cargo test --workspace` | classify failures |
| TRC-006 | todo | tracera | TRC-004 | run Go gate | `go test ./...` | classify failures |
| TRC-007 | todo | tracera | TRC-004 | run Python edge gate | project CLI or `uv run pytest` fallback | preserve only edge failures |
| TRC-008 | todo | frontend | TRC-004 | run Bun test/type/build gates | `bun test`, `bun run build`, `bunx tsgo` | remove blockers |
| TRC-009 | todo | tracera | TRC-005..008 | close highest-impact FR cluster | focused tests + diff | update matrix |
| TRC-010 | todo | runtime | TRC-009 | classify Python imports as core/edge/FastMCP | import inventory | approve removals |
| TRC-011 | todo | rust owner | TRC-010 | move first deterministic core boundary to Rust | contract tests + crate | delete Python path |
| TRC-012 | todo | go owner | TRC-010 | move HTTP/control boundary to Go | Go tests + API contract | delete Python path |
| TRC-013 | todo | zig owner | TRC-010 | benchmark Zig candidate boundary | benchmark artifact | choose or reject |
| TRC-014 | todo | mojo owner | TRC-010 | benchmark Mojo candidate only where numeric | benchmark artifact | choose or reject |
| TRC-015 | todo | tracera | TRC-011..014 | remove obsolete Python core modules | `rg` proves no callers | rerun all gates |
| TRC-016 | todo | platform | TRC-015 | Caddy routes Go/Rust core and Python edge | Caddy config + curl health | deploy local |
| TRC-017 | todo | security | TRC-016 | authz, secrets, SSRF, error-surface audit | security report + tests | resolve P0/P1 |
| TRC-018 | todo | release | TRC-017 | package Vercel-compatible edge functions | `vercel build` or documented incompatibility | deploy preview |
| TRC-019 | todo | clients | TRC-016 | install macOS client/tray/CLI | install logs + health | repeat Windows |
| TRC-020 | todo | tracera | TRC-018..019 | publish Tracera release packet | tag/URL/checksums | operator approval |

## Project WBS: AgilePlus

| id | state | owner | depends_on | deliverable | evidence | next_transition |
| AGL-001 | todo | agileplus | ORG-002 | choose canonical AgilePlus checkout | remote/branch evidence | record winner |
| AGL-002 | todo | agileplus | AGL-001 | inventory FRs, epics, and stale claims | `rg -n "FR-|epic|acceptance|TODO"` | matrix |
| AGL-003 | todo | agileplus | AGL-002 | verify Rust workspace/build | `cargo check --workspace` | repair compile |
| AGL-004 | todo | agileplus | AGL-002 | run Rust tests | `cargo test --workspace` | cluster failures |
| AGL-005 | todo | agileplus | AGL-002 | verify dashboard/ownership bracket | focused tests + snapshot | close gaps |
| AGL-006 | todo | platform | AGL-003 | build Apple Container OCI image | native container command + digest | publish digest |
| AGL-007 | todo | platform | AGL-006 | run Apple Container health | `curl /health` + logs | soak |
| AGL-008 | todo | platform | AGL-006 | deploy WSL Native OCI | `wslc list` + remote health | record endpoint |
| AGL-009 | todo | platform | AGL-007..008 | compare Apple/WSLC parity | parity matrix | resolve drift |
| AGL-010 | todo | edge | AGL-009 | configure Caddy ingress/Tailscale | config + curl | smoke external path |
| AGL-011 | todo | release | AGL-010 | Vercel/serverless compatibility audit | `vercel build` + function inventory | deploy preview |
| AGL-012 | todo | clients | AGL-009 | install local desktop and CLI clients | version + health commands | fix packaging |
| AGL-013 | todo | observability | AGL-009 | traces/metrics/logs for deploy paths | OTEL/log evidence | add alerts |
| AGL-014 | todo | security | AGL-010..013 | secret/auth/network audit | audit report | close P0/P1 |
| AGL-015 | todo | release | AGL-011..014 | publish release/runbook packet | URL, digest, rollback-free forward plan | operator go/no-go |

## Language Ownership Matrix

| boundary | canonical owner | Python allowed? | target | acceptance |
| HTTP/control plane | Go | edge adapter only | Go service | contract and load tests |
| domain/state engine | Rust | no | Rust crate | parity vectors + migration removal |
| numeric/ML hot path | Mojo or Rust | no | benchmark-selected | p95/p99 and correctness |
| low-level experimental kernel | Zig | no | benchmark-selected | reproducible benchmark |
| FastMCP bridge | Python | yes | minimal edge | isolated process + protocol tests |
| browser/client UI | Bun TypeScript | no Python | TS/Bun | Bun tests, tsgo, build |
| OCI/runtime glue | shell/Caddy/native OCI | no | Apple/WSLC | image digest + health |

## QA / Gap Audit Matrix

| gap_id | surface | severity | state | required proof | owner | dependency |
| GAP-001 | canonical repo ambiguity | P0 | open | one selected checkout + remotes | root | ORG-002 |
| GAP-002 | dirty-tree ownership | P0 | open | protected-path manifest | root | ORG-003 |
| GAP-003 | FR traceability | P0 | open | FR->test->command matrix | QA | TRC-003 |
| GAP-004 | Python core residue | P1 | open | import classification + removal proof | runtime | TRC-010 |
| GAP-005 | Rust/Go parity | P1 | open | golden vectors + full gates | runtime | TRC-011..012 |
| GAP-006 | Bun TS7 readiness | P1 | open | Bun/tsgo/build matrix | frontend | TRC-008 |
| GAP-007 | Apple OCI parity | P1 | open | digest, health, logs, soak | platform | AGL-006..007 |
| GAP-008 | WSLC parity | P1 | open | remote health + port map | platform | AGL-008 |
| GAP-009 | Caddy/Tailscale ingress | P1 | open | config lint + authenticated curl | edge | AGL-010 |
| GAP-010 | Vercel compatibility | P1 | open | build + preview health | release | AGL-011 |
| GAP-011 | local client install | P2 | open | macOS + Windows version/health | clients | AGL-012 |
| GAP-012 | observability | P2 | open | traces/metrics/logs and alert test | ops | AGL-013 |
| GAP-013 | security/secrets | P0 | open | secret scan + authz/SSRF audit | security | AGL-014 |

## Cross-Project Dependency DAG

```text
ORG-001 -> ORG-002 -> ORG-003 -> ORG-004 -> ORG-006 -> ORG-008 -> ORG-010
                         |             |
                         v             v
                    TRC-001        AGL-001
                         |             |
TRC-003 -> TRC-004 -> TRC-005..008   AGL-002 -> AGL-003..005
                         |             |
                         v             v
                   TRC-010 -> TRC-011..015   AGL-006..009
                         |             |
                         +------> AGL-010..014
                                           |
                                           v
                                    TRC-016..020 + AGL-015
```

## Machine Status Contract

Each transition must append a row or update the row in this file with:

```text
id=<ID> state=<todo|wip|ok|blocked|hold|defer> owner=<agent-or-team>
started=<ISO-8601> completed=<ISO-8601-or-empty>
evidence=<command/file/commit/url> blockers=<semicolon-separated-or-none>
next=<single-transition>
```

No item is `ok` without current evidence. Historical evidence is explicitly labeled historical.

## 2026-07-14 Runtime and Deploy Evidence

| gap                                     | severity | current evidence                                                                                                                    | owner     | exit evidence                                           |
| --------------------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------- | --------- | ------------------------------------------------------- |
| Tracera Rust formatting drift           | P1       | `just format` reports diffs in `tracera-edge/src/lib.rs`, `tracera-server/src/cost_tracking.rs`, and `tracera-server/src/ingest.rs` | Tracera   | clean `cargo fmt --check` after ownership review        |
| Tracera Bun test gate is non-existent   | P0       | frontend root has no `test`; web app test is `echo "No tests configured"`                                                           | frontend  | real Bun test script and nontrivial tests               |
| Tracera workflow commands are untracked | P1       | `Justfile` and `AGENTS.md` are dirty/untracked                                                                                      | Tracera   | committed command surface and CI proof                  |
| Tracera Compose cannot build as written | P0       | `docker-compose.yml` parses but references missing `Dockerfile`; only `Dockerfile.local` exists                                     | platform  | `docker compose build` proof                            |
| Tracera self-host secret boundary       | blocked  | self-host Compose requires `CF_TUNNEL_TOKEN` interpolation                                                                          | platform  | supplied secret and redacted deploy proof               |
| AgilePlus root Dockerfile release path  | P0       | builds excluded `agileplus-cli` and copies absent `rust/`; `Dockerfile.rust` builds active workspace                                | AgilePlus | workspace activation plus executable image health proof |
| Apple native OCI                        | verify   | `/usr/local/bin/container` exists                                                                                                   | platform  | build/run/digest/health evidence                        |
| Caddy                                   | verify   | `/opt/homebrew/bin/caddy` exists and Tracera self-host Caddyfile exists                                                             | platform  | config validate and route smoke                         |
| WSLC / Traefik                          | absent   | command discovery found neither; no project config                                                                                  | platform  | availability decision before Windows deploy             |
| AgilePlus root Vercel surface           | absent   | no root `vercel.json` found                                                                                                         | release   | explicit incompatible or alternative surface decision   |

Critical path: real Tracera Bun test surface -> committed workflow surface -> Compose/Dockerfile repair -> native OCI build and health -> Caddy route smoke -> WSLC availability -> Vercel compatibility decision -> desktop install proof.

## Merge Boundary

This file is the unique recovery source for this session. Other agents may write separate reports under `work/`, but must not modify `work/WORK.md`. On operator instruction, merge completed rows into `work/WORK.md` one source file at a time, preserving unrelated staged work and retaining this file as the audit trail.
