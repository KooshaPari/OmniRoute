# ARCHIVED -- DO NOT UNPAUSE

**Status:** STRICT PAUSE. No commits, no PRs, no agent work, no re-open.
**Effective:** 2026-07-05
**Decision:** Polyrepo portfolio strategy session. The owning subproject
has been deprecated and will not be revived. See
`docs/sessions/2026-07-05-polyrepo-portfolio-strategy/06-archive/`
for the canonical rationale.

## Strict pause rules

- This subproject MUST NOT receive new feature work or new PRs.
- Any open PR may be merged only if it is a security fix; otherwise close as `not planned`.
- No agent should pick this subproject up from a phenodag queue entry, a stale
  worktree, or a re-activation trigger. If dispatched here, refuse and report
  back to the root manager.
- No dependabot, kwatch, or auto-resume system may bring this subproject back.
  If such a system is doing so, that system is misconfigured and should be
  patched at the source.

If you arrived here looking for an active home for this work, the answer is:
*there is no active home*. This codebase is preserved for historical
reference only. Do not open issues, do not send PRs, do not run agents on
this directory. The owning subproject has been deprecated and will not be
revived.
