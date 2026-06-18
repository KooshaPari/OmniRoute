# Archived-Repos Preservation Policy

**Date:** 2026-06-14
**Scope:** All 4 archived/private repos in the Phenotype ecosystem.
**Authority:** `archived-repos/REGISTRY.md` (companion SSOT).
**Owner:** Phenotype-org governance.

**Wipe-resilience note (2026-06-14):** This policy was wiped between 2026-06-12 and 2026-06-14 along with the rest of `archived-repos/`. It is being re-issued with the same content it had on 2026-06-12, plus a §9 note pointing at the durability analyses in `HC-09` §1.3 and `HC-11` §1.3.

---

## 1. The 5 hard rules

### 1.1 NO DELETION
- **No archive may be deleted from GitHub or local clones.**
- This applies even if:
  - The archive is empty (0 files of code).
  - The archive's "successor" is fully complete.
  - The 2026-06-08 org-wide consolidation memo recommends deletion.
  - The archive was an experiment that "didn't work out".
- **Rationale:** Archives are historical records. Deletion erases provenance. A frozen bad idea is more useful than a void.

### 1.2 NO UNARCHIVE
- **No archive may be unarchived (set `isArchived: false` on GitHub).**
- This applies even if:
  - The user has time/energy to revive the work.
  - A new successor has been proposed.
  - A "preserved concept" needs to be re-extracted.
- **Rationale:** Unarchiving changes the repo's identity and breaks the immutable "frozen 2026-05-XX" reference. Revival work should happen in a NEW repo or in the active successor, not by unarchiving the original.
- **Exception (rare):** If the user explicitly authorizes an unarchive with a written rationale and a successor-or-burn plan, AND it's logged in `archived-repos/UNARCHIVE_LOG.md`.

### 1.3 STATUS.md REQUIRED
- **Every archive must have a `STATUS.md` at the repo root.**
- The STATUS.md must contain:
  - Date frozen (e.g., 2026-05-02)
  - The active successor (with repo URL)
  - The most recent audit report path
  - The reason it was archived (verbatim from GitHub description or AGENTS.md)
  - The owner (GitHub handle)
- **Rationale:** A future contributor (human or agent) needs to know "what is this frozen thing and where is the live version?" in one read.

### 1.4 AUDIT EVERY 6 MONTHS
- **Every archive must be re-audited at least every 6 months.**
- The audit must:
  - Confirm the archive is still archived (via `gh repo view --json isArchived`).
  - Confirm the successor still exists and is active.
  - Capture hygiene baselines (clippy, fmt, gitleaks, deny).
  - Verify the STATUS.md is up-to-date.
- **Audit cadence:** Q1 (January) + Q3 (July) — see `archived-repos/.github/workflows/audit.yml`.

### 1.5 SUCCESSOR-LINK MANDATORY
- **The active successor repo must contain a cross-reference to the archive.**
- Cross-reference can be in:
  - README "Lineage" / "See also" / "Related repos" section
  - AGENTS.md "Archived siblings" section
  - docs/archive/ dedicated folder (preferred for 1+ page references)
- **Rationale:** A user discovering the successor should immediately know about the archive, and vice versa.

---

## 2. Per-repo application

| Repo | Personal-project constraint | Successor-link required in | STATUS.md present? |
|---|---|---|---|
| KVirtualStage | **YES** ("STRICTLY DO NOT DELETE NOR UNARCHIVE") | `KDesktopVirt/docs/archive-kvirtualstage.md` | Optional (per §1.3, the GitHub description is sufficient) |
| PhenoLang | No (organizational archive) | `phenoUtils/docs/`, `HexaKit/`, `AgilePlus/` | Recommended |
| helios-cli-backup | No (organizational archive) | `HeliosCLI/README.md` (Lineage section) | Recommended |
| phenotype-colab-extensions | No (organizational archive) | `HeliosLab/docs/archive/colab-extensions-INDEX.md` | Recommended |

---

## 3. The KVirtualStage gold standard

The `KooshaPari/KVirtualStage` repo's GitHub description is the gold standard for personal-project preservation:

> "STRICTLY DO NOT DELETE NOR UNARCHIVE - Personal Project - Desktop automation platform for AI agents"

Why this is exemplary:
1. **Explicit** — no ambiguity about what's allowed.
2. **Self-describing** — "Personal Project" signals the author owns the policy.
3. **Negative-space** — defines what NOT to do (delete, unarchive).
4. **Concise** — fits in the GitHub description field.

All other archived repos in the Phenotype ecosystem should aspire to this clarity, but it's not required to be exactly this wording. The minimum bar is §1.1–§1.5 above.

---

## 4. Branch protection (recommended for all archives)

For archived repos, the GitHub branch protection on `main` should be:
- Required reviewers: 1 (the archive owner, or `@KooshaPari` for personal archives)
- Required status checks: `archived-repos-audit` (weekly hygiene baseline)
- Required conversation resolution: yes
- Allow force pushes: NO
- Allow deletions: NO
- Allow unarchive: NO (per §1.2)

