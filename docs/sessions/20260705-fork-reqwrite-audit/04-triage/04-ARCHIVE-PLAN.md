# Archive Plan -- AtomsBot, GDK, KaskMan

## Canonical pause notice

The user directive: "Archive after strict pause notice placed in their
descr/readmes so it stops being unpaused."

The canonical pause notice already exists at:
phenotype-apps/GDK/README.md

We use that text as the template. The GitHub repo description and the README
must both be updated; both must carry the same content so that the "no
unpause" message is unavoidable from any surface.

### README banner (drop-in, top of file, before any other content)

```markdown
# ARCHIVED -- DO NOT UNPAUSE

**Status:** STRICT PAUSE. No commits, no PRs, no agent work, no re-open.
**Effective:** 2026-07-05
**Decision:** Polyrepo portfolio strategy session. The owning subproject
has been deprecated and will not be revived. See
docs/sessions/2026-07-05-polyrepo-portfolio-strategy/06-archive/
for the canonical rationale.

If you arrived here looking for an active home for this work, the answer is:
*there is no active home*. This codebase is preserved for historical
reference only. Do not open issues, do not send PRs, do not run agents on
this directory. The owning subproject has been deprecated and will not be
revived.
```

### GitHub repo description (drop-in, set via gh repo edit --description)

```
[ARCHIVED] Strict pause. No commits/PRs/agent work. Superseded by other
repos -- see README. Do not unpause.
```

### GitHub repo topics (drop-in, set via gh repo edit --add-topic)

```
archived
strict-pause
no-unpause
deprecated
phenotype-portfolio-2026-07
```

## Per-repo application

| Repo                          | Canonical README location              | Action                                          |
|-------------------------------|----------------------------------------|-------------------------------------------------|
| AtomsBot (canonical)          | phenotype-apps/AtomsBot-2nd/README.md  | Replace README top with the banner above.       |
| AtomsBot (worktree copies)    | phenotype-apps/AtomsBot/ (empty), AtomsBot-3rd/, -4th/, -5th/ | Symlink to the canonical AtomsBot-2nd README; or paste the banner if symlink is too cute. |
| GDK (already archived)        | phenotype-apps/GDK/README.md           | Already correct; no change.                     |
| GDK (other copies)            | phenotype-apps-L39-wt/GDK/, AgilePlus/GDK/, pheno/GDK/, phenotype-registry/GDK/ | All show 0 files; replace the (empty) README with the banner, or delete the empty dir if the parent repo permits. |
| KaskMan (top-level)           | KaskMan/README.md                      | Replace README top with the banner above.       |

## Sub-steps

### Step 1 -- AtomsBot (canonical)

1. cd /Users/kooshapari/CodeProjects/Phenotype/repos/phenotype-apps/AtomsBot-2nd
2. Prepend the banner to README.md (do not delete the rest of the README;
   the Discord<->GitHub bridge documentation is historically valuable).
3. Commit: chore: strict-pause archive notice (AtomsBot, 2026-07-05).
4. Push to KooshaPari/AtomsBot (the actual GitHub repo, not the worktree).
   The build badge in the existing README points at the top-level
   KooshaPari/AtomsBot, so the canonical GitHub repo is the top-level one,
   and phenotype-apps/AtomsBot-2nd is its worktree copy. Update the top
   of the README in the top-level repo too.
5. gh repo edit KooshaPari/AtomsBot --description "[ARCHIVED] Strict pause..." --add-topic archived --add-topic strict-pause --add-topic no-unpause --add-topic deprecated --add-topic phenotype-portfolio-2026-07

### Step 2 -- KaskMan

1. cd /Users/kooshapari/CodeProjects/Phenotype/repos/KaskMan
2. Prepend the banner to README.md.
3. Vendor a copy of claude-flow and dashboard-*.js into
   phenotype-org-audits/archive/kaskman/ so the scripts are preserved
   without reactivating the repo.
4. Commit: chore: strict-pause archive notice (KaskMan, 2026-07-05).
5. gh repo edit KooshaPari/KaskMan --description "[ARCHIVED] Strict pause..." --add-topic ...

### Step 3 -- GDK mirrors (zero-file copies)

For each of:
- phenotype-apps/GDK/ (already has the banner; verify, no change)
- phenotype-apps-L39-wt/GDK/
- AgilePlus/GDK/
- pheno/GDK/
- phenotype-registry/GDK/

If the dir is empty and the parent repo does not require it to exist: delete
the empty dir, since the absence of the dir itself signals "archived". If
the parent repo requires the dir to exist (worktree registry, etc.):
populate it with a single README.md containing only the banner.

### Step 4 -- AtomsBot worktree copies (other than the canonical)

For each of:
- phenotype-apps/AtomsBot/ (0 files)
- phenotype-apps/AtomsBot-3rd/, -4th/, -5th/
- phenotype-apps-L39-wt/AtomsBot/, -2nd/, ...
- AgilePlus/AtomsBot/
- phenotype-registry/AtomsBot/
- pheno/AtomsBot/
- focalpoint-wt-v12-16-17/AtomsBot-2nd/ (19 files)
- pheno-cockpit-registry-bracket/

If 0 files: same treatment as GDK mirrors (delete the dir, or paste the
banner if the dir is required to exist).
If has files: prepend the banner to README.md, same as the canonical
AtomsBot.

## Why "strict pause" and not just "archived"

GitHub's Archived flag stops new issues and PRs but does NOT stop an
admin (or an agent with admin scope) from reactivating the repo. The user's
"stops being unpaused" language is a tell that the standard GitHub archive
is not enough -- the repos have been reactivated before by accident or
auto-agent. The strict-pause README banner is a human/agent-readable
contract that complements the GitHub flag. Both must be set.
