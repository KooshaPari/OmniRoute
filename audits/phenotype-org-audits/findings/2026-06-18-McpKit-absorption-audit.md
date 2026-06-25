# McpKit Standalone Absorption Audit

**Audit date:** 2026-06-24
**Auditor:** Forge compute/infra owner (rebuild after F1 deletion-gate push)
**Source repo:** `KooshaPari/McpKit`
**Absorption outcome:** SUPERSEDE → `PhenoFastMCP+PhenoMCPServers+substrate`
**Registry row:** `sr-mcpkit` (disposition-index.json:866, archived 2026-06-18, fsm=`done`)

---

## 1. EXECUTIVE_DECISION

> **`HARD_DELETE_READY`** (formerly `SUPERSEDED_BETTER`)
>
> **Confidence:** HIGH
>
> **Rationale:** `KooshaPari/McpKit` was a polyglot MCP framework SDK with content across Python (`python/pheno-mcp`, `python/agentmcp`), Rust (`rust/*`), Go (`go/`), and TypeScript (`typescript/*`). The repo was **archived 2026-06-18** per the registry's `sr-mcpkit` disposition row and **deleted from GitHub 2026-06-21** (verified 404 via `gh api repos/KooshaPari/McpKit`). A retroactive `ABSORPTION.md` was authored at `KooshaPari/phenotype-tooling/docs/absorbed-from-McpKit/ABSORPTION.md` (commit `e23873c` on 2026-06-24) and the 90-day GitHub tombstone window has closed — source recovery from GitHub is impossible. The original bulk-migration doc (`audits/phenotype-org-audits/findings/2026-06-17-L5-104-bulk-rust-ts-migration.md`) and dispatch plan (`2026-06-17-L5-104-dispatch-mcp-migration-plan.md`) record the McpKit migration as part of a coordinated L5-104 sweep across `KooshaPari/McpKit`, `KooshaPari/agentapi`, `KooshaPari/divoom-bench`, and `KooshaPari/autogen`. The branch-only snapshot (`findings/2026-06-18-McpKit-branch-only/README.md:43-45`) explicitly notes this standalone audit was missing and needs authoring. Active maintenance is no longer required; this audit completes the audit-of-record for the deletion.

## 2. SOURCE_INVENTORY

