# WBS / Traceability Audit

Status: `wip`  
Audit ID: `AUDIT-WBS-2026-07-12-001`  
Scope: repository-level work control plane, organization/project WBS, gap/QA traceability, and machine status synchronization.

## Top Bracket

`[OmniRoute:◐, Tracera:◐, AgilePlus:◐, Civis:!, WorkDB:⚠, Deploy:◐]`

## Evidence Snapshot

| surface                  | observed state                                                                                                                                                       | evidence                                                              | grade                       |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- | --------------------------- |
| `work/WORK.md`           | Text ledger has a cross-repo DAG, 75 concrete tasks, 7 WBS rows, 7 gap rows, and an evidence log                                                                     | `wc -l work/WORK.md`; `rg '^\- \[ \] T                                | ^\| WBS-                    | ^\| GAP-      | ^\| 2026-' work/WORK.md` | B-                                             |
| `work/agileplus-work.db` | Schema supports projects, modules, features, work packages, dependencies, evidence, audit events, snapshots, policies, metrics, and devices                          | `sqlite3 work/agileplus-work.db '.tables'`; `sqlite_master` query     | A (schema) / F (population) |
| WorkDB population        | No rows returned from `features` and related control-plane tables during this audit                                                                                  | `sqlite3 work/agileplus-work.db 'select count(*) from features; ...'` | F                           |
| Unique handoff           | `2026-07-04-tracera-agileplus-native-oci-handoff.md` is not present in this checkout                                                                                 | `rg --files work`                                                     | ❌ missing                  |
| Cross-repo ownership     | Ledger names OmniRoute, Tracera, AgilePlus, Civis, BytePort, and pheno but has no canonical repo inventory with branch, path, owner, or grade                        | `sed -n '1,220p' work/WORK.md`                                        | C                           |
| Status machine           | Text states are documented, but there is no verified sync/check command connecting Markdown rows to WorkDB rows                                                      | `rg -n 'sync                                                          | workdb                      | work_packages | audit_log                | evidence' work . --glob '!**/node_modules/**'` | D   |
| Gap/QA matrix            | Existing matrix covers seven queue/cockpit gaps, but not Python retirement, Bun TS7, native OCI, Vercel, desktop installs, Caddy/Tailscale, or end-to-end deployment | `rg -n '^\| GAP-' work/WORK.md`                                       | C                           |

## Findings

1. **P1 — dual sources of truth.** Markdown is populated; the SQLite control plane is structurally ready but empty. A cockpit cannot claim machine traceability until every active task has a durable feature/work-package/evidence identity.
2. **P1 — missing artifact continuity.** The referenced unique handoff is absent from the current sparse checkout. Historical claims must be downgraded until recovered from git or re-created from command evidence.
3. **P1 — missing organization index.** There is no one-line repo bracket source containing repo path, branch/commit, owner, lifecycle grade, runtime ownership, and deployment state.
4. **P1 — incomplete objective coverage.** The current ledger emphasizes OmniRoute queue and historical AgilePlus cockpit work. It does not cover the requested Tracera FR audit, Python-core retirement, Bun TS7 preview, native Apple/WSL OCI, Vercel, home-desktop deployment, Caddy/Tailscale, or local client installation as a traceable WBS.
5. **P2 — evidence semantics are underspecified.** `evidence` has `fr_id`, type, artifact path, and metadata, but no checksum, command exit code, commit SHA, or freshness/expiry field. Stale evidence can therefore be mistaken for current proof.
6. **P2 — ownership is text-only.** `work_packages.agent_id` exists, but there is no owner registry or claim/release protocol that prevents two agents from editing the same file scope.
7. **P2 — QA is not requirement-complete.** Existing gaps are queue-oriented; no matrix rows bind each FR to implementation, test, deployment, security, performance, and rollback-free migration evidence.
8. **P2 — no automated drift gate is visible.** There is no checked-in command that fails when a Markdown task lacks a WorkDB row, when a WorkDB row lacks evidence, or when an `ok` claim is older than its freshness window.

## Required Control-Plane Shape

```text
ORG-INDEX (repo ownership + grades)
  -> PROJECT (Tracera | AgilePlus | OmniRoute | Civis | BytePort | pheno)
    -> FEATURE / FR
      -> WORK PACKAGE
        -> DEPENDENCY EDGE
        -> QA/GAP MATRIX ROW
        -> EVIDENCE (command + exit + artifact + sha + timestamp)
          -> AUDIT EVENT (hash chained)
            -> SNAPSHOT / COCKPIT TICK
```

