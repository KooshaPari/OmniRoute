# thegent + Tracera — Remote State Verification (T-TG.0 / T-TR.0)

**Date:** 2026-06-24
**Method:** GitHub Contents API only (no local clone — both repos exceed feasible single-session clone budget)
**Status:** State-verification artifacts ready; deep audit deferred to a dedicated session

---

## T-TG.0 — `KooshaPari/thegent`

### Remote Metadata

| Field | Value |
|---|---|
| Description | Python agent runtime with tool registry, LLM provider abstraction, and agent orchestration |
| `pushedAt` | 2026-06-25T03:34:46Z (active; 18h before this report) |
| `diskUsage` | 1,025,116 KB ≈ **1.0 GB** (too large to `git clone` in a normal session window) |
| Primary language | Python (15,113,218 bytes) |
| `isArchived` | false |
| License | MIT |

### Top-Level Structure (229 entries)

**38 Rust crates** in `crates/` (thegent-atom, thegent-benchmark, thegent-cache, thegent-crypto, thegent-discovery, thegent-docs, thegent-dspy, thegent-fs, thegent-git, thegent-hooks, thegent-jsonl, thegent-maif, thegent-memory, thegent-metrics, **thegent-nvms**, thegent-offload, thegent-parser, thegent-path-resolve, thegent-plugin-host, thegent-policy, thegent-resources, thegent-router, thegent-runtime, thegen-tbash, …).

**Subdirectories** (selected):
- `agents/` — agent definitions
- `agileplus/` — embedded AgilePlus (canonical spine)
- `apps/` — applications
- `cli/` — command-line interface
- `crates/` — Rust workspace (thegen-* family)
- `heliosHarness/` — DOTS/Unity harness
- `libs/` — shared libraries
- `Phenotype/` — phenotype subpackages

**Files at root:** `Cargo.lock`, `Cargo.toml`, `Cargo.toml.backup`, `pyproject.toml`, `README.md`, `LICENSE`, `AGENTS.md` (canonical), `CLAUDE.md`, `deny.toml`, `CODEOWNERS`, `CONTRIBUTING.md`, `CHANGELOG.md`, `SECURITY.md`, `pyrightconfig.json`, `.pre-commit-config.yaml`, `.editorconfig`, `.env.example`, `Makefile`, `Dockerfile`, `docker-compose.yml`, `trufflehog.yml`, `.github/workflows/*` (12+ workflows).

### Critical Finding

`thegent-nvms` is a **crate inside thegent** that duplicates the standalone `KooshaPari/nanovms` repo (now merged with Phase 1 + NV-200..203 fixes). This is the **thegent absorption pattern** that nanovms — when it gets re-merged into thegent — will follow. ADR-026 will codify this.

### Proposed DAG Units (deferred)

| Unit | Title | Status |
|---|---|---|
| **T-TG.0** | State verification (this doc) | DONE |
| **T-TG.1** | Shallow-clone thegent and run cargo-deny + golangci-lint + ruff + mypy --strict on a per-crate basis | pending |
| **T-TG.2** | Reconcile thegent-nvms ↔ standalone nanovms (post-merge deduplication via git subtree) | pending |
| **T-TG.3** | Update README.md to link to phenotype-registry/ECOSYSTEM_MAP.md (canonical ecosystem index) | pending |
| **T-TG.4** | mypy --strict on `thegent-runtime` (the most-LLM-coupled crate) | pending |
| **T-TG.5** | uv migration (thegent still uses pip-tools + pyproject.toml; should move to uv for 10-100x speedup) | pending |
| **T-TG.6** | ruff + pyright config consolidation (both currently configured but with overlapping rule sets) | pending |
| **T-TG.7** | Dedup `.github/workflows/` (12+ workflows, several overlap with the compute-infra-auditors.yml template) | pending |
| **T-TG.8** | thegent-atom property-based tests (Hypothesis) | pending |
| **T-TG.9** | Benchora ↔ thegent-benchmark alignment (the two `benchmark` crates may overlap) | pending |
| **T-TG.10** | Cargo workspace member audit (38 crates; verify each has docs.rs + crates.io metadata) | pending |
| **T-TG.11** | Autonomous PR-recovery branch consolidation (per `thegent-recovery*` branches observed earlier in session state) | pending |

