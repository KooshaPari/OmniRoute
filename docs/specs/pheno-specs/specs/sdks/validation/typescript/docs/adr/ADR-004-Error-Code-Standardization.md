# ADR-004: Error Code Standardization

**Status**: Proposed
**Date**: 2026-04-05
**Deciders**: phenotype-validation-ts team

## Context

Validation errors in most libraries are either:
1. Strings (human-readable but not machine-readable)
2. Custom objects (flexible but inconsistent)

This makes programmatic error handling difficult:
- i18n requires maintaining string keys
- API responses need consistent error shapes
- Client-side validation parity is hard
- Error tracking and analytics need codes

We need structured errors with standardized codes.

## Decision

All validation errors in phenotype-validation-ts have a standardized structure:

```typescript
interface ValidationIssue {
  code: string;           // Machine-readable error code
  message: string;        // Human-readable message (i18n key or template)
  path: (string | number)[];  // Location of error in data structure
  meta?: Record<string, unknown>;  // Additional context
}
```

### Standard Error Codes

| Code | Description | Example |
|------|-------------|---------|
| `INVALID_TYPE` | Input is not the expected type | `{ name: 123 }` where name should be string |
| `TOO_SMALL` | Value below minimum | String "ab" with minLength(3) |
| `TOO_LARGE` | Value above maximum | String "abcd" with maxLength(3) |
| `PATTERN_MISMATCH` | String doesn't match required pattern | "abc" not matching /^[0-9]+$/ |
| `FORMAT_INVALID` | String doesn't match expected format | "not-an-email" for email format |
| `UNEXPECTED_VALUE` | Value not in allowed set | "unknown" when only "admin" or "user" allowed |
| `CUSTOM_ERROR` | Custom validator failed | `.refine()` or `.check()` returned false |
| `COMPOSITION_FAILED` | Intersection/union validation failed | Value failed all union members |
| `REQUIRED` | Required field missing | undefined for required field |
| `NULLABILITY_VIOLATION` | Null value where not allowed | null for non-nullable field |

### Validation Result Types

```typescript
type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; issues: ValidationIssue[] };

// Alternative safe result without discriminated union
type SafeResult<T> = {
  data?: T;
  issues: ValidationIssue[];
  valid: boolean;
};
```

### Error Path Convention

Paths use dot notation with array indices:

```typescript
// Nested field
{ path: ["user", "email"], ... }

// Array item
{ path: ["users", 0, "name"], ... }

// Deeply nested
{ path: ["org", "departments", 0, "members", 2, "email"], ... }
```

### Usage Examples

```typescript
const userSchema = v.object({
  email: v.string().email(),
  age: v.number().min(0).max(150),
});

const result = validate(userSchema, { email: "invalid", age: -5 });

if (!result.success) {
  for (const issue of result.issues) {
    console.log(`${issue.path.join(".")}: ${issue.code}`);
    // email: FORMAT_INVALID
    // age: TOO_SMALL
  }
}
```

### Error Translation

```typescript
const messages: Record<string, string> = {
  TOO_SMALL: "Value is too small",
  FORMAT_INVALID: "Invalid format",
};

function translate(issue: ValidationIssue): string {
  return messages[issue.code] || issue.message;
}
```

### API Response Transformation

```typescript
function toApiResponse<T>(result: ValidationResult<T>): ApiResponse<T> {
  if (result.success) {
    return { data: result.data, errors: [] };
  }
  return {
    data: undefined,
    errors: result.issues.map(issue => ({
      field: issue.path.join("."),
      code: issue.code,
      message: translate(issue),
    })),
  };
}
```

## Consequences

### Positive

1. **Machine-Readable**: Codes enable programmatic error handling
2. **i18n Ready**: Messages are translation keys, not hardcoded strings
3. **Consistent**: All errors follow the same structure
4. **Analytics-Friendly**: Error codes enable tracking and reporting
5. **Client Parity**: Same codes work on client and server
6. **Documentation**: Codes serve as error documentation

### Negative

1. **Verbosity**: More structure than simple string errors
2. **Mapping Overhead**: Must map codes to messages
3. **Code Ownership**: Need to maintain code registry

### Mitigation

- Default messages provided for all standard codes
- Codes are optional - libraries can use their own
- Documentation lists all standard codes
- Tooling to generate code registries

## Alternatives Considered

### String-Only Errors

```typescript
{ message: "Email is invalid" }
```

Cons: No machine-readable code, can't translate, can't map to API responses

### Custom Error Objects

```typescript
{ errorType: "validation", message: "..." }
```

Cons: Every library uses different structures, no standardization

### Numeric Error Codes

```typescript
{ code: 1001, message: "..." }
```

Cons: Harder to read in code, harder to debug

## References

- JSON Schema validation: https://json-schema.org
- Zod error handling: https://zod.js.org
- Yup validation: https://github.com/jquense/yup