`work/WORK.md` remains the operator-readable ledger. `work/agileplus-work.db` is the machine
state. A verifier must make both agree before a task can be shown as `ok`.

## Append-Only Repair WBS

These IDs are intentionally new and do not overwrite existing `T001`-`T075` or `WBS-001`-
`WBS-007` rows. They are proposed for the next merge into `work/WORK.md` and WorkDB.

| id          | phase           | owner           | state | depends_on              | deliverable                                 | acceptance / evidence                                                                                                                  |
| ----------- | --------------- | --------------- | ----- | ----------------------- | ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| AUD-WBS-001 | control-plane   | root            | todo  | -                       | Canonical repo ownership index              | `work/repos-index.json` validates; each repo has path, branch, HEAD, owner, grade, runtime, deploy state                               |
| AUD-WBS-002 | control-plane   | root            | todo  | AUD-WBS-001             | Markdown↔SQLite identity map                | Every active `T*`, `WBS-*`, `GAP-*`, and `FR-*` row has a stable WorkDB ID; duplicate IDs fail verifier                                |
| AUD-WBS-003 | control-plane   | root            | todo  | AUD-WBS-002             | WorkDB population/import                    | `projects`, `modules`, `features`, `work_packages`, and `wp_dependencies` have rows matching the ledger; import is idempotent          |
| AUD-WBS-004 | control-plane   | root            | todo  | AUD-WBS-003             | Evidence writer/verifier                    | Each `ok` transition stores command, exit code, artifact path, SHA, timestamp, and freshness; stale evidence downgrades state          |
| AUD-WBS-005 | control-plane   | root            | todo  | AUD-WBS-004             | Cockpit tick generator                      | One command emits top bracket, tree bars, DAG, agent table, and next actions from WorkDB, not hand-counted prose                       |
| AUD-WBS-006 | control-plane   | root            | todo  | AUD-WBS-005             | Drift CI gate                               | CI/local gate exits nonzero for orphan Markdown rows, orphan WorkDB rows, missing evidence, invalid dependencies, or stale `ok` claims |
| AUD-WBS-007 | org-audit       | root            | todo  | AUD-WBS-001             | Organization/project grade rubric           | Grade each repo on build, tests, lint, security, deploy, ownership, and evidence freshness with weighted score                         |
| AUD-WBS-008 | org-audit       | root            | todo  | AUD-WBS-007             | Cross-project dependency graph              | Graph records ownership and runtime edges: Tracera↔AgilePlus↔OmniRoute↔Civis↔BytePort↔pheno                                            |
| AUD-WBS-009 | tracera-audit   | Tracera owner   | todo  | AUD-WBS-003             | FR inventory and QA matrix                  | Every Tracera FR maps to source, test, security/perf checks, owner, state, and evidence artifact                                       |
| AUD-WBS-010 | tracera-runtime | Tracera owner   | todo  | AUD-WBS-009             | Python-core retirement boundary             | Inventory Python modules; classify as Rust/Go/Zig/Mojo core or minimal FastMCP/edge; removal criteria are test-backed                  |
| AUD-WBS-011 | agileplus-audit | AgilePlus owner | todo  | AUD-WBS-003             | AgilePlus FR/gap closure matrix             | Cargo/API/DB/OCI/client gaps map to implementation and current command evidence                                                        |
| AUD-WBS-012 | ts7-preview     | frontend owner  | todo  | AUD-WBS-003             | Bun TS7 preview matrix                      | Bun/tsgo/oxlint/oxc/TS7 preview claims map to scripts, lockfile, tests, and compatibility evidence                                     |
| AUD-WBS-013 | native-oci      | platform owner  | todo  | AUD-WBS-011             | Apple Container + WSL OCI deployment matrix | Build, run, health, restart, logs, ports, and image digest captured for macOS and Windows WSL native OCI                               |
| AUD-WBS-014 | edge-deploy     | deploy owner    | todo  | AUD-WBS-013             | Caddy/Tailscale/Vercel matrix               | Caddy routes, Tailscale/OpenSSH transport, Vercel build/functions, and health checks are separately evidenced                          |
| AUD-WBS-015 | clients         | desktop owner   | todo  | AUD-WBS-014             | macOS/Windows client install matrix         | Install, launch, first-run, update, uninstall, and health evidence for each local desktop/client surface                               |
| AUD-WBS-016 | qa              | QA owner        | todo  | AUD-WBS-009,AUD-WBS-011 | Risk-weighted regression plan               | P0/P1 gaps have tests; aggregate gate, focused gates, security scan, performance baseline, and deploy smoke are recorded               |
| AUD-WBS-017 | recovery        | root            | todo  | AUD-WBS-002             | Recover or recreate missing unique handoff  | Git search either restores the handoff or a new evidence-backed handoff replaces it with provenance note                               |
| AUD-WBS-018 | publication     | root            | todo  | AUD-WBS-006,AUD-WBS-016 | Release/handoff bundle                      | Green evidence bundle, changed-file review, deployment URLs, client install status, and next-owner assignments                         |