This is enforced via the per-repo `CODEOWNERS` + the global `archived-repos/PRESERVATION_POLICY.md` SSOT.

---

## 5. CI guard (recommended for the active successor)

Every active successor repo should have a CI guard that PR-fails if any PR:
- Adds a file with the archived repo's name prefix (e.g., `kvirtualdesktop-` for KVirtualStage).
- Re-introduces a "TODO: port from <archive>" comment.
- Removes a `// FROZEN-ARCHIVED-REFERENCE` marker.

Examples:
- `KDesktopVirt/.github/workflows/no-port-kvirtualstage.yml` (per DAG task `arc-5-02`)
- `HeliosCLI/.github/workflows/snapshot-parity.yml` (per DAG task `arc-5-07`) — **PR-fails any PR that modifies `HeliosCLI/perf-results/` without a documented new baseline run with a fresh composite SHA-256** (per HC-09)

---

## 6. What "PRESERVE" means in practice

| Action | Allowed? | Notes |
|---|---|---|
| `gh repo view` | YES | Read-only |
| `git clone` | YES | Read-only |
| `git log`, `git show`, `git diff` | YES | Read-only |
| Add `STATUS.md` to the archived repo | YES, but requires a PR | Per §1.3 |
| Run cargo fmt/clippy/test on the archived source | YES, but report-only | For audit baselines |
| Run gitleaks/deny on the archived source | YES, but report-only | For audit baselines |
| `git push` to the archived repo | ONLY for in-archive docs (STATUS.md, etc.) | Requires owner approval |
| Modify source code in the archive | NO | The archive is frozen |
| Unarchive | NO | Per §1.2 |
| Delete | NO | Per §1.1 |

---

## 7. Escape hatch: the UNARCHIVE_LOG

If a future user explicitly authorizes an unarchive, the procedure is:
1. User writes a rationale to `archived-repos/UNARCHIVE_LOG.md` (e.g., "KVirtualStage unarchived 2027-01-15 to revive the desktop-automation platform with a new MCP-based architecture").
2. The log entry includes:
   - Date
   - User (GitHub handle)
   - Rationale (1 paragraph)
   - Plan for the next 90 days (1 paragraph)
   - Success criteria (bullet list)
3. The unarchive happens.
4. A new repo or branch is created for the revival work; the original archive remains as a baseline.
5. The 6-month audit cadence continues on the revived repo.

This log is the **only** way to bypass §1.2.

---

## 8. Cross-references

- `archived-repos/REGISTRY.md` — SSOT for the 4 archived repos
- `archived-repos/HC-PERF-RESULTS-PORT-PLAN.md` — HC-09, perf-results byte-equal verdict + durability analysis
- `archived-repos/HC-PATCHES-LIFT-PLAN.md` — HC-11, patches lift-with-provenance + durability analysis
- `archived-repos/.github/CODEOWNERS` — owner assignments
- `archived-repos/.github/workflows/audit.yml` — weekly hygiene audit
- `archived-repos/.github/workflows/release-check.yml` — daily archived-status check
- `archived-repos/UNARCHIVE_LOG.md` — escape-hatch log (empty unless used)
- `plans/2026-06-12-archived-repos-100-task-dag-v1.md` — 100-task DAG with §1.1–§1.5 cited per task

---

## 9. Durability under /tmp wipe (added 2026-06-14)

The policy and its companion SSOT (`REGISTRY.md`) and per-track plans (HC-09, HC-11) are designed to survive a `/tmp` cleanup that wipes the local archive clone and any gitleaks/diff scratch files. The recovery procedure for any wiped plan is:

1. Re-fetch the archive: `gh repo clone KooshaPari/helios-cli-backup /tmp/helios-cli-backup`
2. Re-run the per-file SHA-256 comparison against the active (see HC-09 §1.3 §3 verification commands).
3. Re-issue the SSOT (`REGISTRY.md`) and the per-track plans with the same content they had on the last intact turn, plus a wipe-resilience note in the header.

The 5 hard rules (§1.1–§1.5) are invariant and re-derivable from:
- The archived GitHub repos themselves (`KooshaPari/KVirtualStage`, `KooshaPari/PhenoLang`, `KooshaPari/helios-cli-backup`, `KooshaPari/phenotype-colab-extensions`).
- The active successor repos (`KDesktopVirt`, `HexaKit` + `AgilePlus` + `phenoUtils`, `HeliosCLI`, `HeliosLab`).
- The HC-09 §1.3 and HC-11 §1.3 durability analyses (which themselves are the durable artifacts).

---

**Status:** This policy is in effect as of 2026-06-14 for all 4 archived repos in `archived-repos/REGISTRY.md`. Any new archived repo added to the registry inherits this policy automatically.
