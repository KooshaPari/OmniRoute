# Boundary — pheno-cdylib-bridge (absorbed)

**Status:** Absorbed 2026-07-17 into `pheno` monorepo as `crates/pheno-cdylib-bridge/`.

## Identity

- **Source:** `KooshaPari/pheno-cdylib-bridge` (Rust cdylib, 3 branches, v0.1.0)
- **Canonical home:** `KooshaPari/pheno` (`crates/pheno-cdylib-bridge/`)
- **Crate name:** `pheno-cdylib-bridge`
- **Library output:** `libpheno_bridge.{so,dylib,dll}` (cdylib) + `libpheno_bridge.a` (staticlib)
- **Workspace member:** yes (Rust monorepo `pheno`)
- **Path-deps:** `thegent-memory = { path = "../../../thegent/crates/thegent-memory" }` (sibling monorepo)

## Role

C-ABI FFI bridge that exposes the Rust MemoryPort trait (defined in
the sibling `thegent` workspace under `crates/thegent-memory`) to
Go (forgecode), Python (ctypes), C (dlopen), and any other FFI-capable
language — **without requiring them to compile the Rust toolchain**.

This is the *embedder* surface. Memory *storage backends* (Supermemory,
Letta, Cognee, Mem0, Graphiti, Hippo, Zep) live in `thegent-memory` itself.
The bridge is purely a serialization layer that:
1. Wraps `Box<dyn MemoryPort>` as `*mut c_void` opaque handles
2. Marshals `*const c_char` ↔ Rust `String`/`&str` (CString round-trip)
3. Returns ownership-clean errors via `pheno_last_error()`
4. Hands heap-allocated outputs back via `pheno_string_free()`

## C ABI surface (v0.1.0)

```
const char* pheno_bridge_version(void);
const char* pheno_last_error(void);
void        pheno_string_free(char*);

void* pheno_memory_new(const char* provider);
int   pheno_memory_store(void* h, const char* scope, const char* key, const char* value);
int   pheno_memory_recall(void* h, const char* scope, const char* query, const char** out);
int   pheno_memory_forget(void* h, const char* scope, const char* key);
int   pheno_memory_free(void* h);
```

`provider` accepted: `sm`/`supermemory`, `letta`, `cognee`, `mem0`,
`graphiti`, `hippo`, `zep`, `composite`.

## Out of scope

- Server-side memory backends — those live in `thegent-memory` itself
- gRPC transport — pure HTTP/JSON over the FFI surface
- Cross-language smoke runner — `scripts/build-c-smoke.sh` left in
  the GitHub archive of the source repo; will be brought back as
  `scripts/build-c-smoke.sh` in the monorepo in a follow-up commit

## Consumers

- **`antinomyhq/forgecode`** (upstream) — primary consumer; loads the
  bridge via `cgo` or `plugin.Open()` to access Rust memory from the
  Go agent CLI without rewriting in Go

## References

- Absorption record: `docs/absorption/pheno-cdylib-bridge/README.md`
- Audit: `audits/absorption-justifications/pheno-cdylib-bridge-2026-07-17.md`
- Disposition: `registry/disposition-index.json` row `repo-pheno-cdylib-bridge`
- Absorbed branch: `pheno@origin/absorb/pheno-cdylib-bridge-2026-07-17`
