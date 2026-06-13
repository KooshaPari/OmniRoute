# Auto-Linker

Resolves a GitHub issue linkage for a Discord thread by scanning recent messages.

## Sources
- Full GitHub issue URLs found in messages (first valid one wins)
- Shorthand references like `#123` using default repo or thread-context repo

## Flow
1) Fetch up to N recent messages from the thread (tests use 50)
2) Extract all candidate URLs in order
3) Validate each against GitHub API (users and issues endpoints as needed)
4) On first valid issue, set `thread.number`, `thread.repoOwner`, `thread.repoName`
5) Log and return true; otherwise return false

## Error handling
- Discord channel fetch may fail or return null: log a warning and return false
- Message fetch errors: return false
- GitHub API errors, rate limits, auth errors: gracefully handled; return false

## Implementation
- `src/github/autoLinker.ts`
- Regex helpers and parsing in `src/github/linkFormats.ts`
- Repo context managed via `thread.repoOwner` and `thread.repoName`

## Tests
- `src/github/__tests__/autoLinker.test.ts` covers URLs, shorthand, ordering, errors, and integration

