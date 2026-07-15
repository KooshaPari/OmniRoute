# Polyrepo Long-Horizon Handoff — Root Manager

> Merge candidate: this file is intentionally isolated from `work.md`; merge it only after the other writers have finished. Every task below has a stable ID so agents can update status without rewriting the plan.

## Cockpit seed

`[OmniRoute:◐, Tracera:✓, AgilePlus:○, DesktopDeploy:◐, Vercel:◐]`

| Lane | Grade | Current evidence | Owner | Immediate gate |
|---|---:|---|---|---|
| OmniRoute | ◐ | Compose hardening; Apple native OCI preview is useful for runtime but build path is unstable | root/OmniRoute owner | Windows WSLC deploy proof |
| Tracera | ✓ | Caddy surface and Go/API aggregate gates were green in prior slice; re-check current tree before claiming | Tracera owner | Caddy runtime + serverless proof |
| AgilePlus/Substrate | ○ | Cockpit/work DB schema exists; ledger was empty in last audit | AgilePlus owner | seed DB and round-trip evidence |
| DesktopDeploy | ◐ | SSH alias `desk` reaches Windows and `wslc.exe` was discoverable | deployment owner | reproducible remote install/rollback |
| Vercel | ◐ | Tracera Rust and AgilePlus Vite surfaces are coherent; phenotype-registry identity is unresolved | Vercel owner | project identity + deploy evidence |
| AgentInfra | ◐ | iMessage bridge exists; timeout degradation has occurred | infra owner | health/fallback/no-telemetry proof |

## Operating contract

- Status values are `proposed`, `ready`, `working`, `blocked`, `verified`, or `retired`.
- A task is `verified` only with a current command, artifact path, timestamp, and exit/result captured in the evidence ledger.
- “Tests passed previously” is historical context, not current proof.
- External blockers (Docker daemon, credentials, remote host availability) remain explicit blockers; do not silently downgrade scope.
- Production preference: Apple native OCI for local runtime validation; Windows WSL Containers (`wslc.exe`) over Tailscale + OpenSSH for the home production host; Caddy as gateway; managed/serverless services only where stateful desktop hosting is not appropriate.
- Do not add SFTP unless SSH/SCP is insufficient for a demonstrated transfer requirement.

## Ownership and dependency tree

```text
POLY-CONTRACT-001 (cross-repo API/schema/version contract)
├── OmniRoute
│   ├── OR-COMPOSE-001 ──┬── OR-CADDY-001 ── OR-RUNTIME-001
│   │                    └── OR-OCI-001 ── DESKTOP-PARITY-001
│   └── OR-WSLC-001 ── DEP-ROLLBACK-001
├── Tracera
│   ├── TR-CADDY-001 ── TR-TLS-001
│   ├── TR-GO-001 ── VERCEL-GO-001
│   └── TR-OBS-001
├── AgilePlus / Substrate
│   ├── AGILEPLUS-DB-001 ── AGILEPLUS-COCKPIT-001
│   ├── SUB-PLANE-001 ── SUB-INTEGRATION-001
│   └── AP-EVIDENCE-001 ── GATE-AGG-001
├── DesktopDeploy
│   ├── DESKTOP-SSH-001 ── OR-WSLC-001
│   └── DESKTOP-PARITY-001 ── DESKTOP-INSTALL-001
├── Vercel
│   ├── VERCEL-ID-001 ── VERCEL-ENV-001 ── VERCEL-PROOF-001
│   └── VERCEL-GO-001
└── AgentInfra
    ├── AGENTINFRA-IMSG-001 ── AGENTINFRA-HOOK-001
    └── AGENTINFRA-PRIVACY-001 ── GATE-AGG-001
```

## Phased WBS / forward DAG

### Phase 0 — inventory, contracts, and machine traceability

