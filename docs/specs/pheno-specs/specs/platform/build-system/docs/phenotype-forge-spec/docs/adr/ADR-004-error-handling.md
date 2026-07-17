# ADR-004: Error Handling and Recovery Strategy

## Status

**Accepted** — Active since project inception

Last Updated: $(date +%Y-%m-%d)

---

## Context

Error handling is a fundamental aspect of system design that affects reliability, observability, and user experience. A comprehensive error handling strategy must address:

1. **Classification**: Distinguishing between different error types
2. **Propagation**: Moving error information to appropriate handlers
3. **Recovery**: Automatically or manually resolving error conditions
4. **Reporting**: Making errors visible to operators and developers
5. **Prevention**: Designing to minimize error occurrence

### Error Taxonomy

We classify errors along multiple dimensions:

#### By Origin
- **User Errors**: Invalid input, permission violations, business rule violations
- **System Errors**: Infrastructure failures, resource exhaustion, service unavailability
- **Programming Errors**: Logic bugs, invariant violations, unhandled edge cases

#### By Severity
- **Fatal**: System cannot continue, requires restart
- **Error**: Operation failed, but system remains stable
- **Warning**: Potential issue, operation succeeded but requires attention
- **Info**: Notable condition, not problematic

#### By Recoverability
- **Recoverable**: Can be resolved automatically with retry or fallback
- **Manual**: Requires operator intervention
- **Terminal**: Cannot be resolved, operation must fail

---

## Decision

We have decided to implement a **comprehensive error handling strategy** with the following components:

### Error Types and Hierarchy

```
AppError (base)
├── DomainError
│   ├── ValidationError
│   ├── BusinessRuleViolation
│   └── EntityNotFound
├── InfrastructureError
│   ├── NetworkError
│   ├── DatabaseError
│   ├── ExternalServiceError
│   └── ConfigurationError
├── SystemError
│   ├── ResourceExhausted
│   ├── InternalError
│   └── Panic
└── UserError
    ├── Unauthorized
    ├── Forbidden
    └── InvalidInput
```

### Error Handling Principles

1. **Fail Fast**: Detect and report errors as early as possible
2. **Clear Messages**: Error messages explain what happened and suggest resolution
3. **Context Preservation**: Include full context (request ID, stack trace, relevant data)
4. **Graceful Degradation**: When possible, continue with reduced functionality
5. **No Silent Failures**: All errors are logged and, if severe, alerted

### Recovery Strategies

| Error Type | Strategy | Implementation |
|------------|----------|----------------|
| Transient | Exponential backoff retry | Automatic retry with jitter |
| Resource | Circuit breaker + queue | Shed load, queue for retry |
| Dependency | Fallback to cache/default | Return cached or default value |
| Permanent | Escalate to operator | Alerting, manual intervention |

### Error Response Format

All API errors follow a consistent format:

```json
{
  "error": {
    "code": "ENTITY_NOT_FOUND",
    "message": "The requested resource was not found",
    "details": {
      "resource_type": "User",
      "resource_id": "user-123"
    },
    "request_id": "req-abc-123",
    "timestamp": "2024-01-15T10:30:00Z",
    "documentation_url": "https://docs.example.com/errors/ENTITY_NOT_FOUND"
  }
}
```

---

## Consequences

### Positive Consequences

1. **Operational Clarity**: Operators can quickly identify and resolve issues
2. **Developer Experience**: Clear error types aid debugging and testing
3. **User Experience**: Meaningful error messages help users recover
4. **System Resilience**: Retry and fallback strategies improve availability
5. **Observability**: Structured errors enable effective monitoring and alerting

### Negative Consequences

1. **Complexity**: Comprehensive error handling adds code overhead
2. **Performance**: Context gathering and logging have runtime cost
3. **Maintenance**: Error taxonomy requires ongoing maintenance as system evolves

### Mitigations

- Code generation for error types and conversions
- Performance testing to validate overhead is acceptable
- Regular review of error taxonomy for relevance

---

## Alternatives Considered

### Alternative 1: Exception-Based Error Handling

**Approach**: Use language exceptions for all error propagation

**Pros**: Familiar pattern, automatic stack trace capture
**Cons**: Can be abused for flow control, invisible in type signatures, performance overhead
**Why Rejected**: Explicit error types provide better documentation and force handling

### Alternative 2: Error Codes Only

**Approach**: Return integer or string error codes without rich context

**Pros**: Simple, minimal overhead, language-agnostic
**Cons**: Limited information, requires documentation lookup, hard to extend
**Why Rejected**: Insufficient context for debugging and user assistance

### Alternative 3: Panic on All Errors

**Approach**: Crash the process on any error condition

**Pros**: Simple failure model, no partial state concerns
**Cons**: Terrible availability, operational nightmare, poor user experience
**Why Rejected**: Completely unacceptable for production service

---

## Implementation Guidelines

### For Domain Errors
- Define explicit error types for each business rule violation
- Include relevant domain context in error (entity IDs, attempted values)
- Map to appropriate HTTP status codes at API boundary

### For Infrastructure Errors
- Wrap external errors with context about the operation being attempted
- Implement retry logic with exponential backoff
- Use circuit breakers to prevent cascade failures

### For Programming Errors
- Use assertions for invariant checking
- Log extensively before failing
- Never expose internal details to users

### Recovery Implementation

```
┌─────────────────────────────────────────────────────────────┐
│                        Request                               │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
                   ┌─────────────────┐
                   │   Try Primary   │
                   └─────────────────┘
                            │
              ┌───────────────┼───────────────┐
              │ Success       │ Failure       │
              ▼               ▼               │
        ┌──────────┐  ┌──────────┐           │
        │ Return   │  │ Retry?   │───────────┘
        │ Result   │  │ (Backoff)│
        └──────────┘  └────┬─────┘
                           │ Max retries
                           ▼
                    ┌──────────┐
                    │ Fallback │
                    │ or Fail  │
                    └──────────┘
```

---

## Monitoring and Alerting

1. **Error Rate Metrics**: Track errors per minute by type
2. **SLA Monitoring**: Alert when error rate exceeds thresholds
3. **Error Budgets**: Allocate allowable error rates per period
4. **Post-Incident Reviews**: Document significant errors and improvements

---

## References

1. [SRE Book: Error Budgets](https://sre.google/sre-book/embracing-risk/)
2. [AWS Well-Architected: Reliability](https://docs.aws.amazon.com/wellarchitected/latest/reliability-pillar/welcome.html)
3. [Designing for Failure](https://aws.amazon.com/blogs/architecture/designing-for-failure/)
4. Project SPEC.md — Section 6: Error Handling

---

## Changelog

| Date | Change | Author |
|------|--------|--------|
| $(date +%Y-%m-%d) | Initial strategy | Reliability Team |
| $(date +%Y-%m-%d) | Added circuit breaker patterns | SRE Team |
| $(date +%Y-%m-%d) | Accepted | Tech Lead |

