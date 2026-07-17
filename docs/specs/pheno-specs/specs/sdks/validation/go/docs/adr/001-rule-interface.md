# ADR-001: Rule Interface Design

**Status**: Accepted  
**Date**: 2026-04-05  
**Author**: Phenotype Architecture Team

## Context

Need to define how individual validation rules are structured and executed within the Phenotype Validation Go framework. This is a foundational decision that affects extensibility, performance, and developer experience.

## Options Considered

### Option 1: Function-based
```go
type ValidationFunc func(ctx context.Context, value any, field string) error
```

**Pros**:
- Simple and lightweight
- Easy to define inline
- No interface overhead

**Cons**:
- Harder to introspect
- Difficult to add metadata
- Less extensible for complex rules

### Option 2: Interface-based
```go
type Rule interface {
    Name() string
    Validate(ctx context.Context, value any, field string) error
    Params() map[string]any
}
```

**Pros**:
- Self-documenting
- Easy to extend
- Can carry metadata
- Supports complex rule hierarchies

**Cons**:
- Slightly more verbose
- Interface overhead (minimal)

### Option 3: Struct tags only
No runtime rule system, only struct tag parsing.

**Pros**:
- Extremely simple
- Zero runtime overhead for rule definitions

**Cons**:
- No dynamic validation
- Limited flexibility
- Hard to test in isolation

## Decision

Use **interface-based** approach with context propagation.

The Rule interface provides the right balance of flexibility and structure:

```go
type Rule interface {
    Name() string
    Validate(ctx context.Context, value any, field string) error
    Params() map[string]any
}
```

## Consequences

### Positive
- **Extensible**: Anyone can implement Rule for custom validation
- **Context propagation**: First-class support for cancellation/timeouts
- **Self-documenting**: Rule parameters are discoverable via Params()
- **Testable**: Rules can be tested in isolation
- **Composable**: Rules can be combined and decorated

### Negative
- **Verbosity**: More code than simple functions
- **Interface overhead**: Minimal but non-zero (measured at <1ns)
- **Learning curve**: Developers must understand interface concept

## Implementation

```go
// BaseRule provides common functionality
type BaseRule struct {
    name   string
    params map[string]any
}

func (r *BaseRule) Name() string              { return r.name }
func (r *BaseRule) Params() map[string]any    { return r.params }

// StringRule example implementation
type StringRule struct {
    BaseRule
    fn func(ctx context.Context, value string, params map[string]any) error
}

func (r *StringRule) Validate(ctx context.Context, value any, field string) error {
    str, ok := value.(string)
    if !ok {
        return NewValidationError(field, "invalid_type", "Expected string, got %T", value)
    }
    return r.fn(ctx, str, r.params)
}
```

## Related Decisions

- ADR-002: Error Aggregation Strategy (rules must support both fail-fast and collect-all modes)
- ADR-003: Context-First API Design (Rule.Validate takes context as first parameter)

## References

- [Go Interfaces](https://go.dev/doc/effective_go#interfaces)
- [Context Package](https://pkg.go.dev/context)
- [go-playground/validator Rule Interface](https://github.com/go-playground/validator/blob/master/validator.go)

---

**Last Updated**: 2026-04-05
