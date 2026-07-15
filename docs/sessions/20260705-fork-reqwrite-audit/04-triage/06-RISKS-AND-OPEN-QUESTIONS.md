# Risks and Open Questions -- 04-triage

## Risks (with mitigations)

### R-1 -- AtomsBot or KaskMan has silent dependents in the polyrepo
**Risk:** the caller scan was capped at 10 files per term; deeper scan may
uncover tooling that imports AtomsBot or KaskMan code.
**Mitigation:** Phase 5 verification re-runs the caller scan with a higher
cap. If a real consumer is found, add an exception to the archive plan: the
consumer is migrated to the closest live spine (AuthKit for auth-adjacent code,
substrate for dispatch-adjacent code) before the strict-pause banner is
applied to the archived repo.

### R-2 -- GitHub archive flag is not enough; admins can unarchive
**Risk:** the user said "stops being unpaused" -- there is a history of
admins/agents un-archiving these repos.
**Mitigation:** the strict-pause README banner is the human/agent-readable
contract. Both the GitHub flag AND the banner must be set, and a note is
added to the AI-DD-META block in the existing AI-DD-managed repos so the
next agent to touch the dir sees the banner before any other content.

### R-3 -- KaskMan has 226 files; vendor-snapshotting takes time
**Risk:** archiving KaskMan without a snapshot loses the dashboard scripts
and claude-flow permanently.
**Mitigation:** the migration checklist Phase 2b explicitly vendors
claude-flow and dashboard-*.js into phenotype-org-audits/archive/kaskman/
before the banner is committed. This is a one-time copy, not a git
mirror; history lives in the original KaskMan repo, which is archived
(not deleted).

### R-4 -- phenotype-apps has 324+ entries, prune is destructive
**Risk:** pruning the *-Nth duplicates may break worktree expectations
elsewhere in the polyrepo.
**Mitigation:** the prune moves duplicates (does not hard-delete); the
preservation target is phenotype-org-audits/archive/<app>/. If a worktree
breaks, restore from there.

### R-5 -- Two "spines" claim the same role
**Risk:** the user wrote "phenotype-org-audits -> one of the spine repos"
-- a literal reading could mean "fold it into a spine", not "make it one".
**Mitigation:** this audit argues for the "make it a spine" reading and
documents the alternative. Sponsor sign-off requested in the executive
summary's open questions. If sponsor prefers fold, the recommended target
is pheno (workspace umbrella) -- not substrate, AgilePlus, or any other
specialized spine.

### R-6 -- The apps-extract branch on phenotype-apps is in flight
**Risk:** the active branch is apps-extract, which suggests the meta-repo
is being deliberately shrunk. Our prune-and-vendor actions may collide with
the extract work.
**Mitigation:** check with the branch owner (or git log apps-extract --oneline -20)
before pruning. If extract is in flight, defer the prune to a follow-up
lane and do only the spine-charter + catalog/ step in this round.

## Open questions for the sponsor

1. **Authvault deletion** -- confirm the GitHub web-UI archive (Phase 1) is
   acceptable. Alternative: keep Authvault on GitHub but unmaintained, and
   do not archive -- some users may still resolve the URL. The recommended
   action is archive; the alternative is "freeze (no archive)".

2. **Tracera role** -- is it the trace spine, or is it a leaf? My audit
   says spine (891 files, distinct from substrate's 118). If you disagree,
   the recommended reorg is to absorb Tracera into substrate as
   substrate/observability/trace/.

3. **phenotype-apps duplicates** -- prune the *-Nth copies or keep the
   empty placeholders so the slot name is reserved? Recommended: prune to
   a single canonical entry per app.

4. **KaskMan vendor scope** -- vendor the whole 226 files, or just the
   irreplaceable scripts (claude-flow, dashboard-*.js)? Recommended:
   the scripts only; the rest is regenerable from the archived GitHub repo.

5. **Strict-pause enforcement** -- the banner text uses assertive language
   ("no commits, no PRs, no agent work, no re-open"). Some readers may find
   this off-putting. The user asked for "strict" so I am erring toward
   strict; confirm or soften.

6. **GHD/Agentora/AtomsBot-Nth cleanup** -- the user only named
   AtomsBot/GDK/KaskMan for archival, but the polyrepo has several other
   -Nth duplicates (Agentora-2nd, AppGen, focalpoint, etc.) that look
   like worktree artifacts. Defer to a follow-up lane, or roll into this one?
   Recommended: defer to keep this PR focused.

## What I did NOT do (and why)

- I did not touch any code in the live repos. The deliverables are
  audit + plan + checklist; the user (or a sub-agent in a follow-up turn)
  applies the changes per the checklist.
- I did not push to GitHub. Pushing requires a gh auth check and
  sponsor sign-off on the open questions; both are preconditions in
  Phase 0 of the migration checklist.
- I did not propose new repos. The user did not ask for any. The seven
  spines + the archives + the deletions are sufficient to express the
  current portfolio's intended shape.