| ID | Task | Owner | Depends | Acceptance/evidence | State |
|---|---|---|---|---|---|
| POLY-CONTRACT-001 | Define cross-repo API, image, schema, and version compatibility matrix | root | — | Markdown + machine rows; every lane has owner, status, dependency, evidence command | ready |
| POLY-CONTRACT-002 | Record repo roots, branches, worktrees, and dirty-tree policy | root | 001 | snapshot artifact with timestamp; stale worktrees labelled historical | ready |
| POLY-CONTRACT-003 | Define state vocabulary and transition rules | root | 001 | schema/test rejects unknown states | ready |
| POLY-CONTRACT-004 | Define artifact retention and evidence naming convention | root | 001 | evidence paths are unique and machine-ingestible | ready |
| AGILEPLUS-DB-001 | Seed six repo projects and initial work packages in `work/agileplus-work.db` | AgilePlus | 001 | non-empty `projects`, `work_packages`, `wp_dependencies`, `evidence`; DB↔Markdown round-trip | ready |
| AGILEPLUS-DB-002 | Add idempotent ledger import/export command | AgilePlus | DB-001 | second run creates no duplicates; JSON diff is stable | proposed |
| AGILEPLUS-DB-003 | Add dependency-cycle and orphan-owner audit | AgilePlus | DB-002 | failing fixture catches cycle/orphan; report includes task IDs | proposed |
| AGILEPLUS-DB-004 | Add evidence freshness and missing-artifact audit | AgilePlus | DB-002 | stale/missing evidence is `blocked`, never `verified` | proposed |
| AGILEPLUS-DB-005 | Add snapshot schema for cockpit ticks | AgilePlus | DB-002 | one snapshot captures bracket, bars, DAG, agents, blockers | proposed |
| AGILEPLUS-DB-006 | Register this handoff as a merge candidate, not canonical truth | root | DB-001 | source path and merge status are recorded | proposed |

### Phase 1 — gateway, container, and local runtime proof

| ID | Task | Owner | Depends | Acceptance/evidence | State |
|---|---|---|---|---|---|
| OR-COMPOSE-001 | Validate scaled Compose graph, pinned images, env requirements, and intentional mounts | OmniRoute | POLY-CONTRACT-001 | `docker compose config` artifact and no obsolete gateway service | verified-history |
| OR-CADDY-001 | Reconcile Caddy routes, upstream names, metrics, and health endpoints | OmniRoute/Tracera | COMPOSE-001 | rendered config + route table; no nginx references | ready |
| OR-CADDY-002 | Add Caddy config lint and route smoke fixture | Tracera | CADDY-001 | lint plus `/`, `/api/v1/*`, `/python/*`, `/metrics` checks | proposed |
| TR-CADDY-001 | Prove Caddy runtime against the actual compose network | Tracera | CADDY-002 | curl health/status, upstream response, metrics scrape artifact | ready |
| TR-TLS-001 | Establish local and production TLS termination policy | DesktopDeploy | TR-CADDY-001 | Caddyfile/env documented; cert renewal and failure path tested | proposed |
| OR-OCI-001 | Build a native OCI runtime matrix for Apple container preview | OmniRoute | OR-COMPOSE-001 | commands, image digest, health output, resource limits, and known preview failures captured | ready |
| OR-OCI-002 | Separate Apple runtime proof from Apple builder capability | OmniRoute | OR-OCI-001 | docs/tests never treat unstable builder as production proof | proposed |
| OR-OCI-003 | Test image export/import between Apple native OCI and Windows host | DesktopDeploy | OR-OCI-001 | same digest or documented reproducible rebuild; transfer artifact | proposed |
| OR-RUNTIME-001 | Run end-to-end local gateway → service → health smoke | OmniRoute | OR-CADDY-001, OR-OCI-001 | one timestamped trace covers request, response, logs, and cleanup | proposed |
| DESKTOP-PARITY-001 | Compare Apple OCI, Docker/OrbStack, and Windows WSLC behavior | DesktopDeploy | OR-OCI-003 | parity matrix for image, ports, volumes, health, restart, logs | ready |

