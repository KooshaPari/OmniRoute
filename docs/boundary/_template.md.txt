---
# Boundary file frontmatter schema
repo: string  # canonical repo name
role: enum  # per ECOSYSTEM_MAP.md taxonomy
status: enum  # active | paused | dormant | archived | retired
last_boundary_review: date  # ISO 8601
review_cadence: enum  # 30d | 60d | 90d | dormant
in_scope: [string, ...]  # required, non-empty
out_of_scope: [string, ...]  # required, non-empty
depends_on: [string, ...]  # opt
depended_on_by: [string, ...]  # opt
---

# Boundary — <repo>

## In Scope

<Bulleted list of capabilities the repo owns. Be specific (e.g. "Owns the canonical LLM router (TypeScript)" rather than "Routing").>

## Out of Scope

<Bulleted list of capabilities the repo explicitly does NOT own. For each, state where the capability lives instead.>

| Not here | Lives in | Reason |
| -------- | -------- | ------ |
| <capability> | <other-repo-or-N/A> | <why this is the right home> |

## Boundary Crossings

| Crossing | Direction | Surface | Status |
| -------- | --------- | ------- | ------ |
| <capability or interface> | <this-repo→other\|other→this-repo> | <Trait / HTTP / CLI / file / event> | <green\|amber\|red — amber/red means relocation pending> |

## Last Boundary Review

**Date:** <YYYY-MM-DD>
**Reviewer:** <human or agent>
**Worklog / finding:** <link>
**Decisions:**
- <Bullet of what changed since last review>
- <Bullet>

**Next review:** <YYYY-MM-DD>
