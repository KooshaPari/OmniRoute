# Absorption Record — pheno-cdylib-bridge

## Transfer Record

| Field | Value |
|-------|-------|
| Source repo | `KooshaPari/pheno-cdylib-bridge` |
| Target repo | `KooshaPari/pheno` (monorepo) |
| Target paths | `crates/pheno-cdylib-bridge/` |
| Absorbed date | 2026-07-17 |
| Absorbed by | forge agent |
| Branch on target | `origin/absorb/pheno-cdylib-bridge-2026-07-17` |
| Commit on target | `26ec806` |
| Verification | `cargo check -p pheno-cdylib-bridge` clean; `cargo test -p pheno-cdylib-bridge` 4/4 pass |

## What was absorbed

C-ABI cdylib exposing the pheno-* fleet's `thegent-memory` MemoryPort
trait to Go, Python, and any other C-callable FFI consumer. The
primary consumer is `antinomyhq/forgecode` (the CLI-side Rust agent
that we feed memory to via `cgo`).

- **Surfaced functions:** `pheno_bridge_version`, `pheno_last_error`,
  `pheno_string_free`, `pheno_memory_new`, `pheno_memory_store`,
  `pheno_memory_recall`, `pheno_memory_forget`, `pheno_memory_free`
- **Memory providers bridged in v0.1.0:** supermemory, letta, cognee,
  mem0, composite (fan-out across the four primaries)
- **Memory providers accepted in v0.1.0 FFI but adapter pending:**
  graphiti, hippo, zep — return NULL handle + descriptive
  `pheno_last_error()` message; schedule v0.2 per ADR-096
- **Memory scopes:** episodic, identity, project_knowledge, fallback

## Workspace changes

- New crate: `crates/pheno-cdylib-bridge/` (cdylib + staticlib) inside the
  `pheno` workspace
- New path-dep: `thegent-memory = { path = "../../../thegent/crates/thegent-memory" }`
  (sibling `repos/thegent` workspace)
- `Cargo.toml` (workspace root) registers the new member next to `pheno-context`
- README updated with absorbed-into monorepo pointer

## Upstream adaptations during absorption

Three new `MemoryProvider` variants (`Graphiti`, `Hippo`, `Zep`) were
added to `thegent-memory` after the bridge was authored. The match in
`provider_from_str` and the dispatch in `pheno_memory_new` were
extended to keep the bridge compiling against the current `thegent-memory`
v0.2.x. The new providers are accepted at the FFI surface but their
adapters are deferred to bridge v0.2 (tracked in the source README).

## Verification

```sh
$ cargo check -p pheno-cdylib-bridge
    Finished `dev` profile [unoptimized + debuginfo] target(s) in 7.64s

$ cargo test -p pheno-cdylib-bridge
    Finished `test` profile [unoptimized + debuginfo] target(s) in 1m 23s
running 4 tests
test mock_adapter_labels_itself ... ok
test mock_adapter_round_trip ... ok
test composite_scope_routing_is_per_scope ... ok
test composite_routes_each_scope ... ok
test result: ok. 4 passed; 0 failed; 0 ignored; 0 measured
```

The four Rust in-process FFI smoke tests pass. The cross-language
smoke test (C → cdylib) lives at `c/examples/smoke.c` and is built
via `scripts/build-c-smoke.sh` from the source repo (the script
itself was not absorbed; it remains in the GitHub archive).

## Provenance

Branch: `origin/absorb/pheno-cdylib-bridge-2026-07-17` on
`KooshaPari/pheno`. Source repo `KooshaPari/pheno-cdylib-bridge`
archived via `gh repo archive`.