### Phase 2 — Windows home production lane

| ID | Task | Owner | Depends | Acceptance/evidence | State |
|---|---|---|---|---|---|
| DESKTOP-SSH-001 | Verify SSH alias `desk`, host key policy, and least-privilege account | DesktopDeploy | POLY-CONTRACT-001 | `ssh desk` evidence without secrets; documented failure modes | ready |
| DESKTOP-SSH-002 | Verify remote `wslc.exe` discovery and version | DesktopDeploy | SSH-001 | remote command output captured | verified-history |
| OR-WSLC-001 | Implement/reconcile Windows WSLC deploy script and operator docs | OmniRoute | DESKTOP-SSH-002 | idempotent deploy, remote health, explicit rollback, nonzero failure exits | ready |
| OR-WSLC-002 | Add dry-run mode and artifact transfer via SSH/SCP | OmniRoute | WSLC-001 | dry-run never mutates host; SFTP remains unnecessary unless proven | proposed |
| DEP-ROLLBACK-001 | Test failed deploy rollback and previous image recovery | DesktopDeploy | OR-WSLC-002 | injected failure leaves known-good service healthy | proposed |
| DESKTOP-INSTALL-001 | Define Windows install/uninstall parity for services, volumes, and secrets | DesktopDeploy | DEP-ROLLBACK-001 | clean install, upgrade, uninstall, and re-install evidence | proposed |
| DESKTOP-INSTALL-002 | Define macOS local developer install parity | DesktopDeploy | DESKTOP-PARITY-001 | same operator contract and health checks | proposed |
| DESKTOP-OBS-001 | Capture host resource, restart, and log rotation policy | DesktopDeploy | DESKTOP-INSTALL-001 | bounded disk/memory behavior and alert thresholds | proposed |
| DESKTOP-DR-001 | Run restore drill from image/config backup | DesktopDeploy | DESKTOP-OBS-001 | timed restore artifact and RTO/RPO result | proposed |

### Phase 3 — Tracera Go/API and serverless surfaces

| ID | Task | Owner | Depends | Acceptance/evidence | State |
|---|---|---|---|---|---|
| TR-GO-001 | Keep Vercel handler cgo-free and contract-shaped | Tracera | POLY-CONTRACT-001 | `go test ./...`, build output, handler contract check | verified-history |
| TR-GO-002 | Verify API route behavior against exported router | Tracera | TR-GO-001 | health, API, error, and cleanup tests | verified-history |
| TR-GO-003 | Replace any in-memory-only production assumption with explicit persistence boundary | Tracera | TR-GO-002 | API docs state durability model; no silent data-loss claim | proposed |
| VERCEL-GO-001 | Build Vercel Go function with production env contract | Vercel/Tracera | TR-GO-001 | Vercel build/deploy output and request smoke | ready |
| VERCEL-GO-002 | Prove cold start, concurrent invocation, and cleanup behavior | Vercel/Tracera | VERCEL-GO-001 | bounded load smoke and logs show no leaked handles | proposed |
| TR-OBS-001 | Add health, readiness, and dependency status semantics | Tracera | TR-GO-002 | stable JSON schema and failure status mapping | proposed |
| TR-OBS-002 | Export Go/API evidence to AgilePlus ledger | Tracera/AgilePlus | TR-OBS-001 | evidence row references exact artifact | proposed |

### Phase 4 — Vercel identity and deploy proof

