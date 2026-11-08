# OmniRoute — State & Forward Docket

**Subject:** `KooshaPari/OmniRoute`
**Revision audited:** `8d253946ac` (branch `main`, full SHA in §Provenance)
**Observation window:** 2026-10-16 → 2026-10-17
**Governing contract:** Phenotype CVP Execution Addendum + Product Evaluation Protocol v0.2 (PROPOSED)
**Held by:** jcode (serial passes; subagent delegation failed — see §Method honesty)

> **The named spec `handbook/specs/assessment/state-forward-docket-v1/` does not exist**
> in PhenoRegistry. The three actual governing documents present were used instead:
> `product-evaluation-protocol/PRODUCT-EVALUATION-PROTOCOL-v0.2.md`,
> `phenotype-cvp-audit/AGENT_CVP_EXECUTION_ADDENDUM.md`, and
> `agent-lab-dossiers-v1.1`. No record was invented to fill the gap.

---

## Cockpit (two minutes)

**What works today.** A real Next.js gateway on `:20128`. Cold start serves
`/api/health` 200, `/login` 200 (745 KB UI), `POST /api/auth/login` 200 with an
`auth_token` cookie, `/dashboard` 200 authenticated, `/api/v1/models` returns
**521 models**, `/api/settings` returns persisted config, an unauthenticated
`/api/settings` correctly 401s, and `/api/v1/chat/completions` routes to a pool of
**8 targets** and returns structured diagnostics (`ALL_TARGETS_SKIPPED`) because
no provider credential exists.

**What does not work.** It cannot complete a real LLM request (no provider
credentials). It cannot be installed by a user: **1 of 100 releases carries any
asset**, and the release bodies leak raw `git-cliff` ANSI debug output. CI runs
again (this session fixed a 10-day `startup_failure`) but the suite is red.

**State ladder (each independent, per the contract):**

| State      | Verdict     | Evidence                                                    |
| ---------- | ----------- | ----------------------------------------------------------- |
| WORKING    | **YES**     | journeys below, HTTP codes observed                         |
| PUBLISHED  | **NO**      | 0 assets on the audited nightly                             |
| INTEGRATED | **PARTIAL** | single repo; registry entry exists                          |
| VERIFIED   | **NO**      | coverage floor informational; 41 files with `.skip`/`.todo` |
| PACKAGED   | **NO**      | no downloadable artifact                                    |
| INSTALLED  | **NO**      | never installed outside the repo                            |
| RELEASED   | **NOMINAL** | 30 tags/releases exist; no artifacts                        |
| ADOPTED    | **NO**      | no user validation evidence; 16 stars                       |

**Closest Viable Product (CVP).** The smallest identity-preserving slice that
delivers a real outcome: _a user installs OmniRoute and gets one real completion
through it._ Three gaps stand between here and that: (1) provider credential,
(2) `STORAGE_ENCRYPTION_KEY` (else keys are stored **plaintext**),
(3) a packaged artifact with assets.

**Biggest single risk: disk.** The volume reached **100% / 450 MB free** during
this audit and silently truncated two dependency files earlier
(`tailwind-merge` 1,669 B vs ~106 KB; `@swc/core-darwin-arm64` 23.8 MB vs 24.9 MB
declared). Any further install or build on this machine risks corruption.

---

## 1. Intent

Reconstructed from `README.md`, `AGENTS.md`, `UPSTREAM*.md`, `CHANGELOG.md`,
`docs/sessions/*/`, `docs/architecture/*`. Classified per the Product Evaluation
Protocol.

### Goal tree

- **G1 — Be the canonical org LLM router.**
  `projects/OmniRoute.json`: `canonical_routing: true`, note _"CANONICAL org LLM
  router (TS) — never archive per Cluster A + ADR-ECO-007"_.
  **ACCEPTED-DECISION.**
