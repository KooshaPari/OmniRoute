import { handleVideoGeneration } from "@omniroute/open-sse/handlers/videoGeneration.ts";
<<<<<<< Updated upstream
import { resolveVideoCredentialProvider } from "@omniroute/open-sse/handlers/videoGeneration/googleFlow.ts";
import { withInjectionGuard } from "@/middleware/promptInjectionGuard";
import { getProviderCredentials, clearRecoveredProviderState } from "@/sse/services/auth";
=======
import {
  getProviderCredentials,
  clearRecoveredProviderState,
  extractApiKey,
  isValidApiKey,
} from "@/sse/services/auth";
>>>>>>> Stashed changes
import {
  parseVideoModel,
  getAllVideoModels,
  getVideoProvider,
} from "@omniroute/open-sse/config/videoRegistry.ts";
import { errorResponse } from "@omniroute/open-sse/utils/error.ts";
import { HTTP_STATUS } from "@omniroute/open-sse/config/constants.ts";
import * as log from "@/sse/utils/logger";
import { enforceApiKeyPolicy } from "@/shared/utils/apiKeyPolicy";
<<<<<<< Updated upstream
import {
  isAllRateLimitedCredentials,
  rateLimitedProviderResponse,
} from "@/app/api/v1/_shared/rateLimit";
import {
  failedMediaGenerationResponse,
  mediaGenerationModelListResponse,
  mediaGenerationOptionsResponse,
  promptRequiredResponse,
  readMediaGenerationBody,
  successfulMediaGenerationResponse,
} from "@/app/api/v1/_shared/mediaGenerationRoute";
=======
import { v1ImageGenerationSchema } from "@/shared/validation/schemas";
import { isValidationFailure, validateBody } from "@/shared/validation/helpers";
>>>>>>> Stashed changes

/**
 * Handle CORS preflight
 */
export async function OPTIONS() {
  return mediaGenerationOptionsResponse();
}

/**
 * GET /v1/videos/generations — list available video models
 */
export async function GET() {
  return mediaGenerationModelListResponse(getAllVideoModels(), "video");
}

/**
 * POST /v1/videos/generations — generate videos
 */
<<<<<<< Updated upstream
async function postHandler(request, context) {
  const parsed = await readMediaGenerationBody(request, log, "VIDEO");
  if (!parsed.ok) {
    return parsed.response;
  }
  const body = parsed.body;
  const startTime = Date.now();
=======
export async function POST(request) {
  let rawBody;
  try {
    rawBody = await request.json();
  } catch {
    log.warn("VIDEO", "Invalid JSON body");
    return errorResponse(HTTP_STATUS.BAD_REQUEST, "Invalid JSON body");
  }

  const validation = validateBody(v1ImageGenerationSchema, rawBody);
  if (isValidationFailure(validation)) {
    return errorResponse(HTTP_STATUS.BAD_REQUEST, validation.error.message);
  }
  const body = validation.data;
>>>>>>> Stashed changes

  const promptError = promptRequiredResponse(body);
  if (promptError) return promptError;

  // Enforce API key policies (model restrictions + budget limits)
  const policy = await enforceApiKeyPolicy(request, body.model);
  if (policy.rejection) return policy.rejection;

  // Parse model to get provider
  const { provider } = parseVideoModel(body.model);
  if (!provider) {
    return errorResponse(
      HTTP_STATUS.BAD_REQUEST,
      `Invalid video model: ${body.model}. Use format: provider/model`
    );
  }

  // Check provider config for auth bypass
  const providerConfig = getVideoProvider(provider);

  // Get credentials — skip for local providers (authType: "none")
  let credentials = null;
  if (providerConfig && providerConfig.authType !== "none") {
    credentials = await getProviderCredentials(provider);
    if (!credentials) {
      return errorResponse(
        HTTP_STATUS.BAD_REQUEST,
        `No credentials for video provider: ${provider}`
      );
    }
  }

  const result = await handleVideoGeneration({ body, credentials, log });

  if (result.success) {
    await clearRecoveredProviderState(credentials);
<<<<<<< Updated upstream
    return successfulMediaGenerationResponse({
      result,
      billingMode: "video",
      provider,
      model: body.model,
      startTime,
      duration: body.duration,
=======
    return new Response(JSON.stringify((result as any).data), {
      status: 200,
      headers: { "Content-Type": "application/json" },
>>>>>>> Stashed changes
    });
  }

  return failedMediaGenerationResponse(result, "Video generation provider error");
}
