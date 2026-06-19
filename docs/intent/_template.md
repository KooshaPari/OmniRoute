---
# Intent file frontmatter schema
# All fields are required unless marked optional (opt).
repo: string  # canonical repo name (e.g. "HexaKit", "phenotype-registry")
aliases: [string, ...]  # opt — other names this repo is known by
role: enum  # per ECOSYSTEM_MAP.md taxonomy
status: enum  # active | paused | dormant | archived | retired
last_verified: date  # ISO 8601 (YYYY-MM-DD)
bound_prompts: integer  # count of curated prompts bound to this repo
bound_plans: integer  # count of curated plans bound to this repo
bound_responses: integer  # count of curated agent responses bound to this repo
# Free-form below — keys you may add:
#   primary_language: "rust" | "python" | "go" | "ts" | ...
#   depends_on: [string, ...]  # opt — cross-repo deps
#   depended_on_by: [string, ...]  # opt — reverse cross-repo deps
#   supersedes: [string, ...]  # opt — repos this one replaced
#   superseded_by: string  # opt — repo that replaced this one
#   tags: [string, ...]  # opt — free-form
---

# Intent — `<repo>`

## Intent Statement

`<3-7 sentences in the human owner's voice, sourced from the most recent binding prompt. State what this repo exists to do, for whom, and what the boundary of "done" looks like.>`

## Bound Prompts

| Date | Source | File | Summary | Tag |
| ---- | ------ | ---- | ------- | --- |
| `<YYYY-MM-DD>` | `<claude-code|codex|cursor-agent|forge|droid|aider|other>` | `docs/curated-prompts/<source>/<YYYY-MM>/<id>.md` | `<one-line summary of why this bound>` | `<repo-defining|policy-setting|idea|bugfix|implementation|narrative>` |

## Bound Plans

| Date | Source | File | Status | Outcome |
| ---- | ------ | ---- | ------ | ------- |
| `<YYYY-MM-DD>` | `<source>` | `docs/curated-plans/<source>/<YYYY-MM>/<id>.md` | `<approved|drafted|superseded>` | `<one-line: what shipped / what was abandoned>` |

## Bound Responses (specs, ideas, plans from agents)

| Date | Source | File | Kind | Outcome |
| ---- | ------ | ---- | ---- | ------- |
| `<YYYY-MM-DD>` | `<source>` | `docs/curated-responses/<source>/<YYYY-MM>/<id>.md` | `<spec|idea|plan|design-doc>` | `<one-line>` |

## Boundary

See: [`docs/boundary/<repo>.md`](../boundary/`<repo>`.md)

## Ecosystem Role

`<One-line restatement of role + dependencies from ECOSYSTEM_MAP.md>.`

## Open Questions

- `<Bullet list of in-flight issues, sourced from the latest prompt on this repo.>`
- `<If none, write "None — last verified <date>.">`

## Change Log

| Date | Change | Worklog |
| ---- | ------ | ------- |
| `<YYYY-MM-DD>` | Initial binding | `worklogs/<L7-NNN>-<slug>-<date>.json` |
