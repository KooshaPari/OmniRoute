# OmniRoute Fork Evolution DAG — `omni-evolve`

> **Indefinitely followable, indefinitely extendable, sub-agent-parallelizable**
> plan for the OmniRoute fork after the v8.1 Bifrost Tier-1 track closure
> (2026-06-25, commits `57ba29067` + `16032fec1`).

---

## 0. How to read this document

This is a **living DAG**, not a one-shot plan. It has three stable top-level
sections and three dynamic ones:

| Section | Stability | Update cadence |
|---|---|---|
| §1 Topology (streams + phases) | **Stable shape** | New streams/phases appended; existing nodes rarely renamed |
| §2 Streams | **Living** | Leaf nodes added/closed continuously |
| §3 Resume protocol | **Stable** | Pattern, not content |
| §4 Sub-agent dispatch protocol | **Stable** | Pattern + templates |
| §5 Current state snapshot | **Dynamic, top of file** | Updated each session |
| §6 Recent activity log | **Rolling, bottom of file** | Append-only, oldest pruned after 30 entries |

### Node status legend

| Marker | State |
|---|---|
| `[ ]` | Pending — not started, no blocker |
| `[/]` | In progress — assigned, work underway |
| `[x]` | Done — committed, worklog written, status updated |
| `[~]` | Blocked — explicit dep or external factor |
| `[!]` | Escalated — needs operator decision |
| `[?]` | Speculative — not yet researched |

### Edge notation

- `A → B` means B cannot start until A is `[x]`
- `A ⇉ B` (double arrow) means A unblocks B *but* B can run before A finishes
- `A ∥ B` means A and B are independent and can run in parallel
- `A ⊕ B` means B is alternative work to A (pick one)

---

## 1. Topology (stable shape)

```
                              ┌─────────────────────────────┐
                              │  omni-evolve (evergreen)    │
                              └──────────────┬──────────────┘
                                             │
       ┌─────────┬─────────┬─────────┬───────┼───────┬─────────┬─────────┬─────────┐
       ▼         ▼         ▼         ▼       ▼       ▼         ▼         ▼         ▼
     S1        S2        S3        S4      S5      S6        S7        S8        S9
   Bifrost   A2A/MCP   OperSec  Sync    Cost    Resilience  DX      DEBT     Archive
   Router    Skills    Hard.    Upstr.  Quota   & Drift    Infra   Burndown Recovery
   (post-B9)                         Billing
       │         │         │         │       │       │         │         │         │
       ▼         ▼         ▼         ▼       ▼       ▼         ▼         ▼         ▼
   P1a..P1n   P2a..P2n  P3a..P3n P4a..   P5a..  P6a..     P7a..    P8a..    P9a..
   (phases)   (phases)  (phases)  P4n     P5n    P6n       P7n      P8n      P9n
       │         │         │         │       │       │         │         │         │
       ▼         ▼         ▼         ▼       ▼       ▼         ▼         ▼         ▼
   L1a..L1n   L2a..L2n  L3a..L3n L4a..   L5a..  L6a..     L7a..    L8a..    L9a..
   (leaves,   (leaves)  (leaves)  L4n     L5n    L6n       L7n      L8n      L9n
    PR-sized)
```

**Invariant**: streams are independent. Phases within a stream have explicit
edges. Leaves within a phase have explicit edges. New leaves can be appended
under any phase without restructuring the graph.

---

## 2. Streams

Each stream entry contains:
- **Stream ID**: `S<n>`
- **Definition of done (DoD)**: what "evergreen complete" looks like
- **Phases**: ordered list (P<n><letter>)
- **Current state snapshot**: where we are right now (updated each session)
- **Leaves**: PR-sized tasks (L<n><letter><n>)

---

### S1 — Bifrost Tier-1 Router (post-B9)

**DoD**: Bifrost v8.1 (B1–B9) is in production with auto-fallback, virtual keys,
cost tracking, traffic shadow, and migration playbook. Post-B9 hardening (B10+)
extends the router with new features as Bifrost upstream evolves.

**Phases**:

| Phase | Name | Status |
|---|---|---|
| **P1a** | v8.1 closeout (B1–B9) | `[x]` (L5-109..119) |
| **P1b** | B5+ executor-side model cache strict mode | `[ ]` |
| **P1c** | chatCore.ts integration of `dispatchBifrostWithFallback` | `[ ]` |
| **P1d** | Traffic-shadow rollout (5% → 25% → 100%) | `[ ]` |
| **P1e** | B10: Bifrost semantic cache integration | `[ ]` |
| **P1f** | B11: Bifrost MCP client (use Bifrost's MCP server for tool routing) | `[ ]` |
| **P1g** | B12: Bifrost virtual-key UI polish + cost dashboards | `[ ]` |

**Leaves**:

| ID | Phase | Title | Status | Depends | L5-NNN |
|---|---|---|---|---|---|
| **L1a** | P1c | chatCore.ts: replace direct `getExecutor()` call sites for Bifrost-flagged providers with `dispatchBifrostWithFallback()` | `[ ]` | — | L5-120 (planned) |
| **L1b** | P1c | Add integration test: kill switch trips → fallback path used, no 500 to user | `[ ]` | L1a | L5-121 |
| **L1c** | P1b | `BifrostBackendExecutor.execute()` consults `bifrost_models` cache; add `BIFROST_MODEL_CACHE_REQUIRED` (default 0) + `BIFROST_MODEL_CACHE_REFRESH_ON_MISS` (default 0) env toggles | `[ ]` | — | L5-122 |
| **L1d** | P1b | Tests for cache strict mode: cache-miss throws, cache-hit proceeds, refresh-on-miss populates + retries | `[ ]` | L1c | L5-123 |
| **L1e** | P1d | Production shadow: 5% Bifrost traffic for 7 days, watch SLO dashboard, then 25%, then 100% | `[ ]` | L1a, L1c | L5-130 |
| **L1f** | P1e | Wire `bifrostSemanticCache` lookup into executor.execute() before fetch | `[ ]` | L1a | L5-140 |
| **L1g** | P1f | Map OmniRoute MCP tools → Bifrost MCP client (when Bifrost `/mcp` is exposed) | `[ ]` | L1a | L5-150 |
| **L1h** | P1g | Cost dashboard widget in `/dashboard/endpoint`: per-provider Bifrost cost, savings vs legacy | `[ ]` | L1a | L5-160 |

---

### S2 — A2A/MCP Skill Surface

**DoD**: All 8 A2A skills implemented (currently 0/8 stubs cleared per L5-119 audit),
20+ MCP tools registered with Zod validation, skill marketplace / plugin system
shipped.

**Phases**:

| Phase | Name | Status |
|---|---|---|
| **P2a** | DEBT-006 closeout (providerDiscovery, listCapabilities, agentDispatch stubs → impl) | `[x]` (audit found all 8 implemented as of L5-119) |
| **P2b** | MCP tool surface expansion (target 100+ tools) | `[ ]` |
| **P2c** | A2A skills marketplace (DB-backed registry, enable/disable UI) | `[ ]` |
| **P2d** | Plugin system GA (currently experimental) | `[ ]` |

**Leaves**:

| ID | Phase | Title | Status | Depends | L5-NNN |
|---|---|---|---|---|---|
| **L2a** | P2b | MCP tool: `combo_dry_run` — simulate routing decision without executing | `[ ]` | — | L5-200 |
| **L2b** | P2b | MCP tool: `cost_forecast` — project monthly cost given current trajectory | `[ ]` | L1h | L5-201 |
| **L2c** | P2b | MCP tool: `provider_slo_status` — return current SLO state per provider | `[ ]` | S6 | L5-202 |
| **L2d** | P2c | A2A skill: `policy_dry_run` — preview policy decision (DEBT-006 follow-up) | `[ ]` | — | L5-210 |
| **L2e** | P2c | A2A skill: `routing_replay` — replay past combo routing decisions for debugging | `[ ]` | — | L5-211 |
| **L2f** | P2d | Plugin loader: read `plugins/*.ts` from `DATA_DIR`, validate Zod schema, hot-load | `[ ]` | — | L5-220 |

---

### S3 — Operational Security & Hardening

**DoD**: All hook chains passing, secret-scan clean, SBOM generated, dependabot
green, audit-ratchet score ≥ 2.0 (current: 1.97 per PR #85).

**Phases**:

| Phase | Name | Status |
|---|---|---|
| **P3a** | Hook chain port to lefthook (DEBT-002) | `[x]` (commit `a556e1bba`) |
| **P3b** | SBOM + security scan workflows | `[x]` (commit from PR #96) |
| **P3c** | Audit-ratchet closure (target: 2.0) | `[ ]` |
| **P3d** | Secret-scan expansion (custom patterns for KP-specific tokens) | `[ ]` |

**Leaves**:

| ID | Phase | Title | Status | Depends | L5-NNN |
|---|---|---|---|---|---|
| **L3a** | P3c | Address audit-71-pillar remediation backlog (3 remaining P1 items) | `[ ]` | — | L5-300 |
| **L3b** | P3c | Add `lefthook.yml` cycle-check job to CI (run on PR, not just local) | `[ ]` | — | L5-301 |
| **L3c** | P3d | Extend `secret-scan` to detect Anthropic/OpenAI/Gemini key prefixes | `[ ]` | — | L5-310 |
| **L3d** | P3d | Add `git-secrets` style hooks for KP internal tokens (KP_API_*, KP_INT_*) | `[ ]` | — | L5-311 |
| **L3e** | P3b | SBOM: add per-PR diff comment showing new dependencies | `[ ]` | — | L5-320 |

---

### S4 — Upstream Sync

**DoD**: OmniRoute fork stays within 200 commits of `diegosouzapw/OmniRoute`
while preserving fork-only modules (Bifrost executor, kill switch, audit doc).

**Phases**:

| Phase | Name | Status |
|---|---|---|
| **P4a** | Initial absorb (rebase main onto upstream) | `[x]` (multiple `chore/absorb-*` branches) |
| **P4b** | Continuous sync (weekly rebase) | `[ ]` |
| **P4c** | Conflict resolution policy (fork-only modules take precedence) | `[ ]` |

**Leaves**:

| ID | Phase | Title | Status | Depends | L5-NNN |
|---|---|---|---|---|---|
| **L4a** | P4b | Schedule weekly rebase cron (or workflow) | `[ ]` | — | L5-400 |
| **L4b** | P4b | Document conflict policy in `CONTRIBUTING.md` | `[ ]` | — | L5-401 |
| **L4c** | P4c | Codify fork-only file list in `.gitattributes` (mark with `export-ignore` for upstream PRs) | `[ ]` | — | L5-410 |
| **L4d** | P4c | Pre-rebase script that warns about impending conflicts in fork-only files | `[ ]` | L4c | L5-411 |

---

### S5 — Cost / Quota / Billing

**DoD**: Per-request cost attribution, monthly cost forecasts, virtual-key billing,
quota enforcement with TPM/TPD buckets.

**Phases**:

| Phase | Name | Status |
|---|---|---|
| **P5a** | Cost sync from LiteLLM | `[x]` (`src/lib/pricingSync.ts`) |
| **P5b** | Cost tracking in combo routing | `[x]` (per L5-109 cherry-pick) |
| **P5c** | Virtual-key UI + cost dashboards (B5) | `[x]` (PR #90) |
| **P5d** | Quota enforcement (TPM/TPD token buckets) | `[ ]` (DEBT-001) |
| **P5e** | Cost export to CSV/Parquet for accounting | `[ ]` |

**Leaves**:

| ID | Phase | Title | Status | Depends | L5-NNN |
|---|---|---|---|---|---|
| **L5a** | P5d | Token bucket per API key: TPM (tokens/min) + TPD (tokens/day) | `[ ]` | — | L5-500 |
| **L5b** | P5d | Quota dashboard in `/dashboard/endpoint` | `[ ]` | L5a | L5-501 |
| **L5c** | P5d | A2A `quotaManagement` skill: query/reset per-key quota | `[ ]` | L5a | L5-502 |
| **L5d** | P5e | Export endpoint: `GET /api/v1/usage/export?format=csv&from=2026-06-01` | `[ ]` | — | L5-510 |
| **L5e** | P5e | Parquet export via duckdb-wasm (browser-side query) | `[ ]` | L5d | L5-511 |

---

### S6 — Resilience & Drift Detection

**DoD**: Per-provider SLO tracking, auto-fallback on degradation, drift detection
between upstream catalog and local catalog, circuit breakers on persistent 5xx.

**Phases**:

| Phase | Name | Status |
|---|---|---|
| **P6a** | Rate limit manager | `[x]` (`open-sse/services/rateLimitManager.ts`) |
| **P6b** | Account fallback | `[x]` (`open-sse/services/accountFallback.ts`) |
| **P6c** | Bifrost kill switch (B9) | `[x]` (L5-118 + L5-119) |
| **P6d** | Circuit breaker on persistent 5xx | `[ ]` |
| **P6e** | Catalog drift detection (upstream ↔ local) | `[ ]` |

**Leaves**:

| ID | Phase | Title | Status | Depends | L5-NNN |
|---|---|---|---|---|---|
| **L6a** | P6d | Circuit breaker: 10 consecutive 5xx → open, exponential backoff close | `[ ]` | — | L5-600 |
| **L6b** | P6d | Per-provider error rate tracking window (5min sliding) | `[ ]` | L6a | L5-601 |
| **L6c** | P6e | Daily job: compare `src/shared/constants/providers.ts` against upstream `diegosouzapw/OmniRoute/providers.ts` | `[ ]` | — | L5-610 |
| **L6d** | P6e | Drift report posted to dashboard banner when divergence > 5% | `[ ]` | L6c | L5-611 |

---

### S7 — DX / Dev Infrastructure

**DoD**: Type safety end-to-end, fast test feedback loop, MCP/A2A client SDK
ergonomic, CLI tooling for common ops.

**Phases**:

| Phase | Name | Status |
|---|---|---|
| **P7a** | Zod schemas everywhere | `[x]` (per AGENTS.md) |
| **P7b** | Vitest baseline functional | `[ ]` (`@vitejs/plugin-react` missing) |
| **P7c** | CLI for common ops (rotate-keys, trigger-bifrost, dump-cache) | `[ ]` |
| **P7d** | Type-safe SDK (Python, Go, Rust) | `[ ]` |

**Leaves**:

| ID | Phase | Title | Status | Depends | L5-NNN |
|---|---|---|---|---|---|
| **L7a** | P7b | Restore `vitest.config.ts` plugin load (`@vitejs/plugin-react` install) | `[ ]` | — | L5-700 |
| **L7b** | P7b | Add `lefthook run test:vitest` as pre-push gate | `[ ]` | L7a | L5-701 |
| **L7c** | P7c | CLI: `omniroute bifrost trip anthropic "high error rate"` | `[ ]` | L1a | L5-710 |
| **L7d** | P7c | CLI: `omniroute cache refresh --provider openai` | `[ ]` | — | L5-711 |
| **L7e** | P7d | Python SDK: typed client for /v1/chat/completions + /v1/responses | `[ ]` | — | L5-720 |

---

### S8 — DEBT Burndown

**DoD**: All P1 items in `docs/TECH_DEBT.md` closed. P2 items scheduled. P3 items
triaged quarterly.

**Phases**:

| Phase | Name | Status |
|---|---|---|
| **P8a** | P1 DEBT items (4) | `[ ]` |
| **P8b** | P2 DEBT items (7) | `[ ]` |
| **P8c** | P3 DEBT items (9) | `[ ]` |

**Leaves**:

| ID | Phase | Title | Status | Depends | L5-NNN |
|---|---|---|---|---|---|
| **L8a** | P8a | Triage each P1 DEBT item; pick top 1 to close per sprint | `[ ]` | — | L5-800 |
| **L8b** | P8b | Move P2 items to P1 once P1 cleared (rolling triage) | `[ ]` | L8a | L5-810 |
| **L8c** | P8a | AGENTS.md staleness scanner: weekly check that referenced line numbers are still valid | `[ ]` | — | L5-820 |

---

### S9 — Archive Recovery / Fork Continuity

**DoD**: Push capability restored. Fork is either unarchived or work has migrated
to a new fork. CI green on the active remote.

**Phases**:

| Phase | Name | Status |
|---|---|---|
| **P9a** | Diagnose archive trigger | `[ ]` |
| **P9b** | Restore push (unarchive OR new fork) | `[ ]` |
| **P9c** | Mirror workflow to active remote | `[ ]` |

**Leaves**:

| ID | Phase | Title | Status | Depends | L5-NNN |
|---|---|---|---|---|---|
| **L9a** | P9a | Open issue on `KooshaPari/OmniRoute` (or contact GitHub support) to understand archive reason | `[ ]` | — | L5-900 |
| **L9b** | P9b | If archive was intentional: create `KooshaPari/OmniRoute-v8` fork from current local main | `[ ]` | L9a | L5-901 |
| **L9c** | P9b | Migrate CI secrets, CODEOWNERS, branch protection to new fork | `[ ]` | L9b | L5-902 |
| **L9d** | P9c | `git remote set-url origin <new-fork>` + push commits `16032fec1` and any further work | `[ ]` | L9c | L5-903 |
| **L9e** | P9c | Update CLAUDE.md / AGENTS.md / docs/ with new repo URL | `[ ]` | L9d | L5-904 |

---

## 3. Resume protocol

Each session that touches this plan must do **three things**:

### 3.1 Update the snapshot (§5)

Replace the contents of §5 with the current state:

```markdown
## 5. Current state snapshot

**Date**: YYYY-MM-DD
**Session**: <short slug>
**main HEAD**: <sha> "<title>"
**origin/main**: <sha or "stuck (archive)">
**Working tree**: clean | <N> dirty files

### Stream status (one-line per stream)

- **S1 Bifrost**: P1a ✅, P1b-P1g open. Next: L1a (chatCore.ts integration)
- **S2 Skills**: P2a ✅, P2b-P2d open. Next: L2a (combo_dry_run MCP tool)
- ...

### In-flight leaves (assigned to sub-agents)

- **<leaf-id>** [forge|muse] assigned at HH:MM; expected return HH:MM
```

### 3.2 Pick leaves (§5.4)

From §5.4 "Next dispatchable leaves", pick one or more leaves whose `Depends`
column is satisfied (`[x]`). For parallel execution, batch independent leaves
(`A ∥ B`) into a single `Task` tool call.

### 3.3 Append activity (§6)

After each session (or each leaf completion), append to §6:

```markdown
### YYYY-MM-DD HH:MM — <slug>

- **Picked**: L1a, L2a (parallel)
- **Dispatched**: forge × 2
- **Returned**: 1×done (L1a), 1×blocked (L2a — needs upstream #5078)
- **Committed**: <shas>
- **Worklog**: worklogs/YYYY-MM-DD-L5-NNN-*.md
- **Snapshot updated**: yes
```

---

## 4. Sub-agent dispatch protocol

### 4.1 When to use the `Task` tool

Use `Task` (with `agent_id: forge` for code work or `agent_id: muse` for
planning/audit) when:

1. The work is more than ~3 tool calls (read/edit/test loop)
2. The work is context-heavy (would crowd this conversation)
3. Two or more leaves are independent and can run in parallel
4. The user explicitly asks for subagent delegation

### 4.2 Leaf dispatch template

Each leaf in §2 has a **dispatch prompt** that can be copy-pasted into a `Task`
call. The template:

```text
Goal: <leaf title>
Scope: <files/area, bounded>
Files to read first: <paths>
Files to modify: <paths>
Acceptance criteria:
  - <concrete, testable criterion 1>
  - <concrete, testable criterion 2>
Constraints:
  - <e.g. "DO NOT modify chatCore.ts">
  - <e.g. "fork-only marker in commit body">
Tests:
  - <test file path or "follow existing pattern">
  - <vitest/standalone/etc.>
Report back:
  - Files changed with file:start-end ranges
  - Test count added
  - Worklog path
  - Commit hash (if any)
```

### 4.3 Parallel dispatch pattern

For independent leaves, batch into one `Task` tool call:

```js
Task({
  agent_id: "forge",
  tasks: [
    "<leaf-A dispatch prompt>",
    "<leaf-B dispatch prompt>",
    "<leaf-C dispatch prompt>",
  ]
})
```

The agent runs them concurrently. On return, merge results into §6.

### 4.4 Verification before completion

After a leaf returns:

1. Read the agent's report
2. Run `lefthook run pre-commit` if code changed
3. Confirm the commit landed: `git log -1 --stat`
4. Update the leaf status in §2: `[ ]` → `[x]`
5. Update §5 snapshot
6. Append §6 entry

### 4.5 Escalation

If a leaf hits a blocker that the agent can't resolve:

1. Mark leaf as `[~]` in §2 with a `~ <reason>` annotation
2. Add an entry to §6 with `[!] escalated`
3. Open an issue or contact the operator (depending on severity)
4. Pick a different leaf from §5.4

---

## 5. Current state snapshot

**Date**: 2026-06-25
**Session**: B9 closure + DAG creation
**main HEAD**: `16032fec1` "feat(bifrost): B9 dispatcher fallback wrapper (closes B9 v8.1)"
**origin/main**: `57ba29067` (stuck — `KooshaPari/OmniRoute` archived)
**Working tree**: clean

### Stream status

- **S1 Bifrost**: P1a ✅ closed (L5-109 → L5-119). P1b, P1c, P1d, P1e, P1f, P1g open. Next: **L1a** (chatCore.ts integration).
- **S2 Skills**: P2a ✅ (audit found 0/8 stubs). P2b-P2d open. Next: **L2a** (combo_dry_run MCP tool).
- **S3 OperSec**: P3a ✅ (commit `a556e1bba`). P3b ✅ (PR #96). P3c, P3d open. Next: **L3a** (audit remediation backlog).
- **S4 Sync**: P4a ✅. P4b, P4c open. Next: **L4a** (weekly rebase cron).
- **S5 Cost**: P5a-P5c ✅. P5d, P5e open. Next: **L5a** (token bucket).
- **S6 Resilience**: P6a-P6c ✅. P6d, P6e open. Next: **L6a** (circuit breaker).
- **S7 DX**: P7a ✅. P7b broken (`@vitejs/plugin-react` missing). P7c, P7d open. Next: **L7a** (restore vitest).
- **S8 DEBT**: P8a-P8c open. Next: **L8a** (triage P1 items).
- **S9 Archive**: P9a-P9c open (NEW — created in response to today's archive event). Next: **L9a** (open issue).

### Next dispatchable leaves (no unmet deps)

- **L1a** — chatCore.ts integration (depends on closed P1a — ready)
- **L1c** — executor-side model cache strict mode (no deps — ready)
- **L2a** — combo_dry_run MCP tool (no deps — ready)
- **L3a** — audit-71-pillar remediation backlog (no deps — ready)
- **L4a** — weekly rebase cron (no deps — ready)
- **L5a** — token bucket (no deps — ready)
- **L6a** — circuit breaker (no deps — ready)
- **L7a** — restore vitest (no deps — ready)
- **L8a** — DEBT P1 triage (no deps — ready)
- **L9a** — diagnose archive (no deps — ready)

### In-flight leaves

(none)

---

## 6. Recent activity log

### 2026-06-25 (this session)

- **Picked**: B9 wiring closeout + DAG creation
- **Dispatched**: direct (small surgical patches; sub-agents not warranted)
- **Committed**:
  - `a556e1bba` fix(hooks): port pre-commit + pre-push to lefthook + bun (closes DEBT-002)
  - `57ba29067` feat(bifrost): B9 wiring — executor calls recordObservation + isActive
  - `16032fec1` feat(bifrost): B9 dispatcher fallback wrapper (closes B9 v8.1)
- **Worklogs**:
  - `2026-06-24-L5-115-bifrost-track-closeout.md`
  - `2026-06-24-L5-118-cherry-pick-vibeslop-postmortem.md`
  - `2026-06-25-L5-119-b9-dispatcher-fallback.md`
- **Artifacts created**:
  - `plans/2026-06-25-omni-evolve-dag.md` (this file)
- **Push state**: 1 commit stuck (`16032fec1`) — fork archived
- **Snapshot updated**: yes (this is the first snapshot)

---

## Appendix A — Extension protocol

To add new work:

1. Pick the appropriate stream (§2). If none fits, add a new stream (`S10+`) with
   a `Definition of done`, an initial phase (`P<N>a`), and one or more leaves.
2. Append phases and leaves following the existing schema.
3. State explicit dependencies in the `Depends` column.
4. Reserve the next L5-NNN number (see Appendix B).
5. Update §5 snapshot if relevant.

There is **no upper bound** on the number of streams, phases, or leaves. The
DAG can grow indefinitely without restructuring existing nodes.

## Appendix B — L5-NNN numbering

Worklogs follow `YYYY-MM-DD-L5-NNN-*.md`. The L5-NNN is **monotonically
increasing** and reserved at leaf creation (not at completion) to avoid
allocation races between parallel sub-agents.

Reservation rule: when adding a leaf, assign the next free L5-NNN. Update the
leaf's row in §2 and the L5-NNN column immediately. Even if the work is later
deferred or cancelled, the number is consumed.

Range allocation (current):

| Range | Stream |
|---|---|
| L5-100..L5-199 | S1 Bifrost |
| L5-200..L5-299 | S2 A2A/MCP Skills |
| L5-300..L5-399 | S3 OperSec |
| L5-400..L5-499 | S4 Upstream Sync |
| L5-500..L5-599 | S5 Cost/Quota |
| L5-600..L5-699 | S6 Resilience |
| L5-700..L5-799 | S7 DX |
| L5-800..L5-899 | S8 DEBT |
| L5-900..L5-999 | S9 Archive |
| L5-1000+ | reserved for new streams (S10+) |

Last allocated: **L5-119** (B9 dispatcher wrapper). Next free: **L5-120** (L1a).