| ID | Task | Owner | Depends | Acceptance/evidence | State |
|---|---|---|---|---|---|
| VERCEL-ID-001 | Resolve `phenotype-registry` identity versus duplicated Bifrost scaffold | Vercel | POLY-CONTRACT-001 | explicit project/name/domain/owner mapping | ready |
| VERCEL-ID-002 | Remove duplicate or rename it with a documented ownership decision | Vercel | VERCEL-ID-001 | no ambiguous deploy target remains | proposed |
| VERCEL-ENV-001 | Define per-project env ownership and secret injection | Vercel | VERCEL-ID-001 | env matrix, no committed secrets, preview/prod separation | proposed |
| VERCEL-ENV-002 | Add serverless storage decision record | Vercel/Tracera | VERCEL-ENV-001 | managed Postgres/Supabase/etc selected only where required; tradeoffs recorded | proposed |
| VERCEL-PROOF-001 | Deploy Tracera and AgilePlus preview surfaces | Vercel | VERCEL-ID-002, VERCEL-ENV-001 | URLs, build logs, health/API smoke, rollback pointer | proposed |
| VERCEL-PROOF-002 | Run production promotion gate | Vercel | VERCEL-PROOF-001 | approval artifact, smoke, and rollback test | proposed |
| VERCEL-DR-001 | Test redeploy from clean checkout | Vercel | VERCEL-PROOF-002 | reproducible build with documented external dependencies | proposed |

### Phase 5 — AgilePlus/Substrate cockpit and runtime integration

| ID | Task | Owner | Depends | Acceptance/evidence | State |
|---|---|---|---|---|---|
| AGILEPLUS-COCKPIT-001 | Render top bracket, progress tree, DAG, ownership, and agent table from ledger | AgilePlus | AGILEPLUS-DB-005 | deterministic snapshot output | ready |
| AGILEPLUS-COCKPIT-002 | Ingest external repo gate results without manual rewriting | AgilePlus | COCKPIT-001, GATE-AGG-001 | evidence import updates state and timestamp | proposed |
| AP-EVIDENCE-001 | Add evidence freshness badges and blocker explanations | AgilePlus | DB-004, COCKPIT-001 | stale/weak evidence visible in cockpit | proposed |
| AP-OWNERSHIP-001 | Map repo, lane, task, agent, and worktree ownership | AgilePlus | DB-001 | ownership tree has no orphan tasks | proposed |
| SUB-PLANE-001 | Define Substrate runtime/compose contract | Substrate | POLY-CONTRACT-001 | service, ports, persistence, health, and dependency schema | ready |
| SUB-INTEGRATION-001 | Prove Substrate against the selected gateway and storage boundary | Substrate | SUB-PLANE-001, TR-CADDY-001 | cargo tests plus runtime health trace | proposed |
| SUB-EVIDENCE-001 | Publish Substrate artifacts into AgilePlus | Substrate/AgilePlus | SUB-INTEGRATION-001 | evidence row and cockpit state | proposed |
| AP-RELEASE-001 | Define release train across Go/Rust/TypeScript/Python edge lanes | AgilePlus | SUB-EVIDENCE-001, VERCEL-PROOF-001 | dependency-ordered release checklist | proposed |
| AP-RELEASE-002 | Execute one rehearsal release with rollback | AgilePlus | AP-RELEASE-001 | all gates and rollback artifact linked | proposed |

### Phase 6 — AgentInfra and aggregate gates

