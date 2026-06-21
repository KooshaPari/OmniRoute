# ADR-036: forge-runner-scripts is the canonical collection repo for reusable forge runner scripts

`KooshaPari/forge-runner-scripts` is the canonical home for reusable forge runner scripts. It is curated from the operator's local `~/.forge/` (forge resume runs, autoqueue, commands, loop) into a 33-file / 468 KB dotfile-style collection with a single `install.sh` installer.

**Status:** Accepted
**Date:** 2026-06-18
**Author:** orchestrator (claude opus 4.7)
**Track:** v8 T14 (governance backlog)
**L8-016** (T14.7)

## Context

The operator accumulates forge runner scripts in `~/.forge/` over time:

- `~/.forge/forge_resume_runs/` — long-running forge dispatches (multi-hour waves)
- `~/.forge/autoqueue/bin/` — autoqueue orchestration scripts
- `~/.forge/commands/` — slash-command implementations (`/loop`, `/readiness-report`, etc.)
- `~/.forge/loop/` — `/loop` support files (per the `loop-support` skill)

Across 4 months of fleet operation this directory grew to **246 MB raw** of scripts, scratch logs, and orphaned state. The signal (the curated scripts that the operator actively uses) is **~33 files / 468 KB**; the rest is scratch / cache / orphan.

The scripts are not git-tracked. They are not shareable. When the operator switches devices, the scripts are not on the new device until manually re-derived. When a new operator joins, there is no canonical "where do the forge runner scripts live" answer.

## Decision

**`KooshaPari/forge-runner-scripts` is the canonical collection repo for the operator's reusable forge runner scripts.**

### Curation policy

- **Source:** `~/.forge/forge_resume_runs/`, `~/.forge/autoqueue/bin/`, `~/.forge/commands/`, `~/.forge/loop/`
- **Selection:** 33 files / 468 KB curated from 246 MB raw
- **Selection criteria:** a file is included if (a) the operator has invoked it ≥ 3 times in the last 30 days, OR (b) it is a slash-command implementation referenced by an active skill.

### Layout

```
KooshaPari/forge-runner-scripts/
├── bin/
│   ├── subagents-orchestration/   # scripts that orchestrate multiple subagents
│   └── autoqueue/                 # autoqueue scripts
├── commands/                      # slash-command implementations
├── specs/                         # per-script spec docs
├── docs/                          # cross-cutting docs (loop pattern, dispatch pattern)
└── install.sh                     # the dotfile installer
```

### `install.sh` — the dotfile installer

`install.sh` is the **single entry point** for installing the collection onto a new device. It:

1. Copies `bin/*` to `~/bin/` (or `$HOME/bin` if `~/bin` is not in `$PATH`).
2. Copies `commands/*` to `~/.forge/commands/`.
3. Copies `loop/*` to `~/.forge/loop/`.
4. Sets executable bits on shell scripts (`chmod +x`).
5. Verifies the install by running `--version` on each script.

The installer is idempotent: re-running it does not duplicate or overwrite local edits (it diffs first; local edits are preserved).

```bash
# Fresh install
git clone https://github.com/KooshaPari/forge-runner-scripts
cd forge-runner-scripts
./install.sh

# Verify
~/bin/forge-dispatch --version
```

## Consequences

*Positive:*
- The 33-file / 468 KB curated collection is git-tracked, shareable, and auditable.
- `install.sh` is a single-command bootstrap; new operators can be productive in 5 minutes.
- The 246 MB → 468 KB curation ratio (0.19%) means the collection is small enough to review line-by-line.
- The `specs/` directory enforces the "no script without a spec" rule; orphans cannot accumulate.

*Negative / Risks:*
- Curation is manual; the operator must re-curate when a new script is added. Mitigation: a monthly `~/.forge/audit.sh` script (itself in the collection) flags scripts in `~/.forge/` that are not in the collection and have been invoked ≥ 3 times in the last 30 days.
- The `install.sh` idempotency relies on a `diff` step; if the operator's local `~/bin/` has uncommitted symlinks, the diff may be misleading. Mitigation: `install.sh` prompts before any overwrite.
- The repo is operator-specific in style; it is not a generic "forge runner scripts" library. Mitigation: the README is explicit that this is the **Phenotype operator's** collection, not a general-purpose library.

## Refs

- AGENTS.md § "Key Commands" (forge dispatch proven working 2026-06-15)
- The `loop-support` skill (in `available_skills`)
- The `dispatch` skill (single-endpoint headless worker dispatch via OmniRoute)
- v8 plan § 3.6 Track T14 (ADR backlog)
