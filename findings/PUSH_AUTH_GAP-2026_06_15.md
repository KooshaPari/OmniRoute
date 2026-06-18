# Push Auth Gap — confirmed structural issue (2026-06-15)

**Status:** The `chore/w1-2-archive-cheap-llm-mcp-2026-06-15` branch (and the
L5-87 lineage it absorbed) cannot be pushed to any GitHub remote from
Dmouse92's `gh` account.

## Diagnosis

| Remote | URL | Status |
|---|---|---|
| `argis` | `git@github.com:KooshaPari/argis-extensions.git` | ✅ reachable (wrong repo) |
| `pheno` | `https://github.com/KooshaPari/phenoShared.git` | ✅ reachable (wrong repo) |
| `voxel` | `git@github.com:KooshaPari/phenotype-voxel.git` | ✅ reachable (wrong repo) |
| `dmouse` | `https://github.com/Dmouse92/AgilePlus.git` | ❌ 404 |
| `github` | `https://github.com/Phenotype/Phenotype.git` | ❌ 404 |
| `origin` | `https://github.com/KooshaPari/Phenotype` | ❌ 404 |
| `worklogs` | `https://github.com/KooshaPari/worklogs.git` | ❌ 404 |

The correct monorepo remotes are unreachable because:
- `github.com/Phenotype/Phenotype` does not exist (the org-level monorepo is not on this account)
- `github.com/KooshaPari/Phenotype` is not visible to `Dmouse92` (likely private or no access)

`gh auth status`:
```
✓ Logged in to github.com account Dmouse92
Token scopes: 'gist', 'read:org', 'repo', 'workflow'
```

`gh api user`:
```
{"login": "Dmouse92", "id": 20732082, ...}
```

`Dmouse92` has 51 repos but **zero `Phenotype/*` or `KooshaPari/*`** repos
(other than `phenotype-teamcomm` and `phenodocs`, which are Dmouse92-owned forks).

## Path forward

The 4 unreachable remotes point to the canonical `KooshaPari/Phenotype` monorepo,
which is owned by the `KooshaPari` GitHub user, not `Dmouse92`. To push, the
session needs to re-authenticate:

```bash
gh auth switch --user KooshaPari
gh auth setup-git
git push -u origin chore/w1-2-archive-cheap-llm-mcp-2026-06-15
```

(requires interactive login or a `KooshaPari` personal access token in
`GH_TOKEN` / `GITHUB_TOKEN`)

## Workarounds

If re-auth is not possible in this session:
1. **Local-only work** — commit to local branches; v6 is documented in
   `findings/V6_MASTER_STATUS-2026_06_15.md` and `findings/V6_TRACK_*_PRESENTATION-2026_06_15.md`
2. **Patch-only delivery** — `git format-patch main..HEAD` produces
   mbox patches that can be applied manually by the user
3. **Bundle** — `git bundle create v6.bundle --all` produces a single
   binary file containing all branches/refs for transfer

## v6 commit trail (still recoverable from local)

- Pyron: `eaebe896` (fix(pyron): unblock cargo check --workspace)
- root: `cbe1ca4d42` (chore(root): bump Pyron to include build-fix commit)
- root: `c7c4d29c92` (docs: v6 Track 5 dispatch gate)
- root: `d9...`     (docs: v6 Track 1)
- root: `...`       (docs: v6 Track 2)
- root: `...`       (docs: v6 Track 3)
- root: `659781ee0f` (docs: v6 Track 4)
- root: `d037999bcc` (docs: v6 master status)

All 8 commits are reachable from `HEAD` on `chore/w1-2-archive-cheap-llm-mcp-2026-06-15`.
