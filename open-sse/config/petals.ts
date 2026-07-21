/** Petals API defaults and endpoint normalization. */

export const PETALS_DEFAULT_BASE_URL = "https://chat.petals.dev/api/v1/generate";
export const PETALS_DEFAULT_MODEL = "meta-llama/Meta-Llama-3.1-8B-Instruct";

/** Normalize a configured Petals endpoint while preserving its generate route. */
export function normalizePetalsBaseUrl(baseUrl?: string | null): string {
  const value = typeof baseUrl === "string" ? baseUrl.trim() : "";
  if (!value) return PETALS_DEFAULT_BASE_URL;
  const suffixIndex = value.search(/[?#]/);
  const path = suffixIndex === -1 ? value : value.slice(0, suffixIndex);
  const suffix = suffixIndex === -1 ? "" : value.slice(suffixIndex);
  const normalizedPath = path.replace(/\/+$/, "");
  if (/\/generate$/i.test(normalizedPath)) return `${normalizedPath}${suffix}`;
  return `${normalizedPath}/generate${suffix}`;
}
