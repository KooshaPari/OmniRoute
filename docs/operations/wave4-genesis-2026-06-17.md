# Wave 4 — Genesis fleet rollout — 2026-06-17

## Merged genesis PRs

| Repo | Role | PR |
|------|------|-----|
| phenotype-otel | observe | [#6](https://github.com/KooshaPari/phenotype-otel/pull/6) |
| PhenoMCP | connect | [#165](https://github.com/KooshaPari/PhenoMCP/pull/165) |
| Authvault | connect | [#83](https://github.com/KooshaPari/Authvault/pull/83) |
| kwality | quality | [#42](https://github.com/KooshaPari/kwality/pull/42) — additive; existing `SOTA.md` preserved |
| AgilePlus | specs | [#758](https://github.com/KooshaPari/AgilePlus/pull/758) |

Each PR adds: `charter.md`, `intent.md`, `review.md`, `SOTA.md` (or preserved), `okf/manifest.okf.yaml`, `docs/sota/technical.md`, `docs/intent/*`.

## Blocked

| Repo | Issue |
|------|-------|
| phenotype-journeys | Windows clone fails: invalid path `.github/workflows/?[01;31m?[Kci.yml` (ANSI artifact in tree) |

## Remaining genesis matrix

| Repo | Status |
|------|--------|
| Conft | pending |
| phenotype-dep-guard | pending |
| HexaKit | post-crate-eviction refresh |
| phenotype-resilience | repo does not exist (404) |

## Next

1. ~~Fix phenotype-journeys workflow path on GitHub; re-run genesis rollout~~ → Wave 5 [#111](https://github.com/KooshaPari/phenotype-journeys/pull/111)
2. ~~Pyron pheno workspace lockstep (`Logify`, `Metron`, …)~~ → Wave 5 [#53](https://github.com/KooshaPari/Pyron/pull/53)
3. Metron archive path remap
