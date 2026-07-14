import { getEmbeddingProvider } from "@omniroute/open-sse/config/embeddingRegistry.ts";
import { getRerankProvider } from "@omniroute/open-sse/config/rerankRegistry.ts";
import { validateQoderCliPat } from "@omniroute/open-sse/services/qoderCli.ts";

import { validateImageProviderApiKey } from "@/lib/providers/imageValidation";
import { resolveNvidiaValidationModel } from "@/lib/providers/nvidiaValidationModel";
import { MODAL_DEFAULT_VALIDATION_MODEL_ID } from "@/shared/constants/modal";

import {
  validateAssemblyAIProvider,
  validateAwsPollyProvider,
  validateBailianCodingPlanProvider,
  validateDeepgramProvider,
  validateElevenLabsProvider,
  validateInworldProvider,
  validateKieProvider,
  validateMaritalkProvider,
  validateNlpCloudProvider,
  validateNousResearchProvider,
  validatePoeProvider,
  validateRekaProvider,
  validateRunwayProvider,
} from "./audioMiscProviders";
import {
  validateAzureAiProvider,
  validateAzureOpenAIProvider,
  validateDataRobotProvider,
  validateDatabricksProvider,
  validateGigachatProvider,
  validateHerokuProvider,
  validateOciProvider,
  validateSapProvider,
  validateSnowflakeProvider,
  validateWatsonxProvider,
} from "./cloudProviders";
import {
  validateClarifaiProvider,
  validateEmbeddingApiProvider,
  validateRerankApiProvider,
} from "./embeddingProviders";
import { buildBearerHeaders, directHttpsRequest } from "./headers";
import {
  validateBedrockProvider,
  validateCommandCodeProvider,
  validateHuggingFaceProvider,
  validateOpenAILikeProvider,
} from "./openaiFormat";
import { SEARCH_VALIDATOR_CONFIGS, validateSearchProvider } from "./searchProviders";
import {
  validatePetalsProvider,
  validatePoolsideProvider,
  validateV0VercelProvider,
} from "./specialtyChatProviders";
import { toValidationErrorResult, validationRead, validationWrite } from "./transport";
import { normalizeBaseUrl } from "./urlHelpers";
import {
  validateBlackboxWebProvider,
  validateChatGptWebProvider,
  validateDeepSeekWebProvider,
  validateGrokWebProvider,
  validateKimiWebProvider,
  validatePerplexityWebProvider,
  validateQwenWebProvider,
} from "./webProvidersA";
import {
  validateAdaptaWebProvider,
  validateClaudeWebProvider,
  validateCopilotM365WebProvider,
  validateCopilotWebProvider,
  validateGeminiWebProvider,
  validateInnerAiProvider,
  validateJulesProvider,
  validateMuseSparkWebProvider,
  validateT3WebProvider,
} from "./webProvidersB";

type ValidatorArgs = { apiKey: string; providerSpecificData?: any };
type SpecialtyValidator = (args: ValidatorArgs, isLocal?: boolean) => any;

export function bytezValidationResultFromStatus(status: number): {
  valid: boolean;
  error: string | null;
} {
  if (status === 200) return { valid: true, error: null };
  if (status === 401 || status === 403) {
    return { valid: false, error: "Invalid API key" };
  }
  return { valid: false, error: `Validation failed: ${status}` };
}

export async function validateBytezProvider({ apiKey, providerSpecificData = {} }: ValidatorArgs) {
  try {
    const response = await validationRead("https://api.bytez.com/models/v2/list/tasks", {
      method: "GET",
      headers: buildBearerHeaders(apiKey, providerSpecificData),
    });
    return bytezValidationResultFromStatus(response.status);
  } catch (error: unknown) {
    return toValidationErrorResult(error);
  }
}

async function validateQoder({ apiKey, providerSpecificData = {} }: ValidatorArgs) {
  const key = (apiKey || "").trim();
  if (key.startsWith("pt-")) {
    return validateQoderCliPat({ apiKey: key, providerSpecificData });
  }

  try {
    const response = await validationRead(
      "https://dashscope.aliyuncs.com/compatible-mode/v1/models",
      { headers: { Authorization: `Bearer ${key}` } },
      false
    );
    if (response.ok) return { valid: true, error: null };
    if (response.status === 401 || response.status === 403) {
      return {
        valid: false,
        error:
          "Invalid Qoder API key. Make sure you're using a valid API key from Qoder / Alibaba Cloud Dashscope.",
      };
    }
    return { valid: true, error: null };
  } catch (error: unknown) {
    return toValidationErrorResult(error);
  }
}

