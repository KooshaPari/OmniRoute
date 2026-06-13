# Worktree Audit - 2026-06-10

Source commands:
- `git worktree list`
- `git worktree list --porcelain`
- `git log -1 --format=%cI` / `git show -s --format=%cI`
- `git branch --format='%(refname:short) %(committerdate:iso8601) %(objectname:short) %(upstream:short)'`

Audit basis: 33 registered worktrees. Dates are the committer dates for each worktree HEAD.

| # | Worktree path | Branch | HEAD | Last commit date | Classification | Decision |
|---:|---|---|---|---|---|---|
| 1 | `/Users/kooshapari/CodeProjects/Phenotype/repos` | `fix/repos-status-md-restoration-20260608` | `d2213e12c4` | 2026-06-09T20:35:40-07:00 | active | Keep. Current root checkout for repos status restoration work. |
| 2 | `/private/tmp/focalpoint-pr71-rebase` | detached HEAD | `7b78b5d051` | 2026-06-08T21:52:52-07:00 | duplicate | Delete. Detached scratch checkout at the same HEAD as `main` and most agent-spawned worktrees. |
| 3 | `/private/tmp/fp-pr71-72195` | detached HEAD | `8ca842066d` | 2026-05-28T17:43:53-07:00 | stale | Delete after confirming PR71 is no longer needed. Old detached FocalPoint PR scratch checkout. |
| 4 | `/Users/kooshapari/CodeProjects/Phenotype/.claude/worktrees/agileplus-pr663` | `chore-feature-agileplus` | `7b78b5d051` | 2026-06-08T21:52:52-07:00 | duplicate | Delete. Named worktree points at the same HEAD as `main`; no unique worktree HEAD. |
| 5 | `/Users/kooshapari/CodeProjects/Phenotype/.claude/worktrees/focalpoint-pin-actions-20260605` | `chore/pin-actions-20260605` | `9673d0ba5a` | 2026-06-10T21:40:41-07:00 | active | Keep/merge. Recent branch with unique HEAD and remote tracking branch. |
| 6 | `/Users/kooshapari/CodeProjects/Phenotype/.claude/worktrees/phenoMCP-ci-sha-pin-102` | `ci/sha-pin-checkout-20260606` | `96ec73c204` | 2026-06-08T19:23:26-07:00 | active | Keep/merge. Recent CI pin branch with unique HEAD. |
| 7 | `/Users/kooshapari/CodeProjects/Phenotype/repos/.claude/worktrees/agent-a0029279854c3f890` | `worktree-agent-a0029279854c3f890` | `7b78b5d051` | 2026-06-08T21:52:52-07:00 | agent-spawned | Delete. Locked agent worktree at shared `main` HEAD; no unique HEAD. |
| 8 | `/Users/kooshapari/CodeProjects/Phenotype/repos/.claude/worktrees/agent-a022027cc9fe1036f` | `worktree-agent-a022027cc9fe1036f` | `7b78b5d051` | 2026-06-08T21:52:52-07:00 | agent-spawned | Delete. Locked agent worktree at shared `main` HEAD; no unique HEAD. |
| 9 | `/Users/kooshapari/CodeProjects/Phenotype/repos/.claude/worktrees/agent-a178937d3dc56ca4d` | `worktree-agent-a178937d3dc56ca4d` | `7b78b5d051` | 2026-06-08T21:52:52-07:00 | agent-spawned | Delete. Locked agent worktree at shared `main` HEAD; no unique HEAD. |
| 10 | `/Users/kooshapari/CodeProjects/Phenotype/repos/.claude/worktrees/agent-a24d2c59c30002a08` | `worktree-agent-a24d2c59c30002a08` | `7b78b5d051` | 2026-06-08T21:52:52-07:00 | agent-spawned | Delete. Locked agent worktree at shared `main` HEAD; no unique HEAD. |
| 11 | `/Users/kooshapari/CodeProjects/Phenotype/repos/.claude/worktrees/agent-a28374593de90ccbf` | `worktree-agent-a28374593de90ccbf` | `7b78b5d051` | 2026-06-08T21:52:52-07:00 | agent-spawned | Delete. Locked agent worktree at shared `main` HEAD; no unique HEAD. |
| 12 | `/Users/kooshapari/CodeProjects/Phenotype/repos/.claude/worktrees/agent-a29c3210f9a6887c8` | `worktree-agent-a29c3210f9a6887c8` | `7b78b5d051` | 2026-06-08T21:52:52-07:00 | agent-spawned | Delete. Locked agent worktree at shared `main` HEAD; no unique HEAD. |
| 13 | `/Users/kooshapari/CodeProjects/Phenotype/repos/.claude/worktrees/agent-a30aac04b38b425c8` | `worktree-agent-a30aac04b38b425c8` | `7b78b5d051` | 2026-06-08T21:52:52-07:00 | agent-spawned | Delete. Locked agent worktree at shared `main` HEAD; no unique HEAD. |
| 14 | `/Users/kooshapari/CodeProjects/Phenotype/repos/.claude/worktrees/agent-a3d086f6974a02a4f` | `worktree-agent-a3d086f6974a02a4f` | `7b78b5d051` | 2026-06-08T21:52:52-07:00 | agent-spawned | Delete. Locked agent worktree at shared `main` HEAD; no unique HEAD. |
| 15 | `/Users/kooshapari/CodeProjects/Phenotype/repos/.claude/worktrees/agent-a44ea94ae915df6d2` | `worktree-agent-a44ea94ae915df6d2` | `7b78b5d051` | 2026-06-08T21:52:52-07:00 | agent-spawned | Delete. Locked agent worktree at shared `main` HEAD; no unique HEAD. |
| 16 | `/Users/kooshapari/CodeProjects/Phenotype/repos/.claude/worktrees/agent-a5a6df8d5a148ed6c` | `worktree-agent-a5a6df8d5a148ed6c` | `7b78b5d051` | 2026-06-08T21:52:52-07:00 | agent-spawned | Delete. Locked agent worktree at shared `main` HEAD; no unique HEAD. |
| 17 | `/Users/kooshapari/CodeProjects/Phenotype/repos/.claude/worktrees/agent-a6853e8146360639c` | `worktree-agent-a6853e8146360639c` | `7b78b5d051` | 2026-06-08T21:52:52-07:00 | agent-spawned | Delete. Locked agent worktree at shared `main` HEAD; no unique HEAD. |
| 18 | `/Users/kooshapari/CodeProjects/Phenotype/repos/.claude/worktrees/agent-a6c6c92e9f7315937` | `worktree-agent-a6c6c92e9f7315937` | `7b78b5d051` | 2026-06-08T21:52:52-07:00 | agent-spawned | Delete. Locked agent worktree at shared `main` HEAD; no unique HEAD. |
| 19 | `/Users/kooshapari/CodeProjects/Phenotype/repos/.claude/worktrees/agent-a788f8feaa4cbbf14` | `worktree-agent-a788f8feaa4cbbf14` | `7b78b5d051` | 2026-06-08T21:52:52-07:00 | agent-spawned | Delete. Locked agent worktree at shared `main` HEAD; no unique HEAD. |
| 20 | `/Users/kooshapari/CodeProjects/Phenotype/repos/.claude/worktrees/agent-a7c71a1edf63226f3` | `worktree-agent-a7c71a1edf63226f3` | `7b78b5d051` | 2026-06-08T21:52:52-07:00 | agent-spawned | Delete. Locked agent worktree at shared `main` HEAD; no unique HEAD. |
| 21 | `/Users/kooshapari/CodeProjects/Phenotype/repos/.claude/worktrees/agent-a83d5663800769672` | `main` | `7b78b5d051` | 2026-06-08T21:52:52-07:00 | duplicate | Delete. Locked duplicate checkout of `main` under agent worktree storage. |
| 22 | `/Users/kooshapari/CodeProjects/Phenotype/repos/.claude/worktrees/agent-a8c0e544e6c6c9916` | `worktree-agent-a8c0e544e6c6c9916` | `7b78b5d051` | 2026-06-08T21:52:52-07:00 | agent-spawned | Delete. Locked agent worktree at shared `main` HEAD; no unique HEAD. |
| 23 | `/Users/kooshapari/CodeProjects/Phenotype/repos/.claude/worktrees/agent-a976b6608d449832c` | `worktree-agent-a976b6608d449832c` | `7b78b5d051` | 2026-06-08T21:52:52-07:00 | agent-spawned | Delete. Locked agent worktree at shared `main` HEAD; no unique HEAD. |
| 24 | `/Users/kooshapari/CodeProjects/Phenotype/repos/.claude/worktrees/agent-aa26a5ffd4a1cbf4d` | `worktree-agent-aa26a5ffd4a1cbf4d` | `7b78b5d051` | 2026-06-08T21:52:52-07:00 | agent-spawned | Delete. Locked agent worktree at shared `main` HEAD; no unique HEAD. |
| 25 | `/Users/kooshapari/CodeProjects/Phenotype/repos/.claude/worktrees/agent-aaba70db5c25ff50d` | `worktree-agent-aaba70db5c25ff50d` | `7b78b5d051` | 2026-06-08T21:52:52-07:00 | agent-spawned | Delete. Locked agent worktree at shared `main` HEAD; no unique HEAD. |
| 26 | `/Users/kooshapari/CodeProjects/Phenotype/repos/.claude/worktrees/agent-abe32574a5dedae85` | `worktree-agent-abe32574a5dedae85` | `7b78b5d051` | 2026-06-08T21:52:52-07:00 | agent-spawned | Delete. Locked agent worktree at shared `main` HEAD; no unique HEAD. |
| 27 | `/Users/kooshapari/CodeProjects/Phenotype/repos/.claude/worktrees/agent-ac0c0cf360d022946` | `worktree-agent-ac0c0cf360d022946` | `7b78b5d051` | 2026-06-08T21:52:52-07:00 | agent-spawned | Delete. Locked agent worktree at shared `main` HEAD; no unique HEAD. |
| 28 | `/Users/kooshapari/CodeProjects/Phenotype/repos/.claude/worktrees/agent-ac22a8137857c6197` | `worktree-agent-ac22a8137857c6197` | `7b78b5d051` | 2026-06-08T21:52:52-07:00 | agent-spawned | Delete. Locked agent worktree at shared `main` HEAD; no unique HEAD. |
| 29 | `/Users/kooshapari/CodeProjects/Phenotype/repos/.claude/worktrees/agent-ace79dbaf53d57b08` | `worktree-agent-ace79dbaf53d57b08` | `7b78b5d051` | 2026-06-08T21:52:52-07:00 | agent-spawned | Delete. Locked agent worktree at shared `main` HEAD; no unique HEAD. |
| 30 | `/Users/kooshapari/CodeProjects/Phenotype/repos/.claude/worktrees/agent-ace79dbaf53d57b08/.claude/worktrees/pr-hygiene-2026-06-09` | detached HEAD | `7b78b5d051` | 2026-06-08T21:52:52-07:00 | agent-spawned | Delete. Nested detached agent hygiene checkout at shared `main` HEAD. |
| 31 | `/Users/kooshapari/CodeProjects/Phenotype/repos/.claude/worktrees/agent-ae5921478b394aa83` | `worktree-agent-ae5921478b394aa83` | `7b78b5d051` | 2026-06-08T21:52:52-07:00 | agent-spawned | Delete. Locked agent worktree at shared `main` HEAD; no unique HEAD. |
| 32 | `/Users/kooshapari/CodeProjects/Phenotype/repos/.claude/worktrees/agent-ae975baf71236bd16` | `worktree-agent-ae975baf71236bd16` | `7b78b5d051` | 2026-06-08T21:52:52-07:00 | agent-spawned | Delete. Locked agent worktree at shared `main` HEAD; no unique HEAD. |
| 33 | `/Users/kooshapari/CodeProjects/Phenotype/repos/.claude/worktrees/agent-tpm-coord` | `chore/focalpoint-housekeeping` | `cd56404907` | 2026-06-08T01:48:36-07:00 | agent-spawned | Merge/delete. Unique housekeeping snapshot branch; preserve only if its changes are still wanted, then remove the worktree. |

## Summary

- Keep: 1
- Keep/merge: 2
- Merge/delete: 1
- Delete: 29
- Most deletion candidates are locked agent-spawned checkouts at `7b78b5d051`, the same HEAD as `main`.

