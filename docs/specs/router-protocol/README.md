# Phenotype Router Protocol — Spec Index

This directory contains the canonical protocol specification for the
**phenotype router A2A surface** — the wire format that substrate engines,
substrate drivers, and substrate adapters use to talk to each other.

The protocol is intentionally minimal: 4 schemas + 4 prose docs.
The schema files are the source of truth; this directory contains prose
that explains the rationale and gives worked examples.

## Status

**Draft** — under active development alongside substrate. Breaking changes
are likely until `v0.3.0`.

## Files

| File | Purpose |
|---|---|
| [`schema/router-dispatch.json`](./schema/router-dispatch.json) | JSON Schema for RouterDispatch + RouterRequest + RouterDispatchResponse |
| [`schema/router-mailbox.json`](./schema/router-mailbox.json) | JSON Schema for RouterMailbox envelope (used over SSE / WS / stdin) |
| [`schema/router-trace.json`](./schema/router-trace.json) | JSON Schema for RouterTrace (OTLP/JSON resourceLogs compatible) |
| [`schema/router-artifact.json`](./schema/router-artifact.json) | JSON Schema for RouterArtifact |
| [`docs/dispatch.md`](./docs/dispatch.md) | Dispatch protocol semantics — how a Task becomes a routed Engine invocation |
| [`docs/mailbox.md`](./docs/mailbox.md) | Mailbox/event-stream protocol — how engines and supervisors exchange mid-flight events |
| [`docs/trace.md`](./docs/trace.md) | Trace protocol — OTLP-flavored trace event format, substrate-trace compatible |
| [`docs/lanes.md`](./docs/lanes.md) | Sync / fanout / tree execution lanes |
| [`examples/`](./examples/) | Reference JSON payloads for each schema |

## Scope

This spec defines the **wire-level protocol** that any substrate-compatible
agent router must speak. It covers:

1. **Dispatch** — `RouterDispatch` (routing decisions) + `RouterRequest` (work)
2. **Mailbox** — `RouterMailbox` event envelope (status updates, message chunks, errors)
3. **Trace** — `RouterTrace` (observability primitives — task lifecycle events)
4. **Artifact** — `RouterArtifact` (PR URLs, file diffs, structured outputs)

It does NOT define:

- The HTTP transport itself (substrate uses reqwest, but any transport works)
- The agent CLI semantics (those are agent-specific — substrate has adapters)
- The trace export format (use OTLP; see [`pheno-otel`](https://github.com/KooshaPari/PhenoObservability/tree/main/pheno-otel))

## Conformance

A router implementation is **conformant** if it:

1. Produces valid `RouterDispatch` JSON for every input `RouterRequest`
2. Consumes `RouterMailbox` events in order
3. Emits `RouterTrace` for task lifecycle transitions
4. Returns `RouterArtifact[]` on task completion
5. Passes the [`engine-conformance`](https://github.com/KooshaPari/substrate/tree/main/crates/engine-conformance) suite in substrate

Reference implementations:

- **HTTP gateway** → [`substrate::engine-agentapi`](https://github.com/KooshaPari/substrate/tree/main/crates/engine-agentapi) (over the `agentapi-plusplus` Go binary)
- **OpenAI-compat** → [`substrate::cliproxy-adapter`](https://github.com/KooshaPari/substrate/tree/main/crates/cliproxy-adapter)
- **Provider router** → [`substrate::omniroute-adapter`](https://github.com/KooshaPari/substrate/tree/main/crates/omniroute-adapter)
- **Bifrost decisions** → [`substrate::routing-phenotype-router`](https://github.com/KooshaPari/substrate/tree/main/crates/routing-phenotype-router) (wraps `phenotype-router`)

## Versioning

This protocol follows semver.

- **0.1.x** — current development. Breaking changes bump the minor.
- The `version` field on every envelope is the contract — consumers MUST
  reject envelopes with a major version they don't support.

| Version | Status | Notes |
|---|---|---|
| 0.1.0 | draft | current |

## Reference implementation

The canonical Rust implementation lives at
[`KooshaPari/substrate/crates/substrate-core`](https://github.com/KooshaPari/substrate/tree/main/crates/substrate-core).

Specifically:
- `domain.rs` — Task, Conversation, Session, Message, StructuredResult, RoutingDecision, EngineCapabilities, TaskState
- `ports.rs` — EnginePort, RoutingPort, TransportPort, StorePort, DispatchApi
- `trace.rs` — TracePort + TraceEvent + TaskRegistered/TaskCompleted/TaskFailed variants

The agent-facing **wire** is published separately at
[`KooshaPari/substrate-adapters-bundle`](https://github.com/KooshaPari/substrate-adapters-bundle).

## License

Dual MIT/Apache-2.0. See [LICENSE](./LICENSE) (MIT) and [LICENSE-APACHE](./LICENSE-APACHE) (Apache-2.0).

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines on proposing changes,
reporting issues, and validating schemas.

- [Issue templates](./.github/ISSUE_TEMPLATE/) — file protocol-change and bug-report issues
- [PR template](./.github/PULL_REQUEST_TEMPLATE.md) — checklist for schema/doc changes
- [CODEOWNERS](./CODEOWNERS) — automatic review assignment
- [Threat model](./docs/threat-model.md) — STRIDE analysis of protocol envelopes

## Related repos

- [`KooshaPari/substrate`](https://github.com/KooshaPari/substrate) — Rust hexagonal spine, reference implementations
- [`KooshaPari/substrate-adapters-bundle`](https://github.com/KooshaPari/substrate-adapters-bundle) — meta-repo of standalone adapter crates
- [`KooshaPari/phenotype-registry`](https://github.com/KooshaPari/phenotype-registry) — registry of phenotype-related projects