# 00 — Executive Summary

## Where the project stands

| Dimension                             | State                                                                                                                                                                                                                                                                                     |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Is it a fork?**                     | Yes. `KooshaPari/OmniRoute` ← `diegosouzapw/OmniRoute`. 1,021 ahead / 92 behind, status `diverged`.                                                                                                                                                                                       |
| **Does it run?**                      | **Yes.** Dev server on `:20128`; `/api/health` 200, `/login` 200 (745 KB real UI), login POST 200, `/dashboard` 200 authenticated.                                                                                                                                                        |
| **Does the gateway route?**           | **Yes.** `POST /api/v1/chat/completions` builds a pool of 8 targets and returns structured diagnostics. It stops at `ALL_TARGETS_SKIPPED` because **no provider has credentials** — a missing secret, not a defect.                                                                       |
| **Is it tested?**                     | ~48,061 test cases exist in `tests/`; per-area coverage is uneven (see 03). Coverage floor is 60% via `.qgate.toml` and is **informational only — it does not block**.                                                                                                                    |
| **Does CI gate anything?**            | **Now yes.** CI had produced **zero** non-`startup_failure` runs since 2026-10-05 — four actions were missing from the allowlist (fixed). `required_status_checks` was also unset; three green gates are now required. Force-push and branch-deletion blocking were **already** in place. |
| **Is the production build verified?** | **No.** It cannot complete on this workstation: swap exhausted (13.9 GB of 14.3 GB), Turbopack workers killed, `.build` frozen at 1,428 KB. Attempted twice.                                                                                                                              |
| **Biggest single risk**               | **Disk at 94–99% full.** It is actively corrupting npm installs (two confirmed truncated files).                                                                                                                                                                                          |

## What was accomplished 2026-10-16 → 17

Four commits pushed to `main`:

| SHA          | What                                                                                                                                 |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| `2619835e49` | Wired the resurrection guard into `.husky/pre-commit`; it had **never fired** (KI-031), plus `--staged-only` and the CI checkout fix |
| `a6c38f7d10` | KI-031 negative-control proof + handoff corrections                                                                                  |
| `6d726fb9f4` | KI-032 resolved locally; corrected a wrong package-manager claim                                                                     |
| `42f50de195` | **Fix: stop leaking `node:fs` into the client bundle** — this is what made every page 500                                            |

Plus the app went from non-functional to serving (see 02).

## The honest bottom line

The app **works**. The project is **not finished**, and the two facts are
independent. What separates them:

1. **CI is dead on this fork** and has been for 10+ days. Nothing is enforced
   remotely. The only working gate is the local husky pre-commit chain.
2. **Unfinished subsystems** are concentrated and countable (03), not diffuse.
   The Rust rewrite is 6-of-9 scaffolds; compression has 91 stub markers; there
   are 2,384 LOC of disabled provider handlers.
3. **Fork intent is under-documented.** The fork cherry-picks upstream and can
   never merge it (11,796 divergent files), but what "done" means is not
   written down (05).

## Time to finish — planning bands

| Target                                                                       | Time                             | Confidence                                                  |
| ---------------------------------------------------------------------------- | -------------------------------- | ----------------------------------------------------------- |
| **Usable instance** (log in, add one provider, get a completion)             | **hours**                        | High — app already serves; blocked only on operator secrets |
| **Clean-up pass** (delete dead code, close the counted stubs)                | **1–2 weeks**                    | Medium-high — mostly deletion                               |
| **"As close to finish as possible"**, excluding the Rust rewrite and scaling | **6–12 weeks** for 1–2 engineers | Medium — see 03/05                                          |
| **Rust rewrite made real** (6 scaffold crates)                               | **6–10 weeks** additional        | Low — scope never defined; may be better deleted            |
| **Production build verified on adequate hardware**                           | **1–2 days**                     | High — blocked purely by local RAM/disk                     |

## What the operator must decide

1. **Supply the secrets** to make the CVP real: `STORAGE_ENCRYPTION_KEY`
   (currently **empty → provider keys would be stored in plaintext**), a changed
   `INITIAL_PASSWORD`, and at least one provider credential.
2. **Unblock CI.** Actions are enabled in the API but every run dies with 0 jobs.
   Fork consent must be granted in the GitHub UI.
3. **Decide the Rust rewrite's fate** — finish it or delete it. It is the single
   largest unbounded item.
4. **Rule on the 4 gated items** carried from the earlier saga (see 06).
