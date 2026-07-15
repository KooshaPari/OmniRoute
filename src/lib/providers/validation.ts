import { getRegistryEntry } from "@omniroute/open-sse/config/providerRegistry.ts";
import {
  isClaudeCodeCompatibleProvider,
  isAnthropicCompatibleProvider,
  isLocalProvider,
  isOpenAICompatibleProvider,
  isSelfHostedChatProvider,
  providerAllowsOptionalApiKey,
  WEB_COOKIE_PROVIDERS,
} from "@/shared/constants/providers";

import {
  OPENAI_LIKE_FORMATS,
  GEMINI_LIKE_FORMATS,
  addModelsSuffix,
  resolveBaseUrl,
} from "./validation/urlHelpers";
import { applyCustomUserAgent } from "./validation/headers";
import { toValidationErrorResult } from "./validation/transport";
import {
  validateOpenAILikeProvider,
  validateCommandCodeProvider,
  validateGeminiLikeProvider,
  validateOpenAICompatibleProvider,
} from "./validation/openaiFormat";
import { getSpecialtyValidator } from "./validation/specialtyProviders";
import {
  validateAnthropicLikeProvider,
  validateAnthropicCompatibleProvider,
  validateClaudeCodeCompatibleProvider,
} from "./validation/anthropicFormat";
// validateCommandCodeProvider + validateClaudeCodeCompatibleProvider have external importers
// (provider-nodes/validate route + tests) — re-export to preserve the historical public surface.
export { validateCommandCodeProvider, validateClaudeCodeCompatibleProvider };

// isRetryableProxyTarget + isSecurityBlockError now live in ./validation/transport. Re-export them
// here to preserve the historical public surface (tests + route handlers import them via this module).
export { isRetryableProxyTarget, isSecurityBlockError } from "./validation/transport";

/**
 * Validates web-cookie providers by performing a ping request to check if the session is still valid.
 * Returns SESSION_EXPIRED error code if the upstream returns 401/403.
 */
export async function validateWebCookieProvider({
  provider,
  apiKey,
  providerSpecificData = {},
}: any) {
  const entry = (WEB_COOKIE_PROVIDERS as Record<string, { website?: string } | undefined>)[
    provider
  ];
  if (!entry) {
    return { valid: false, error: "Provider validation not supported", unsupported: true };
  }

  const cookie = typeof apiKey === "string" ? apiKey.trim() : "";
  if (!cookie) {
    return {
      valid: false,
      error: "Cookie is required for web-cookie provider validation",
      unsupported: false,
    };
  }

  try {
    const url = new URL("/models", entry.website || "https://example.com").toString();
    const response = await globalThis.fetch(url, {
      method: "GET",
      headers: applyCustomUserAgent(
        {
          Accept: "application/json",
          Cookie: cookie,
        },
        providerSpecificData
      ),
    });

    if (response.status === 401 || response.status === 403) {
      return {
        valid: false,
        error: "SESSION_EXPIRED",
        errorCode: "AUTH_007",
        unsupported: false,
      };
    }

    return { valid: true, error: null, unsupported: false };
  } catch (error: unknown) {
    return toValidationErrorResult(error);
  }
}

export {
  bytezValidationResultFromStatus,
  validateBytezProvider,
} from "./validation/specialtyProviders";

async function validateCompatibleProvider(
  provider: string,
  apiKey: string,
  providerSpecificData: any,
  isLocal: boolean
) {
  if (isOpenAICompatibleProvider(provider)) {
    try {
      return await validateOpenAICompatibleProvider({ apiKey, providerSpecificData });
    } catch (error: any) {
      return toValidationErrorResult(error);
    }
  }

  if (isAnthropicCompatibleProvider(provider)) {
    try {
      if (isClaudeCodeCompatibleProvider(provider)) {
        return await validateClaudeCodeCompatibleProvider({ apiKey, providerSpecificData });
      }
      return await validateAnthropicCompatibleProvider({
        apiKey,
        providerSpecificData,
        isLocal,
      });
    } catch (error: any) {
      return toValidationErrorResult(error);
    }
  }

  return null;
}

function antigravityTokenExpiry(providerSpecificData: any): number {
  const expiresAt =
    providerSpecificData?.tokenExpiresAt ||
    providerSpecificData?.expiresAt ||
    providerSpecificData?.expiry_date ||
    providerSpecificData?.expiryDate;
  if (typeof expiresAt === "number") return expiresAt;
  if (typeof expiresAt === "string" && expiresAt.trim()) return Date.parse(expiresAt);
  return Number.NaN;
}

