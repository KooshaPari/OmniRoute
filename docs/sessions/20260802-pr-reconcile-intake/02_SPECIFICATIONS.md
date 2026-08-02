# Specifications

## Acceptance criteria

1. Preserve the existing tested runtime diff without unrelated source changes.
2. Keep dispatch fail-closed when dry-run, webhook secret, provenance, duplicate event, or head checks fail.
3. Keep payload and feedback collection bounded and UTF-8 safe.
4. Record the CLI decomposition as required follow-up.
5. Snapshot the WIP state with Airlock; do not merge or publish a feature PR.

## ARUs

- The CLI remains over the target size temporarily so no tested behavior is lost during preservation.
- Full GitHub-hosted review and live dispatch remain unverified in this local lane.
