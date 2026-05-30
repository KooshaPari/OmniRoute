# phenotype-hub Worklog

This is the canonical work audit index for `phenotype-hub`.

## Current State

`phenotype-hub` is an active governance scaffold. The repository contains agent
contracts, functional-requirement templates, workflow scaffolding, and this
worklog surface. It does not yet contain a hub runtime implementation.

## Canonical Surfaces

- Root project overview: `README.md`
- Agent contract: `AGENTS.md`
- Claude/Codex workflow notes: `CLAUDE.md`
- Functional requirements: `FUNCTIONAL_REQUIREMENTS.md`
- Detailed audit log: `docs/worklogs/worklog.md`

## Worklog Routing

Record hub-specific findings in `docs/worklogs/worklog.md`.

Use parent Phenotype governance and worklog indices only for cross-repo
aggregation or org-level decisions.

## Open Follow-Ups

- Decide whether the future hub is a governance-only registry, a runtime service
  discovery layer, or both.
- Add implementation-specific build and test commands only after source code is
  populated.
- Add a repository license once the intended licensing model is confirmed.
