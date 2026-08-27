/**
 * Petals provider configuration stub.
 * Original file was removed; these are the minimal exports needed
 * by src/lib/providers/validation.ts to compile.
 */

export const PETALS_DEFAULT_MODEL = "bigscience/bloom-7b1";

export function normalizePetalsBaseUrl(url?: string): string {
  return url || "https://chat.petals.dev/api/v1";
}
