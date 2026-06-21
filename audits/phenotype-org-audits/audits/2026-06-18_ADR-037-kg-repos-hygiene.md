# ADR-037: Kg-repos hygiene — 4-repo retirement template (process + doc shape)

The 4-repo retirement process (dagctl, kwality, phenotype-auth-ts, dinoforge-packs) executed 2026-06-18 establishes the fleet's reusable retirement template: survey → migrate specs/features/code → PR → merge → archive source → delete via UI. Future retirements follow the same shape and produce the same audit artifact.

**Status:** Accepted
**Date:** 2026-06-18
**Author:** orchestrator (claude opus 4.7)
**Track:** v8 T14 (governance backlog)
**L8-017** (T14.8)

## Context

On 2026-06-18 the user directed: *"all 4 help merge into new target inqwhole ensure all specs, relevant features code properly itnegrated in and then delete. add to ntoes and ocnitnue dont seer"* + *"we are looking to etire kwality into a colleciton\absorb into a different project's arch. no new repos."*

The combined intent: migrate all 4 repos in one wave, ensure full integration of specs + features + code, archive source repos, continue. The 4 repos were:

| # | Source | Target | PR | Migration |
|---|---|---|---|---|
| 1 | `KooshaPari/dagctl` (pre-archived) | `KooshaPari/phenodag` | `KooshaPari/phenodag#13` | `VERSION` v3.3.1, `CHANGELOG.md`, `docs/dagctl-absorption.md` |
| 2 | `KooshaPari/kwality` | `KooshaPari/phenotype-tooling` | `KooshaPari/phenotype-tooling#158` | `docs/absorbed-from-kwality/` (engines, internal, scripts, cmd) |
| 3 | `KooshaPari/phenotype-auth-ts` | `KooshaPari/AuthKit` | `KooshaPari/AuthKit#120` | `typescript/packages/auth-ts/` (hexagonal, DDD, vitest BDD/CDD) |
| 4 | `KooshaPari/dinoforge-packs` | `KooshaPari/Dino` | `KooshaPari/Dino#297` | `packs/example-balance/` + `packs/community-contributions/dinoforge-packs-mirror/` |

All 4 source repos were set to **archived** (read-only marker). The `gh repo delete` step requires `delete_repo` scope on the active token, which the `KooshaPari` token does not have; the deletion step is therefore a **manual UI action** (Settings → General → Danger Zone → Delete this repository), with a 90-day GitHub retention tombstone.

This was the first multi-repo retirement in the fleet's history. Codifying the process as a reusable template ensures the next retirement is faster and the audit trail is uniform.

## Decision

**Adopt the 4-repo retirement process as the fleet's reusable retirement template.** Every future multi-repo retirement MUST follow the 6-step process and produce the audit artifact described below.

### 6-step process

1. **Survey** — for each source repo: list the specs, features, and code that must migrate. Output: a migration matrix.
2. **Migrate** — for each source repo: open a PR on the target repo that imports the spec / feature / code. Each PR is a single concern; multi-PR per source is fine.
3. **Merge** — each migration PR is reviewed and merged independently. CI on the target must be green.
4. **Archive source** — once all PRs for a source are merged, `gh api -X PATCH repos/<owner>/<source> -f archived=true` (or UI: Settings → General → Archive this repository).
5. **Delete via UI** — after archive, open the GitHub UI for each archived source and click Danger Zone → Delete this repository. The `gh repo delete` CLI requires `delete_repo` scope, which most fleet tokens do not have. Document the manual steps in the audit artifact.
6. **Doc + close** — author the audit artifact at `findings/L5-XXX-<topic>-retirement.md` and link it from `AGENTS.md` § "Stale / warnings" → "PAUSED APPs".

### Audit artifact shape (`findings/L5-XXX-<topic>-retirement.md`)

Every retirement produces an audit artifact with the following sections:

```markdown
# L5-XXX — <topic> retirement

**Date:** YYYY-MM-DD
**User directive:** "<the verbatim user message that triggered the retirement>"
**Status:** COMPLETE / IN-FLIGHT

## Migration matrix
| # | Source | Target | PR | What migrated |
|---|---|---|---|---|

## Source archive status
For each source: archived (yes/no) + date + manual delete UI link.

## Manual delete commands
The 4 GitHub UI URLs (Settings → Danger Zone → Delete) for the post-archive step.

## Integration verification
- [ ] All specs migrated
- [ ] All features migrated
- [ ] All code migrated
- [ ] CI green on target
- [ ] Deprecation notices in source READMEs
- [ ] Cross-links from SSOT.md / AGENTS.md updated

## Policy notes
- Any user-pinned policies (e.g. "STRICTLY DO NOT DELETE NOR UNARCHIVE" in kwality's README) are documented and overridden by user directive.
```

### Reuse

This template is the canonical reference for future retirements. The audit artifact is the SSOT for "what was migrated, where, when, and what manual steps remain." The 90-day GitHub retention tombstone is the safety net: nothing is destroyed before the user can intervene.

## Consequences

*Positive:*
- The 4-repo retirement is a documented precedent; future retirements copy the template.
- The audit artifact is the SSOT for what was migrated, with a machine-parseable migration matrix.
- The 6-step process is small enough to be a runbook; the 90-day tombstone is the safety net.

*Negative / Risks:*
- Step 5 (delete via UI) is manual and untracked; a source could sit archived forever without a user-driven delete. Mitigation: the audit artifact's "Source archive status" section lists the manual UI link so a future operator can find and click it.
- The `gh repo delete` CLI is unavailable; automation of the delete step is not possible with the current token scopes. Mitigation: requesting the `delete_repo` scope is a fleet policy decision (out of scope for this ADR).
- A future retirement that doesn't follow the 6-step process will not have a uniform audit trail. Mitigation: the v9 fleet onboarding doc references this ADR as the canonical retirement process.

## Refs

- `findings/2026-06-18-L5-109-4-repo-retirement.md` — the 4-repo retirement audit artifact (template instance)
- AGENTS.md § "Stale / warnings" (the "PAUSED APPs" section is the post-retirement state)
- ADR-039 (fork tracking — archive-not-delete for upstream forks, related but distinct)
- ADR-040 (deletion recipe — pre-archive doc + retention tombstone + manual UI commands, the underlying deletion policy)
