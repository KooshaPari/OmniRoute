import { getEmbeddingProvider } from "@omniroute/open-sse/config/embeddingRegistry.ts";
import { getRerankProvider } from "@omniroute/open-sse/config/rerankRegistry.ts";
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
import { SAFE_OUTBOUND_FETCH_PRESETS, safeOutboundFetch } from "@/shared/network/safeOutboundFetch";
import { getProviderOutboundGuard } from "@/shared/network/outboundUrlGuard";
import { resolveNvidiaValidationModel } from "@/lib/providers/nvidiaValidationModel";
import { MODAL_DEFAULT_VALIDATION_MODEL_ID } from "@/shared/constants/modal";
import { validateQoderCliPat } from "@omniroute/open-sse/services/qoderCli.ts";
import { validateImageProviderApiKey } from "@/lib/providers/imageValidation";
import { usesCcWireImage } from "@omniroute/open-sse/services/ccWireImageBuiltins.ts";
import {
  isAlibabaRegionalProvider,
  resolveAlibabaProviderBaseUrl,
} from "@/shared/constants/alibabaProviderRegions";
import { buildProviderHeaders, buildProviderUrl } from "@omniroute/open-sse/services/provider.ts";

import {
  OPENAI_LIKE_FORMATS,
  GEMINI_LIKE_FORMATS,
  normalizeBaseUrl,
  addModelsSuffix,
  resolveBaseUrl,
} from "./validation/urlHelpers";
import { toValidationErrorResult } from "./validation/transport";
import {
  validateDeepSeekWebProvider,
  validateQwenWebProvider,
  validateGrokWebProvider,
  validateChatGptWebProvider,
  validatePerplexityWebProvider,
  validateBlackboxWebProvider,
  validateKimiWebProvider,
} from "./validation/webProvidersA";
import {
  validateMuseSparkWebProvider,
  validateAdaptaWebProvider,
  validateClaudeWebProvider,
  validateGeminiWebProvider,
  validateCopilotM365WebProvider,
  validateCopilotWebProvider,
  validateT3WebProvider,
  validateJulesProvider,
  validateInnerAiProvider,
  validateNotionWebProvider,
} from "./validation/webProvidersB";
import {
  validateHerokuProvider,
  validateDatabricksProvider,
  validateDataRobotProvider,
  validateSnowflakeProvider,
  validateGigachatProvider,
  validateAzureOpenAIProvider,
  validateAzureAiProvider,
  validateWatsonxProvider,
  validateOciProvider,
  validateSapProvider,
} from "./validation/cloudProviders";
import {
  validateDeepgramProvider,
  validateAssemblyAIProvider,
  validateRevAiProvider,
  validateElevenLabsProvider,
  validateInworldProvider,
  validateKieProvider,
  validateAwsPollyProvider,
  validateBailianCodingPlanProvider,
  validateQwenCloudTokenPlanProvider,
  validateRekaProvider,
  validateMaritalkProvider,
  validateNlpCloudProvider,
  validateRunwayProvider,
  validateNousResearchProvider,
  validatePoeProvider,
} from "./validation/audioMiscProviders";
import { validateSearchProvider, SEARCH_VALIDATOR_CONFIGS } from "./validation/searchProviders";
import {
  validateClarifaiProvider,
  validateEmbeddingApiProvider,
  validateRerankApiProvider,
} from "./validation/embeddingProviders";
import {
  validateBedrockProvider,
  validateOpenAILikeProvider,
  validateCommandCodeProvider,
  validateGeminiLikeProvider,
  validateHuggingFaceProvider,
  validateOpenAICompatibleProvider,
} from "./validation/openaiFormat";
import {
  validateAnthropicLikeProvider,
  validateAnthropicCompatibleProvider,
  validateClaudeCodeCompatibleProvider,
} from "./validation/anthropicFormat";
import {
  validateWebCookieProvider,
  bytezValidationResultFromStatus,
  validateBytezProvider,
} from "./validation/webCookie";
import {
  validateV0VercelProvider,
  validateAuggieProvider,
  validateQoderProvider,
  validateKiroProvider,
  validateGitlabProvider,
  validateVertexProvider,
  validateVertexPartnerProvider,
  validateLongcatProvider,
  validateNvidiaProvider,
  validateZaiProvider,
  validateXiaomiMimoProvider,
  buildGitlawbValidators,
} from "./validation/specialtyInline";
// validateCommandCodeProvider + validateClaudeCodeCompatibleProvider have external importers
// (provider-nodes/validate route + tests) — re-export to preserve the historical public surface.
export { validateCommandCodeProvider, validateClaudeCodeCompatibleProvider };

