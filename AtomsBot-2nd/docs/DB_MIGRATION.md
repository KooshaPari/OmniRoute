# Persistence Migration: JSON ➜ SQLite (with ORM-ready layout)

This repo currently persists link mappings to `.data/link-mappings.json` for simplicity. The scaffold below adds a SQLite-backed layer that you can enable later, providing durability and easier queries. Runtime still uses JSON by default.

## Why SQLite

- Durable: ACID transactions, fewer corruption risks than ad‑hoc JSON writes.
- Queryable: Inspect/repair state with SQL.
- Portable: Single file `./data/bot.db` works well for single-instance bots.

If you need multi-instance or remote scaling, consider PostgreSQL.

## What’s included

- `db/sqlite.ts`: Minimal SQLite layer using `better-sqlite3` with schema helpers and upsert methods.
- `scripts/migrate-json-to-sqlite.js`: One-time importer from `.data/link-mappings.json` → `data/bot.db`.
- `.env.example`: Optional `DB_SQLITE_PATH` and `PERSISTENCE_DB_ENABLED` flags.

Runtime still writes/reads JSON; DB is scaffolded to be enabled later.

## Install dependency

```
npm i better-sqlite3
```

## Run one-time import

```
node scripts/migrate-json-to-sqlite.js
```

By default this reads `.data/link-mappings.json` and writes to `data/bot.db`. You can override the input path:

```
node scripts/migrate-json-to-sqlite.js /custom/path/link-mappings.json
```

## Enable DB (later)

Add to `.env` (do not enable until you’re ready to flip reads/writes):

```
PERSISTENCE_DB_ENABLED=false
DB_SQLITE_PATH=./data/bot.db
```

Then, when ready:

1. Add repository calls inside `src/store.ts` alongside (or instead of) JSON persistence.
2. Flip `PERSISTENCE_DB_ENABLED=true` and update startup to read from DB first.
3. After a stable period, remove the JSON path.

## Tables

```
threads(id, title, archived, locked, repoOwner, repoName, number, createdAt, updatedAt)
jira_links(threadId PK → threads.id, jiraKey, githubNumber, createdAt)
github_links(threadId PK → threads.id, number, owner, repo, createdAt)
```

## ORM

This scaffold uses hand-written SQL to minimize dependencies and keep tests stable. If you prefer an ORM:

- Drizzle ORM + better-sqlite3 (lightweight, fast)
- Prisma + SQLite (type-safe client, mature tooling)

Either can replace `db/sqlite.ts` while keeping the same schema and migration shape.

