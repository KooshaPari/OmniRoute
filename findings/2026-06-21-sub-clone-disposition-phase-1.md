# Sub-clone disposition — Phase 1 (DELETE-LOCAL)

**Date:** 2026-06-21
**Author:** sub-clone disposition subagent
**Status:** ABORTED — Step 1 safety check failed
**Outcome:** 0 removed, 5 skipped (out of scope)

---

## TL;DR

Phase 1 did **not** execute. The task's Step 1 safety rule ("If ANY of the 5 has dirty state or non-main local branches, STOP and report — do not delete that one.") triggered on **3 of the 5 targets**. Additionally, **2 of the 5 do not exist** in this working tree, the referenced audit doc and ADR-057 are not present in the monorepo, and there is no `.gitmodules` file — these directories are independent git clones, not submodules. **No destructive action was taken.**

---

## Pre-flight context discrepancies

| Reference in task | Actual state in monorepo |
|---|---|
| `findings/2026-06-20-subagent-b-dmouse92-clones-audit.md` | **Does not exist.** `findings/` lists no such file. Closest matches: `findings/2026-06-20-v12-closure-report.md`, `findings/2026-06-21-helioscope-cancellation-rationale.md`, `findings/2026-06-21-V12-T01-router-repo-publish.md`. |
| `ADR-057 (apps/repos boundary)` | **Does not exist.** `docs/adr/2026-06-20/` contains only `ADR-015-v2.1`, `ADR-050`, `ADR-051`, `ADR-052`, `ADR-076`, `ADR-077`, `ADR-078`. Highest numbered ADR in monorepo: **ADR-078**. |
| `.gitmodules` (submodule pointers) | **Does not exist** at monorepo root. `cat .gitmodules` returns "No such file or directory". |
| `.git/modules/<name>/` (submodule gitdirs) | **None of the 5 exist** in `.git/modules/`. |
| Working branch | `ci/v12-gates-2026-06-21` (a CI gate branch, not main) |
| Working tree remote | `origin = github.com/KooshaPari/phenotype-apps.git` (the previously-reported `argis` remote is the second remote on this checkout) |
| Sparse-checkout state | **Disabled** (`core.sparseCheckout=false`, `core.sparseCheckoutCone=false`) — contradicts AGENTS.md claim of cone-mode sparse-checkout |

**Implication:** The 5 directories are **independent git clones** (each with its own `origin` pointing to `github.com/KooshaPari/<name>.git`), not git submodules. The Step 2 commands (`git submodule deinit`, `git rm $repo` against the monorepo index) would not work as written and would be inappropriate without a `.gitmodules` entry.

---

## Step 1 verification — per-target findings

### 1. `HeliosCLI/` — **NOT PRESENT**

```
ls: HeliosCLI: No such file or directory
ls: .git/modules/HelioSCLI: No such file or directory
git ls-tree HEAD | grep HeliosCLI: (empty)
```

- Directory does not exist in this working tree
- No submodule pointer exists
- **Status: not present (cannot be deleted; no work to lose)**

### 2. `Pyron/` — **NOT PRESENT**

```
ls: Pyron: No such file or directory
ls: .git/modules/Pyron: No such file or directory
git ls-tree HEAD | grep Pyron: (empty)
```

- Directory does not exist in this working tree
- No submodule pointer exists
- **Status: not present (cannot be deleted; no work to lose)**

### 3. `HexaKit/` — **PRESENT, DIRTY, ACTIVE BRANCH** ❌ STOP

```
branch: chore/L62-hexakit-adopt-2026-06-21   ← NOT trunk
remote:  git@github.com:KooshaPari/HexaKit.git
HEAD:    6f82788 chore(obs): L62 adopt pheno-otel::ErrorCounter for HexaKit  ← Jun 21
prev:    33e49ad chore: rebase marker (#300)
prev:    c658479 feat(rust): H14.3 alias resolver for model-id routing (#302)

Modified (uncommitted, unstaged):
  M Cargo.lock
  M docs/boundary/HexaKit.md   (23 lines changed)
  M docs/intent/HexaKit.md     (91 lines changed)

Staged: (none)
Untracked: (none)
Unmerged: 0
```

