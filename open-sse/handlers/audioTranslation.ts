/**
 * Audio Translation Handler
 *
 * Handles POST /v1/audio/translations (Whisper translate-to-English API
 * format). Proxies multipart/form-data to upstream providers that expose an
 * OpenAI-Whisper-compatible /audio/translations endpoint.
 *
 * Unlike /v1/audio/transcriptions, translation always outputs English text
 * regardless of the source audio language, so there is no `language` input
 * field — only `model`, `file`, `prompt`, `response_format`, and
 * `temperature` are forwarded upstream.
 */

import {
  getTranscriptionProvider,
  parseTranscriptionModel,
  type AudioProvider,
} from "../config/audioRegistry.ts";
import { buildAuthHeaders } from "../config/registryUtils.ts";
import { buildMultipartBody } from "./audioTranscription.ts";
import { errorResponse, sanitizeErrorMessage } from "../utils/error.ts";

type TranslationCredentials = {
  apiKey?: string;
  accessToken?: string;
};

/**
 * Extract a readable error message from an upstream provider's error body.
 */
function extractUpstreamErrorMessage(errText: string, status: number): string {
  try {
    const parsed = JSON.parse(errText);
    const raw =
      parsed?.error?.message ||
      (typeof parsed?.error === "string" ? parsed.error : null) ||
      parsed?.message ||
      null;
    return sanitizeErrorMessage(raw ? String(raw) : errText || `Upstream error (${status})`);
  } catch {
    return sanitizeErrorMessage(errText || `Upstream error (${status})`);
  }
}

function collectExtraFields(formData: FormData): Record<string, string> {
  const extraFields: Record<string, string> = {};
  for (const key of ["prompt", "response_format", "temperature"] as const) {
    const value = formData.get(key);
    if (typeof value === "string") {
      extraFields[key] = value;
    }
  }
  return extraFields;
}

function resolveProviderConfig(
  model: string,
  resolvedProvider: AudioProvider | null,
  resolvedModel: string | null
): { providerConfig: AudioProvider | null; modelId: string | null } {
  if (resolvedProvider) {
    return { providerConfig: resolvedProvider, modelId: resolvedModel };
  }

  const parsed = parseTranscriptionModel(model);
  return {
    providerConfig: parsed.provider ? getTranscriptionProvider(parsed.provider) : null,
    modelId: parsed.model,
  };
}

function translationEndpoint(baseUrl: string): string {
  const suffix = "/audio/transcriptions";
  return baseUrl.endsWith(suffix)
    ? `${baseUrl.slice(0, -suffix.length)}/audio/translations`
    : baseUrl;
}

/**
 * Handle audio translation request
 *
 * @param {Object} options
 * @param {FormData} options.formData - Multipart form data with file + model
 * @param {Object} options.credentials - Provider credentials { apiKey }
 * @returns {Response}
 */
export async function handleAudioTranslation({
  formData,
  credentials,
  resolvedProvider = null,
  resolvedModel = null,
}: {
  formData: FormData;
  credentials?: TranslationCredentials | null;
  resolvedProvider?: AudioProvider | null;
  resolvedModel?: string | null;
}): Promise<Response> {
  const model = formData.get("model");
  if (typeof model !== "string" || !model) {
    return errorResponse(400, "model is required");
  }

  const fileEntry = formData.get("file");
  if (!(fileEntry instanceof Blob)) {
    return errorResponse(400, "file is required");
  }
  const file = fileEntry as Blob & { name?: unknown };

  // Use pre-resolved provider/model from route handler if available.
  let providerConfig = resolvedProvider;
  let modelId = resolvedModel;
  ({ providerConfig, modelId } = resolveProviderConfig(model, providerConfig, modelId));

  if (!providerConfig) {
    return errorResponse(
      400,
      `No translation provider found for model "${model}". Available: openai, groq`
    );
  }

  const token =
    providerConfig.authType === "none" ? null : credentials?.apiKey || credentials?.accessToken;
  if (providerConfig.authType !== "none" && !token) {
    return errorResponse(401, `No credentials for translation provider: ${providerConfig.id}`);
  }

  // OpenAI Whisper translate-to-English params — no `language`, output is
  // always English regardless of the source audio language.
  const extraFields = collectExtraFields(formData);

  try {
    const endpoint = translationEndpoint(providerConfig.baseUrl);

    const { body: multipartBody, contentType: multipartCT } = await buildMultipartBody(file, {
      model: modelId as string,
      ...extraFields,
    });

    const res = await fetch(endpoint, {
      method: "POST",
      headers: { ...buildAuthHeaders(providerConfig, token), "Content-Type": multipartCT },
      body: multipartBody,
    });

    if (!res.ok) {
      const errText = await res.text();
      return errorResponse(res.status, extractUpstreamErrorMessage(errText, res.status));
    }

    const data = await res.text();
    const respContentType = res.headers.get("content-type") || "application/json";

    return new Response(data, {
      status: 200,
      headers: { "Content-Type": respContentType },
    });
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    return errorResponse(500, `Translation request failed: ${sanitizeErrorMessage(error.message)}`);
  }
}
