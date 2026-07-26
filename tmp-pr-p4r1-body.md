## Summary
P4-R1 — first Rust persistence leaf after #413/#390:

- Implement `ProviderRepo` get / list / insert / update / delete over SQLite `providers`
- Validation + unique conflict mapping; never persist plaintext `api_key`
- In-memory sqlx tests for round-trip, conflict, validation
- Fix `omniroute-rs` workspace: stop dual-listing `omniroute-ffi` members (they already have their own workspace), unblocking local `cargo test -p omniroute-storage`

## Test plan
- [ ] `cargo test -p omniroute-storage provider` in `crates/omniroute-rs`
- [ ] CI Rust / cargo jobs green on this PR
