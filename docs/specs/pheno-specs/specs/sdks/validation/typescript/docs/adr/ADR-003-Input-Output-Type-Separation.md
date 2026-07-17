# ADR-003: Input/Output Type Separation

**Status**: Proposed
**Date**: 2026-04-05
**Deciders**: phenotype-validation-ts team

## Context

In most validation libraries, a schema's input type and output type are the same. Zod's `.transform()` breaks this assumption by modifying types mid-chain, making it painful to use transformations while maintaining type safety.

For real-world applications, transformations are essential:
- Trimming whitespace from strings
- Converting date strings to Date objects
- Normalizing phone numbers
- Parsing JSON strings

We need transformations that preserve full type safety throughout the pipeline.

## Decision

Every schema in phenotype-validation-ts has two distinct types:
- `Input<S>`: The type of data the schema accepts
- `Output<S>`: The type of data the schema produces

```typescript
// Schema type definition
type Schema<TInput, TOutput = TInput> = (input: unknown) => ValidationResult<TOutput>;

// Type utilities
type Input<S extends Schema<any>> = S extends Schema<infer T, any> ? T : never;
type Output<S extends Schema<any>> = S extends Schema<any, infer T> ? T : never;
```

### Examples

```typescript
// String schema: input = string, output = string
const stringSchema = v.string();
type StringInput = v.Input<typeof stringSchema>;   // string
type StringOutput = v.Output<typeof stringSchema>; // string

// Transformed schema: input = string, output = string (trimmed)
const trimmedSchema = v.string().transform(s => s.trim());
type TrimmedInput = v.Input<typeof trimmedSchema>;   // string
type TrimmedOutput = v.Output<typeof trimmedSchema>; // string

// Complex transformation: input = unknown, output = Date
const dateSchema = v.string().transform(s => new Date(s));
type DateInput = v.Input<typeof dateSchema>;   // unknown
type DateOutput = v.Output<typeof dateSchema>; // Date

// Object with optional and default
const userSchema = v.object({
  id: v.string().uuid(),
  role: v.union(v.literal("admin"), v.literal("user")).default("user"),
});
type UserInput = v.Input<typeof userSchema>;   // { id: string; role?: "admin" | "user" }
type UserOutput = v.Output<typeof userSchema>; // { id: string; role: "admin" | "user" }
```

### Validation with Transformations

```typescript
const normalizedEmail = v.string()
  .email()
  .transform(s => s.trim().toLowerCase());

// Input: "  User@Example.COM  "
// Output: "user@example.com"

const result = validate(normalizedEmail, "  User@Example.COM  ");
if (result.success) {
  // result.data is typed as "user@example.com" (string, already transformed)
  console.log(result.data); // "user@example.com"
}
```

### Coercion Schemas

Coercion schemas accept one type and output another:

```typescript
const numberFromString = v.coerce(
  v.number(),
  (input) => {
    if (typeof input === "string") {
      const parsed = parseFloat(input);
      if (!isNaN(parsed)) return parsed;
    }
    return input;
  }
);

type NumberFromStringInput = v.Input<typeof numberFromString>;   // unknown
type NumberFromStringOutput = v.Output<typeof numberFromString>; // number

validate(numberFromString, "42"); // Returns 42 as number
```

## Consequences

### Positive

1. **Type Safety**: Transformations don't lose type information
2. **Inference**: Full TypeScript inference at every step
3. **Documentation**: Types serve as documentation of data flow
4. **Validation**: Can validate input shape separately from output shape
5. **API Responses**: Easy to define input validation vs response typing

### Negative

1. **Complexity**: Two type parameters increase cognitive load
2. **Generic Constraints**: More complex type definitions
3. **Documentation Overhead**: Must explain both types

### Mitigation

- Default type parameter: `Schema<T, TOutput = T>` makes single-type case simple
- Type inference handles 90% of cases automatically
- Clear naming: `InferInput` and `InferOutput` utilities
- Documentation with concrete examples

## Alternatives Considered

### Single Type (Zod Pattern)

```typescript
const schema = v.string().transform(s => s.trim());
// Type is now string | { t: string } - confusing!
```

Cons: Transformations lose type safety, break inference

### Output Wrapping

```typescript
const schema = v.string().transform(s => ({ value: s.trim() }));
// Forces output wrapper - awkward
```

Cons: Verbose, forces object wrapping

### Separate Transform Types

```typescript
const schema = v.string();
const transformed = schema.transform(s => s.trim());
// transformed is TransformSchema, not compatible with original
```

Cons: Breaks composition, requires explicit typing

## References

- Zod transforms: https://zod.js.org
- io-ts: https://github.com/gcanti/io-ts
- TypeBox: https://github.com/sinclairzx81/typebox
