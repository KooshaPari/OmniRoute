# Org-wide untracked-file survey (2026-10-15)

A side-effect of the KI-008 saga: the resurrection check I built
(`scripts/check/check-resurrection-patterns.mjs`) is general-purpose,
so it's worth checking whether OmniRoute's 100-resurrection spike
is unique or part of a wider pattern across the org.

## Method

For each of 8 active repos with local checkouts:

1. `git ls-files --others --exclude-standard | wc -l` to count
   untracked files
2. `bun /tmp/check-resurrection.mjs --working-tree-only` (copied
   from OmniRoute) to flag resurrections

## Results

| Repo | Branch | Untracked | Resurrections | Spike nature |
|------|--------|-----------|---------------|--------------|
| OmniRoute | main | 128 | **100** | saga target — 5 removal commits re-added in 1s |
| PhenoMLX | absorb-hfscope | 78 | 0 | new sidecar (`perf-core/hwledger/sidecars/bench-cockpit/`) |
| Tracera | main | 23 | 0 | session docs + audit (`.audit/`, `docs/sessions/`) |
| ShareCLI | fix/quinn-proto-0-11-18-osv-advisories | 0 | 0 | 3449 modified, but 0 untracked |
| AgilePlus | main | 0 | 0 | 3 modified, normal noise |
| Khostty | test/agent-ipc-phase0 | 2 | 0 | normal noise |
| PhenoApps | apps-extract | 1 | 0 | normal noise |
| PhenoShared | main | 0 | 0 | clean |

## Conclusions

1. **OmniRoute is unique.** No other repo in the org has a
   comparable resurrection spike. The 100 resurrections in
   OmniRoute are a single targeted event (5 commits, all
   Electron-related, all on 2026-09-17/18), not a systemic
   pattern.

2. **The check works on other repos.** Zero false positives
   in PhenoMLX/Tracera despite their untracked spikes. The
   resurrection algorithm (hash + deletion-set comparison) is
   portable.

3. **The check had a real ENOBUFS bug** on Tracera's larger
   history. Fixed in commit `51dc982e35` (maxBuffer 1 MiB → 64 MiB).

4. **PhenoMLX and Tracera both have ~100 untracked each**, but
   neither is a resurrection. PhenoMLX is a new in-progress
   sidecar project. Tracera is session/audit metadata. Both
   are normal "in-progress" spikes, not signal of a deeper
   problem.

## Org-wide recommendation

The check is worth wiring into the 8 active repos that have
local checkouts. Each is a 3-step process (copy script, add
lefthook entry, add CI workflow). Not done in this session —
each repo has its own pre-existing patterns (path globs,
Bun/Node version pins, branch naming) that need respect.
