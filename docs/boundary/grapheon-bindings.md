# Boundary — grapheon-bindings (absorbed)

**Status:** Absorbed 2026-07-17 into `phenotype-go-sdk/packages/graphclient/`.

## Identity

- **Source:** `KooshaPari/grapheon-bindings` (Go client stub, 1 branch, 117 LOC)
- **Canonical home:** `KooshaPari/phenotype-go-sdk` (`packages/graphclient/`)
- **Module path:** `github.com/KooshaPari/phenotype-go-sdk/packages/graphclient`
- **Package path:** `pkg/client/` (Go 1.22)
- **Workspace:** `phenotype-go-sdk/go.work` member (alongside `packages/devhex`)

## Role

Pure-Go HTTP/JSON client for the **Grapheon claims graph store**. Speaks the
JSON contract at `/api/v1/intents`, `/api/v1/trace/{forward,reverse}/<id>`
on a Grapheon server (HTTP at :8080; gRPC when exposed). Usable from
Node/Python/Go services without compiling against `rustc`.

This is the *embedder* surface — Grapheon itself lives in `KooshaPari/Grapheon`
(Rust crate server). This client mirrors the JSON contract and keeps
embedders free of a rustc dependency.

## Surface

- **Types:** `Client`, `Intent`, `Claim`, `Evidence`, `Graph`
- **Methods:** `Health(ctx)`, `ListIntents(ctx)`, `ForwardTrace(ctx, from, depth)`,
  `ReverseTrace(ctx, from, depth)`, `Post(ctx, path, body, out)`
- **Helpers:** internal `get(ctx, path, out)`

## Out of scope

- Server-side Rust types — those live in `KooshaPari/Grapheon` directly
- gRPC transport — the `grpc/` and `rest/` subdirs of the original stub
  are placeholders; gRPC implementation will land in a follow-up
  once the Grapheon gRPC contract is committed

## Consumers

None yet (first integration). Future consumers expected: any
service that needs to read/write the Grapheon graph without
pulling in the Rust toolchain.

## References

- Absorption record: `docs/absorption/grapheon-bindings/README.md`
- Audit: `audits/absorption-justifications/grapheon-bindings-2026-07-17.md`
- Disposition: `registry/disposition-index.json` row `repo-grapheon-bindings`
- Absorbed branch: `phenotype-go-sdk@origin/absorb/grapheon-bindings-2026-07-17`
