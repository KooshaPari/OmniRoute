/**
 * Connection-ID routing utilities for chat handler.
 *
 * Extracted from chat.ts to keep the main handler barrel under the 350-line
 * target.  Both functions are pure helpers with no side effects.
 */

/**
 * Normalise an opaque value into a string[] of non-empty connection IDs, or
 * return `null` when the input is absent / produces no valid entries.
 */
export function normalizeAllowedConnectionIds(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const ids = value.filter(
    (entry): entry is string => typeof entry === "string" && entry.trim().length > 0
  );
  return ids.length > 0 ? ids : null;
}

/**
 * Intersect two connection-ID sources.  When both are present the result is
 * the intersection; when only one is present it passes through; when neither
 * is present `null` is returned.
 */
export function intersectAllowedConnectionIds(primary: unknown, secondary: unknown): string[] | null {
  const first = normalizeAllowedConnectionIds(primary);
  const second = normalizeAllowedConnectionIds(secondary);

  if (first && second) {
    return first.filter((id) => second.includes(id));
  }

  return first || second || null;
}
