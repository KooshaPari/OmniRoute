# Close Button/Commands: GitHub Issue Not Found - Plan & WBS

## Objective
Eliminate the "GitHub issue not found" error when using the Close button and related commands by binding each thread to the repository it originated from and using that repo context for all issue operations. Improve diagnostics on failure.

## Root Cause Hypothesis
- Global repo config (owner/repo) used everywhere; threads can originate from different repos or environment can change later, causing 404 when closing.
- Token scopes or permission mismatches causing 403.
- Stale/missing thread.number in some edge cases.

## Fix Strategy
- Add per-thread repository binding (repoOwner, repoName).
- Use getRepoCredentialsForThread(thread) everywhere to call GitHub APIs and build URLs.
- Improve error messages (404/403 specific guidance).

## Scope of Changes
- Types: src/interfaces.ts (Thread: repoOwner?, repoName?)
- Helper: src/github/githubActions.ts (getRepoCredentialsForThread)
- Populate bindings:
  - formatIssuesToThreads() sets repoOwner/repoName from current repoCredentials
  - createIssue() binds repoOwner/repoName on success
- Update call sites to use per-thread repo:
  - src/discord/buttonHandlers.ts (get/update + refresh)
  - src/discord/commands/status.ts (update/lock/unlock)
  - src/discord/commands/label.ts (get/update + embed links)
  - src/discord/embeds.ts (get + embed links)
  - src/discord/smartEmbeds.ts (links)
  - src/github/githubActions.ts (lock/unlock/update via updateWithThread)
- Deprecated: githubManage.ts and the `/github-manage` command have been removed. Use `/link` for linking and the core `/status`, `/priority`, and `/label` commands for updates.

## WBS
1. Diagnostics & UX
   - [x] Improve error handling in buttonHandlers/status for 404/403
2. Data Model
   - [x] Add Thread.repoOwner/repoName
   - [x] Implement getRepoCredentialsForThread(thread)
3. Binding & Propagation
   - [x] formatIssuesToThreads sets repoOwner/repoName
   - [x] createIssue binds repoOwner/repoName
4. Call Site Upgrades
   - [x] buttonHandlers: toggle state and refresh use per-thread repo
   - [x] status command uses per-thread repo in thread context
   - [x] label command uses per-thread repo and correct URLs
   - [x] embeds use per-thread repo to fetch and link
   - [x] githubActions lock/unlock/update WithThread variant
5. Testing & Verification
   - [ ] Unit checks for getRepoCredentialsForThread
   - [ ] Playwright E2E: close/reopen via button; status command; negative paths
   - [ ] Capture 1920x1080 screenshots + a short video; commit to screenshots/; embed in PR
6. Documentation & PR
   - [x] Create this plan doc
   - [ ] Update doc with testing artifacts and final acceptance checklist
   - [ ] Create PR with embeds and results

## Acceptance Criteria
- Close button toggles state successfully for any linked thread that originated from a repo the token can access.
- Status command in a thread uses that thread’s repo context.
- On 404/403, users see precise, actionable guidance.
- Screenshots and video demonstrate success paths and error handling.

## Risks & Mitigations
- Threads created before this change won’t have repoOwner/repoName: mitigated by defaulting to current repoCredentials and guiding user if 404 appears; a background refresh pass could add repo bindings.
- Multi-repo support in UI: URLs now reflect per-thread repo where available.

## Next Steps
- Implement small tests.
- Run Playwright and document results in this file.
- Prepare PR with assets and detailed comments per project guidelines.


## Update (stacked PR note)
- Backfill routine implemented and per-thread repo binding in place.
- Next: add Playwright tests, screenshots, and PR embeds.