// isRetryableProxyTarget + isSecurityBlockError now live in ./validation/transport. Re-export them
// here to preserve the historical public surface (tests + route handlers import them via this module).
export { isRetryableProxyTarget, isSecurityBlockError } from "./validation/transport";

// validateWebCookieProvider + bytezValidationResultFromStatus have external importers (tests +
// the web-cookie fallback suites) — re-export to preserve the historical public surface.
export { validateWebCookieProvider, bytezValidationResultFromStatus };

// validateWebCookieProvider, bytezValidationResultFromStatus, validateBytezProvider, and
// validateKiroApiKeyRuntimeProbe now live in ./validation/webCookie and ./validation/kiro.
// They are re-exported above to preserve the historical public surface.

export async function validateProviderApiKey({ provider, apiKey, providerSpecificData = {} }: any) {
  const requiresApiKey = !providerAllowsOptionalApiKey(provider);
  const isLocal = isLocalProvider(provider);

  if (!provider || (requiresApiKey && !apiKey)) {
    return { valid: false, error: "Provider and API key required", unsupported: false };
  }

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

  // buildOpengatewayValidator + buildGitlawbValidators now live in ./validation/specialtyInline
  // (god-file decomposition). The host still owns the SPECIALTY_VALIDATORS map below; only the
  // validator bodies were extracted as leaf functions taking `isLocal` where the original
  // closure captured it.

  // -- Specialty provider validation --
  const SPECIALTY_VALIDATORS = {
    "v0-vercel": async ({ apiKey, providerSpecificData }: any) => {
      try {
        const configuredBaseUrl =
          typeof providerSpecificData?.baseUrl === "string" && providerSpecificData.baseUrl.trim()
            ? providerSpecificData.baseUrl.trim()
            : "https://api.v0.dev";

        const root = normalizeBaseUrl(configuredBaseUrl)
          .replace(/\/v1\/chat\/completions$/, "")
          .replace(/\/v1$/, "");

        const res = await validationRead(
          `${root}/v1/chats?limit=1`,
          {
            method: "GET",
            headers: buildBearerHeaders(apiKey, providerSpecificData),
          },
          isLocal
        );

        if (res.ok) {
          return { valid: true, error: null, method: "v0_platform_chats_list" };
        }

        if (res.status === 401 || res.status === 403) {
          return { valid: false, error: "Invalid API key" };
        }

        return { valid: false, error: `v0 validation failed: ${res.status}` };
      } catch (error: any) {
        return toValidationErrorResult(error);
      }
    },
    jules: validateJulesProvider,
    // auggie is a fully local, credential-less CLI passthrough — there is no API
    // key to check upstream. The only meaningful validation is confirming the
    // `auggie` binary is installed and runnable on this machine.
    auggie: async () => {
      const { checkAuggieCliVersion } = await import(
        "@omniroute/open-sse/executors/auggie.ts"
      );
      const result = await checkAuggieCliVersion();
      if (!result.ok) {
        return {
          valid: false,
          error: result.error || "Auggie CLI not found. Install it and run `auggie login`.",
          unsupported: false,
        };
      }
      return { valid: true, error: null, unsupported: false, method: result.version };
    },
    qoder: async ({ apiKey, providerSpecificData }: any) => {
      // Bifurcate validation: PAT tokens use Cosy auth against api1.qoder.sh;
      // regular API keys validate against dashscope (OpenAI-compatible endpoint).
      const key = (apiKey || "").trim();
      if (key.startsWith("pt-")) {
        return validateQoderCliPat({ apiKey: key, providerSpecificData });
      }
      // Non-PAT token → validate against dashscope (Alibaba Cloud).
      // The executor routes these tokens to dashscope.aliyuncs.com, so the
      // validation must test against dashscope, NOT the Cosy PAT endpoint.
      try {
        const dashscopeUrl = "https://dashscope.aliyuncs.com/compatible-mode/v1/models";
        const res = await validationRead(
          dashscopeUrl,
          {
            headers: {
              Authorization: `Bearer ${key}`,
            },
          },
          false
        );
        if (res.ok) return { valid: true, error: null };
        if (res.status === 401 || res.status === 403) {
          return {
            valid: false,
            error:
              "Invalid Qoder API key. Make sure you're using a valid API key from Qoder / Alibaba Cloud Dashscope.",
          };
        }
        // 4xx/5xx other than auth — treat as valid bypass to prevent false
        // negatives from transient dashscope issues (consistent with PAT path).
        return { valid: true, error: null };
      } catch (err: unknown) {
        return toValidationErrorResult(err);
      }
    },
    "command-code": validateCommandCodeProvider,
    huggingface: validateHuggingFaceProvider,
    // #5422: auth-only probe — Bytez 404s on every chat model until the account adds it to
    // its catalog, so the generic chat probe can't validate a fresh key.
    bytez: validateBytezProvider,
    deepgram: validateDeepgramProvider,
    assemblyai: validateAssemblyAIProvider,
    "rev-ai": validateRevAiProvider,
    "fal-ai": ({ apiKey, providerSpecificData }: any) =>
      validateImageProviderApiKey({ provider: "fal-ai", apiKey, providerSpecificData }),
    "stability-ai": ({ apiKey, providerSpecificData }: any) =>
      validateImageProviderApiKey({ provider: "stability-ai", apiKey, providerSpecificData }),
    "black-forest-labs": ({ apiKey, providerSpecificData }: any) =>
      validateImageProviderApiKey({ provider: "black-forest-labs", apiKey, providerSpecificData }),
    recraft: ({ apiKey, providerSpecificData }: any) =>
      validateImageProviderApiKey({ provider: "recraft", apiKey, providerSpecificData }),
    topaz: ({ apiKey, providerSpecificData }: any) =>
      validateImageProviderApiKey({ provider: "topaz", apiKey, providerSpecificData }),
    elevenlabs: validateElevenLabsProvider,
    inworld: validateInworldProvider,
    kie: validateKieProvider,
    "aws-polly": validateAwsPollyProvider,
    "bailian-coding-plan": validateBailianCodingPlanProvider,
    "qwen-cloud-token-plan": validateQwenCloudTokenPlanProvider,
    heroku: validateHerokuProvider,
    databricks: validateDatabricksProvider,
    datarobot: validateDataRobotProvider,
    watsonx: validateWatsonxProvider,
    oci: validateOciProvider,
    sap: validateSapProvider,
    bedrock: validateBedrockProvider,
    modal: ({ apiKey, providerSpecificData }: any) =>
      validateOpenAILikeProvider({
        provider: "modal",
        apiKey,
        providerSpecificData,
        baseUrl: normalizeBaseUrl(providerSpecificData?.baseUrl || ""),
        modelId: MODAL_DEFAULT_VALIDATION_MODEL_ID,
        isLocal,
      }),
    "nous-research": validateNousResearchProvider,
    poe: validatePoeProvider,
    clarifai: validateClarifaiProvider,
    reka: validateRekaProvider,
    maritalk: validateMaritalkProvider,
    nlpcloud: validateNlpCloudProvider,
    runwayml: validateRunwayProvider,
    snowflake: validateSnowflakeProvider,
    gigachat: validateGigachatProvider,
    "deepseek-web": validateDeepSeekWebProvider,
    "grok-web": validateGrokWebProvider,
    "qwen-web": validateQwenWebProvider,
    "kimi-web": validateKimiWebProvider,
    "chatgpt-web": validateChatGptWebProvider,
    "perplexity-web": validatePerplexityWebProvider,
    "blackbox-web": validateBlackboxWebProvider,
    "muse-spark-web": validateMuseSparkWebProvider,
    "inner-ai": validateInnerAiProvider,
    "adapta-web": validateAdaptaWebProvider,
    "claude-web": validateClaudeWebProvider,
    "gemini-web": validateGeminiWebProvider,
    "copilot-m365-web": validateCopilotM365WebProvider,
    "copilot-web": validateCopilotWebProvider,
    "t3-web": validateT3WebProvider,
    "azure-openai": validateAzureOpenAIProvider,
    "azure-ai": validateAzureAiProvider,
    "voyage-ai": ({ apiKey, providerSpecificData }: any) => {
      const embeddingProvider = getEmbeddingProvider("voyage-ai");
      return validateEmbeddingApiProvider({
        apiKey,
        providerSpecificData,
        url: embeddingProvider?.baseUrl,
        modelId: embeddingProvider?.models?.[0]?.id || "voyage-4-lite",
      });
    },
    "jina-ai": ({ apiKey, providerSpecificData }: any) => {
      const rerankProvider = getRerankProvider("jina-ai");
      return validateRerankApiProvider({
        apiKey,
        providerSpecificData,
        url: rerankProvider?.baseUrl,
        modelId: rerankProvider?.models?.[0]?.id || "jina-reranker-v3",
      });
    },
    gitlab: ({ apiKey, providerSpecificData }: any) =>
      validateGitlabProvider({ apiKey, providerSpecificData, isLocal }),
    vertex: validateVertexProvider,
    "vertex-partner": validateVertexPartnerProvider,
    longcat: ({ apiKey, providerSpecificData }: any) =>
      validateLongcatProvider({ apiKey, providerSpecificData, isLocal }),
    nvidia: validateNvidiaProvider,
    zai: validateZaiProvider,
    "xiaomi-mimo": ({ apiKey, providerSpecificData }: any) =>
      validateXiaomiMimoProvider({ apiKey, providerSpecificData, isLocal }),
    // Gitlawb Opengateway — Xiaomi MiMo compatible, same /models endpoint limitation.
    // Bypass /models probe in favor of chat/completions, matching xiaomi-mimo's pattern.
    // Uses a factory to share validation logic across Opengateway provider variants.
    ...buildGitlawbValidators(
      [
        ["gitlawb", "https://opengateway.gitlawb.com/v1/xiaomi-mimo", "mimo-v2.5-pro"],
        ["gitlawb-gmi", "https://opengateway.gitlawb.com/v1/gmi-cloud", "XiaomiMiMo/MiMo-V2.5-Pro"],
      ],
      isLocal
    ),
    // Search providers — use factored validator
    ...Object.fromEntries(
      Object.entries(SEARCH_VALIDATOR_CONFIGS).map(([id, configFn]) => [
        id,
        ({ apiKey, providerSpecificData }: any) => {
          const { url, init } = configFn(apiKey, providerSpecificData);
          return validateSearchProvider(url, init, providerSpecificData, isLocal);
        },
      ])
    ),
  };

  if (SPECIALTY_VALIDATORS[provider]) {
    try {
      return await SPECIALTY_VALIDATORS[provider]({ apiKey, providerSpecificData });
    } catch (error: any) {
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

  const entry = getRegistryEntry(provider);
  if (!entry) {
    if (isSelfHostedChatProvider(provider)) {
      return await validateOpenAILikeProvider({
        provider,
        apiKey,
        baseUrl: resolveBaseUrl(null, providerSpecificData),
        providerSpecificData,
        modelId: "local-model",
        modelsUrl: addModelsSuffix(providerSpecificData?.baseUrl || ""),
        isLocal,
      });
    }
    return { valid: false, error: "Provider validation not supported", unsupported: true };
  }

  const modelId = entry.models?.[0]?.id || null;
  // (#532) Use testKeyBaseUrl if defined — some providers validate keys on a different endpoint
  // than where requests are sent (e.g. opencode-go validates on zen/v1, not zen/go/v1)
  const validationEntry = entry.testKeyBaseUrl
    ? { ...entry, baseUrl: entry.testKeyBaseUrl }
    : entry;
  const usesAlibabaRegionalEndpoint = isAlibabaRegionalProvider(provider);
  const baseUrl = usesAlibabaRegionalEndpoint
    ? resolveAlibabaProviderBaseUrl(provider, providerSpecificData, validationEntry.baseUrl)
    : resolveBaseUrl(validationEntry, providerSpecificData);

  try {
    if (OPENAI_LIKE_FORMATS.has(entry.format)) {
      return await validateOpenAILikeProvider({
        apiKey,
        baseUrl,
        headers: entry.headers || {},
        providerSpecificData,
        modelId,
        modelsUrl: usesAlibabaRegionalEndpoint ? "" : entry.testKeyModelsUrl || entry.modelsUrl,
        isLocal,
      });
    }

    if (entry.format === "claude") {
      const requestBaseUrl = `${baseUrl}${entry.urlSuffix || ""}`;
      const requestHeaders = {
        ...(entry.headers || {}),
      };

      if ((entry.authHeader || "").toLowerCase() === "x-api-key") {
        requestHeaders["x-api-key"] = apiKey;
      } else {
        requestHeaders["Authorization"] = `Bearer ${apiKey}`;
      }

      return await validateAnthropicLikeProvider({
        apiKey,
        baseUrl: requestBaseUrl,
        modelId,
        headers: requestHeaders,
        providerSpecificData,
        isLocal,
      });
    }

    if (GEMINI_LIKE_FORMATS.has(entry.format)) {
      return await validateGeminiLikeProvider({
        apiKey,
        baseUrl,
        providerSpecificData,
        authType: entry.authType,
        isLocal,
      });
    }

    if (entry.format === "antigravity") {
      const expiresAt =
        providerSpecificData?.tokenExpiresAt ||
        providerSpecificData?.expiresAt ||
        providerSpecificData?.expiry_date ||
        providerSpecificData?.expiryDate;
      const expiryMs =
        typeof expiresAt === "number"
          ? expiresAt
          : typeof expiresAt === "string" && expiresAt.trim()
            ? Date.parse(expiresAt)
            : Number.NaN;

      if (Number.isFinite(expiryMs) && expiryMs > 0 && expiryMs < Date.now()) {
        return {
          valid: false,
          error: "Antigravity OAuth token has expired. Re-import or refresh the CLI login.",
          unsupported: false,
        };
      }

      return { valid: true, error: null, unsupported: false };
    }

    return { valid: false, error: "Provider validation not supported", unsupported: true };
  } catch (error: any) {
    return toValidationErrorResult(error);
  }
}
