# v20-T4 L27 Contract Tests — Pact Consumer-Driven (DEFERRED)

**Track:** T4 (Cycle 10 P1 reduction, L27)
**Status:** ⏸ DEFERRED — blocked on `pheno-mcp-router` + `pheno-mcp-router-ffi` local clones
**Target Repos:** `KooshaPari/pheno-mcp-router` (provider), `KooshaPari/pheno-mcp-router-ffi` (consumer)
**Author:** KooshaPari, 2026-06-21
**ADR:** ADR-084 (cycle 10 P1 reduction)

---

## Goal

Lift L27 (contract tests) from P1 to saturated by adding **Pact consumer-driven contract tests** between the 3 federated services:

| Consumer | Provider | Contract Surface |
|----------|----------|-----------------|
| `pheno-mcp-router-ffi` (Rust) | `pheno-mcp-router` (Rust) | JSON-RPC `tools/invoke` |
| `pheno-context` (Rust) | `pheno-config` (Rust) | `Config::from_env` schema |
| `pheno-events` (Rust) | `pheno-port-adapter` (Rust) | `Event::emit` schema |

Each consumer publishes a `.pact` file in `pacts/` directory. Each provider verifies in CI via `pact_verifier` or `pact_mock_server` (Rust: `pact_consumer` crate).

## Why Deferred

Requires:
- Live `pheno-mcp-router` + `pheno-mcp-router-ffi` repos (no local clones)
- Pact broker setup (currently absent)
- ~1 week of focused work per consumer/provider pair

Recommended: spawn `orch-v20-T4-L27-pact-contracts` when clones exist, with this finding as input.

## Scaffold (when ready)

```toml
# pheno-mcp-router-ffi/Cargo.toml [dev-dependencies]
pact_consumer = "0.10"
pact_verifier = "0.10"
```

```rust
// pheno-mcp-router-ffi/tests/pact/tools_invoke.rs
use pact_consumer::prelude::*;

#[test]
fn tools_invoke_contract() {
    let pact = PactBuilder::new("pheno-mcp-router-ffi", "pheno-mcp-router")
        .interaction("invoke tool", |i| {
            i.request.post("/rpc");
            i.response.status(200);
            i.response.json_body(json!({
                "result": {"status": "ok"},
                "error": null
            }));
        })
        .build();
    // run mock server, send request, verify response
}
```

## Acceptance

- 3 `.pact` files in `pacts/`
- 3 consumer tests in `tests/pact/` directories
- CI matrix runs `pact_verifier_cli` against each provider
- All pass within 30s

## ETA

When unblocked: **1 week** (3 days impl, 2 days CI)
