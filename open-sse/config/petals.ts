/** Petals API defaults and endpoint normalization. */

export const PETALS_DEFAULT_BASE_URL = "https://chat.petals.dev/api/v1/generate";
export const PETALS_DEFAULT_MODEL = "meta-llama/Meta-Llama-3.1-8B-Instruct";

/** Normalize a configured Petals endpoint while preserving its generate route. */
export function normalizePetalsBaseUrl(baseUrl?: string | null): string {
  const value = typeof baseUrl === "string" ? baseUrl.trim() : "";
  if (!value) return PETALS_DEFAULT_BASE_URL;
  const normalized = value.replace(/\/+$/, "");
  if (/\/generate$/i.test(normalized)) return normalized;
  return `${normalized}/generate`;
}
