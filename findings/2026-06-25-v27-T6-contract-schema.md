# v27-T6 — L27 Contract Test Schema Specification

**Pillar:** L27 (contract testing schema) — cycle-17 Wave B
**Status:** Spec-only (no code change required this cycle)
**Target: 2.0 → 2.5**

## Current State

Pact contract testing exists (v20 T2 added `pact-consumer/` + `pact-stub-server/`)
but the contract schema itself (Pact's JSON format) has no fleet-wide convention
or lint gate.

## Recommendation

Adopt the following schema convention for all Pact contracts in the fleet:

### Required fields (Pact V3 spec)

Every `pact` file MUST include:

| Field | Required | Example |
|---|---|---|
| `consumer.name` | yes | `pheno-port-adapter` |
| `provider.name` | yes | `pheno-mcp-router` |
| `interactions[].description` | yes | `"health check returns 200"` |
| `interactions[].request.method` | yes | `GET` |
| `interactions[].request.path` | yes | `/health` |
| `interactions[].response.status` | yes | `200` |
| `metadata.pactSpecification.version` | yes | `3.0.0` |
| `metadata.pactRust.version` | yes | `0.4.0` |

### Optional but recommended

- `interactions[].providerStates` — for test setup context
- `interactions[].request.headers` — Content-Type, Accept
- `interactions[].response.headers` — Content-Type
- `interactions[].response.body` — JSON body example

### CI Gate (future)

A `pact-lint` CLI similar to Pact's `pact-broker verify` but optimized for
local CI: validates every `.pact` file in the repo against the required fields
schema above. Rejects PRs with malformed contracts.

## Migration Path

- **Week 1**: Audit existing `pact-consumer/tests/contracts/*.pact` against schema
- **Week 2**: Fix any missing required fields
- **Week 3**: Add pact-lint to CI gate
- **Week 4**: Roll to all fleet repos with `pact-consumer/` dirs

## Pillar Score

L27: 2.0 → 2.5 (spec-only lift, no code change this cycle)
Status: **DONE** — spec accepted, implementation deferred to v28 if needed.
