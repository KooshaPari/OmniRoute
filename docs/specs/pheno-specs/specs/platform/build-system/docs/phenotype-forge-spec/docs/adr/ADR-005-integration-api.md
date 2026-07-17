# ADR-005: Integration and API Design

## Status

**Accepted** — Active since project inception

Last Updated: $(date +%Y-%m-%d)

---

## Context

Modern systems rarely operate in isolation. Integration with other services, APIs, and external systems is essential. The integration strategy affects:

- System coupling and independence
- Performance and latency characteristics
- Security and authentication requirements
- Error handling and resilience patterns
- Developer experience for API consumers

### Integration Requirements

1. **Internal Services**: Communication within the Phenotype ecosystem
2. **External APIs**: Third-party service integration
3. **Client SDKs**: Support for language-specific client libraries
4. **Event Streams**: Asynchronous event-driven communication
5. **Webhooks**: Outbound notifications to subscriber systems

### API Design Goals

1. **Intuitive**: Easy to understand and use correctly
2. **Consistent**: Follows established patterns across endpoints
3. **Documented**: Comprehensive, accurate documentation
4. **Versioned**: Changes are backward compatible or versioned
5. **Observable**: Usage, errors, and performance are visible

---

## Decision

We have decided to adopt a **multi-protocol integration strategy** with the following design:

### API Architecture

**Primary API: RESTful HTTP**
- Standard HTTP methods (GET, POST, PUT, PATCH, DELETE)
- Resource-oriented URL design
- JSON request/response bodies
- Standard HTTP status codes
- OAuth 2.0 / JWT authentication

**Secondary API: gRPC**
- High-performance internal service communication
- Strongly typed contracts via Protocol Buffers
- Bi-directional streaming support
- Service mesh integration

**Event Interface: Async Messaging**
- Event-driven communication for decoupled operations
- At-least-once delivery guarantees
- Schema evolution support
- Dead letter queues for failed processing

### API Design Standards

#### URL Structure
```
/api/v1/{resource}/{id}/{sub-resource}
```

Examples:
- `GET /api/v1/users` — List users
- `GET /api/v1/users/123` — Get specific user
- `POST /api/v1/users` — Create user
- `PATCH /api/v1/users/123` — Partial update
- `DELETE /api/v1/users/123` — Delete user

#### Response Envelope

Success:
```json
{
  "data": { ... },
  "meta": {
    "request_id": "req-abc-123",
    "timestamp": "2024-01-15T10:30:00Z"
  }
}
```

Collection:
```json
{
  "data": [ ... ],
  "meta": {
    "request_id": "req-abc-123",
    "timestamp": "2024-01-15T10:30:00Z",
    "pagination": {
      "page": 1,
      "per_page": 20,
      "total": 100,
      "total_pages": 5
    }
  }
}
```

### Authentication and Authorization

1. **Authentication**: JWT tokens with short expiry
2. **Refresh**: Long-lived refresh tokens for session continuity
3. **Scopes**: Fine-grained permission scopes
4. **Rate Limiting**: Tiered limits based on authentication and plan

### Integration Patterns

```
┌─────────────────────────────────────────────────────────────────┐
│                         Clients                                │
│  (Web App, Mobile, CLI, Third-party Services)                   │
└─────────────────────────────────────────────────────────────────┘
                            │
           ┌────────────────┼────────────────┐
           │                │                │
           ▼                ▼                ▼
    ┌─────────────┐  ┌─────────────┐  ┌─────────────┐
    │  REST API   │  │   gRPC API  │  │  WebSocket  │
    │  Gateway    │  │   Gateway   │  │  Gateway    │
    └──────┬──────┘  └──────┬──────┘  └──────┬──────┘
           │                │                │
           └────────────────┼────────────────┘
                            │
                   ┌─────────┴─────────┐
                   ▼                   ▼
            ┌─────────────┐     ┌─────────────┐
            │   Service   │◄───►│   Event     │
            │   Core      │     │   Bus       │
            └──────┬──────┘     └─────────────┘
                   │
       ┌───────────┼───────────┐
       ▼           ▼           ▼
   ┌────────┐ ┌────────┐ ┌────────┐
   │  DB    │ │ Cache  │ │ External│
   │        │ │        │ │ APIs    │
   └────────┘ └────────┘ └────────┘
```

---

## Consequences

### Positive Consequences

1. **Developer Experience**: REST API is easy to understand and integrate
2. **Performance**: gRPC enables high-performance internal communication
3. **Scalability**: Event-driven patterns support independent scaling
4. **Flexibility**: Multiple protocols for different use cases
5. **Ecosystem Fit**: Standard protocols integrate well with existing tooling

### Negative Consequences

1. **Complexity**: Multiple protocols require different expertise
2. **Duplication**: Some logic may be duplicated across protocol implementations
3. **Overhead**: Multiple gateway layers add latency
4. **Maintenance**: Keeping multiple API versions in sync requires discipline

### Mitigations

- Shared domain logic layer reused by all protocol implementations
- Code generation for API clients and documentation
- API versioning strategy to minimize breaking changes
- Comprehensive integration testing across all protocols

---

## Alternatives Considered

### Alternative 1: GraphQL Only

**Approach**: Use GraphQL as the primary (or only) API

**Pros**: Flexible queries, strong typing, single endpoint, introspection
**Cons**: Complexity, caching challenges, file upload limitations, learning curve
**Why Rejected**: Overkill for current needs; simpler REST meets requirements

### Alternative 2: SOAP/XML

**Approach**: Use SOAP with XML payloads

**Pros**: Enterprise standard, strong tooling support, formal contracts
**Cons**: Verbose, complex, poor performance, dated technology
**Why Rejected**: Doesn't align with modern API expectations and performance goals

### Alternative 3: Custom Binary Protocol

**Approach**: Design a custom binary protocol for maximum efficiency

**Pros**: Optimal performance, tailored to specific needs
**Cons**: No ecosystem, must build all tooling, debugging challenges
**Why Rejected**: Unnecessary complexity; existing protocols are sufficient

---

## API Versioning Strategy

1. **URL Path Versioning**: `/api/v1/`, `/api/v2/`
2. **Deprecation Period**: Minimum 6 months notice for deprecation
3. **Sunset Headers**: Response headers indicate deprecation timeline
4. **Documentation**: Maintain docs for all supported versions

### SDK Support

1. **Official SDKs**: Provide SDKs for primary languages
2. **Auto-Generation**: Generate SDKs from API specifications
3. **Versioning**: SDK versions track API versions
4. **Examples**: Comprehensive examples for common operations

---

## References

1. [REST API Design Best Practices](https://docs.microsoft.com/en-us/azure/architecture/best-practices/api-design)
2. [Google API Design Guide](https://cloud.google.com/apis/design)
3. [gRPC Documentation](https://grpc.io/docs/)
4. [OpenAPI Specification](https://spec.openapis.org/oas/latest.html)
5. Project SPEC.md — Section 7: API Specification

---

## Changelog

| Date | Change | Author |
|------|--------|--------|
| $(date +%Y-%m-%d) | Initial API design | API Design Team |
| $(date +%Y-%m-%d) | Added gRPC specification | Platform Team |
| $(date +%Y-%m-%d) | Accepted | Tech Lead |

