# Store

AtomsBot provides a DB-backed store for production and maintains a legacy JSON store for compatibility and tests.

## DB Store (preferred)
- File: `src/store-db.ts`
- In-memory caches with async persistence
- Thread structure stores:
  - id (Discord thread id), node_id (GitHub), number (issue number)
  - repoOwner, repoName
  - Jira link (optional): jiraKey
- Methods include findThread, getAllThreads, addThread, updateThread, deleteThread

## Legacy JSON Store
- File: `src/store.ts`
- Maintained for tests and backwards compat

## Testing
- tests/mocks/store.ts provides a mock store used by tests
- Ensure method signatures (sync vs async) align with usage in tests

