export const PETALS_DEFAULT_BASE_URL = "https://chat.petals.dev/api/v1/generate";
export const PETALS_DEFAULT_MODEL = "petals-team/StableBeluga2";

export function normalizePetalsBaseUrl(baseUrl: unknown): string {
  if (typeof baseUrl !== "string") {
    return PETALS_DEFAULT_BASE_URL;
  }

  const trimmed = baseUrl.trim();
  if (!trimmed) {
    return PETALS_DEFAULT_BASE_URL;
  }

  try {
    return new URL(trimmed).toString();
  } catch {
    return PETALS_DEFAULT_BASE_URL;
  }
}
