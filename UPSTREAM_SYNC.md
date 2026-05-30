# Upstream Sync Guide — OmniRoute

## Upstream
- Remote: `upstream` → https://github.com/diegosouzapw/OmniRoute
- Branch tracking: `upstream/main`
- Latest synced upstream tag: check `git log upstream/main --oneline -1`

## How to Sync Upstream Changes

```bash
# Fetch latest upstream
git fetch upstream

# Compare our fork vs upstream
git log upstream/main..HEAD  # commits we're ahead
git diff upstream/main HEAD  # full delta

# Cherry-pick selective upstream fixes
git cherry-pick <sha>

# NEVER rebase onto upstream/main:
# Our routing core diverges at the bifrost layer.
# Rebasing would conflict with our arch changes.
```

## Our Divergence Point

OmniRoute is being rebuilt around:
- **bifrost** — Phenotype routing substrate (intelligent multi-provider routing crate)
- **cliproxy** — Proxy and policy layer

The upstream OpenAI-compatible gateway API surface is preserved for compatibility,
but the routing core, load balancing, and provider selection are replaced by bifrost.

## What to Backport from Upstream
- Bug fixes in the OpenAI-compatible API layer
- New provider integrations (endpoint schema changes)
- Documentation improvements
- Security patches

## What NOT to Backport from Upstream
- Routing algorithm changes (replaced by bifrost)
- Load balancing logic (replaced by bifrost policies)
- Retry/fallback logic (replaced by phenotype-retry + bifrost)

## Upstream Release Tracking
Latest upstream releases:
- `upstream/release/v3.8.6`
- `upstream/release/v3.8.7`
- `upstream/release/v3.8.8`

Monitor https://github.com/diegosouzapw/OmniRoute/releases for new tags.
