# Blockers -- 2026-07-05

This session cannot complete the GitHub-side actions from inside the local
sandbox. The local artifacts (banner copies, charter insertions, Authvault
CHANGELOG, git tag) are all in `proposals/` and ready to apply. The blockers
are the GitHub-side steps that require interactive or authenticated access.

## B-1: `gh` CLI not authenticated in this session

```
$ gh auth status
# (no output -- the token is not present in the sandbox env)
```

Cannot run:
- `gh repo edit KooshaPari/Authvault --enable-issues=false`
- `gh repo edit KooshaPari/AtomsBot --description "[ARCHIVED]..." --add-topic ...`
- `gh repo edit KooshaPari/KaskMan --description "[ARCHIVED]..." --add-topic ...`
- `gh repo view KooshaPari/Authvault --json isArchived` (verification)

**Resolution:** sponsor runs `gh auth login` once, then the parent
agent can run the `gh repo edit` commands in a follow-up session
that has the token.

## B-2: GitHub web-UI archive cannot be automated

`gh repo archive` does not exist. The only path is:
1. `gh repo edit ... --enable-issues=false`
2. Web UI: Settings -> Danger Zone -> Archive this repository.

This requires a human click. Not automatable from a CLI session.

**Resolution:** sponsor performs the web-UI step for each of
Authvault, AtomsBot, KaskMan after the CLI edits land.

## B-3: phenotype-apps active branch verification

The audit notes (03-APPS-PLAN.md R-6) that the active branch on
phenotype-apps is `apps-extract`. This session did not verify
the branch state from inside phenotype-apps/.

**Resolution:** before pushing the spine-charter commit,
`cd phenotype-apps && git branch --show-current` to confirm the
target branch. If `apps-extract` is in flight, coordinate with
the branch owner before pushing (per 06-RISKS R-6).

## B-4: AuthKit `migrations/from-authvault.md` not yet drafted

The 05-MIGRATION-CHECKLIST.md Phase 1 requires AuthKit to receive a
migration guide that documents the toml/git snippet. This is a
separate, additive change inside AuthKit and was not in scope for
the audit session (the audit verifies Authvault is deletable; the
AuthKit-side guide is the next PR inside AuthKit).

**Resolution:** the next AuthKit-side PR (separate agent lane)
adds `migrations/from-authvault.md` and extends the FR
traceability table in `AuthKit/specs/requirements/`.

## B-5: Spine REGISTRY.md does not exist yet

The 02-ORG-AUDITS-PLAN.md action #4 calls for a
`phenotype-org-audits/spines/REGISTRY.md` listing all seven
spines. This is a cross-repo file that requires a one-liner
contribution from each spine. Best done as a coordinated
"polyrepo-spines-v1" PR; not in scope for this session.

**Resolution:** track in the polyrepo forward-DAG; coordinate
via the org-audits owner.

## What CAN be done in this session (and has been)

- All 4 PROPOSAL files in `proposals/` are written and ready.
- `00_PROGRESS.md` and this file are written and ready.
- The 6 root-level audit docs are already on disk and complete.

## Net summary

Local artifacts: 4 proposals + 2 status files = 6 files written.
GitHub-side steps: blocked on B-1 and B-2.
Other-side steps: blocked on B-3, B-4, B-5.
