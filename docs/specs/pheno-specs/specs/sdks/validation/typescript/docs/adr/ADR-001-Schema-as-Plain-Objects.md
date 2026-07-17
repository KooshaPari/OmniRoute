# ADR-001: Schema as Plain Objects, Not Classes

**Status**: Proposed
**Date**: 2026-04-05
**Deciders**: phenotype-validation-ts team

## Context

The TypeScript validation library landscape predominantly uses class-based schemas (Zod, Yup, Joi). This approach, while familiar to many developers, introduces limitations that impact testability, serialization, and functional composition.

We need to choose a schema representation that:
1. Enables pure functional composition
2. Supports schema serialization (for storage, transmission, code generation)
3. Allows easy mocking and testing
4. Maintains type safety throughout

## Decision

We will use plain TypeScript objects (higher-order functions) as the schema representation, not classes.

```typescript
// Instead of class-based:
class StringSchema {
  minLength(n: number) { return new StringSchema(...); }
}

// We use:
type StringSchema = (input: unknown) => ValidationResult<string>;

const string = (): StringSchema => (input) => {
  if (typeof input !== "string") {
    return { success: false, issues: [...] };
  }
  return { success: true, data: input };
};
```

Constraints are applied via function composition:

```typescript
const minLength = (n: number, schema: StringSchema): StringSchema =>
  (input) => {
    const result = schema(input);
    if (!result.success) return result;
    if (result.data.length < n) {
      return { success: false, issues: [{ code: "TOO_SMALL", ... }] };
    }
    return result;
  };

const email = (schema: StringSchema): StringSchema => (input) => {
  const result = schema(input);
  if (!result.success) return result;
  if (!isValidEmail(result.data)) {
    return { success: false, issues: [{ code: "FORMAT_INVALID", ... }] };
  }
  return result;
};

// Composition:
const schema = email(minLength(1, string()));
```

## Consequences

### Positive

1. **Serialization**: Schemas can be serialized to JSON and reconstructed
2. **Testing**: Schemas are values, easily mocked or replaced
3. **Functional Composition**: Standard function composition patterns apply
4. **No new Keyword**: Works naturally in functional TypeScript
5. **Tree-Shaking**: Dead code elimination works optimally

### Negative

1. **Familiarity**: Developers accustomed to Zod/Yup class syntax may find it unfamiliar
2. **Method Chaining**: The fluent API style differs from typical method calls
3. **IDE Support**: Autocomplete patterns differ from class-based APIs

### Mitigation

The API will still provide a fluent builder-style interface that feels similar:

```typescript
const schema = v.string().minLength(1).email().toLowerCase();
```

The builder methods return new schema objects rather than mutating, maintaining immutability while providing a familiar interface.

## Alternatives Considered

### Classes (Zod Pattern)

```typescript
z.string().minLength(1).email()
```

Pros: Familiar, good IDE support, chainable
Cons: Not serializable, harder to test, mutability issues

### Tagged Unions (io-ts Pattern)

```typescript
const string = (): StringSchema => ({ _tag: "String" });
```

Pros: Excellent type inference, pure FP
Cons: Verbose, steep learning curve, error handling verbose

### Symbols as Schema Keys

```typescript
const schema = { [SchemaSymbol]: (input) => ... };
```

Pros: Extensible, can attach metadata
Cons: Non-standard, confusing to users

## References

- Zod: https://zod.js.org
- io-ts: https://github.com/gcanti/io-ts
- TypeBox: https://github.com/sinclairzx81/typebox
