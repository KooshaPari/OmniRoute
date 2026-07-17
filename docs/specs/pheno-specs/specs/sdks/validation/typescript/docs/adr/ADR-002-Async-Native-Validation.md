# ADR-002: Async-Native Validation Design

**Status**: Proposed
**Date**: 2026-04-05
**Deciders**: phenotype-validation-ts team

## Context

Most validation libraries treat async validation as an afterthought. Zod's `.check()` breaks the fluent chain, Yup's `.test()` has awkward error handling, and even Valibot's async support feels bolted on.

For modern applications, async validation is common:
- Database lookups to check uniqueness
- API calls to external services
- File system checks
- Session/permission validation

We need async validators to be first-class citizens in the schema chain.

## Decision

phenotype-validation-ts will treat async validation as a first-class concern with a unified API surface for sync and async validators.

### Core Design

All schema validators return `ValidationResult<T>` synchronously. Async validators use `.check()` which returns a `Schema<T>` that detects whether validation is async:

```typescript
// Sync validator - immediate result
const syncResult = validate(v.string().email(), "user@example.com");
// ValidationResult<string>

// Async validator - returns Promise when input requires async check
const asyncSchema = v.string().email().check(
  async (email) => !await db.users.exists({ email })
);

const asyncResult = await validate(asyncSchema, "user@example.com");
// Promise<ValidationResult<string>>
```

### The `.check()` Method

The `.check()` method accepts:
1. A predicate function (sync or async)
2. Optional configuration with message, code, and metadata

```typescript
// Basic async check
const uniqueEmail = v.string().email().check(
  async (email) => {
    const exists = await db.users.findByEmail(email);
    return !exists;
  }
);

// With custom error
const uniqueEmail = v.string().email().check(
  async (email) => {
    const exists = await db.users.findByEmail(email);
    return !exists;
  },
  { 
    message: "Email already registered",
    code: "DUPLICATE_EMAIL"
  }
);

// Context-aware check (receives full input)
const noDuplicateId = v.object({
  id: v.string().uuid(),
  name: v.string().minLength(1),
}).check(
  async (input, ctx) => {
    const conflict = await db.entities.findByName(input.name);
    if (conflict && conflict.id !== input.id) {
      return ctx.addError("Entity with this name already exists");
    }
    return true;
  }
);
```

### Unified API Surface

The `validate()` function detects async schemas automatically:

```typescript
function validate<T>(schema: Schema<T>, input: unknown): ValidationResult<T> | Promise<ValidationResult<T>> {
  // Implementation detects async validators
}
```

Callers use `await` or check if result is a Promise:

```typescript
const result = validate(schema, input);
if (result instanceof Promise) {
  // Handle async case
  const resolved = await result;
}
```

## Consequences

### Positive

1. **Unified API**: Sync and async validators share the same interface
2. **Fluent Chains**: Async validators don't break method chaining
3. **Type Safety**: Type inference works for async validators
4. **Performance**: Sync-only schemas have zero async overhead
5. **Debugging**: Clear distinction between sync and async paths

### Negative

1. **Return Type Complexity**: API returns `Result | Promise<Result>` in some cases
2. **Learning Curve**: Developers must understand when results are async
3. **Bundle Size**: Async support adds some overhead even for sync-only use

### Mitigation

- Clear documentation with sync vs async examples
- TypeScript utility types to detect async schemas (`IsAsyncSchema<S>`)
- Linting rules to enforce consistent async handling
- Code generation for common async patterns

## Alternatives Considered

### Separate Async Schema Types

```typescript
const syncSchema: SyncSchema<string>;
const asyncSchema: AsyncSchema<string>;
```

Cons: Breaks composition, forces users to choose upfront

### Promise-Based Core

```typescript
const schema = v.string().email();
const result = await validate(schema, input); // Always async
```

Cons: Unnecessary overhead for sync-only validation

### Callback-Based Async

```typescript
v.string().check((val, callback) => {
  db.check(val).then(ok => callback(ok));
});
```

Cons: Callback patterns are less composable than Promises

## References

- Zod async validation: https://zod.js.org
- Valibot async: https://valibot.dev
- io-ts: https://github.com/gcanti/io-ts
