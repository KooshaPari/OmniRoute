# pheno-pydantic-models

Canonical Pydantic models for the pheno-* fleet. Mirrors the domain
model in the sibling `pheno-zod-schemas` TypeScript package so Python
and TypeScript services validate the same wire contract.

## Models

- `User` — identity record (UUID4 id, email, display_name 1..80, aware
  datetime created_at).
- `WorklogEntry` — per-task execution record with a 6-member status
  enum (`pending`, `running`, `blocked`, `completed`, `failed`,
  `cancelled`).
- `Project` — project aggregate with the "owner must be a member"
  invariant enforced by a model-level validator.

## Install

```sh
pip install -e ".[dev]"
```

## Test

```sh
pytest -q
```