## Gap / QA Matrix Additions

| gap_id | invariant | severity | owner | verification | exit condition |
| GAP-TRACE-001 | Markdown and WorkDB represent the same active task set | P1 | root | `python tools/verify_work_traceability.py` | verifier exit 0 |
| GAP-TRACE-002 | Every `ok` claim has fresh, immutable command evidence | P1 | root | `sqlite3 work/agileplus-work.db` + evidence verifier | no missing checksum/exit/timestamp |
| GAP-TRACE-003 | Every repo has one owner, branch/HEAD, runtime grade, and deploy state | P1 | root | repo index validator | no unowned or duplicate repo entries |
| GAP-TRACE-004 | Tracera FRs map to code, tests, and migration/runtime boundary | P1 | Tracera owner | FR inventory + focused/full test commands | 100% FR rows have evidence or explicit blocked state |
| GAP-TRACE-005 | AgilePlus native OCI paths are reproducible on Apple and WSL | P1 | platform owner | build/run/health/restart/log command bundle | both platforms pass or documented external blocker |
| GAP-TRACE-006 | Vercel functions and home-desktop deployment are independently proven | P1 | deploy owner | Vercel build/deploy health + OpenSSH/pheno health | both surfaces return expected health and version |
| GAP-TRACE-007 | Python remains only in approved edge/FastMCP modules | P1 | Tracera owner | dependency graph + import allowlist check | no unapproved Python core dependency |
| GAP-TRACE-008 | Local desktop clients install and report first-run health | P2 | desktop owner | install/launch/update smoke scripts | each supported OS has a passing artifact |
| GAP-TRACE-009 | Agent ownership and file scopes are machine-visible | P2 | root | WorkDB agent/worktree/file-scope query | no overlapping active scopes without explicit dependency |
| GAP-TRACE-010 | Stale claims are downgraded automatically | P2 | root | freshness verifier against timestamps | no expired `ok` claim remains `ok` |

## Immediate Sequencing

```text
AUD-WBS-001 -> AUD-WBS-002 -> AUD-WBS-003 -> AUD-WBS-004 -> AUD-WBS-005 -> AUD-WBS-006
                                      |          |
                                      v          v
                               AUD-WBS-007   AUD-WBS-017
                                      |
             +------------------------+-------------------------+
             v                        v                         v
       AUD-WBS-009              AUD-WBS-011                AUD-WBS-012
             |                        |                         |
             v                        v                         v
       AUD-WBS-010              AUD-WBS-013                AUD-WBS-016
                                      |
                                      v
                               AUD-WBS-014 -> AUD-WBS-015 -> AUD-WBS-018
```

## Machine Handling Rules

- Do not mark this audit `ok` until the verifier and WorkDB import exist and pass.
- Do not merge this file into `work/WORK.md` automatically; the operator requested one-by-one merge.
- When merged, preserve these IDs exactly and append evidence events rather than rewriting history.
- Any task without a current evidence artifact is `todo`, `wip`, or `blocked`, never `ok`.
- A missing repo or handoff is a traceability gap, not proof that the work was never done.

## Audit Conclusion

The repository has a strong human-readable ledger and a promising tamper-evident SQLite schema, but
it is not yet one machine-traceable control plane. The highest-value next action is to build the
Markdown↔WorkDB identity/import/verifier path, then populate the missing organization and
Tracera/AgilePlus/deployment matrices. This report is the unique audit artifact for later operator
merge into `work/WORK.md`.
