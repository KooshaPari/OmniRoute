# OmniRoute — Intent × Dimension Progress Tree

**Subject:** `KooshaPari/OmniRoute` @ `1bd237b0c0` (branch `main`)
**Observed:** 2026-10-17 by jcode

> **Generated file.** Rendered from `progress-tree.json` by
> `render-progress-tree.mjs`. Edit the JSON, then re-run the renderer.
> Verify with `node render-progress-tree.mjs --check`.

**Conventions.** `progress` is 0.0–1.0, or `null` when **UNKNOWN** — and
`null` means _no measurement exists_, never "probably fine".

- test counts != coverage
- commits != completed value
- agent count != product progress
- documentation != delivery
- LOC != semantics

---

## A. By dimension (CVP 8-state ladder, measured independently)

```
D1   IMPLEMENTED    █████████████████░░░     85%  src 583k + open-sse 383k dominate
D2   BUILDABLE      ██░░░░░░░░░░░░░░░░░░     10%  production build NEVER completed locally or in CI; runner killed mid-build
D3   REACHABLE      ████████████████████    100%
D4   EXERCISED      ████████████████░░░░     80%  10/10 journey steps; NO real completion (0 credentialed providers)
D5   VERIFIED       ░░░░░░░░░░░░░░░░░░░░      0%  no coverage artifact exists; floor 60% is INFORMATIONAL (.qgate.toml:7)
D6   PACKAGED       ░░░░░░░░░░░░░░░░░░░░      0%  no downloadable artifact
D7   INSTALLED      ░░░░░░░░░░░░░░░░░░░░      0%  never installed outside the repo
D8   RELEASED       ████░░░░░░░░░░░░░░░░     20%  30 releases exist; 1 of 100 sampled carries any asset
D9   ADOPTED        ░░░░░░░░░░░░░░░░░░░░      0%  no user validation; 16 stars; never user-tested
D10  SECURE         ███████░░░░░░░░░░░░░     33%  3 of 9 obligations MET; contract requires 100%
D11  DOCUMENTED     ██████████████░░░░░░     72%  strict docs PASS; 47 env vars undocumented locally
D12  OPERATIONAL    ██████░░░░░░░░░░░░░░     30%  runners not provisioned; npm publish broken
D13  ACCESSIBLE/UX  ???????????????????? UNKNOWN  NOT MEASURED
D14  COST/SCALE     ???????????????????? UNKNOWN  NOT MEASURED, not in scope
```

## B. By intent

```
G1   Canonical LLM router                   ████████████████░░░░     78%
     └─ G1.1    Provider breadth                       ████████████░░░░░░░░  {"models_registered":521,"providers_credentialed":0}
     └─ G1.2    Routing / fallback / combos            ████████████████░░░░  {"combos_present":["auto/best-coding","auto/best-reasoning","auto/best-fast","auto/best-vision",
     └─ G1.3    Compression (RTK+Caveman)              ████░░░░░░░░░░░░░░░░  {"stub_markers":62}
     └─ G1.4    MCP / A2A / Memory / CloudAgents / Guardrails ██████░░░░░░░░░░░░░░  {"code_exists":true,"exercised_e2e":false}
G2   Dashboard product                      ██████████████░░░░░░     70%
     └─ G2.1    API routes                             ████████████████████  {"count":704}
     └─ G2.2    Dashboard pages                        ████████████████████  {"count":121}
     └─ G2.3    SvelteKit pages                        ████████████████████  {"count":144}
     └─ G2.4    Authenticated reach                    ████████████████████  {"http":200}
     └─ G2.5    Visual / polish gate (GUI states)      ░░░░░░░░░░░░░░░░░░░░  {"states_exercised":0}
G3   Desktop                                ██░░░░░░░░░░░░░░░░░░     10%
     └─ G3.1    electron/                              ????????????????????  {"loc":2496,"tests":0,"in_workspace":false}
     └─ G3.2    desktop-electrobun/                    ????????????????????  {"loc":358,"source_files":1}
G4   Rust rewrite                           ████░░░░░░░░░░░░░░░░     22%
     └─ G4.1    real crates                            ????????????????????  {"omniroute-core":2467,"omniroute-storage":1447}
     └─ G4.2    partial                                ????????????????????  {"omniroute-cli":25}
     └─ G4.3    scaffolds                              ????????????????????  {"omniroute-api":14,"omniroute-bifrost":12,"omniroute-compression":12,"omniroute-mcp":12,"omniro
G5   Fork governance                        ████████████░░░░░░░░     60%
     └─ G5.1    policy documented                      ████████████████████  {"files":["UPSTREAM.md","UPSTREAM_SYNC.md"]}
     └─ G5.2    drift automation                       ████████████████████  {"workflow":"fork-drift-warning.yml"}
     └─ G5.3    sync currency                          █████████░░░░░░░░░░░  {"ahead":1021,"behind":92}
     └─ G5.4    policy accuracy                        ░░░░░░░░░░░░░░░░░░░░
     └─ G5.5    fork accepted as finished              ░░░░░░░░░░░░░░░░░░░░
```

## C. Security (contract: 100% required, not 85%)

**3 of 9 MET.**

