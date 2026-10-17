# OmniRoute — Full State & Forward Path

**Date:** 2026-10-17
**Repo:** `KooshaPari/OmniRoute` @ `42f50de195` (branch `main`)
**Fork of:** `diegosouzapw/OmniRoute` — **yes, this is a fork**
**Audience:** operator
**Status of the app:** **running and serving** on `http://127.0.0.1:20128`

---

## How to read this set

| File                                  | What it answers                                                            |
| ------------------------------------- | -------------------------------------------------------------------------- |
| `00-executive-summary.md`             | The whole thing in one page. Start here.                                   |
| `01-fork-identity.md`                 | What the fork is, how far from upstream, what "finishing the fork" means   |
| `02-usability-state.md`               | What actually works right now, measured by live probes                     |
| `03-immaturity-and-time-to-finish.md` | Every stub / mock / shell / dead-code cluster, with engineer-day estimates |
| `04-gates-and-ci.md`                  | Whether anything gates this repo, and why CI has never run                 |
| `05-forward-path.md`                  | The concrete plan to "as close to finish as possible"                      |
| `06-evidence-log.md`                  | Every command run and its observed result                                  |

---

## The one-paragraph version

This is a **fork that works but is not finished**. On 2026-10-16/17 the app was
taken from _non-functional_ (every page returned HTTP 500) to _running_ by fixing
two real defects: a server-only `node:fs` import leaking into the client bundle,
and a truncated `tailwind-merge` (1,669 bytes vs ~106 KB) written during disk
pressure at 99% full. Login, the dashboard, the model catalog, and gateway
routing now all respond correctly. What remains is not "make it run" — that is
done — but **CI has never once succeeded on this fork** (57 `startup_failure`
runs, 0 jobs), a cluster of unfinished subsystems (a 6-of-9-scaffold Rust
rewrite, 91 stub markers in compression, 2,384 LOC of disabled provider code),
and an unfinished fork-sync posture. Reaching "as close to finish as possible"
is roughly **6–12 engineer-weeks** excluding the Rust rewrite; reaching a
_genuinely usable instance_ is **hours** and is blocked only on secrets the
operator must supply.

**Estimates in this document are planning bands, not measurements.** They are
derived from the counted artifacts below, and the assumptions are stated at each
step. Where something was not verified, it says so.