- **Safety violation #1: dirty state** — 3 files modified today (Cargo.lock + 2 docs, 59 insertions / 55 deletions)
- **Safety violation #2: non-main branch** — `chore/L62-hexakit-adopt-2026-06-21`
- **Recent work is exactly 2026-06-21** (today's date) — L62 obs adoption is part of the active v14 wave
- **Deletion would destroy active uncommitted work on a live L-number track**

### 4. `Tracera/` — **PRESENT, DIRTY, ACTIVE BRANCH** ❌ STOP

```
branch: chore/tier-0-hygiene-batch   ← NOT trunk
remote:  git@github.com:KooshaPari/Tracera.git
HEAD:    b6c4ef85b chore: tier-0 hygiene snapshot 2026-06-20
prev:    b7fd88b57 chore(tracera): recover stash@{0} (L7-001 hygiene batch …)
prev:    3423caf27 chore(tier-0): orch-v10-015 hygiene

Modified (uncommitted, unstaged):
  M docs/boundary/Tracera.md   (23 lines changed)
  M docs/intent/Tracera.md     (100 lines changed)

Untracked:
  ?? dispatch-mcp/ADR.md

Unmerged: 0
```

- **Safety violation #1: dirty state** — 3 files modified/added today (2 docs modified, 1 untracked ADR)
- **Safety violation #2: non-main branch** — `chore/tier-0-hygiene-batch`
- **Deletion would destroy a tier-0 hygiene batch + an untracked dispatch-mcp ADR**

### 5. `PhenoContracts/` — **PRESENT, DIRTY, ACTIVE BRANCH, UNMERGED** ❌ STOP

```
branch: fix/l5-119-quality-p0-2026-06-20   ← NOT trunk
remote:  git@github.com:KooshaPari/PhenoContracts.git
HEAD:    f9defc7 fix(ci): switch TruffleHog to filesystem mode; ignore coverage/ dir
prev:    2d37994 fix(ci): switch TruffleHog to filesystem mode (handles first commit)
prev:    66b6270 chore: tier-0 hygiene snapshot 2026-06-20

Modified (uncommitted, unstaged):
  M coverage/index.html
  M coverage/ports/adapters/coq.ts.html
  M coverage/ports/adapters/index.html
  M coverage/ports/adapters/kani.ts.html
  M coverage/ports/adapters/prusti.ts.html
  M coverage/ports/contract_verifier.ts.html
  M coverage/ports/index.html
  M docs/boundary/PhenoContracts.md   (21 lines changed)
  M docs/intent/PhenoContracts.md     (13 lines changed)

Staged (with conflict):
  M  deny.toml    (97 lines changed, 62/35 +/-)
  UU bun.lock     ← UNMERGED — both branches modified

Unmerged: 3
```

- **Safety violation #1: dirty state** — 9 modified files + 1 staged file with conflicts
- **Safety violation #2: non-main branch** — `fix/l5-119-quality-p0-2026-06-20`
- **CRITICAL: unmerged state** — `bun.lock` is in conflict (UU), `deny.toml` is staged mid-merge. Deletion would destroy an **in-progress merge resolution** of an L5-119 quality P0 fix.

---

## Step 2/3/4 — NOT EXECUTED

Per the task's own instruction: "If ANY of the 5 has dirty state or non-main local branches, STOP and report — do not delete that one." The verification step failed for **3 of the 5** targets (and 2 more don't exist at all). No `git submodule deinit`, `git rm`, `git commit`, or `git push` was issued. The working tree was not modified.

---

## Recommendations (next subagent / wave)

1. **Do not blindly proceed with Phase 1.** The referenced audit doc and ADR-057 do not exist. Before any DELETE-LOCAL work:
   - Author the audit doc with explicit per-target verifications + branch inventory
   - Author ADR-057 (or use the next available number) with the disposition policy
   - Re-verify which directories are actually present in this checkout vs. assumed present
2. **Confirm the working branch.** `ci/v12-gates-2026-06-21` is a CI gate branch; submodule-pointer changes here may belong on `main` / `master` / a `chore/<req-id>-sub-clone-disposition-<date>` branch instead.
3. **Trunk-only verification must be per-checkout.** Each developer / CI runner may have a different working-tree state. The audit must be re-run at the moment of deletion, not relied on from another machine.
4. **HexaKit/Tracera/PhenoContracts have live L-number work** (L7-001 hygiene, L62 obs adopt, L5-119 quality P0). Even if trunk-only is later confirmed, the v14 wave in progress is touching these repos; coordinate with active owners.
5. **HeliosCLI / Pyron absence** may already be the result of prior cleanup (consistent with the 2026-06-18 4-repo retirement documented in AGENTS.md) — verify with `gh repo view` against `KooshaPari/HeliosCLI` and `KooshaPari/Pyron` before assuming they're missing.

---

## What this subagent did NOT do

- Did **not** run `git submodule deinit -f` on any target
- Did **not** `rm -rf .git/modules/<name>`
- Did **not** `git rm -f <name>`
- Did **not** create a commit
- Did **not** push to `origin`
- Did **not** modify the working tree

The 5 target directories remain exactly as they were at the start of the task. PhenoContracts' unmerged `bun.lock` conflict is preserved for the human / next wave to resolve.