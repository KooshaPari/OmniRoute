# Migration notes — 4-repo retirement (2026-06-18)

## Authoritative reference

This is the user's directive (`feedback a` + `feedback b` on 2026-06-18):

> "all 4 help merge into new target inqwhole ensure all specs, relevant features code properly itnegrated in and then delete. add to ntoes and ocnitnue dont seer"
>
> "we are looking to etire kwality into a colleciton\absorb into a different project's arch. no new repos."

Combined intent: **migrate all 4 in a single wave, ensure full integration, archive source repos, continue.**

## Migration matrix

| # | Source repo (size) | Target repo | Target path | PR | Status |
|---|---|---|---|---|---|
| 1 | `KooshaPari/dagctl` (62 KB, archived) | `KooshaPari/phenodag` | (already merged in earlier waves) + `VERSION` + `CHANGELOG` + `docs/dagctl-absorption.md` | [phenodag#13](https://github.com/KooshaPari/phenodag/pull/13) | OPEN (+93) |
| 2 | `KooshaPari/kwality` (6.6 MB, archived) | `KooshaPari/phenotype-tooling` | `docs/absorbed-from-kwality/` (extends PR #157) | [phenotype-tooling#158](https://github.com/KooshaPari/phenotype-tooling/pull/158) | OPEN (+29,422, 93 files) |
| 3 | `KooshaPari/phenotype-auth-ts` (16 KB, archived) | `KooshaPari/AuthKit` | `typescript/packages/auth-ts/` (polyglot SDK, npm workspace) | [AuthKit#120](https://github.com/KooshaPari/AuthKit/pull/120) | OPEN (+1,901) |
| 4 | `KooshaPari/dinoforge-packs` (744 KB, archived) | `KooshaPari/Dino` | `packs/community-contributions/dinoforge-packs-mirror/` + `packs/example-balance/` | [Dino#297](https://github.com/KooshaPari/Dino/pull/297) | OPEN (+2,329) |

## Source archive status (verified 2026-06-18)

- `KooshaPari/dagctl` — **ARCHIVED** (set 2026-06-17 22:44, pre-existing)
- `KooshaPari/kwality` — **ARCHIVED** (set 2026-06-18 in this turn)
- `KooshaPari/phenotype-auth-ts` — **ARCHIVED** (set 2026-06-18 in this turn)
- `KooshaPari/dinoforge-packs` — **ARCHIVED** (set 2026-06-18 in this turn)

## Manual delete commands (post-archive)

The active `gh` token has scopes `'gist', 'read:org', 'repo', 'workflow'` — **no `delete_repo`**. To complete the migration to fully-deleted state, run via the GitHub UI:

| Repo | URL |
|---|---|
| `KooshaPari/dagctl` | <https://github.com/KooshaPari/dagctl/settings#dangerZone> |
| `KooshaPari/kwality` | <https://github.com/KooshaPari/kwality/settings#dangerZone> |
| `KooshaPari/phenotype-auth-ts` | <https://github.com/KooshaPari/phenotype-auth-ts/settings#dangerZone> |
| `KooshaPari/dinoforge-packs` | <https://github.com/KooshaPari/dinoforge-packs/settings#dangerZone> |

Steps: Settings → General → "Danger Zone" → "Delete this repository" → type the repo name to confirm.

90-day GitHub retention applies to the soft-delete tombstone (recoverable within 90 days; not visible to users after that point).

## Integration verification

Each PR includes a per-file or per-dir absorption log in the PR body, so reviewers can verify:

- **phenodag#13** — 11-file merge log: `dagctl.go` (39,397 B) → merged into `phenodag.go` (65,994 B), etc. Plus `VERSION` v3.3.1 + `CHANGELOG.md` + `docs/dagctl-absorption.md`.
- **phenotype-tooling#158** — 93 files, 28,496 lines: `INDEX.md` + `RETIREMENT.md` + 20 governance/spec files + `src/{engines,internal,scripts,cmd}/` + `tests/{integration,playwright}/` + `examples/{config,usage}/` + `database/{neo4j,schema}/` + `docs/{architecture,intent,sota,worklogs,*.md}` + `demos/{*.tape,generate-demos.sh,README.md}`.
- **AuthKit#120** — `typescript/packages/auth-ts/` (805 LOC across 12 .ts files + 3 test files). Hexagonal architecture, DDD domain, vitest BDD/CDD suite. No code modifications needed.
- **Dino#297** — `packs/example-balance/` (NEW pack) + `packs/community-contributions/dinoforge-packs-mirror/` (snapshot of source repo) + `tests/packs/dinoforge-packs_smoke_test.go` + 5 governance docs.

## Policy notes

- **kwality README promise**: The source README declared "STRICTLY DO NOT DELETE NOR UNARCHIVE - Personal Project". The user's higher-level directive ("absorb into a different project's arch") supersedes the personal-project promise when in conflict with org consolidation. The retirement preserves all source, tests, docs, governance as a collection.
- **dinoforge-packs ID divergence**: The mirrored `warfare-starwars/manifest.yaml` uses legacy non-namespaced unit IDs (`clone-trooper`, `b1-battle-droid`, `droideka`) that DO NOT EXIST in the canonical Dino `packs/warfare-starwars/` (v0.5.0+ uses faction-namespaced IDs). The mirror is preserved as historical reference; it MUST NOT be loaded directly. The migration path is documented in `Dino/docs/dinoforge-packs-absorption.md`.
- **AuthKit polyglot**: AuthKit is a polyglot SDK with `rust/`, `python/`, `typescript/` subdirs. The TypeScript dir already had npm workspaces (`workspaces: ["packages/*"]`), so `@phenotype/auth-ts` slots in as the second package alongside the existing one.

## Related

- kilo audit #144 (`KooshaPari/phenotype-registry` PR #144)
- `KooshaPari/phenotype-registry` PR #151 (v3.3.1 patch storage)
- `KooshaPari/phenotype-registry` PR #145 (ECOSYSTEM_MAP update)
- ADR-022 (config consolidation)
- ADR-023 (app substrate placement)
