# ADR-040: Deletion recipe — pre-archive doc + 90-day retention tombstone + 4 manual `gh repo delete` commands

Every repo deletion MUST follow a documented recipe: (1) pre-archive: author a `findings/L5-XXX-<topic>.md` audit artifact with the migration matrix; (2) pre-archive: confirm the 90-day GitHub retention window; (3) pre-archive: include 4 manual `gh repo delete` commands in the doc (URL form, since the `gh` token does not have `delete_repo` scope); (4) post-archive: archive the source via `gh api`; (5) post-archive: delete via GitHub UI. **Nothing is destroyed before the user can intervene.**

**Status:** Accepted
**Date:** 2026-06-18
**Author:** orchestrator (claude opus 4.7)
**Track:** v8 T14 (governance backlog)
**L8-020** (T14.11)

## Context

The 4-repo retirement on 2026-06-18 (per ADR-037) revealed a fleet policy gap: the `gh repo delete` CLI requires the `delete_repo` OAuth scope, which the active `KooshaPari` token does not have (scopes: `'gist', 'read:org', 'repo', 'workflow'`). The deletion step is therefore a **manual UI action** that lives outside the operator's normal automation surface.

Without a documented recipe, the next operator facing a deletion will:

1. Discover the missing scope at delete-time (not pre-flight).
2. Default to the `gh repo delete` CLI, fail with HTTP 403, and not know what to do next.
3. Either give up (the repo sits archived indefinitely) or skip the safety steps (delete via UI without writing the audit artifact).

Codifying the recipe as ADR-040 ensures the next deletion is a 5-step runbook, not a 5-step exploration.

## Decision

**Every repo deletion MUST follow the 5-step recipe.** The recipe is small (5 steps); the policy is large (nothing is destroyed before the user can intervene).

### The 5-step recipe

#### Step 1 — Pre-archive: author the audit artifact

Before any archive / delete action, author `findings/L5-XXX-<topic>.md` (or `findings/L5-XXX-<topic>-retirement.md` for multi-repo retirements per ADR-037). The artifact includes:

- **User directive verbatim** (the user message that authorized the deletion).
- **Migration matrix** (what was migrated, where, when).
- **Source archive status** (which sources are archived, which are not, on what date).
- **4 manual `gh repo delete` commands** in URL form (Step 3 below).
- **Policy notes** (any user-pinned policies, any override justifications).

#### Step 2 — Pre-archive: confirm the 90-day GitHub retention window

GitHub retains deleted repos in a soft-delete state for **90 days** before permanent destruction. This is the safety window: if a deletion was unauthorized, the user has 90 days to contact GitHub support and recover. The recipe **MUST** explicitly state the 90-day window in the audit artifact, and the user MUST be informed of the window before the delete step.

#### Step 3 — Pre-archive: include 4 manual `gh repo delete` commands in the doc

Since the `gh repo delete` CLI is unavailable without the `delete_repo` scope, the audit artifact lists the 4 manual UI URLs that the operator (or the user) will visit to perform the delete. The format:

```markdown
## Manual delete commands (post-archive)

The active `gh` token has scopes `'gist', 'read:org', 'repo', 'workflow'`. No `delete_repo`. To complete the migration to fully-deleted state, run via the GitHub UI (Settings → General → Danger Zone → Delete this repository):

- https://github.com/KooshaPari/dagctl/settings#dangerZone
- https://github.com/KooshaPari/kwality/settings#dangerZone
- https://github.com/KooshaPari/phenotype-auth-ts/settings#dangerZone
- https://github.com/KooshaPari/dinoforge-packs/settings#dangerZone

90-day GitHub retention applies to the soft-delete tombstone.
```

The 4 URLs are the operator's to-do list. They are stable (the `#dangerZone` anchor survives GitHub UI changes).

#### Step 4 — Post-archive: archive the source via `gh api`

After the migration PRs land and CI is green, archive each source:

```bash
gh api -X PATCH repos/KooshaPari/<source> -f archived=true
```

Archive = read-only marker; the git history is preserved indefinitely. This is **not** deletion; this is the safety layer.

#### Step 5 — Post-archive: delete via GitHub UI

The operator (or the user) visits each URL in Step 3 and clicks Danger Zone → Delete this repository. The deletion is **soft** for 90 days (the repo is in a soft-delete tombstone); after 90 days, the repo is permanently destroyed.

**The CLI delete step (`gh repo delete`) is never used** — it would require the `delete_repo` scope, which the fleet policy (per AGENTS.md) does not grant. This is a safety property, not a limitation.

### The "user can intervene" policy

The recipe is designed so that **nothing is destroyed before the user can intervene**:

- Step 1 (audit artifact) is public (it's a `findings/*.md` file in a public repo). The user can read it at any time and veto the deletion.
- Step 2 (90-day window) is the GitHub safety net; even after the delete is initiated, the user has 90 days to recover.
- Step 3 (4 manual URLs) makes the deletion a **deliberate human action**, not a script side-effect. The user sees the URLs in the audit artifact and decides when to click them.
- Step 4 (archive) is the long-term state. The repo sits archived until the user (not the operator) decides to delete.
- Step 5 (UI delete) is the irreversible step. The user clicks the button; the operator does not.

## Consequences

*Positive:*
- The recipe is a 5-step runbook; no operator has to re-derive the process.
- The audit artifact is the SSOT for "what was migrated, where, when, and what manual steps remain."
- The 90-day retention window is the GitHub-level safety net.
- The CLI-vs-UI distinction is a safety property: token leaks cannot mass-delete.

*Negative / Risks:*
- The 4 manual URLs are operator's work; an operator who doesn't visit them leaves the source archived indefinitely. Mitigation: the audit artifact's "Source archive status" section is a checklist; the operator marks each URL as "visited + deleted" or "visited + skipped (reason)".
- The 90-day window is GitHub's policy, not the fleet's; if GitHub changes the policy, the recipe must be updated. Mitigation: the recipe's Step 2 explicitly cites the 90-day window, so a GitHub policy change is immediately visible.
- A deletion that is wrong (the user didn't want it) is recoverable only within 90 days. Past 90 days, it is permanent. Mitigation: the audit artifact is public; the user can read it and veto before any delete step.

## Refs

- ADR-037 (4-repo retirement template — the `findings/L5-XXX-<topic>-retirement.md` artifact shape)
- ADR-039 (fork tracking — archive-not-delete for upstream forks)
- AGENTS.md § "Stale / warnings" (4-repo retirement § 2026-06-18; CLI-vs-UI token scope note)
- `findings/2026-06-18-L5-109-4-repo-retirement.md` — the first instance of this recipe (template)
- v8 plan § 3.6 Track T14 (ADR backlog)
