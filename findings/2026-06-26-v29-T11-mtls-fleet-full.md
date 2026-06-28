# v29-T11 — L52.1 mTLS Fleet Adoption (P1→3.0)

## What
Verify at least 2 service pairs communicate via mTLS using the `mTlsAdapter` wrapper.

## Action
- Add mTLS test to `pheno-port-adapter/tests/mtls_test.rs` that creates a `mTlsAdapter` with self-signed certs and verifies `connect()` + `health()`.
- Confirm `mTlsAdapter` is in the `src/adapters/` directory with at least the `connect(endpoint: &str) -> Result<Connection, AdapterError>` signature.

Ref: `findings/2026-06-25-v27-T4-mtls-guide.md` (spec from v27 T4)