function validateAntigravityProvider(providerSpecificData: any) {
  const expiryMs = antigravityTokenExpiry(providerSpecificData);
  if (Number.isFinite(expiryMs) && expiryMs > 0 && expiryMs < Date.now()) {
    return {
      valid: false,
      error: "Antigravity OAuth token has expired. Re-import or refresh the CLI login.",
      unsupported: false,
    };
  }
  return { valid: true, error: null, unsupported: false };
}

function buildAnthropicValidationHeaders(entry: any, apiKey: string): Record<string, string> {
  const headers = { ...entry.headers };
  const authHeader = (entry.authHeader || "").toLowerCase();
  if (authHeader === "x-api-key") headers["x-api-key"] = apiKey;
  else headers.Authorization = `Bearer ${apiKey}`;
  return headers;
}

async function validateRegistryFormat({
  entry,
  apiKey,
  providerSpecificData,
  isLocal,
  baseUrl,
}: any) {
  const modelId = entry.models?.[0]?.id || null;
  if (OPENAI_LIKE_FORMATS.has(entry.format)) {
    return validateOpenAILikeProvider({
      apiKey,
      baseUrl,
      headers: entry.headers || {},
      providerSpecificData,
      modelId,
      modelsUrl: entry.modelsUrl,
      isLocal,
    });
  }

  if (entry.format === "claude") {
    return validateAnthropicLikeProvider({
      apiKey,
      baseUrl: `${baseUrl}${entry.urlSuffix || ""}`,
      modelId,
      headers: buildAnthropicValidationHeaders(entry, apiKey),
      providerSpecificData,
      isLocal,
    });
  }

  if (GEMINI_LIKE_FORMATS.has(entry.format)) {
    return validateGeminiLikeProvider({
      apiKey,
      baseUrl,
      providerSpecificData,
      authType: entry.authType,
      isLocal,
    });
  }

  if (entry.format === "antigravity") return validateAntigravityProvider(providerSpecificData);
  return { valid: false, error: "Provider validation not supported", unsupported: true };
}

async function validateRegisteredProvider({
  provider,
  apiKey,
  providerSpecificData,
  isLocal,
}: any) {
  const entry = getRegistryEntry(provider);
  if (!entry) {
    if (!isSelfHostedChatProvider(provider)) {
      return { valid: false, error: "Provider validation not supported", unsupported: true };
    }
    return validateOpenAILikeProvider({
      provider,
      apiKey,
      baseUrl: resolveBaseUrl(null, providerSpecificData),
      providerSpecificData,
      modelId: "local-model",
      modelsUrl: addModelsSuffix(providerSpecificData?.baseUrl || ""),
      isLocal,
    });
  }

  const validationEntry = entry.testKeyBaseUrl
    ? { ...entry, baseUrl: entry.testKeyBaseUrl }
    : entry;
  const baseUrl = resolveBaseUrl(validationEntry, providerSpecificData);
  try {
    return await validateRegistryFormat({
      entry,
      apiKey,
      providerSpecificData,
      isLocal,
      baseUrl,
    });
  } catch (error: unknown) {
    return toValidationErrorResult(error);
  }
}

export async function validateProviderApiKey({ provider, apiKey, providerSpecificData = {} }: any) {
  const requiresApiKey = !providerAllowsOptionalApiKey(provider);
  const isLocal = isLocalProvider(provider);
  if (!provider || (requiresApiKey && !apiKey)) {
    return { valid: false, error: "Provider and API key required", unsupported: false };
  }

  const compatibleResult = await validateCompatibleProvider(
    provider,
    apiKey,
    providerSpecificData,
    isLocal
  );
  if (compatibleResult) return compatibleResult;

  const specialtyValidator = getSpecialtyValidator(provider);
  if (specialtyValidator) {
    try {
      return await specialtyValidator({ apiKey, providerSpecificData }, isLocal);
    } catch (error: unknown) {
      return toValidationErrorResult(error);
    }
  }

  // Web-cookie providers WITHOUT a dedicated specialty validator above fall back to the generic
  // session-ping check (AUTH_007 SESSION_EXPIRED on 401/403). Providers that DO have a rich
  // per-provider validator (grok-web, chatgpt-web, claude-web, …) are handled by
  // SPECIALTY_VALIDATORS first and must not be shadowed by this generic probe (issue: the
  // #4023 dispatch was placed too early and intercepted every web-cookie provider).
  if (WEB_COOKIE_PROVIDERS[provider]) {
    try {
      return await validateWebCookieProvider({ provider, apiKey, providerSpecificData });
    } catch (error: any) {
      return toValidationErrorResult(error);
    }
  }
  return validateRegisteredProvider({ provider, apiKey, providerSpecificData, isLocal });
}
