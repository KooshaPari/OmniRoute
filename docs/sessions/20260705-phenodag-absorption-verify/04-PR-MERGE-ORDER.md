# PR Merge Order — Phenodag absorption

**Date:** 2026-07-05 08:27Z

## Order (dependency-respecting)

1. **Tracera #723** — spec 008 (no code). Sets the contract for Tracera side.
2. **AgilePlus #895** — spec 008 (no code). Sets the contract for AgilePlus side.
3. **Tracera #725** — P1 code: claim, heartbeat, lifecycle. First code in Tracera.
4. **AgilePlus #896** — P1 code: YAML preset loader + 4 corpora. First code in AgilePlus.
5. **Tracera #726** — P2 code: dedup, sqlite, scanner, export, beads, status, init.
6. **phenodag #29** — LAST. The 1-release thin redirector. GATES the deletion.

## Per-PR review checklist

For each PR, the reviewer should confirm:
- [ ] spec is consistent with the master synthesis
- [ ] FR IDs are present and link to the spec
- [ ] no new external dependencies
- [ ] tests pass in CI
- [ ] (for code PRs) the implementation matches the spec
- [ ] (for the redirector) the README points to BOTH Tracera AND AgilePlus

## Once all 6 merged

- [ ] Start the 1-release-cycle clock
- [ ] Update phenodag/CHANGELOG.md with the cycle start date
- [ ] Watch for any issues filed against phenodag (these are consumers discovering the move)
- [ ] When the clock expires, run the 6-step deletion playbook in 00-ABSORPTION-VERIFICATION.md