function imageValidator(provider: string): SpecialtyValidator {
  return ({ apiKey, providerSpecificData = {} }) =>
    validateImageProviderApiKey({ provider, apiKey, providerSpecificData });
}

async function validateAuggie() {
  const { checkAuggieCliVersion } = await import("@omniroute/open-sse/executors/auggie.ts");
  const result = await checkAuggieCliVersion();
  if (!result.ok) {
    return {
      valid: false,
      error: result.error || "Auggie CLI not found. Install it and run `auggie login`.",
      unsupported: false,
    };
  }
  return { valid: true, error: null, unsupported: false, method: result.version };
}

function validateModal(
  { apiKey, providerSpecificData = {} }: ValidatorArgs,
  isLocal: boolean = false
) {
  return validateOpenAILikeProvider({
    provider: "modal",
    apiKey,
    providerSpecificData,
    baseUrl: normalizeBaseUrl(providerSpecificData?.baseUrl || ""),
    modelId: MODAL_DEFAULT_VALIDATION_MODEL_ID,
    isLocal,
  });
}

function validateVoyage({ apiKey, providerSpecificData = {} }: ValidatorArgs) {
  const provider = getEmbeddingProvider("voyage-ai");
  return validateEmbeddingApiProvider({
    apiKey,
    providerSpecificData,
    url: provider?.baseUrl,
    modelId: provider?.models?.[0]?.id || "voyage-4-lite",
  });
}

function validateJina({ apiKey, providerSpecificData = {} }: ValidatorArgs) {
  const provider = getRerankProvider("jina-ai");
  return validateRerankApiProvider({
    apiKey,
    providerSpecificData,
    url: provider?.baseUrl,
    modelId: provider?.models?.[0]?.id || "jina-reranker-v3",
  });
}

async function validateGitlab(
  { apiKey, providerSpecificData = {} }: ValidatorArgs,
  isLocal: boolean = false
) {
  try {
    const configuredBaseUrl =
      typeof providerSpecificData?.baseUrl === "string" ? providerSpecificData.baseUrl.trim() : "";
    const root = (configuredBaseUrl || "https://gitlab.com").replace(/\/$/, "");
    const response = await validationWrite(
      `${root}/api/v4/code_suggestions/direct_access`,
      {
        method: "POST",
        headers: buildBearerHeaders(apiKey, providerSpecificData),
        body: "{}",
      },
      isLocal
    );
    return response.status === 401
      ? { valid: false, error: "Invalid API key" }
      : { valid: true, error: null };
  } catch (error: unknown) {
    return toValidationErrorResult(error);
  }
}

async function validateVertex({ apiKey }: ValidatorArgs) {
  try {
    const { parseSAFromApiKey, getAccessToken, isExpressApiKey } =
      await import("@omniroute/open-sse/executors/vertex.ts");
    if (isExpressApiKey(apiKey)) return { valid: true, error: null };
    await getAccessToken(parseSAFromApiKey(apiKey));
    return { valid: true, error: null };
  } catch (error: any) {
    return { valid: false, error: "Invalid Service Account JSON: " + error.message };
  }
}

