# ADR: relay — Cursor-Based Pagination

## ADR-001: Relay Connection Specification as the Standard

**Status**: Accepted

**Context**: Several cursor pagination formats exist: Relay Connection Spec, custom opaque cursors, keyset pagination (raw). Should relay define its own format?

**Decision**: Implement the Relay Connection Specification as the standard interface.

**Rationale**: The Relay spec is widely adopted in the JavaScript/GraphQL ecosystem. Using it means relay works out-of-the-box with GraphQL clients that understand connections. Even for non-GraphQL APIs, the `Connection<T>` shape is well-understood.

**Consequences**: The spec requires `edges` wrapping `node`, which adds one level of nesting that REST API consumers find verbose. Accept this tradeoff for consistency.

---

## ADR-002: Opaque Base64 Cursors

**Status**: Accepted

**Context**: Cursor encoding options: (a) transparent (expose raw column values), (b) opaque (base64-encoded column values).

**Decision**: Opaque base64-encoded cursors. Clients must not parse or construct them.

**Rationale**: Opaque cursors allow the server to change the underlying sort key or encoding without breaking clients. Clients that depend on cursor structure become brittle.

**Consequences**: Cannot use cursors as stable permalinks for specific data positions. Cursors are session-specific pagination tokens.

---

## ADR-003: Parallel Count Query

**Status**: Accepted

**Context**: Total count requires a separate `COUNT(*)` query. Running it serially adds latency equal to the count query time.

**Decision**: Run data query and count query in parallel (Promise.all) when total count is requested.

**Rationale**: Cuts total count overhead from `data_time + count_time` to `max(data_time, count_time)`. Negligible complexity cost.

**Consequences**: Two concurrent database connections per paginated request when total count is requested. Connection pool must accommodate this.