| ID  | Obligation                 | State       | Evidence                                                                                        |
| --- | -------------------------- | ----------- | ----------------------------------------------------------------------------------------------- |
| S1  | session cookie flags       | **MET**     | login/route.ts:170-172 httpOnly+secure+sameSite                                                 |
| S2  | auth enforced              | **MET**     | /api/status 401 unauth; 200 authed                                                              |
| S3  | resurrection guard active  | **MET**     | KI-031 proven blocking                                                                          |
| S4  | secrets encrypted at rest  | **NOT MET** | encryption.ts:187 logs 'Storing plaintext (passthrough mode)' when STORAGE_ENCRYPTION_KEY unset |
| S5  | default credential changed | **NOT MET** | INITIAL_PASSWORD=CHANGEME                                                                       |
| S6  | per-resource authorization | **NOT MET** | no RBAC located; single shared management password                                              |
| S7  | dependency backlog cleared | **NOT MET** | 12 open Dependabot alerts                                                                       |
| S8  | container image verified   | **UNKNOWN** | 403, token lacks read:packages                                                                  |
| S9  | release integrity          | **NOT MET** | 1 of 100 releases carries assets                                                                |

## D. Assurance

| Family      | Files | Coverage    | Floor | Blocking |
| ----------- | ----: | ----------- | ----- | -------- |
| unit        |  5618 | **UNKNOWN** | 60%   | **no**   |
| integration |   132 | **UNKNOWN** | —     | **no**   |
| e2e         |    41 | **UNKNOWN** | —     | **no**   |
| mutation    |     — | **UNKNOWN** | —     | **no**   |

Disabled tests: **41** files with `.skip`/`.todo`.

Masked failure: `vitest.config.ts:94` — #8618 - pre-existing failure; remove this exclusion when fixed

## E. Operations

| Signal                     | Value                                                                                                                                                      |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| workflows                  | 71                                                                                                                                                         |
| ci_runs                    | true                                                                                                                                                       |
| ci_green                   | false                                                                                                                                                      |
| failing_jobs_last_observed | 17                                                                                                                                                         |
| required_checks            | 3                                                                                                                                                          |
| runners_available          | false                                                                                                                                                      |
| runner_evidence            | dispatch HTTP 422 'Actions has been disabled'; 7 runs queued at observation; npm job killed: 'runner has received a shutdown signal'; billing API HTTP 404 |
| release_notes_fixed        | true                                                                                                                                                       |
| npm_publish_working        | false                                                                                                                                                      |
| resurrection_guard_working | true                                                                                                                                                       |

## F. Roll-up

```
raw_implementation                     █████████████████░░░     85%
verified_engineering                   ░░░░░░░░░░░░░░░░░░░░      0%
usable_journeys                        ████████████████░░░░     80%
real_user_value                        ░░░░░░░░░░░░░░░░░░░░      0%
intent_weighted                        ████████████░░░░░░░░     58%
cvp_install_plus_one_completion        ███░░░░░░░░░░░░░░░░░     15%
```

CVP definition: _user installs OmniRoute and gets one real completion through it_

## G. Delta this session

| Dimension | Change                                                  | From | To  |
| --------- | ------------------------------------------------------- | ---- | --- |
| D12       | release notes FIXED (clean body, 0 ANSI, correct links) | 0    | 1   |
| D12       | CI alive after 10 days of startup_failure               | 0    | 1   |
| D12       | pnpm migration repaired in 5 workflows                  | 0    | 1   |
| D12       | required status checks set                              | 0    | 3   |
| D1        | client-bundle node:fs fix (all pages 500->200)          | —    | —   |
| D11       | llm.txt + 51 mirrors; strict docs PASS verified in CI   | —    | —   |
| D2        | standalone build cache added                            | —    | —   |

Lost: **none** · Retained: all prior capability

## H. Blockers

| ID  | Blocker                      | Consequence                                                 | Owner    | Unblock                                       |
| --- | ---------------------------- | ----------------------------------------------------------- | -------- | --------------------------------------------- |
| B1  | runner provisioning          | CI and releases queue-starved; npm publish killed mid-build | operator | resolve Actions capacity/billing for the repo |
| B2  | STORAGE_ENCRYPTION_KEY unset | provider keys stored plaintext                              | operator | openssl rand -base64 32                       |
| B3  | no provider credential       | gateway has 0 usable targets; no completion possible        | operator | add one provider key                          |
| B4  | INITIAL_PASSWORD=CHANGEME    | default credential                                          | operator | change it                                     |
| B5  | disk                         | was 100%/450MB; truncated 2 dependency files this session   | operator | keep >50 GiB free (currently 99 GiB)          |

## I. Evidence

- `curl /api/health -> 200`
- `curl /login -> 200 (745663 bytes)`
- `POST /api/auth/login -> 200 {"success":true}`
- `GET /api/v1/models -> 521 models`
- `POST /api/v1/chat/completions -> 503 ALL_TARGETS_SKIPPED poolSize 8`
- `find src/app/api -name route.ts -> 704`
- `find src/app -path '*(dashboard)*' -name page.tsx -> 121`
- `wc -l crates/omniroute-rs/crates/*/src/*.rs -> core 2467, storage 1447, 6 scaffolds 12-14`
- `gh api releases -> 30 tags, 1 of 100 with assets`
- `gh run list -> 7 queued, 88 completed`
- `rg stub markers open-sse/services/compression -> 62`