async function validateLongcat(
  { apiKey, providerSpecificData = {} }: ValidatorArgs,
  isLocal: boolean = false
) {
  try {
    const response = await validationWrite(
      "https://api.longcat.chat/openai/v1/chat/completions",
      {
        method: "POST",
        headers: buildBearerHeaders(apiKey, providerSpecificData),
        body: JSON.stringify({
          model: "LongCat-2.0",
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

async function validateNvidia({ apiKey, providerSpecificData = {} }: ValidatorArgs) {
  try {
    const baseUrl = normalizeBaseUrl(
      providerSpecificData?.baseUrl || "https://integrate.api.nvidia.com/v1/chat/completions"
    );
    const chatBase = baseUrl.replace(/\/models$/, "");
    const chatUrl = baseUrl.endsWith("/chat/completions")
      ? baseUrl
      : `${chatBase}/chat/completions`;
    const response = await directHttpsRequest(
      chatUrl,
      {
        method: "POST",
        headers: buildBearerHeaders(apiKey, providerSpecificData),
        body: JSON.stringify({
          model: resolveNvidiaValidationModel(providerSpecificData),
          messages: [{ role: "user", content: "test" }],
          max_tokens: 1,
        }),
      },
      20000
    );
    return response.status === 401 || response.status === 403
      ? { valid: false, error: "Invalid API key" }
      : { valid: true, error: null };
  } catch (error: unknown) {
    return toValidationErrorResult(error);
  }
}

async function validateZai({ apiKey, providerSpecificData = {} }: ValidatorArgs) {
  try {
    const messagesUrl = providerSpecificData?.baseUrl
      ? `${normalizeBaseUrl(providerSpecificData.baseUrl).split("?")[0]}?beta=true`
      : "https://api.z.ai/api/anthropic/v1/messages?beta=true";
    const response = await directHttpsRequest(
      messagesUrl,
      {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: "glm-5.1",
          messages: [{ role: "user", content: "test" }],
          max_tokens: 1,
        }),
      },
      20000
    );
    if (response.status === 401 || response.status === 403) {
      return { valid: false, error: "Invalid API key" };
    }
    if (response.status === 404 || response.status === 405) {
      return { valid: false, error: "Provider validation endpoint not supported" };
    }
    if (response.status >= 500 && response.status !== 502) {
      return { valid: false, error: `Provider unavailable (${response.status})` };
    }
    return { valid: true, error: null };
  } catch (error: unknown) {
    return toValidationErrorResult(error);
  }
}

function buildOpenGatewayValidator(defaultBaseUrl: string, model: string): SpecialtyValidator {
  return async ({ apiKey, providerSpecificData = {} }, isLocal = false) => {
    try {
      const baseUrl = normalizeBaseUrl(providerSpecificData?.baseUrl || defaultBaseUrl);
      const chatUrl = `${baseUrl.replace(/\/chat\/completions$/, "")}/chat/completions`;
      const response = await validationWrite(
        chatUrl,
        {
          method: "POST",
          headers: buildBearerHeaders(apiKey, providerSpecificData),
          body: JSON.stringify({
            model,
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
  };
}

const SPECIALTY_VALIDATORS: Record<string, SpecialtyValidator> = {
  "v0-vercel": validateV0VercelProvider,
  jules: validateJulesProvider,
  auggie: validateAuggie,
  qoder: validateQoder,
  "command-code": validateCommandCodeProvider,
  huggingface: validateHuggingFaceProvider,
  bytez: validateBytezProvider,
  deepgram: validateDeepgramProvider,
  assemblyai: validateAssemblyAIProvider,
  nanobanana: imageValidator("nanobanana"),
  "fal-ai": imageValidator("fal-ai"),
  "stability-ai": imageValidator("stability-ai"),
  "black-forest-labs": imageValidator("black-forest-labs"),
  recraft: imageValidator("recraft"),
  topaz: imageValidator("topaz"),
  elevenlabs: validateElevenLabsProvider,
  inworld: validateInworldProvider,
  kie: validateKieProvider,
  "aws-polly": validateAwsPollyProvider,
  "bailian-coding-plan": validateBailianCodingPlanProvider,
  heroku: validateHerokuProvider,
  databricks: validateDatabricksProvider,
  datarobot: validateDataRobotProvider,
  watsonx: validateWatsonxProvider,
  oci: validateOciProvider,
  sap: validateSapProvider,
  bedrock: validateBedrockProvider,
  modal: validateModal,
  "nous-research": validateNousResearchProvider,
  petals: validatePetalsProvider,
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
  "voyage-ai": validateVoyage,
  "jina-ai": validateJina,
  gitlab: validateGitlab,
  vertex: validateVertex,
  "vertex-partner": validateVertex,
  longcat: validateLongcat,
  nvidia: validateNvidia,
  poolside: validatePoolsideProvider,
  zai: validateZai,
  "xiaomi-mimo": buildOpenGatewayValidator("https://api.xiaomimimo.com/v1", "mimo-v2.5-pro"),
  gitlawb: buildOpenGatewayValidator(
    "https://opengateway.gitlawb.com/v1/xiaomi-mimo",
    "mimo-v2.5-pro"
  ),
  "gitlawb-gmi": buildOpenGatewayValidator(
    "https://opengateway.gitlawb.com/v1/gmi-cloud",
    "XiaomiMiMo/MiMo-V2.5-Pro"
  ),
};

for (const [id, config] of Object.entries(SEARCH_VALIDATOR_CONFIGS)) {
  SPECIALTY_VALIDATORS[id] = ({ apiKey, providerSpecificData = {} }, isLocal = false) => {
    const { url, init } = config(apiKey, providerSpecificData);
    return validateSearchProvider(url, init, providerSpecificData, isLocal);
  };
}

export function getSpecialtyValidator(provider: string): SpecialtyValidator | undefined {
  return SPECIALTY_VALIDATORS[provider];
}