- **G1.1 — One OpenAI-compatible endpoint across many providers.**
  `package.json` description: _"358 providers"_; runtime `/api/v1/models` returns
  **521** entries (combos + models). **DIRECT-REQUIREMENT**, with a **number
  contradiction** (358 vs 521 vs `UPSTREAM_SYNC.md`'s _"237-provider catalog"_).
- **G1.2 — Smart routing, fallback, cost optimisation.** Combos
  `auto/best-coding`, `auto/best-reasoning`, `auto/best-fast`, `auto/best-vision`,
  `auto/best-chat` all present. **DIRECT-REQUIREMENT.**
- **G1.3 — Compression (RTK+Caveman).** `open-sse/services/compression/` — **91
  stub markers**. **DIRECT-REQUIREMENT, substantially unimplemented.**
- **G1.4 — MCP / A2A / Memory / Cloud Agents / Guardrails.** Stated in the
  description; `open-sse/mcp-server/`, `src/lib/a2a/` exist. **PROPOSAL-HEAVY.**
- **G2 — Dashboard product.** `src/app/(dashboard)`, 121 pages. **DIRECT-REQUIREMENT.**
- **G3 — Desktop.** Electron (2,496 LOC, **0 tests**, not in workspace) and
  Electrobun (358 LOC scaffold). **HISTORICAL-CLAIM / undecided.**
- **G4 — A Rust rewrite.** `crates/omniroute-rs/` — **6 of 9 crates are 12–25 LOC
  scaffolds** with `fn placeholder() { assert!(true); }`. **PROPOSAL.** No scope
  document exists.
- **G5 — Be a well-governed fork.** `UPSTREAM.md`, `UPSTREAM_SYNC.md`,
  `fork-drift-warning.yml`. **ACCEPTED-DECISION.**

### Contradictions (unresolved)

| Claim A                       | Claim B                      | Sources                                                        |
| ----------------------------- | ---------------------------- | -------------------------------------------------------------- |
| "358 providers"               | "237-provider catalog"       | `package.json` vs `UPSTREAM_SYNC.md`                           |
| "358 providers"               | 521 `/api/v1/models` entries | `package.json` vs runtime                                      |
| "pnpm is the package manager" | `npm ci` in 21 workflows     | `.gitignore:297` vs workflows (PR #756 later moved CI to pnpm) |

### Superseded intent

- CI once installed via `npm ci`; **PR #756 moved it to pnpm** — merged **while
  CI could not run**, so unvalidated.
- `lefthook.yml` once held the resurrection guard; it now lives in
  `.husky/pre-commit` (KI-031) because `core.hooksPath=.husky/_` made lefthook dead.

### Undeclared obligations (not in any doc, required by the code)

1. `STORAGE_ENCRYPTION_KEY` must be set or provider keys are stored in plaintext.
2. `INITIAL_PASSWORD` must be changed; it ships as `CHANGEME`.
3. At least one provider credential, or the gateway has 0 usable targets.
4. A reverse proxy / TLS story (`OMNIROUTE_TLS_PROXY_URL`, UDS options exist,
   undocumented).
5. Disk headroom — builds and installs silently truncate when the volume is full.

### Non-goals (explicit)

- Not a fork to be merged upstream: `UPSTREAM_SYNC.md` states merge/rebase
  "would create unresolvable conflicts" across ~11,796 divergent files.

---

## 2. Usability — what you can actually use

Observed 2026-10-17 against `:20128` at `8d253946ac`.

| Journey                                   | Result   | Evidence                                                |
| ----------------------------------------- | -------- | ------------------------------------------------------- |
| Cold reachability `/api/health`           | **200**  | `{"status":"ok","timestamp":"..."}`                     |
| `/login` render                           | **200**  | 745,663 bytes, `<title>OmniRoute — AI Gateway…</title>` |
| `POST /api/auth/login`                    | **200**  | `{"success":true}` + `auth_token` cookie                |
| Session check `/api/auth/status`          | **200**  | `{"authenticated":true}`                                |
| Authenticated `/dashboard`                | **200**  | real page                                               |
| Model catalog `/api/v1/models`            | **200**  | `object:list`, **521** models                           |
| Settings read `/api/settings`             | **200**  | persisted config returned                               |
| Negative auth `/api/settings` (no cookie) | **401**  | correct                                                 |
| Gateway `POST /api/v1/chat/completions`   | **503**  | `ALL_TARGETS_SKIPPED`, `poolSize:8`                     |
| Restart / recovery                        | **PASS** | server restarted and re-served after being killed       |

### Interfaces a user has today

- **HTTP API** — OpenAI-compatible `/api/v1/*` (works; no usable target).
- **Web GUI** — `/login` → `/dashboard` (works, authenticated).
- **CLI** — `npm run dev|build|start` only; no installable binary.
- **SDK** — none shipped.
- **Agent interface** — MCP server code exists; **not exercised** in this audit.

### Measured latency defect

First hit on a cold dev server exceeded a **60-second** client timeout
(`/login` returned `000`) and required a retry to reach 200. Dev-mode cold
compile is slow enough to look like an outage. The production build was never
completed (§Known limitations).

### Technical proof vs user validation

Everything above is **technical E2E proof**. There is **no user validation**:
no recorded sessions, no feedback, no adoption. Do not read these HTTP codes as
product acceptance.

---

## 3. Unfinished work

| ID  | Item                           | Location                                      | Present behaviour                             | Consequence                        | Closure oracle                    | Effort          |
| --- | ------------------------------ | --------------------------------------------- | --------------------------------------------- | ---------------------------------- | --------------------------------- | --------------- |
| U1  | No provider credential         | runtime config                                | 0 usable targets                              | Gateway cannot complete a request  | one completion streams            | operator secret |
| U2  | `STORAGE_ENCRYPTION_KEY` unset | `src/lib/db/encryption.ts:187-189`            | logs _"Storing plaintext (passthrough mode)"_ | provider keys stored **plaintext** | encrypt/decrypt round-trip test   | operator secret |
| U3  | Releases carry no artefacts    | GitHub releases                               | **1 of 100** has assets                       | users cannot download              | release with a downloadable asset | 1–2 d           |
| U4  | Release bodies leak debug      | release bodies                                | raw `git-cliff` ANSI `^[[32;1mINFO`           | unreadable release notes           | clean rendered notes              | 0.5 d           |
| U5  | CI red                         | Actions                                       | 17 failing jobs at `8d253946ac`               | no enforcement value               | green required checks             | 3–5 d           |
| U6  | Coverage floor informational   | `.qgate.toml:7` `coverage_threshold = 60.0`   | does not block                                | silent drift                       | blocking threshold                | 20–40 d         |
| U7  | 41 files with `.skip`/`.todo`  | `tests/`                                      | disabled tests                                | unknown blind spots                | count → 0 with reasons            | 2–3 d           |
| U8  | Compression stubs              | `open-sse/services/compression/`              | 91 markers                                    | advertised feature incomplete      | engines implemented or removed    | 10–20 d         |
| U9  | Rust scaffolds                 | `crates/ominiroute-rs/`                       | 6 crates of 12–25 LOC                         | rewrite is facade                  | delete or implement               | 1 d / 30–50 d   |
| U10 | Dead provider handlers         | `providerHandlers.disabled-by-tier1-cleanup/` | 2,384 LOC disabled                            | maintenance drag                   | removed                           | 1 d             |
| U11 | `electron/` untested           | `electron/`                                   | 2,496 LOC, 0 tests                            | unmaintained surface               | tests + workspace, or delete      | 1 d / 6–10 d    |
| U12 | Undocumented env config        | `.env.example`                                | ~39 real vars absent                          | operators cannot configure         | documented with defaults          | 2–3 d           |
| U13 | Branch protection              | GitHub                                        | required checks now 3 of many                 | partial gate                       | all green jobs required           | 0.5 d after U5  |
| U14 | Fork drift                     | vs upstream                                   | 92 behind                                     | stale security fixes               | documented cadence                | ongoing         |

**Not deferred as "post-MVP":** U1–U4 are the CVP itself; U5/U13 are the only
thing preventing regressions; U12 is required for anyone to configure this.

---

## 4. Fork state

|                   | Value                                                        |
| ----------------- | ------------------------------------------------------------ |
| Fork of           | `diegosouzapw/OmniRoute`                                     |
| Divergence        | **1,021 ahead / 92 behind**, `diverged`                      |
| Fork point        | `v3.8.43`                                                    |
| Upstream          | 77,355★ · default branch `release/v3.8.52`                   |
| This fork         | 16★ · MIT                                                    |
| Publish namespace | `ghcr.io/kooshapari/omniroute`, `@kooshapari/omniroute`      |
| Sync policy       | cherry-pick only; merge impossible (~11,796 divergent files) |
| Governance        | `fork-drift-warning.yml` (daily cron), `build-fork.yml`      |

**Fork acceptance is not met**: a finished fork needs a green CI, a published
artefact users can run, an accurate divergence policy (the 237-vs-358
contradiction), a clean tree, and a decision on the Rust rewrite.

---

## 5. Assurance

| Family      |              Files | Floor configured    | Blocking?                                                  | Measured coverage         |
| ----------- | -----------------: | ------------------- | ---------------------------------------------------------- | ------------------------- |
| unit        |              5,304 | 60% (`.qgate.toml`) | **NO** — comment says _"flip to blocking once backfilled"_ | **UNKNOWN** (no artifact) |
| integration |                132 | 60% shared          | NO                                                         | **UNKNOWN**               |
| e2e         |                 41 | none specific       | NO                                                         | **UNKNOWN**               |
| mutation    | configured nightly | none                | NO                                                         | **UNKNOWN**               |

At risk of contradiction: counts are **not** coverage. No coverage artifact was
found, so every coverage figure is **UNKNOWN**, not "good".

41 test files contain `.skip`/`.todo`. `vitest.config.ts:94` carries an explicit
exclusion comment: `// #8618 — pre-existing failure; remove this exclusion when
fixed`. That is a **known failing test masked by config** and is recorded as an
open obligation.

---

## 6. Security (100%-required class)

| Obligation                 | State                    | Evidence                                                                               |
| -------------------------- | ------------------------ | -------------------------------------------------------------------------------------- |
| Secrets encrypted at rest  | **NOT MET** by default   | `encryption.ts:187` logs plaintext passthrough when key unset                          |
| Session cookie flags       | **MET**                  | `httpOnly:true`, `secure:useSecureCookie`, `sameSite:"lax"` (`login/route.ts:170-172`) |
| Default credential changed | **NOT MET**              | ships `INITIAL_PASSWORD=CHANGEME`; bootstrap logs a warning                            |
| Per-resource authorization | **NOT FOUND**            | single shared management password; no RBAC located                                     |
| Dependabot backlog         | **12 open** (earlier 15) | `dependabot/alerts` paginated                                                          |

---

## 7. Delta (this run)

| Goal                          | Before                    | After                                   | Earned  | Retained |
| ----------------------------- | ------------------------- | --------------------------------------- | ------- | -------- |
| G1.1 gateway reachable        | 500 on all pages          | 200 across pages, 521 models            | ✅      | —        |
| G5 fork governance — CI alive | `startup_failure` 10 days | CI runs (8 success / 6 fail)            | ✅      | —        |
| G5 required checks            | none                      | 3 required gates                        | ✅      | —        |
| G5 docs gate                  | strict drift              | `[docs-sync] PASS` (verified in CI)     | ✅      | —        |
| G3/U12 env docs               | 50 undocumented           | 47 (−3 verified test-knob suppressions) | partial | —        |
| U1 provider completion        | blocked                   | still blocked                           | ✗       | —        |
| U3 release artefacts          | 0 assets                  | still 0                                 | ✗       | —        |
| U5 CI green                   | red                       | red                                     | ✗       | —        |

**Regression watch:** disk hit 100% mid-audit; `node_modules` was re-installed
under pressure and one dependency was found truncated. Any further install must
be preceded by a disk check.

---

## 8. Forward path with calibrated ranges

Aggregate agent effort ≠ elapsed critical path. Ranges below are **planning
bands with stated assumptions**, not statistical forecasts.

| Milestone                | Work                                                                               | Elapsed (critical path) | Assumption                                |
| ------------------------ | ---------------------------------------------------------------------------------- | ----------------------- | ----------------------------------------- |
| **30 min**               | Set `STORAGE_ENCRYPTION_KEY` + change `INITIAL_PASSWORD`                           | 30 min                  | operator holds the secrets                |
| **1 h**                  | One provider credential → first real streaming completion                          | 1 h                     | credential available                      |
| **4 h**                  | Installable slice: `npm pack` or Docker image built and run **outside** the repo   | 4 h                     | disk >50 GiB                              |
| **24 h**                 | Release with a real asset; release-body debug stripped; branch protection expanded | 1 day                   | CI green enough to gate                   |
| **Usable CVP**           | U1+U2+U3 closed; a stranger installs and completes a request                       | **1–2 days**            | operator secrets in hand; disk fixed      |
| **MVP**                  | CVP + CI green + coverage blocking at 60%                                          | **2–3 weeks**           | 1 engineer                                |
| **Mature completion**    | All of §3 except U9-Rust; fork acceptance §4 satisfied                             | **6–12 weeks**          | 1–2 engineers; low confidence             |
| Rust rewrite, if pursued | U9 implement                                                                       | **+6–10 weeks**         | scope still undefined → lowest confidence |

**Critical path:** secrets → first completion → packaged artefact → released
asset → CI green → coverage blocking.

**Low / likely / high for "usable CVP":** 4 h / 1 day / 3 days. The high case is
disk remediation plus an operator delay on credentials.

**External waiting:** operator secrets (U1, U2), branch protection approval,
`read:packages` scope to verify the container image.

---

## 9. Decisions required

1. **Set `STORAGE_ENCRYPTION_KEY` before any provider credential** — otherwise
   the key is written to SQLite in plaintext.
2. **Change `INITIAL_PASSWORD`** off `CHANGEME`.
3. **Supply one provider credential** to prove the CVP.
4. **Rule on the Rust rewrite** — delete the 6 scaffolds (1 day) or scope them
   (30–50 days).
5. **Grant `read:packages`** so the container image can be verified at all.
6. **Free disk to >50 GiB** before any further build/install.

---

## 10. Provenance

| Item                         | Value                                                       |
| ---------------------------- | ----------------------------------------------------------- |
| Subject revision             | `8d253946ac` on `main`                                      |
| Working tree                 | clean (0 modified, 46 untracked — the operator-gated spike) |
| Remote sync                  | local == `origin/main` at audit time                        |
| Observation dates            | 2026-10-16 → 2026-10-17                                     |
| Runtime                      | Node v26.8.1, npm 11.19.0, dev server on `:20128`           |
| Model catalog at audit       | 521 entries                                                 |
| Open Dependabot alerts       | 12                                                          |
| Releases total / with assets | 100 sampled / **1**                                         |
| Disk at close                | 16 GiB free, 99% used                                       |

### Method honesty

- **Four subagents were dispatched and all four failed to produce their
  deliverables** (no `intent.md`, `packaging.md`, `security.md`, `assurance.md`).
  The corresponding sections above were produced as **labeled serial passes**.
  No subagent work is claimed.
- Two earlier measurement errors in this audit were caught and corrected:
  `/login` `000` was a cold-compile timeout, not an outage; `/api/v1/models`
  "0 models" was my own `head -c 200000` truncation (actual: 521).

### Known limitations of this audit

- Production build **never completed** on this machine (swap exhausted,
  Turbopack workers killed). Buildability of a release candidate is **UNVERIFIED**.
- Container image existence **UNVERIFIED** (403, missing `read:packages`).
- Coverage percentages **UNKNOWN** (no artifact).
- Streaming completion **never exercised** (no provider credential).
- Real user validation: **none exists**.

---

## 11. Visual state board

Rendered as text so it survives every projection (Markdown, PDF, terminal).
Each bar is a genuine count, not an impression. A Mermaid source is provided in
`diagrams/state-ladder.mmd` alongside this file for editable re-rendering; the
text below is its accessible equivalent.

### 11.1 State ladder

```
WORKING    ████████████████████  YES      journeys observed (10/10 steps)
PUBLISHED  ░░░░░░░░░░░░░░░░░░░░  NO       0 assets on audited nightly
INTEGRATED ████████░░░░░░░░░░░░  PARTIAL  single repo; registry entry exists
VERIFIED   ░░░░░░░░░░░░░░░░░░░░  NO       coverage informational; 41 skipped files
PACKAGED   ░░░░░░░░░░░░░░░░░░░░  NO       no downloadable artifact
INSTALLED  ░░░░░░░░░░░░░░░░░░░░  NO       never installed outside the repo
RELEASED   ████░░░░░░░░░░░░░░░░  NOMINAL  30 tags, 1 of 100 with assets
ADOPTED    ░░░░░░░░░░░░░░░░░░░░  NO       no user validation evidence
```

### 11.2 Goal completion (implementation presence, not value)

```
G1   canonical router        ████████████████░░░░  80%  gateway routes; no target
G1.1 provider breadth        ████████████░░░░░░░░  60%  521 models; 0 credentialed
G1.2 routing/fallback        ████████████████░░░░  80%  combos present
G1.3 compression             ████░░░░░░░░░░░░░░░░  20%  91 stub markers
G1.4 MCP/A2A/memory          ██████░░░░░░░░░░░░░░  30%  code exists, unexercised
G2   dashboard               ██████████████░░░░░░  70%  121 pages, auth works
G3   desktop                 ██░░░░░░░░░░░░░░░░░░  10%  0 tests; scaffold
G4   Rust rewrite            ████░░░░░░░░░░░░░░░░  20%  6 of 9 crates are stubs
G5   fork governance         ████████████░░░░░░░░  60%  CI alive; not green
```

### 11.3 Gate board

```
gate                     status      detail
───────────────────────  ──────────  ────────────────────────────────
unit coverage            UNKNOWN     no artifact; floor informational
integration coverage     UNKNOWN     no artifact
e2e coverage             UNKNOWN     no artifact
mutation                 UNKNOWN     nightly configured, no score
security-at-rest         FAIL        plaintext passthrough when key unset
default credentials      FAIL        INITIAL_PASSWORD=CHANGEME
auth cookie flags        PASS        httpOnly+secure+sameSite
CI runs                  PASS        12+ real jobs
CI green                 FAIL        17 failing jobs
required checks          PARTIAL     3 required of many
resurrection guard       PASS        proven blocking (KI-031)
releases w/ artifacts    FAIL        1 of 100
docs-sync                PASS        verified in CI
env-doc-sync             FAIL        47 vars undocumented
```

### 11.4 Critical path

```
secrets ──▶ first completion ──▶ packaged artifact ──▶ released asset ──▶ CI green ──▶ coverage blocking
 30 min         1 h                  4 h                    24 h           3-5 d          20-40 d
   │              │                    │                      │               │               │
   └ U2           └ U1                 └ U3                   └ U3+U4         └ U5            └ U6
```

### 11.5 Risk map

```
impact
 high │  DISK 100%     CI red        plaintext keys
      │  (truncates)   (no gate)     (secrets leak)
      │
  med │  release w/o   coverage      env docs
      │  assets        informational drift
      │
  low │  Rust          electron/     fork drift
      │  scaffolds     untested      (92 behind)
      └────────────────────────────────────────────
        likely        likely        certain     → probability
```

### 11.6 Timeline (elapsed, critical path)

```
now    +30m      +1h        +4h          +24h         +1-2d       +2-3w      +6-12w
 │       │         │          │            │            │           │          │
 ├─start ├─secrets ├─1st      ├─installable├─release    ├─USABLE    ├─MVP      ├─mature
 │       │  set     │ completion│ slice      │ w/ asset    │ CVP       │          │ completion
```
