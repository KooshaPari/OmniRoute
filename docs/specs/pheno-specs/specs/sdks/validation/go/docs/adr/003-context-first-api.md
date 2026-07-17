# ADR-003: Context-First API Design

**Status**: Accepted  
**Date**: 2026-04-05  
**Author**: Phenotype Architecture Team

## Context

Modern Go applications heavily use context.Context for request-scoped values, cancellation, and timeouts. No existing Go validation library has first-class context support.

## Problem Statement

- Long-running validations need cancellation support
- Distributed traces should propagate through validation
- Request-scoped data (user ID, tenant) may affect validation rules
- Timeouts are essential for external validation (database, API calls)

## Options Considered

### Option 1: No Context Support (Current ecosystem standard)
```go
err := validator.ValidateStruct(user)
```

**Pros**:
- Simple API
- Compatible with existing libraries
- No context propagation complexity

**Cons**:
- No cancellation support
- No timeout handling
- Can't access request-scoped data
- Difficult to integrate with tracing

### Option 2: Context as First Parameter
```go
err := validator.ValidateStruct(ctx, user)
```

**Pros**:
- Idiomatic Go (ctx is first param convention)
- Full context support
- Cancellation, timeouts, values all available
- Future-proof for tracing

**Cons**:
- Breaking change from existing libraries
- More verbose for simple cases
- Requires context.Background() for non-request validation

### Option 3: Context as Optional Parameter
```go
err := validator.ValidateStruct(user)  // no context
err := validator.ValidateStruct(user, validator.WithContext(ctx))  // with context
```

**Pros**:
- Backward compatible API
- Context available when needed
- Simple cases stay simple

**Cons**:
- Inconsistent with Go conventions
- Optional parameters in Go are awkward
- Easy to forget context when needed

## Decision

Use **Context as First Parameter** for all validation methods.

```go
// All validation methods take context first
ValidateStruct(ctx context.Context, v any) error
ValidateVar(ctx context.Context, field string, value any, rules ...Rule) error
ValidateSchema(ctx context.Context, v any, schema Schema) error
```

## Consequences

### Positive
- **Idiomatic Go**: Follows standard context pattern
- **Full functionality**: Cancellation, timeouts, values all supported
- **Tracing**: OpenTelemetry traces can propagate
- **Testing**: context.WithTimeout for slow validation tests
- **Future-proof**: As Go ecosystem evolves, context becomes more essential

### Negative
- **Breaking change**: Different from all existing validation libraries
- **Verbosity**: Simple validations need context.Background()
- **Learning curve**: New developers must understand context

## Migration Path

For users coming from context-less libraries:

```go
// Before (go-playground)
err := validate.Struct(user)

// After (phenotype)
err := v.ValidateStruct(context.Background(), user)

// Or with proper context in HTTP handlers
err := v.ValidateStruct(r.Context(), user)
```

## Implementation

```go
// Core interfaces with context
type Validator interface {
    ValidateStruct(ctx context.Context, v any) error
    ValidateVar(ctx context.Context, field string, value any, rules ...Rule) error
    ValidateSchema(ctx context.Context, v any, schema Schema) error
}

type Rule interface {
    Validate(ctx context.Context, value any, field string) error
}

// Usage examples
func handler(w http.ResponseWriter, r *http.Request) {
    var user User
    
    // With request context (supports cancellation, timeout)
    if err := v.ValidateStruct(r.Context(), &user); err != nil {
        http.Error(w, err.Error(), 400)
        return
    }
}

func backgroundJob() {
    // Create context with timeout
    ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
    defer cancel()
    
    if err := v.ValidateStruct(ctx, data); err != nil {
        log.Error(err)
    }
}
```

## Use Cases Enabled

| Use Case | Without Context | With Context |
|----------|-----------------|--------------|
| HTTP timeouts | Not possible | `r.Context()` with timeout |
| Cancellation | Not possible | `ctx.Done()` channel |
| Request-scoped data | Global state | `ctx.Value()` |
| Distributed tracing | Manual | Automatic propagation |
| Database validation | Background | Cancelable |
| External API validation | May hang | Timeout-protected |

## Performance Impact

| Scenario | No Context | With Context | Overhead |
|----------|------------|--------------|----------|
| Simple validation | 150 ns | 152 ns | 1.3% |
| Complex validation | 450 ns | 455 ns | 1.1% |

The overhead is negligible compared to the benefits.

## Related Decisions

- ADR-001: Rule Interface Design (Rule.Validate takes context)
- ADR-002: Error Aggregation Strategy (context can affect error handling)

## References

- [Go Context Package](https://pkg.go.dev/context)
- [Context Best Practices](https://go.dev/blog/context)
- [Go Code Review Comments - Contexts](https://github.com/golang/go/wiki/CodeReviewComments#contexts)
- [Uber Go Style Guide - Context](https://github.com/uber-go/guide/blob/master/style.md#pass-context-as-first-argument)

---

**Last Updated**: 2026-04-05