| ID | Task | Owner | Depends | Acceptance/evidence | State |
|---|---|---|---|---|---|
| AGENTINFRA-IMSG-001 | Repair and health-check the iMessage bridge | AgentInfra | — | health JSON, timeout behavior, and safe fallback | ready |
| AGENTINFRA-HOOK-001 | Make hook diagnostics non-blocking and actionable | AgentInfra | IMSG-001 | timeout never stalls work; decision output is captured | proposed |
| AGENTINFRA-PRIVACY-001 | Audit telemetry boundaries | AgentInfra | IMSG-001 | no raw gaze/camera/sensitive payloads; retention documented | proposed |
| GATE-AGG-001 | Build aggregate runner for Go/Rust/Node/Python/compose/Vercel | root/AgilePlus | POLY-CONTRACT-001 | exit codes, JSON artifacts, and lane mapping | ready |
| GATE-AGG-002 | Add changed-scope fast gate and full gate modes | root | GATE-AGG-001 | both modes produce compatible evidence schema | proposed |
| GATE-AGG-003 | Add failure classification: code, environment, credential, remote host | root | GATE-AGG-002 | no environment failure is reported as code pass | proposed |
| DEP-SEC-001 | Create secrets, env, SSH, and Tailscale policy matrix | root/AgentInfra | POLY-CONTRACT-001 | secret scan + least-privilege dry run | ready |
| DEP-SEC-002 | Add deploy preflight that fails fast on missing required secrets | DesktopDeploy | DEP-SEC-001 | deterministic preflight output and no partial mutation | proposed |
| QA-MATRIX-001 | Create requirement-to-test-to-evidence matrix for all six lanes | root/AgilePlus | GATE-AGG-001 | every critical task has an executable verifier | proposed |
| QA-MATRIX-002 | Add nightly/resume audit for stale evidence and drift | AgentInfra | QA-MATRIX-001 | machine report identifies changed source since evidence timestamp | proposed |

## Next execution slice (agent-ready)

1. `AGILEPLUS-DB-001` — seed the empty machine ledger with the six lanes and this DAG.
2. `OR-CADDY-001` + `TR-CADDY-001` — current-tree Caddy route/runtime proof.
3. `OR-WSLC-001` — recreate the missing Windows deploy script/docs from verified Tracera conventions.
4. `VERCEL-ID-001` — resolve phenotype-registry ownership before any production deploy.
5. `GATE-AGG-001` — emit machine-readable evidence for all current gates.
6. `DESKTOP-PARITY-001` — compare Apple OCI, Docker/OrbStack, and Windows WSLC once the first two runtime lanes are live.

## Required cockpit tick format

```text
[OmniRoute:◐, Tracera:✓, AgilePlus:○, DesktopDeploy:◐, Vercel:◐]

Progress
├─ Polyrepo contract   ##........ 20%  ETA: ...
├─ Runtime/deploy      ####...... 40%  ETA: ...
├─ Serverless/Vercel   ##........ 20%  ETA: ...
├─ AgilePlus evidence  #......... 10%  ETA: ...
└─ Aggregate QA        ##........ 20%  ETA: ...

DAG
POLY-CONTRACT-001 [wip] ...
AGILEPLUS-DB-001  [ready] ...

Agents
agent | task | state | summary

Next
- task ID + owner + evidence command
- blocker and unblock condition
```

## Expanded cockpit contract: grade, finish, and readable DAG/tree

Every cockpit tick MUST include both views below. Percentages are completion of
the project WBS, not confidence. `Finish` is an estimate based only on remaining
ready work; if an external dependency is unresolved, use `blocked` instead of a
fabricated date.

### Horizontal project strip

```text
┌──────────────┬──────────────┬──────────────┬────────────────┬──────────────┬──────────────┐
│ Project      │ Grade        │ Finish       │ Critical lane  │ Evidence     │ Owner        │
├──────────────┼──────────────┼──────────────┼────────────────┼──────────────┼──────────────┤
│ OmniRoute    │ B / 42% ◐    │ 3 slices    │ OR-WSLC-001    │ current      │ OmniRoute    │
│ Tracera      │ A / 68% ✓    │ 2 slices    │ TR-CADDY-001   │ recheck      │ Tracera      │
│ AgilePlus    │ C / 18% ○    │ 4 slices    │ DB-001         │ ledger empty │ AgilePlus    │
│ DesktopDeploy│ C / 31% ◐    │ blocked     │ SSH/WSLC       │ SSH proven   │ Deploy       │
│ Vercel       │ C / 29% ◐    │ 3 slices    │ VERCEL-ID-001  │ partial      │ Vercel       │
│ AgentInfra   │ B / 51% ◐    │ 2 slices    │ IMSG-001       │ degraded     │ Infra        │
└──────────────┴──────────────┴──────────────┴────────────────┴──────────────┴──────────────┘
```

