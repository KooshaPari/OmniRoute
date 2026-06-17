# Intent — {{PROJECT_NAME}}

## Problem statement

{{PROBLEM_STATEMENT}}

## Success criteria

- [ ] {{SUCCESS_CRITERION_1}}
- [ ] {{SUCCESS_CRITERION_2}}

## Non-goals

See [charter.md](charter.md#out-of-scope). Key exclusions:

- {{NON_GOAL_1}}

## Originating prompts

Deterministic provenance in [docs/intent/prompts/](docs/intent/prompts/README.md).

| Date | Tool | Session | Summary |
|------|------|---------|---------|
| {{DATE}} | cursor | {{SESSION_ID}} | [prompt](docs/intent/prompts/cursor/{{PROMPT_FILE}}.md) |

Refresh: `python scripts/extract-intent-prompts.py --out-dir docs/intent/prompts --repo {{PROJECT_NAME}}`

## Synthesized goals

Full synthesis: [docs/intent/synthesis.md](docs/intent/synthesis.md)

**Confirmed (user-stated):**

1. {{CONFIRMED_GOAL}}

**Inferred (needs validation):**

1. {{INFERRED_GOAL}}

## Agent assumptions log

| Assumption | Action taken | Validated? |
|------------|--------------|------------|
| {{ASSUMPTION}} | {{ACTION}} | pending / yes / no |

Details: [docs/intent/assumptions.md](docs/intent/assumptions.md)