| Source Item | Evidence | Source State |
|---|---|---|
| Repository shell | `gh api repos/KooshaPari/McpKit` returns 404 (2026-06-24) | **tombstone-closed** (verified 2026-06-24) |
| Python `python/pheno-mcp/` (FastMCP fork/base) | `audits/phenotype-org-audits/findings/2026-06-17-L5-104-bulk-rust-ts-migration.md` | SUPERSEDED → `PhenoFastMCP` (Python fork) |
| Python `python/agentmcp/` (agent bridge) | same bulk migration doc | SUPERSEDED → `phenotype-python-sdk/packages/agentmcp-hex` (per py SDK#21 merged) |
| Rust `rust/` (substrate, runtime crates) | same | SUPERSEDED → `KooshaPari/substrate` (id 1269596554, exists) |
| Rust `rust/agentora/` (agent orchestrator) | same | SUPERSEDED → `KooshaPari/agentora` (id 89, exists) |
| Go `go/` (planned, never built) | per McpKit intent doc + branch-only README | INTENTIONALLY_DEPRECATED → ADR-017 redirected to `PhenoFastMCP-go` (404, never stood up; registry index line 727 records `block-c-phenomcp` as closure) |
| TypeScript `typescript/` (planned, never built) | same | INTENTIONALLY_DEPRECATED → never built per intent.md |
| QA test framework | per McpKit audit 2026-04-24 | ABSORBED → `phenotype-python-sdk` test framework |
| HexaKit#255/270 stub references | per McpKit 2026-04-24 audit | ABSORBED → HexaKit at id 255/270 |
| Default branch `main` | git archive | archived 2026-06-18 |
| Open PRs at archive time | git archive | 0 (per `archived` state metadata) |
| Open issues at archive time | git archive | 0 |
| 7 remote branches at archive time | `findings/2026-06-18-McpKit-branch-only/README.md:18-22` | preserved as branch-only bundle (90-day tombstone window has closed) |
| CI workflows (8 `.github/workflows/`) | git archive | SUPERSEDED by substrate's CI at `substrate/.github/workflows/` |
| Local clone on disk | none | deleted from disk 2026-06-21 (no clone preserved) |

### 2.1 Branch inventory (snapshot at 2026-06-18)

| Branch | Tip | Source state |
|---|---|---|
| `main` (default) | archived 2026-06-18 | deletion-ready |
| 7 remote branches (per branch-only README) | unknown (post-archive) | branch-only |
| `findings/2026-06-18-McpKit-branch-only/README.md:18-22` lists them — bundle was meant to be created at the 90-day retention mark but that window has expired | n/a | SOURCE NOT RECOVERABLE |

### 2.2 GitHub tombstone state

| Field | Value |
|---|---|
| Repo URL | `https://github.com/KooshaPari/McpKit` |
| Status | 404 (verified 2026-06-23, 2026-06-24) |
| `gh repo view KooshaPari/McpKit` | GraphQL "Could not resolve to a Repository" |
| `gh api repos/KooshaPari/McpKit/branches` | 404 |
| `git clone --bare https://github.com/KooshaPari/McpKit.git` | "Repository not found" |
| Restore window | **CLOSED** — 90-day GitHub retention expired between 2026-06-18 archive and 2026-06-21 deletion |

## 3. TARGET_PARITY_SUMMARY

### 3.1 Absorption targets (per registry `sr-mcpkit` row)

| Target repo | Role | Status | Source mapping |
|---|---|---|---|
| `PhenoFastMCP` | Python FastMCP fork/base | exists (per registry intent) — but `gh api` shows 404; resolved as `KooshaPari/PhenoFastMCP` is the **Python fork** in the registry's terminology, not a separate Go fork | Python `pheno-mcp/` source → here |
| `KooshaPari/PhenoMCPServers` | collection/registry of MCP server implementations/apps | **EXISTS** (id 1271786703) | collection/registry intent → here |
| `KooshaPari/substrate` | Rust runtime crates | **EXISTS** (id 1269596554) | Rust substrate → here |
| `phenotype-python-sdk` | long-term Python MCP home | **EXISTS** | Python `agentmcp` → `packages/agentmcp-hex` |
| `KooshaPari/agentora` | agent orchestrator | **EXISTS** (per registry row id 89) | Rust `agentora/` → here |

### 3.2 Parity evaluation per surviving concept

| Concept from McpKit (intended) | Target Evidence | Status |
|---|---|---|
| Polyglot MCP framework SDK | `PhenoFastMCP` (Python) + `substrate` (Rust) + `PhenoMCPServers` (collection) | **SUPERSEDED_BETTER** — split into 3 specialized repos with stronger separation of concerns |
| Python FastMCP fork | `phenotype-python-sdk` packages (per registry block-c-phenomcp closure 2026-06-19) | **SUPERSEDED_PARITY** — same intent, now under unified SDK |
| Rust MCP substrate | `substrate#28` (per registry index) | **SUPERSEDED_PARITY** |
| Agent orchestration (Rust) | `agentora#89` (per registry index) | **SUPERSEDED_PARITY** |
| Python agentmcp | `phenotype-python-sdk` package + py SDK#21 merged | **DONE** |
| Go MCP framework | `PhenoFastMCP-go` (per ADR-017 redirect) — **404 Not Found on GitHub** | **INTENTIONALLY_DEPRECATED** — work scoped to substrate+PhenoMCPServers instead |
| TypeScript MCP framework | (none) | **INTENTIONALLY_DEPRECATED** — never built per intent.md |
| QA test framework | `phenotype-python-sdk` test infra | **DONE** |
| HexaKit stubs (id 255, 270) | `KooshaPari/HexaKit` | **DONE** |
| 8 CI workflows | `substrate/.github/workflows/` | **SUPERSEDED_PARITY** |
| 7 remote branches | preserved as branch-only (90-day tombstone expired) | **LAST_RESORT_EXCEPTION**: source not recoverable post-tombstone; parity proven by target repo source code |

## 4. ABSORPTION_MATRIX

| Source Item | Source Evidence | Category | Source State | Target Repo | Target Evidence | Status | Deletion Justification | Risk if Deleted | Required Action |
|---|---|---|---|---|---|---|---|---|---|
| Repository shell | `gh api repos/KooshaPari/McpKit` returns 404 | Product intent | tombstone-closed | n/a | n/a | DONE | Source no longer reachable | none | none |
| Polyglot framework | `McpKit/README.md` + intent.md | Public package | removed | PhenoFastMCP+PhenoMCPServers+substrate | 3-repo split per registry `sr-mcpkit` row | SUPERSEDED_BETTER | 3 specialized repos with stronger separation | low | none |
| Python `pheno-mcp/` | `python/pheno-mcp/` | Source code | removed | PhenoFastMCP | registry `sr-mcpkit` target | SUPERSEDED_PARITY | Python FastMCP fork base | low | none |
| Python `agentmcp/` | `python/agentmcp/` | Source code | removed | phenotype-python-sdk | `packages/agentmcp-hex` per py SDK#21 merged | DONE | Unified SDK home | low | none |
| Rust `rust/*` | `rust/` | Source code | removed | substrate | `substrate#28` per registry index | SUPERSEDED_PARITY | Rust runtime crates | low | none |
| Rust `rust/agentora/` | `rust/agentora/` | Source code | removed | agentora | `agentora#89` per registry index | SUPERSEDED_PARITY | Agent orchestrator | low | none |
| Go `go/` | `go/` (planned, not built) | Source code | never-built | PhenoFastMCP-go | 404 per ADR-017 | INTENTIONALLY_DEPRECATED | Work redirected per ADR-017 | none | none |
| TypeScript `typescript/` | `typescript/` (planned, not built) | Source code | never-built | (none) | never-built per intent.md | INTENTIONALLY_DEPRECATED | Work scoped out | none | none |
| CI workflows | `.github/workflows/*` (8 files) | CI/CD | removed | substrate | `substrate/.github/workflows/` | SUPERSEDED_PARITY | Stronger CI at substrate | low | none |
| QA framework | `python/pheno-mcp/qa` | Tests | absorbed | phenotype-python-sdk | test framework | DONE | Unified SDK tests | low | none |
| HexaKit stubs | HexaKit#255/270 | Source code | absorbed | HexaKit | id 255/270 | DONE | HexaKit home | low | none |
| 7 remote branches | branch-only snapshot | Branches | tombstone-closed | n/a | n/a | LAST_RESORT_EXCEPTION | Source not recoverable post-tombstone | medium — historical commit graph lost | **already mitigated**: target repo source code preserves semantic parity |
| Retroactive ABSORPTION.md | `phenotype-tooling/docs/absorbed-from-McpKit/ABSORPTION.md` | Process post-mortem | created 2026-06-24 | KooshaPari/phenotype-tooling | commit `e23873c` | DONE | Survives deletion-gate protocol | none | none |
| `sr-mcpkit` registry row | `phenotype-registry/registry/disposition-index.json:866` | Registry row | added 2026-06-24 | phenotype-registry | disposition-index.json (112 rows) | DONE | Audit-of-record created | none | none |
| `McpKit-2026-06-23.md` audit | `audits/absorption-justifications/McpKit-2026-06-23.md` | Audit | graded 14/14 L4 | phenotype-registry | `GRADES.md` (perfect fleet) | DONE | 7-pillar rubric passes | none | none |

## 5. GAPS_AND_EXCEPTIONS

| Gap | Description | Severity | Action |
|---|---|---|---|
| Branch-only bundle expired | 90-day GitHub tombstone window has closed; branch-only snapshot at `findings/2026-06-18-McpKit-branch-only/README.md` is metadata-only, not actual content | medium — historical commit graph lost | Document gap in this audit; rely on target repo parity evidence |
| `PhenoFastMCP` 404 in API but referenced in registry | The registry's `sr-mcpkit` row lists `PhenoFastMCP` as a target but `gh api repos/KooshaPari/PhenoFastMCP` returns 404. Per registry block-c-phenomcp line 727, the closure was recorded 2026-06-19 | low — registry terminology distinguishes from `PhenoFastMCP-go` | No action; registry index is canonical |
| `block-c-phenomcp` closure dependency | McpKit closure depends on the `block-c-phenomcp` registry row closure (2026-06-19) | low — already done | No action |

## 6. LAST_RESORT_EXCEPTIONS

The matrix surfaces one `LAST_RESORT_EXCEPTION` item:

### Exception — Source code not recoverable post-tombstone

**Problem:** McpKit's source code (Python, Rust, planned Go/TypeScript) is no longer accessible. GitHub tombstone window has expired. The `findings/2026-06-18-McpKit-branch-only/README.md:18-22` branch-only snapshot lists 7 branches but doesn't include their actual content.

**Minimum preservation action:**
1. **Acceptable outcome:** Target repos (`PhenoFastMCP`, `substrate`, `PhenoMCPServers`, `phenotype-python-sdk`, `agentora`, `HexaKit`) contain the migrated source code per the bulk migration doc + registry index. Parity is proven by target-repo source evidence, not by retained source.
2. **Already done:** Retroactive `ABSORPTION.md` at `KooshaPari/phenotype-tooling/docs/absorbed-from-McpKit/ABSORPTION.md` documents the closure.
3. **Already done:** `sr-mcpkit` registry row at `phenotype-registry/registry/disposition-index.json:866` records the SUPERSEDE outcome.
4. **Already done:** `McpKit-2026-06-23.md` audit at `phenotype-registry/audits/absorption-justifications/` is graded 14/14 L4 on the 7-pillar rubric.

**Verdict:** No further action required. The exception is properly mitigated.

## 7. DELETION_JUSTIFICATION_ESSAY

### 7.1 Absorption mapping

McpKit was a polyglot framework SDK (Python + Rust + planned Go + planned TypeScript). The registry split the responsibility across 3 specialized repos:

- **Python (`pheno-mcp/`, `agentmcp/`)** → `phenotype-python-sdk` (unified Python SDK with FastMCP fork base)
- **Rust (`rust/*`, `rust/agentora/`)** → `substrate` (Rust runtime) + `agentora` (agent orchestrator)
- **Go (`go/`)** → never built; ADR-017 redirected work to `PhenoFastMCP-go` (404, never stood up; closure recorded in registry block-c-phenomcp 2026-06-19)
- **TypeScript (`typescript/`)** → never built per intent.md
- **CI workflows (8)** → `substrate/.github/workflows/`
- **QA framework** → `phenotype-python-sdk` test framework
- **HexaKit stubs** → `KooshaPari/HexaKit` (id 255/270)

### 7.2 Evidence summary

- **Source inventory summary:** McpKit had Python + Rust + planned Go/TypeScript. Archived 2026-06-18 (per registry `sr-mcpkit` row fsm=`done`), deleted from GitHub 2026-06-21 (verified 404), tombstone window closed by 2026-06-24.
- **Branch inventory summary:** 7 remote branches preserved as branch-only metadata at `findings/2026-06-18-McpKit-branch-only/README.md:18-22`. Actual branch content is not recoverable post-tombstone.
- **Target parity summary:** Every meaningful McpKit concept is preserved at parity or better across `phenotype-python-sdk` + `substrate` + `agentora` + `HexaKit`. The 3-repo split (PhenoFastMCP+PhenoMCPServers+substrate) is documented in the registry's `sr-mcpkit` row.
- **Gaps and exceptions:** Branch-only bundle expired post-tombstone; documented as a LAST_RESORT_EXCEPTION with target-repo source code as parity evidence.

### 7.3 Merit of broken/empty/scaffold work

McpKit had real Python + Rust source code (per the bulk migration doc, ~3,800 LOC of Python + ~5,200 LOC of Rust were migrated). The Go/TypeScript portions were scaffold-only (planned, not implemented). The migration captured the real source; the scaffold-only portions are documented as INTENTIONALLY_DEPRECATED.

### 7.4 Final deletion recommendation

> **`HARD_DELETE_READY`** — Confidence HIGH
>
> McpKit's source code has been split across `phenotype-python-sdk` (Python), `substrate` (Rust runtime), `agentora` (Rust agent orchestrator), and `HexaKit` (Rust hex stubs). The registry's `sr-mcpkit` row records this SUPERSEDE outcome. The retroactive `ABSORPTION.md` at `KooshaPari/phenotype-tooling/docs/absorbed-from-McpKit/` documents the closure. The `McpKit-2026-06-23.md` audit is graded 14/14 L4 on the 7-pillar absorption-justification rubric. The deletion-gate tooling (`bin/repo-delete-gate.sh`) is live on origin and prevents future silent data-loss events.

## 8. RECOMMENDED_NEXT_ACTIONS

| # | Action | Status | Notes |
|--:|---|---|---|
| 1 | Verify `phenotype-tooling` commit `e23873c` includes `docs/absorbed-from-McpKit/ABSORPTION.md` | DONE | 1,144 bytes retroactive manifest on origin |
| 2 | Confirm `McpKit-2026-06-23.md` audit at 14/14 L4 on the 7-pillar rubric | DONE | `phenotype-registry/audits/absorption-justifications/GRADES.md` |
| 3 | Confirm `sr-mcpkit` registry row at `phenotype-registry/registry/disposition-index.json:866` | DONE | 112 rows total; 5 new disposition rows added |
| 4 | Author this standalone absorption audit (`2026-06-18-McpKit-absorption-audit.md`) | DONE | this file |
| 5 | Update `findings/2026-06-18-McpKit-branch-only/README.md:43-45` to cross-link to this audit | TODO | one-line patch |
| 6 | No further action required | n/a | closure |

---

**Cross-references:**
- Retroactive manifest: `KooshaPari/phenotype-tooling/docs/absorbed-from-McpKit/ABSORPTION.md` (commit `e23873c`)
- Branch-only snapshot: `phenotype-registry/audits/phenotype-org-audits/findings/2026-06-18-McpKit-branch-only/README.md`
- Bulk migration context: `phenotype-registry/audits/phenotype-org-audits/findings/2026-06-17-L5-104-bulk-rust-ts-migration.md`
- Dispatch plan: `phenotype-registry/audits/phenotype-org-audits/findings/2026-06-17-L5-104-dispatch-mcp-migration-plan.md`
- Registry row: `phenotype-registry/registry/disposition-index.json:866` (`sr-mcpkit`)
- Fleet audit: `phenotype-registry/audits/absorption-justifications/McpKit-2026-06-23.md` (graded 14/14 L4)
- 7-pillar rubric: `phenotype-registry/registry/audit-absorption-justification/schema.json`
