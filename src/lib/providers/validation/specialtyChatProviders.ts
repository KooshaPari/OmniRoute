import { PETALS_DEFAULT_MODEL, normalizePetalsBaseUrl } from "@omniroute/open-sse/config/petals.ts";

import { buildBearerHeaders } from "./headers";
import { toValidationErrorResult, validationRead, validationWrite } from "./transport";
import { normalizeBaseUrl } from "./urlHelpers";

type ValidatorArgs = { apiKey: string; providerSpecificData?: any };

export async function validateV0VercelProvider(
  { apiKey, providerSpecificData = {} }: ValidatorArgs,
  isLocal: boolean = false
) {
  try {
    const configuredBaseUrl =
      typeof providerSpecificData?.baseUrl === "string" && providerSpecificData.baseUrl.trim()
        ? providerSpecificData.baseUrl.trim()
        : "https://api.v0.dev";
    const root = normalizeBaseUrl(configuredBaseUrl)
      .replace(/\/v1\/chat\/completions$/, "")
      .replace(/\/v1$/, "");
    const response = await validationRead(
      `${root}/v1/chats?limit=1`,
      {
        method: "GET",
        headers: buildBearerHeaders(apiKey, providerSpecificData),
      },
      isLocal
    );

    if (response.ok) {
      return { valid: true, error: null, method: "v0_platform_chats_list" };
    }
    if (response.status === 401 || response.status === 403) {
      return { valid: false, error: "Invalid API key" };
    }
    return { valid: false, error: `v0 validation failed: ${response.status}` };
  } catch (error: unknown) {
    return toValidationErrorResult(error);
  }
}

export async function validatePetalsProvider({ apiKey, providerSpecificData = {} }: ValidatorArgs) {
  const url = normalizePetalsBaseUrl(providerSpecificData.baseUrl);
  const modelId =
    typeof providerSpecificData.validationModelId === "string" &&
    providerSpecificData.validationModelId.trim()
      ? providerSpecificData.validationModelId.trim()
      : PETALS_DEFAULT_MODEL;
  const headers: Record<string, string> = {
    "Content-Type": "application/x-www-form-urlencoded",
  };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

  const body = new URLSearchParams({
    model: modelId,
    inputs: "test",
    max_new_tokens: "1",
  });

  try {
    const response = await validationWrite(url, {
      method: "POST",
      headers,
      body: body.toString(),
    });

    if (response.ok) {
      const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
      if (payload.ok === false) {
        return { valid: false, error: "Petals API rejected validation request" };
      }
      return { valid: true, error: null, method: "petals_generate" };
    }
    if (response.status === 401 || response.status === 403) {
      return { valid: false, error: "Invalid API key" };
    }
    if (response.status === 429) {
      return {
        valid: true,
        error: null,
        method: "petals_generate",
        warning: "Rate limited, but endpoint is reachable",
      };
    }
    if (response.status >= 500) {
      return { valid: false, error: `Provider unavailable (${response.status})` };
    }
  } catch (error: unknown) {
    return toValidationErrorResult(error);
  }

  return { valid: false, error: "Connection failed while testing Petals" };
}

export async function validatePoolsideProvider(
  { apiKey, providerSpecificData = {} }: ValidatorArgs,
  isLocal: boolean = false
) {
  try {
    const baseUrl = normalizeBaseUrl(providerSpecificData?.baseUrl || "https://api.poolside.ai/v1");
    const chatUrl = `${baseUrl.replace(/\/chat\/completions$/, "")}/chat/completions`;
    const response = await validationWrite(
      chatUrl,
      {
        method: "POST",
        headers: buildBearerHeaders(apiKey, providerSpecificData),
        body: JSON.stringify({
          model: "poolside-model",
          messages: [{ role: "user", content: "test" }],
          max_tokens: 1,
        }),
      },
      isLocal
    );
    return response.status === 401 || response.status === 403
      ? { valid: false, error: "Invalid API key" }
      : { valid: true, error: null };
  } catch (error: unknown) {
    return toValidationErrorResult(error);
  }
}
