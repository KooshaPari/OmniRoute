# Specifications

## In scope

1. Pass the resolved backend URL into the bundled renderer environment.
2. Poll `/healthz` for renderer and backend readiness and terminate a timed-out backend child.
3. Validate the renderer BFF proxy route in the smoke script.
4. Keep Claude thinking deltas in reasoning content, not assistant content.
5. Accept Deno and Cloudflare relay types/sources in the canonical registry schema.
6. Make the deterministic batch test reject failed batches and failed requests.
7. Remove duplicate API-contract installation and apply formatter output.

## Out of scope

Packaged `.app` launch orchestration, adapter-node path assumptions, qgate policy changes, and broad
logger/type refactors.

## Final acceptance record

| Requirement                           | Result          | Evidence                                        |
| ------------------------------------- | --------------- | ----------------------------------------------- |
| Reconcile against the live PR base    | done            | Base `f7709a87ab`; integration `93c5e5973b`     |
| Preserve source and review provenance | done            | No PR push or merge performed                   |
| Run bounded validation                | partial by host | 11 passed; 39 SQLite-driver checks host-blocked |
| Snapshot resulting state              | done            | Airlock `wip/20260803T0636-18c83820dca03348`    |
