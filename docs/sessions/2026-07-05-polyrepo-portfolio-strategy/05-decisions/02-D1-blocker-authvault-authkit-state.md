# BLOCKER: D1 conflict on Authvault/AuthKit state (2026-07-05 03:51 UTC)

**Status:** ROOT HALTED ALL PR PUSHES pending sponsor resolution.

---

## What the prior analysis assumed (WRONG)

- AuthKit README self-declares successor to Authvault.
- AuthKit shipped FR-AUTHV-018 (PKCE).
- Authvault main was at c7994b9 (`chore: mark Authvault as archived —
absorbed into AuthKit`).
- Decision D1 = YES: KEEP AuthKit, DELETE Authvault.

## What the actual git state shows (RIGHT NOW, 2026-07-05 03:51 UTC)

### Authvault (origin/main at 3c659fe)

- 3c659fe ci: pin nightly toolchain + apply rustfmt-nightly (#92)
- 7897e08 feat(pkce): GAP-008 PKCE state→session binding at middleware (#94)
- 51b17b0 feat-middleware-gap010 (#93)
- **The c7994b9 archive marker is GONE from the main tip.**
- The PKCE work (GAP-008, GAP-010) that the AuthKit description says it
  "absorbs" actually landed in Authvault, not AuthKit.
- GitHub API: `archived: false`, `open_issues_count: 4`, language=Rust,
  description="Authentication and authorization framework with OAuth2,
  JWT, RBAC/ABAC, and multi-tenant support."

### AuthKit (origin/main at ... 3 commits ahead of local)

- Local HEAD: bc74d31 `wip/local-dump-20260626: auto-commit before cleanup`
- Last meaningful commit: 064b310 `feat: AuthKit initial landing —
FR-AUTHV-018 PKCE state binding`
- Behind origin/main by 3 commits (which are likely the GAP-008/010 work).
- GitHub API: `archived: false`, `open_issues_count: 0`, language=Rust.

### Implication

The PKCE state→session binding (FR-AUTHV-018 / GAP-008) exists in BOTH
repos but is ahead in Authvault. Authvault is NOT the empty post-archive
repo we assumed. It has active, recent, meaningful work that overlaps
with AuthKit.

---

## Why I halted

D1 = "KEEP AuthKit, DELETE Authvault" was correct only under the prior
state. Under the current state:

- If I archive Authvault now, I delete the GAP-008/010 work that is NOT
  yet in AuthKit. That is destructive.
- If I "port GAP-008/010 from Authvault to AuthKit first, then archive
  Authvault", that is a real PR series (3+ commits to AuthKit, then
  archive) that changes the original D1 spec.
- If I "delete Authvault regardless", I lose 4 open issues + the PKCE
  middleware work + the public Authvault surface.

The user said "1 is a yes" -- but the yes was given when the c7994b9
archive marker was at HEAD. The state has changed since that yes.

---

## What I did NOT do (and why)

- Did NOT push PR-C (Authvault archive deprecation banner).
- Did NOT push PR-D (AuthKit migrations doc) -- it is predicated on
  Authvault being archived, which is now in question.
- Did NOT push PR-A (org-audits spine) -- the recent commits there are
  phenodag-audit work; my charter would race with the in-flight
  phenodag-pillar series (P20-P28).
- Did NOT set the GitHub Archived flag on Authvault.
- Did NOT push PR-B (apps spine) -- local checkout has OmniRoute as
  origin remote, not phenotype-apps (misconfigured); R-C is also in
  flight on apps-extract.

## What I DID do

- Placed the process-safety note ("Codex|Forge + Claude|Ghostty MUST
  NEVER be killed by automated safety systems") in:
  - `repos/AGENTS.md` (canonical contract, line 549)
  - session overview doc
- Placed 7 strict-pause README banners in phenotype-apps/{AtomsBot,
  AtomsBot-2nd..5th, GDK, KaskMan} -- these are uncommitted in the
  misconfigured checkout; will not push from there.
- Updated `00_MASTER_SYNTHESIS.md` and `00_SESSION_OVERVIEW.md` to
  reflect the scope correction (no OmniRoute, no BytePort).
- Handed off the OmniRoute Rust rewrite audit (8 files, 1604 lines) to
  the OmniRoute team via the session folder
  `docs/sessions/20260705-omniroute-backend-rewrite/`.

## The OmniRoute audit hand-off (NOT my lane)

Location:
`docs/sessions/20260705-omniroute-backend-rewrite/`

- 00-MASTER-SYNTHESIS.md
- 00-SESSION-OVERVIEW.md
- 01-inventory/
- 02-language-eval/
- 03-architecture-research/
- 04-migration-strategy/
- 05-requirements/
- 06-plan/

Summary: 30 PRs / 24 weeks, pure-Rust, 12 omniroute-rust crates (1 with
code), Bifrost v1.5 pivot, kill switch <30s, 4-slot ceiling respected.
Sponsor decisions D-omni-01..10 listed.

The OmniRoute team owns this. Root will not act on it.

---

## Sponsor input needed (D1 conflict)

Pick one:

A. **Port GAP-008/010 from Authvault to AuthKit, THEN archive Authvault.**
This is the cleanest "delete Authvault" path. ~3 PRs to AuthKit + 1
archive PR to Authvault. ~2-3 days of work.

B. **Re-merge Authvault work into AuthKit via a real PR series, then
delete Authvault.** Same as A but with proper code review on the
AuthKit side.

C. **Reconsider D1: keep BOTH, mark Authvault as "frozen at GAP-008/010"
with a redirect to AuthKit for new work.** This is a soft archive,
not a hard one. No code loss, no destructive op.

D. **Hard delete Authvault, accept losing GAP-008/010 and the 4 open
issues.** Fastest, most destructive. NOT recommended.

E. **Escalate to user-in-the-loop, defer all D1 work until they return.**

My recommendation: **A** (port + archive). It honors the D1 intent,
preserves the work, and gives the OmniRoute/AuthKit/Authvault team a
clean end-state.

---

## Other findings (FYI, not blocking)

- `phenotype-apps/` local checkout has OmniRoute as its origin remote.
  Likely a multi-remote worktree setup. Pushing from there is unsafe.
  Will need sponsor confirmation before any push.
- `phenotype-org-audits/` has 1 unpushed commit
  (`consolidation/config-consolidation-plan-2026-06-29` branch) +
  untracked files. Active phenodag-pillar work in flight. Spine
  charter would race with that.
- `AuthKit/` is 3 commits behind origin/main on the same GAP-008/010
  work. Pulling will fast-forward.
