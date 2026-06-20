import { NextResponse } from "next/server";
import { z } from "zod";

/**
 * Validate a request body against a Zod schema.
 * Returns either the parsed data (success) or the error details object (failure).
 *
 * On failure: `{ success: false, error: { message, details } }` — route handlers
 * should return `NextResponse.json({ error: v.error }, { status: 400 })`.
 */
export function validateBody<T extends z.ZodTypeAny>(
  schema: T,
  body: unknown
): { success: true; data: z.infer<T> } | { success: false; error: { message: string; details: Array<{ field: string; message: string }> } } {
  const result = schema.safeParse(body);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return {
    success: false,
    error: {
      message: "Invalid request",
      details: result.error.issues.map((i) => ({
        field: i.path.join("."),
        message: i.message,
      })),
    },
  };
}

export function isValidationFailure<T>(
  v:
    | { success: true; data: T }
    | { success: false; error: { message: string; details: Array<{ field: string; message: string }> } }
): v is { success: false; error: { message: string; details: Array<{ field: string; message: string }> } } {
  return !v.success;
}
