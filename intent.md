# Intent — phenotype-registry

## Problem statement

The Phenotype fleet grew to 144+ active repos with competing indexes, language-monorepo absorption proposals, and no single domain-role authority. Agents could not determine canonical owners, delete eligibility, or language placement without looping across stale docs.

## Success criteria

- [x] `DOMAIN_ROLES.md` and `LANGUAGE_PLACEMENT.md` on main as fleet SSOT
- [x] Archive reconcile SOP with 100% boundary coverage before delete
- [ ] Every canonical role owner registered with genesis docs + `projects/*.json`
- [ ] Zero-loop manager preflight encoded (no duplicate subagent lanes)

## Non-goals

See [charter.md](charter.md#out-of-scope). Key exclusions:

- Domain SDK implementation (owned by role repos)
- Genesis template authority (HexaKit)

## Originating prompts

Deterministic provenance in [docs/intent/prompts/](docs/intent/prompts/README.md).

| Date | Tool | Session | Summary |
|------|------|---------|---------|
| 2026-06-17 | cursor | b561a593-1729-44da-b90d-0cfbdf9d72ef | [fleet audit + domain roles + zero-shot AX](docs/intent/prompts/cursor/20260617-b561a593-1729-44da-b90d-0cfbdf9d72ef-t1.md) |

Refresh: `python ../HexaKit/scripts/extract-intent-prompts.py --out-dir docs/intent/prompts --repo phenotype-registry`

## Synthesized goals

Full synthesis: [docs/intent/synthesis.md](docs/intent/synthesis.md)

**Confirmed (user-stated):**

1. Organize fleet by **domain role**, not language monorepo junk drawers
2. DELETE archives only at **100% boundary coverage** in role owners
3. Optimize sessions for **zero-shot / zero-loop** agent work

**Inferred (needs validation):**

1. Registry owns ADR pack for role migrations (RFC 001/002)

## Agent assumptions log

| Assumption | Action taken | Validated? |
|------------|--------------|------------|
| #77 is canonical SSOT over #75/#76 | Closed #75/#76 | yes |
| Kit archives delete-eligible post-reconcile | Deleted ObservabilityKit, ResilienceKit, TestingKit | yes |

Details: [docs/intent/assumptions.md](docs/intent/assumptions.md)
