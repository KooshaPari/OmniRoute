# As-Cast Type Drift Audit — August 2026

This document inventories `as unknown as X` casts in `src/lib/db/` and proposes
a migration path. These casts hide schema drift at compile time, similar to
the quota keystore type-drift bug fixed in PR #505.

## Background

In July 2026, the quota keystore had ghost-type imports (`PoolUsage`,
`PoolUsageWithDimensions`, `PlanPoolUsage` — none existed). The half-migrated
code compiled because `as unknown as` casts between unrelated types are
silent at the TypeScript level. PR #505 added a compile-time contract test
(`_SqliteConforms = SqliteQuotaStore extends QuotaStore ? true : false`) to
prevent recurrence, but the underlying pattern — `rowToCamel(...) as unknown
as SomeDomainType` — remains widespread.

## Methodology

A new check script `scripts/check/as-cast-drift.ts` scans `src/lib/db/` for
`as unknown as X` casts and classifies them:

| Pattern | Classification | Reason |
|---|---|---|
| `getDbInstance() as unknown as DbLike` | **Intentional narrowing** | Each module narrows the DB singleton to only expose methods it uses. 21 local `DbLike` interfaces exist for this purpose. |
| `checkpointTimer as unknown as NodeJS.Timeout` | **Adapter narrowing** | sql.js / better-sqlite3 abstraction layer types as `NodeJS.Timeout` |
| `stmt.run(...) as unknown as RunResult` | **Adapter narrowing** | Same abstraction-layer concern |
| `rowToCamel(row) as unknown as SomeDomainType` | **POTENTIAL DRIFT** | Casts untyped JSON to specific row shape; hides schema changes |

## Findings (August 2026)

The script currently finds **15 potentially-drifting casts** across 5 files.
All follow the `rowToCamel → domain-type` pattern.

| File | Line | Cast | Domain |
|---|---|---|---|
| `src/lib/db/files.ts` | 71 | `rowToCamel(row) as unknown as FileRecord` | File storage metadata |
| `src/lib/db/files.ts` | 126 | (same, in listFiles) | |
| `src/lib/db/quotaSnapshots.ts` | 79 | `rowToCamel(r) as unknown as QuotaSnapshotRow` | Quota historical snapshots |
| `src/lib/db/quotaSnapshots.ts` | 103 | (same, in getLatest) | + nested `as unknown as { windowKey? }` re-cast |
| `src/lib/db/registeredKeys.ts` | 250 | `rowToCamel(existing) as unknown as RegisteredKey` | Registered API keys |
| `src/lib/db/registeredKeys.ts` | 312 | (same, with rawKey merge) | |
| `src/lib/db/registeredKeys.ts` | 323 | (same, in getRegisteredKey) | |
| `src/lib/db/registeredKeys.ts` | 345 | (same, in listRegisteredKeys) | |
| `src/lib/db/registeredKeys.ts` | 402 | (same, in countRegisteredKeys) | |
| `src/lib/db/registeredKeys.ts` | 476 | `rowToCamel(row) as unknown as ProviderKeyLimit` | Provider-level limits |
| `src/lib/db/registeredKeys.ts` | 484 | `rowToCamel(row) as unknown as AccountKeyLimit` | Account-level limits |
| `src/lib/db/relayProxies.ts` | 139 | `rowToCamel(token) as unknown as RelayToken` | Relay proxy tokens |
| `src/lib/db/relayProxies.ts` | 148 | (same, spread) | |
| `src/lib/db/relayProxies.ts` | 159 | (same, with enabled mapping) | |
| `src/lib/db/relayProxies.ts` | 170 | (same, with enabled mapping) | |

Total: **15 casts in 5 files**.

## Risk assessment

**Highest risk**: `quotaSnapshots.ts:103` — has TWO consecutive casts (`as
unknown as QuotaSnapshotRow` followed by `as unknown as { windowKey?: string }`).
This pattern signals a known-but-accepted drift in the snapshot row shape,
where `windowKey` exists in one version but not another.

**High risk**: `registeredKeys.ts` — 7 casts across multiple methods. If the
`registered_keys` schema changes (added/removed columns), all 7 silently
produce wrong data.

**Medium risk**: `files.ts`, `relayProxies.ts` — 2-4 casts each, less likely
to drift because the schemas are stable.

## Proposed migration

The proper fix is **runtime-validated row mapping** using either Zod schemas
or a custom `toRecord<T>` helper that checks expected fields exist:

```ts
// In src/lib/db/caseMapping.ts (or new src/lib/db/rowValidator.ts):
export function toRecord<T extends Record<string, unknown>>(
  row: JsonRecord | null,
  requiredFields: ReadonlyArray<keyof T>,
): T | null {
  if (!row) return null;
  for (const field of requiredFields) {
    if (!(field in row)) {
      throw new Error(
        `rowToCamel: missing required field '${String(field)}' in row ${JSON.stringify(row).slice(0, 100)}`,
      );
    }
  }
  return row as T;
}

// Caller:
return row ? toRecord<FileRecord>(rowToCamel(row), ["id", "filename", "bytes", "createdAt", "purpose"]) : null;
```

This catches drift at startup/runtime instead of compile time. The throw
error surfaces immediately when the schema doesn't match expectations.

### Migration priority

1. **`registeredKeys.ts`** — 7 casts, auth-critical (API key handling)
2. **`quotaSnapshots.ts`** — 4 casts including double-cast
3. **`files.ts`** — 2 casts
4. **`relayProxies.ts`** — 4 casts (network proxy config; less critical)

## Recommended path forward

For this PR: ship the detection script as an audit tool. Add the known
drifts to `--allow-list` so the check can be added to `check:governance`
in a future PR once the migration is complete.

For future PRs: migrate one file at a time using `toRecord<T>` helper. Each
migration is small (~10 lines changed per file) but high-value.

## Related work

- PR #505: Fixed the quota keystore type-drift bug; introduced
  `tests/unit/quota/quotaStore.contract.test.ts` as compile-time defense
- PR #532: Added governance check scripts (`crypto-failures`, `console-in-src`,
  `broken-imports`)
- PR #534: F8 followup — encryption error handling with typed errors
- PR #536: Test infrastructure wiring + quota contract CI enforcement

## References

- `src/lib/db/AGENTS.md` — Domain module conventions
- `plans/encryption-failclosed-spec.md` — Encryption failure mode analysis
- TypeScript handbook: [Type Assertions](https://www.typescriptlang.org/docs/handbook/2/everyday-types.html#type-assertions)
