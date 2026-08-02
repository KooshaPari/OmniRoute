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
