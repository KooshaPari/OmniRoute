# pheno-zod-schemas

Canonical Zod schemas for the pheno-* fleet. Mirrors the domain model in
the sibling `pheno-pydantic-models` Python package so TypeScript and
Python services validate the same wire contract.

## Schemas

- `UserSchema` (+ type `User`) — identity record.
- `WorklogEntrySchema` (+ type `WorklogEntry`) — per-task execution
  record with a 6-member status enum.
- `ProjectSchema` (+ type `Project`) — project aggregate with the
  "owner must be a member" invariant.

Every schema is exported as both a runtime Zod schema and an inferred
TypeScript type:

```ts
import { UserSchema, type User } from "@kooshapari/pheno-zod-schemas";
const user: User = UserSchema.parse(untrustedInput);
```

## Install

```sh
npm install
```

## Test

```sh
npx vitest run
```
