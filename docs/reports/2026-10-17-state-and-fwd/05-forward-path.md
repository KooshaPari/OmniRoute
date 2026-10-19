# 05 — Forward Path

## Principle

"Finish" here means: **a green, enforced CI over a clean tree, with the
unfinished subsystems either deleted or implemented, and a stated fork posture.**
It does **not** mean the Rust rewrite is done — that is a separate, unbounded
decision.

## Phase 0 — Make it usable (hours, operator-blocked)

Everything here is a secret or a UI action. No code required.

| #   | Action                                                            | Why                                                   | Blocked on |
| --- | ----------------------------------------------------------------- | ----------------------------------------------------- | ---------- |
| 0.1 | `openssl rand -base64 32` → `STORAGE_ENCRYPTION_KEY`              | Without it, provider keys are stored **in plaintext** | Operator   |
| 0.2 | Change `INITIAL_PASSWORD` off `CHANGEME`                          | Default credential                                    | Operator   |
| 0.3 | Add one provider credential                                       | Gateway has 0 usable targets                          | Operator   |
| 0.4 | Verify streaming: `POST /api/v1/chat/completions {"stream":true}` | Never exercised                                       | After 0.3  |
| 0.5 | Grant fork Actions consent (GitHub UI) if dispatch still fails    | CI admission                                          | Operator   |

**Exit criterion:** a real completion streams end to end.

## Phase 1 — Lock the gains (1–2 days)

| #   | Action                                                       | Why                                                                        |
| --- | ------------------------------------------------------------ | -------------------------------------------------------------------------- |
| 1.1 | **Enable branch protection** with `CI` required              | CI now runs but enforces nothing. Highest-leverage single change.          |
| 1.2 | Get CI green                                                 | The pnpm migration (#756) landed unvalidated across 32 workflows           |
| 1.3 | **Free disk** (currently 94% full)                           | Disk pressure has already corrupted two dependency files. This will recur. |
| 1.4 | Reconcile the stash and uncommitted workflow edits           | Working tree is not clean; see 06                                          |
| 1.5 | Verify the production build on adequate hardware (64 GB box) | Never completed locally                                                    |

**Exit criterion:** `main` is protected, CI is green, tree is clean.

## Phase 2 — Delete the dead weight (3–4 days)

Pure deletion. High value, low risk. Each item needs a "is anything importing
this?" check first.

| #   | Target                                                  | Size                 |
| --- | ------------------------------------------------------- | -------------------- |
| 2.1 | `providerHandlers.disabled-by-tier1-cleanup/`           | 12 files / 2,384 LOC |
| 2.2 | `electron/` (or adopt it: tests + workspace membership) | 2,496 LOC, 0 tests   |
| 2.3 | Rust scaffold crates (if the decision is "delete")      | 6 crates             |
| 2.4 | Remaining inert `lefthook.yml` blocks                   | ~5 blocks            |

**Exit criterion:** dead code gone; `lefthook.yml` is either live or removed.

## Phase 3 — Close the counted stubs (4–8 weeks)

| #   | Target                                                           | Estimate |
| --- | ---------------------------------------------------------------- | -------- |
| 3.1 | Compression stubs (`open-sse/services/compression/`, 91 markers) | 10–20 d  |
| 3.2 | Svelte shells (22 pages under 15 lines)                          | 5–10 d   |
| 3.3 | `desktop-electrobun/` scaffold                                   | 5–8 d    |
| 3.4 | Make the coverage floor **blocking**                             | 20–40 d  |
| 3.5 | Misc `src/` stub markers (~185)                                  | 3–5 d    |

**Exit criterion:** a blocking coverage floor at 60%+ and no counted stub
clusters above a stated threshold.

## Phase 4 — Decide the Rust rewrite (a decision, not a task)

The six scaffold crates (`providers`, `router`, `compression`, `mcp`, `api`,
`bifrost`) contain 12–25 LOC each and a placeholder test. There are exactly two
coherent options:

- **Delete them** (1 day). Keep `core`, `storage`, `cli`. This is the honest
  reading of the evidence: nothing depends on the scaffolds and no scope was
  ever defined.
- **Commit to the rewrite** (30–50 days minimum, **low confidence**). Requires a
  written scope, a parity target against the TypeScript implementation, and a
  reason to exist that the language choice alone does not provide.

**Do not leave this undecided** — it is the largest unbounded item in the
project and the main reason "time to finish" has a wide band.

## Phase 5 — State the fork posture (1–2 days)

| #   | Action                                                                  |
| --- | ----------------------------------------------------------------------- |
| 5.1 | Fix the 237-vs-358 provider contradiction in `UPSTREAM_SYNC.md`         |
| 5.2 | Document an explicit answer: do we track upstream, and on what cadence? |
| 5.3 | Confirm the published artifacts (ghcr image, npm scope) match the docs  |
| 5.4 | Decide the fate of the upstream-sync automation                         |

## Total

| Scope                                                | Estimate                        |
| ---------------------------------------------------- | ------------------------------- |
| Phase 0 (usable)                                     | **hours**                       |
| Phases 1–2 (lock + delete)                           | **1 week**                      |
| Phases 3 + 5 (stubs + posture)                       | **4–8 weeks**                   |
| **"As close to finish as possible"**, excluding Rust | **~6–12 engineer-weeks**        |
| Phase 4 if the rewrite is pursued                    | **+6–10 weeks, low confidence** |

## What would change these estimates

- **Scaling requirements** — not modelled here.
- **Sunset** — if the fork is abandoned, only Phase 1.3 (disk) matters.
- **User feedback** — you have not yet used the running app; using it will
  reorder everything.
- **Intent evolution** — the CVP scope is operator-defined, not inferred.

## Recommended first move

**Phase 0, then 1.1 (branch protection).** Phase 0 is hours and unlocks the
product; 1.1 converts CI from decoration into a gate. Everything else is
sequencing.