The values above are a cockpit seed and must be replaced by ledger-derived
values on the next tick. The machine record for each project must contain:
`project_id`, `grade`, `percent_complete`, `finish_estimate`, `critical_task_id`,
`evidence_state`, `owner`, and `updated_at`.

### Vertical project subtrees

```text
OmniRoute  B / 42% ◐  finish: 3 slices
├─ OR-COMPOSE-001 [verified-history] ─┐
├─ OR-CADDY-001   [ready]             ├─▶ OR-RUNTIME-001 [proposed]
├─ OR-OCI-001     [ready]             ┘       └─▶ DESKTOP-PARITY-001 [ready]
└─ OR-WSLC-001    [ready] ───────────────▶ DEP-ROLLBACK-001 [proposed]

Tracera  A / 68% ✓  finish: 2 slices
├─ TR-GO-001      [verified-history] ─▶ VERCEL-GO-001 [ready]
├─ TR-GO-002      [verified-history] ─▶ TR-OBS-001 [proposed]
├─ TR-CADDY-001   [ready]             ─▶ TR-TLS-001 [proposed]
└─ TR-OBS-002     [proposed]          ─▶ GATE-AGG-001 [ready]

AgilePlus  C / 18% ○  finish: 4 slices
├─ AGILEPLUS-DB-001      [ready] ─▶ AGILEPLUS-DB-002 [proposed]
│                              └─▶ AGILEPLUS-COCKPIT-001 [ready]
├─ AGILEPLUS-DB-003      [proposed]
├─ AGILEPLUS-DB-004      [proposed] ─▶ AP-EVIDENCE-001 [proposed]
└─ AP-OWNERSHIP-001      [proposed]

DesktopDeploy  C / 31% ◐  finish: blocked
├─ DESKTOP-SSH-001       [ready] ─▶ DESKTOP-SSH-002 [verified-history]
│                              └─▶ OR-WSLC-001 [ready]
├─ DESKTOP-PARITY-001    [ready] ─▶ DESKTOP-INSTALL-001 [proposed]
└─ DEP-ROLLBACK-001      [proposed]  (blocked by deploy lane)

Vercel  C / 29% ◐  finish: 3 slices
├─ VERCEL-ID-001         [ready] ─▶ VERCEL-ID-002 [proposed]
│                              └─▶ VERCEL-ENV-001 [proposed]
├─ VERCEL-GO-001         [ready] ─▶ VERCEL-GO-002 [proposed]
└─ VERCEL-PROOF-001      [proposed] ─▶ VERCEL-PROOF-002 [proposed]

AgentInfra  B / 51% ◐  finish: 2 slices
├─ AGENTINFRA-IMSG-001   [ready] ─▶ AGENTINFRA-HOOK-001 [proposed]
│                              └─▶ AGENTINFRA-PRIVACY-001 [proposed]
└─ QA-MATRIX-002         [proposed] ─▶ GATE-AGG-002 [proposed]
```

Rendering rules:

- Horizontal rows answer “which project is closest to finish?” in one glance.
- Vertical branches answer “what is holding this project?” without flattening dependencies.
- `├─▶` is a dependency edge; indentation is ownership/tree structure; a task may appear in multiple trees when it is a cross-project join.
- A subtree task must show its stable ID, state, and evidence freshness; hidden child tasks are a cockpit defect.
- Percent complete is computed as weighted accepted tasks / total tasks, with critical-path tasks weighted higher; the weighting formula must be stored in the ledger.

## Merge protocol

Before merging into `work.md`, an agent must provide: (1) task IDs changed, (2) exact evidence artifacts, (3) current state transitions, (4) conflicts with other writers, and (5) whether the handoff remains consistent with the machine ledger. No prose-only completion claims.
