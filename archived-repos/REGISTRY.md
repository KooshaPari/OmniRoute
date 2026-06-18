# Archived-Repos Registry — SSOT

**Date:** 2026-06-14
**Purpose:** Single source of truth for the 4 archived/private repos in the Phenotype ecosystem. Per `PRESERVATION_POLICY.md`, no archive may be deleted, unarchived, or destructively modified.

**Wipe-resilience note (2026-06-14):** The `archived-repos/` directory was wiped between 2026-06-12 and 2026-06-14 (along with `/tmp/helios-cli-backup/` and the `/tmp/gitleaks-*` files). The surviving contents are: `archived-repos/HC-PATCHES-LIFT-PLAN.md` (HC-11, re-derived 2026-06-14), `archived-repos/PL-CARGO-DENY-BASELINE.md` (preserved), `archived-repos/HC-PERF-RESULTS-PORT-PLAN.md` (this plan's sibling, re-derived 2026-06-14), and the other `archived-repos/PL-*.md` files dated 2026-06-14. The SSOT (this file) is being re-issued 2026-06-14 with the same content it had on 2026-06-12 plus a §1.3 durability pointer.

---

## Active registry

| # | Repo | Visibility | Archive date | Successor (active) | Audit report | DAG task prefix |
|---|---|---|---|---|---|---|
| 1 | `KooshaPari/KVirtualStage` | Private, archived | 2026-05-03 | `KooshaPari/KDesktopVirt` | `/tmp/audit_kvirtualstage.md` | KV-* |
| 2 | `KooshaPari/PhenoLang` | Private, archived | 2026-05-30 | `KooshaPari/HexaKit` (foundation) + `KooshaPari/AgilePlus` (business) + `KooshaPari/phenoUtils` (new ports) | `/tmp/audit_phenolang.md` | PL-* |
| 3 | `KooshaPari/helios-cli-backup` | Private, archived | 2026-05-03 | `KooshaPari/HeliosCLI` (a.k.a. `helioscope`) | `/tmp/audit_helios_cli_backup.md` | HC-* (perf-results: deliberate byte-equal duplicate, 478/478 files, see HC-09) |
| 4 | `KooshaPari/phenotype-colab-extensions` | Private, archived | 2026-05-03 | `KooshaPari/HeliosLab` (renamed from `KooshaPari/colab`) | `/tmp/audit_phenotype_colab_extensions.md` | CE-* |

---

## Per-repo one-line summary

### 1. KVirtualStage
- **Description (GitHub):** "STRICTLY DO NOT DELETE NOR UNARCHIVE - Personal Project - Desktop automation platform for AI agents"
- **Local path:** `/tmp/KVirtualStage` (109 files, 2.1 MB)
- **State:** Non-compilable marketing artifact. `kvirtualdesktop-mcp-server/Cargo.toml` declares 5 path-dep workspace crates that **do not exist**; ~5,800 LOC of Go stubs returning `TODO: Implement`; empty `kvirtualstage/` dir; `credential_manager/src/vault.rs` has a likely borrow-checker error.
- **Constraint:** Personal-project constraint. Annotation/marker tasks only. No port. No unarchive. No delete.
- **Owner:** `@KooshaPari` (sole)

### 2. PhenoLang
- **Description (GitHub):** "ARCHIVED: superseded by KooshaPari/phenoUtils" — **MISLEADING**. The real successors are HexaKit + AgilePlus + new phenoUtils ports. See `arc-1-06` to amend the GitHub description.
- **Local path:** `/tmp/PhenoLang` (3,974 files, 53 MB, 174,584 Rust LOC)
- **State:** Meta-monorepo with 78 components; 3 distinct Cargo workspaces (root + `agileplus/` + `phenotype-infrakit/`); 47 empty placeholder dirs; root `Cargo.toml` is broken (9 path-deps to excluded crates).
- **Notable gaps with no successor:** `omniroute-core` (4,365 LOC), `phenotype-retry` (1,656 LOC, excluded from HexaKit), `phenotype-infrakit/*` (6,555 LOC).
- **Action:** ANNOTATE + PORT-OUT (10 crates to phenoUtils per `arc-4-01..10`) + REMOVE-EMPTY (47 zero-LOC placeholder dirs).
- **Owner:** `@KooshaPari/phenoUtils` maintainer + HexaKit maintainer (for foundation-crate ports)

### 3. helios-cli-backup
- **Description (GitHub):** "DEPRECATED: Backup/old version - use KooshaPari/HexaKit/helios-cli" — **MISLEADING**. The successor is `KooshaPari/HeliosCLI` (a.k.a. `helioscope`), NOT a subdirectory of HexaKit. HexaKit spec `006-helioscli-completion` merely references it as a sibling.
- **Local path:** `/tmp/helios-cli-backup` (3,213 files, 104 MB, 386,377 Rust LOC) — **regenerable** via `gh repo clone KooshaPari/helios-cli-backup /tmp/helios-cli-backup`
- **State:** Frozen 2026-05-02 snapshot of `openai/codex`. 79 codex-rs crates; 1 DROPPED (`exec-server`); 7 ADDED in active (`crossterm_0_29`, `scrolling-regions`, `test-macros`, `unstable-backend-writer`, `unstable-rendered-line-info`, `unstable-widget-ref`, `utils/stream-parser`).
- **Unique value:** `perf-results/` (9.1 MB, 478 files) is **byte-equal** to active HeliosCLI (per-file sorted SHA-256 diff is empty, exit 0, re-verified 2026-06-12 and 2026-06-14 against the active's stable mtimes `May 23 14:12`). This is a **deliberate duplicate, not a hygiene violation** — the archive copy serves as the immutable 2026-05-02 reference baseline; the active copy is the live number. **Do NOT delete either copy and do NOT rsync** (would break byte-equal verification). See `archived-repos/HC-PERF-RESULTS-PORT-PLAN.md` (HC-09) for the full plan, including the §1.3 durability analysis (the verdict is re-derivable in ~10 seconds even after `/tmp` wipe). `patches/` (4 files: 3 identical, 1 with +20/-0 delta) is preserved — see `archived-repos/HC-PATCHES-LIFT-PLAN.md` (HC-11) for the lift-with-provenance plan.
- **Action:** PRESERVE + LIFT-PERF-DATA (`arc-4-15`, voided by HC-09) + LIFT-PATCHES (`arc-4-13..14`, see HC-11).
- **Owner:** `@KooshaPari/HeliosCLI` maintainer

### 4. phenotype-colab-extensions
- **Description (GitHub):** "Phenotype extensions for colab fork - AgilePlus specs, webflow-plugin"
- **Local path:** `/tmp/phenotype-colab-extensions` (11 files, 220 KB)
- **State:** Spec-only / governance-overlay ghost repo. **Zero implementation code.** 3 ADRs, 38 FRs, broken `src/Taskfile.yml` (cargo tasks for a TS project). The intended sibling `KooshaPari/phenotype-cli-extensions` was never created (HTTP 404). Actual colab-fork work landed in `KooshaPari/HeliosLab`.
- **Action:** PRESERVE + ADD-STATUS-MARKER (`arc-1-16`) + FIX-TASKFILE-IN-SUCCESSOR (`arc-5-12`).
- **Owner:** `@KooshaPari/HeliosLab` maintainer

---

## Hygiene baselines (2026-06-12; re-verified 2026-06-14 where the underlying artifacts survived)

| Repo | Clippy | Fmt | Gitleaks | Tests | Verdict |
|---|---|---|---|---|---|
| KVirtualStage | N/A (broken path-deps) | N/A | 1 finding (TEST-FIXTURE only) | 0 (negative tests for catalog of brokenness) | Frozen; annotation-only |
| PhenoLang | Broken workspace | 3 sub-workspaces | 0 findings | Compile-test catalog (PL-11) | Annotation + port-out |
| helios-cli-backup | Baseline captured | Clean | 2 findings (test fixtures) | cargo + npm + tsc baselines captured | Frozen; lift perf + patches |
| phenotype-colab-extensions | N/A (no code) | Clean (md only) | N/A (no code) | Bun test for FR/ADR validation | Frozen; in-archive STATUS.md |

**Per-repo baseline reports (note: most plan files have been wiped between 2026-06-12 and 2026-06-14; verdicts are re-derivable from the surviving source artifacts):**
- `plans/2026-06-12-bg-hc-03-perf-results-parity.md` (byte-equal verdict — file was wiped between turns; verdict re-derivable from active's stable perf-results/ per HC-09 §1.3 durability analysis)
- `plans/2026-06-12-bg-hc-04-patches-delta.md` (3/4 byte-identical, +20/-0 on 1 — file was wiped; verdict re-derived 2026-06-14 in `archived-repos/HC-PATCHES-LIFT-PLAN.md` §1)
- `plans/2026-06-12-bg-hc-10-gitleaks-baseline.md` (2 test-fixture findings — `/tmp/gitleaks-hc-2026-06-12.stdout` was wiped; findings are also captured in HC-09 §1.2 and HC-11 §1.2)
- `plans/2026-06-12-bg-kv-09-gitleaks-baseline.md` (1 test-fixture finding)

---

## DAG task prefix map

- **KV-*** (13 tasks): KVirtualStage preservation, annotation, cross-reference, gap-table
- **PL-*** (28 tasks): PhenoLang annotation, hygiene, port-out, release
- **HC-*** (24 tasks): helios-cli-backup preservation, hygiene, perf-data lift, lineage docs
- **CE-*** (12 tasks): phenotype-colab-extensions status, audit, fix in successor
- **sd-cross-*** (6 tasks): Top-level registry, policy, hygiene baselines, audit workflow, CODEOWNERS
- **sd-fuzz-***, **sd-type-***, **sd-coverage-***, **sd-perf-***, **sd-lib-***, **sd-deploy-***, **sd-orchestration-***, **sd-research-***: 17 cross-cutting tasks

**Total:** 100 tasks (20×5 rectangle).

---

## Cross-references

- 100-task DAG: `plans/2026-06-12-archived-repos-100-task-dag-v1.md`
- Per-track action plan: `plans/2026-06-12-archived-repos-consolidation-plan-v1.md`
- Executive summary: `plans/2026-06-12-archived-repos-summary-v1.md`
- Preservation policy: `archived-repos/PRESERVATION_POLICY.md`
- HC-09 (this task's port plan): `archived-repos/HC-PERF-RESULTS-PORT-PLAN.md`
- HC-11 (sibling plan, same wipe conditions): `archived-repos/HC-PATCHES-LIFT-PLAN.md`
- BG hygiene reports: `plans/2026-06-12-bg-*.md` (most wiped; verdicts re-derivable from the surviving source artifacts per the durability analyses)

---

**Status:** All 4 repos remain archived, untouched, and frozen. This registry is the SSOT for queries about "what is the archive doing here?".
