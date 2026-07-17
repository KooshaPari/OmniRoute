# Absorption Record — grapheon-bindings

## Transfer Record

| Field | Value |
|-------|-------|
| Source repo | `KooshaPari/grapheon-bindings` |
| Target repo | `KooshaPari/phenotype-go-sdk` |
| Target paths | `packages/graphclient/` |
| Absorbed date | 2026-07-17 |
| Absorbed by | forge agent |
| Verification | `go build ./packages/graphclient/...` clean; `go vet` clean |

## What was absorbed

Single Go file `go/client/client.go` (117 LOC) — a pure-Go HTTP/JSON client
for the Grapheon claims graph store. Provides types `Intent`, `Claim`,
`Evidence`, `Graph` and methods `Health`, `ListIntents`, `ForwardTrace`,
`ReverseTrace`, `Post`, `get`. No external runtime dependencies
(`gorilla/websocket` + `google.golang.org/grpc` listed in source
`go.mod` are pinned for future gRPC expansion but unused in the
current client path).

## Workspace changes

- New module: `github.com/KooshaPari/phenotype-go-sdk/packages/graphclient`
  (Go 1.22, no external deps)
- `go.work` updated to register the new package as a workspace member
  alongside `packages/devhex`
- New package README documenting the absorption & usage

## Verification

```sh
$ go build ./packages/graphclient/pkg/client/  # silent = success
$ go vet ./packages/graphclient/...            # silent = clean
$ go work use ./packages/graphclient           # registered
```

Build & vet pass. Future work: add a smoke test against a running
Grapheon instance (will land in a follow-up commit once the
`phenotype-registry/specs/router-protocol` runtime is available
locally for testing).

## Provenance

Branch: `origin/absorb/grapheon-bindings-2026-07-17` on
`KooshaPari/phenotype-go-sdk`. Source repo
`KooshaPari/grapheon-bindings` archived via `gh repo archive`.
