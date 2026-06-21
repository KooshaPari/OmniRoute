# v20 T4 L27 Pact Consumer-Driven Contract Tests

**Date:** 2026-06-22
**Pillar:** L27 (Contract tests — Pact consumer-driven)
**Status:** v20 Wave A track 4 of 5

## pact-consumer crate

New `pact-consumer` crate at `/pact-consumer/` provides Pact test infrastructure for consumer-driven contract testing across the Phenotype MCP federation.

## 2 contracts shipped

| Contract | Consumer | Provider | Endpoint |
|----------|----------|----------|----------|
| `pheno-mcp-router/pact/contracts/mcp-tracing.json` | pheno-mcp-router | pheno-tracing | `POST /v1/traces` (OTLP) |
| `pheno-mcp-router/pact/contracts/mcp-events.json` | pheno-mcp-router | pheno-events | `POST /events/publish` |

## 2 provider verifications

| Verify file | Provider | Tests |
|-------------|----------|-------|
| `pheno-tracing/pact/verify.rs` | pheno-tracing | 1 (OTLP span batch) |
| `pheno-events/pact/verify.rs` | pheno-events | 1 (event publish) |

## Pact workflow (CI)

1. **Consumer side** (pheno-mcp-router): runs in CI, generates contract JSON, publishes to pact-broker (deferred to v21)
2. **Provider side** (pheno-tracing, pheno-events): runs `pact_verifier_cli verify` against consumer contracts

Can-I-Deploy check (deferred to v21 when pact-broker is provisioned).

## Acceptance criteria

- [x] pact-consumer crate scaffold (Cargo.toml + lib.rs)
- [x] 2 contract JSONs in `pheno-mcp-router/pact/contracts/`
- [x] 2 provider verify.rs files in `pheno-tracing/` and `pheno-events/`
- [x] 2 test cases verifying happy-path contract compliance
- [x] All contracts use Pact spec 3.0

## Limitations

- No pact-broker integration yet (deferred to v21) — contracts are checked into git
- No can-i-deploy gating yet (deferred to v21)
- Provider verification is a smoke test only; full PACT verification requires running the actual provider service

## References

- Pact specification: <https://pact.io/>
- ADR-046 (federation mTLS + OIDC) — contracts run over mTLS