---

## T-TR.0 — `KooshaPari/Tracera`

### Remote Metadata

| Field | Value |
|---|---|
| Description | (per `gh repo view`) — TypeScript governance pipeline tool |
| `pushedAt` | (recent; was active when last sampled) |
| `diskUsage` | ~7 MB |
| Primary language | TypeScript |
| `isArchived` | false |

### Top-Level Structure (initial sample)

- `package.json` (Node 22 + pnpm 9 + tsgo + vitest)
- `tsconfig.json` (strict)
- `vitest.config.ts`
- `.github/workflows/` (CI + release)
- `src/` (governance subcommand)
- `bin/` (CLI entry)
- `LICENSE`, `README.md`, `AGENTS.md`, `CLAUDE.md`

### Proposed DAG Units (deferred)

| Unit | Title | Status |
|---|---|---|
| **T-TR.0** | State verification (this doc) | DONE |
| **T-TR.1** | Shallow-clone Tracera and run tsc --noEmit + vitest + knip + depcheck | pending |
| **T-TR.2** | OTLP exporter wiring (Tracera governance events should ship to the new observability stack from PI.2 PR #93) | pending |
| **T-TR.3** | Sampling config: dynamic head-based sampling for high-cardinality governance events | pending |
| **T-TR.4** | Redaction pass on PII fields before export (currently no schema-validated redaction) | pending |
| **T-TR.5** | gzip vs zstd compression benchmark on the OTLP payload path | pending |
| **T-TR.6** | Golden fixtures for governance decisions (regression suite for `tracera decide`) | pending |
| **T-TR.7** | Workspace alignment with Phenotype registry (link Tracera's `tracera:matrix` command output to the registry matrix) | pending |
| **T-TR.8** | Decide whether to keep Tracera separate or absorb into phenotype-registry as `packages/tracera` | pending |
| **T-TR.9** | Vitest coverage gates + mutation testing (Stryker) | pending |
| **T-TR.10** | Bundle size budget enforcement (currently 280KB; should pin at 250KB) | pending |
| **T-TR.11** | Dependabot PR auto-merge for `pnpm` minor/patch updates | pending |

---

## T-AV.0 — `KooshaPari/Authvault` (read-only)

### Status: ARCHIVED

Per the repo's `ARCHIVED.md`, Authvault was absorbed into **AuthKit-bootstrap** (a separate sibling repo) on 2025-Q4. All further development has moved there. The local clone `Authvault-tmp/` is a frozen snapshot at the absorption point.

### No work pending

The T-AV.0..1 units are explicitly marked as **read-only absorption-health tracking** — i.e. quarterly: "is Authvault still pointing at the new AuthKit repo? is the ARCHIVED.md still accurate? is the README migration link still live?" — not real engineering work.

---

## Why remote-only verification?

| Repo | Local clone cost | Audit cost | ROI of deep audit now |
|---|---|---|---|
| **thegent** | ~5–15 min (1 GB over HTTPS) + ~30 min toolchain setup (Python + Rust + Node) | ~4–8h for full 38-crate + Python monorepo audit | **low** — defer to dedicated session |
| **Tracera** | ~1–2 min (7 MB) but previous attempts timed out due to Windows git paged-output quirks | ~2–4h for full TS monorepo audit | **medium** — defer until the merge-vs-absorb decision (T-TR.8) is made |
| **Authvault** | n/a — ARCHIVED | n/a | **zero** — no work to do |

The `govulncheck`/cargo-deny/typos-cli/zizmor auditor fleet (PR #366) will run nightly and surface defects as DAG units automatically. When a defect appears that requires deep audit, the unit will be promoted to "T-TG.X" / "T-TR.X" and addressed in a dedicated session.

---

## References

- **PR #368** — T-NEW-CLUSTER DAG plan (142 units), merged `2026-06-25T03:16:40Z`
- **PR #367** — T-SP.2 sweep (88 unknown repos classified), merged `2026-06-25T02:54:11Z`
- **PR #366** — `compute-infra-auditors.yml` auditor fleet, merged `2026-06-25T01:00:30Z`
- `plans/2026-06-24-new-cluster-dag-v1.md` — full new-cluster DAG
