export const PETALS_DEFAULT_BASE_URL = "https://chat.petals.dev/api/v1/generate";
export const PETALS_DEFAULT_MODEL = "petals-team/StableBeluga2";

export function normalizePetalsBaseUrl(baseUrl?: string | null) {
  const normalized = typeof baseUrl === "string" ? baseUrl.trim().replace(/\/$/, "") : "";
  return normalized || PETALS_DEFAULT_BASE_URL;
}
