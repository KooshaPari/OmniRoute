import { NextResponse } from "next/server";
import { getAuditRequestContext, logAuditEvent } from "@/lib/compliance/index";
import { validateClaudeCodeCompatibleProvider } from "@/lib/providers/validation";
import {
  SAFE_OUTBOUND_FETCH_PRESETS,
  SafeOutboundFetchError,
  getSafeOutboundFetchErrorStatus,
  safeOutboundFetch,
} from "@/shared/network/safeOutboundFetch";
import { getProviderValidationGuard } from "@/shared/network/outboundUrlGuard";
import { isCcCompatibleProviderEnabled } from "@/shared/utils/featureFlags";
import { providerNodeValidateSchema } from "@/shared/validation/schemas";
import { isValidationFailure, validateBody } from "@/shared/validation/helpers";

function sanitizeAnthropicBaseUrl(baseUrl: string) {
  return (baseUrl || "")
    .trim()
    .replace(/\/$/, "")
    .replace(/\/messages(?:\?[^#]*)?$/i, "");
}

function sanitizeClaudeCodeCompatibleBaseUrl(baseUrl: string) {
  return (baseUrl || "")
    .trim()
    .replace(/\/$/, "")
    .replace(/\/(?:v\d+\/)?messages(?:\?[^#]*)?$/i, "");
}

<<<<<<< Updated upstream
// Status-specific error message for /models probe failures.
function getModelsErrorMessage(status: number) {
  if (status === 401 || status === 403) return "API key unauthorized";
  if (status === 404) {
    return "/models endpoint not found - enter a Model ID to validate via chat/completions instead";
  }
  if (status >= 500) return "Server error - try again later";
  return `Unexpected response (${status})`;
}

// Status-specific error message for the /chat/completions fallback probe.
function getChatErrorMessage(status: number) {
  if (status === 401 || status === 403) return "API key unauthorized";
  if (status === 400) return "Invalid model or bad request";
  if (status === 404) return "Chat endpoint not found";
  if (status >= 500) return "Server error - try again later";
  return `Chat request failed (${status})`;
}

async function probeChatFallback({
  baseUrl,
  apiKey,
  modelId,
  extraHeaders = {},
}: {
  baseUrl: string;
  apiKey: string;
  modelId: string;
  extraHeaders?: Record<string, string>;
}) {
  const chatUrl = `${baseUrl.replace(/\/$/, "")}/chat/completions`;
  return safeOutboundFetch(chatUrl, {
    ...SAFE_OUTBOUND_FETCH_PRESETS.validationRead,
    guard: getProviderValidationGuard(),
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...extraHeaders,
    },
    body: JSON.stringify({
      model: modelId,
      messages: [{ role: "user", content: "ping" }],
      max_tokens: 1,
    }),
  });
}

=======
>>>>>>> Stashed changes
function sanitizeAuditBaseUrl(baseUrl: string) {
  if (!baseUrl) return null;
  try {
    const parsed = new URL(baseUrl);
    return `${parsed.origin}${parsed.pathname}`.replace(/\/$/, "") || parsed.origin;
  } catch {
    return baseUrl;
  }
}

// POST /api/provider-nodes/validate - Validate API key against base URL
export async function POST(request) {
  const auditContext = getAuditRequestContext(request);
  let rawBody;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json(
      {
        error: {
          message: "Invalid request",
          details: [{ field: "body", message: "Invalid JSON body" }],
        },
      },
      { status: 400 }
    );
  }

  try {
    const validation = validateBody(providerNodeValidateSchema, rawBody);
    if (isValidationFailure(validation)) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }
    const { baseUrl, apiKey, type, compatMode, chatPath, modelsPath } = validation.data;

    // Anthropic Compatible Validation
    if (type === "anthropic-compatible") {
      if (compatMode === "cc") {
        if (!isCcCompatibleProviderEnabled()) {
          return NextResponse.json(
            { valid: false, error: "CC Compatible provider is disabled" },
            { status: 403 }
          );
        }

        const result = await validateClaudeCodeCompatibleProvider({
          apiKey,
          providerSpecificData: {
            baseUrl: sanitizeClaudeCodeCompatibleBaseUrl(baseUrl),
            chatPath: chatPath || undefined,
          },
        });

        return NextResponse.json({
          valid: !!result.valid,
          error: result.valid ? null : result.error || "Invalid API key",
          warning: result.warning || null,
          method: result.method || null,
        });
      }

      // Robustly construct URL: remove trailing slash, and remove trailing /messages if user added it
      const normalizedBase = sanitizeAnthropicBaseUrl(baseUrl);

      // Use /models endpoint for validation as many compatible providers support it (like OpenAI)
      const modelsUrl = `${normalizedBase}${modelsPath || "/models"}`;

      const res = await safeOutboundFetch(modelsUrl, {
        ...SAFE_OUTBOUND_FETCH_PRESETS.validationRead,
        guard: getProviderValidationGuard(),
        method: "GET",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          Authorization: `Bearer ${apiKey}`, // Add Bearer token for hybrid proxies
        },
      });

      return NextResponse.json({ valid: res.ok, error: res.ok ? null : "Invalid API key" });
    }

    // OpenAI Compatible Validation (Default)
    const modelsUrl = `${baseUrl.replace(/\/$/, "")}${modelsPath || "/models"}`;
    const res = await safeOutboundFetch(modelsUrl, {
      ...SAFE_OUTBOUND_FETCH_PRESETS.validationRead,
      guard: getProviderValidationGuard(),
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    return NextResponse.json({ valid: res.ok, error: res.ok ? null : "Invalid API key" });
  } catch (error) {
    const status = getSafeOutboundFetchErrorStatus(error);
    if (status) {
<<<<<<< Updated upstream
      const rawMessage =
        error instanceof SafeOutboundFetchError && error.code === "INVALID_URL"
          ? "Invalid provider base URL format"
          : error instanceof Error
            ? error.message
            : "Validation failed";
      const message = augmentDockerLocalhostHint(error, attemptedBaseUrl, rawMessage);
      if (error instanceof SafeOutboundFetchError && error.code === "URL_GUARD_BLOCKED") {
=======
      const message = error instanceof Error ? error.message : "Validation failed";
      if (
        error instanceof SafeOutboundFetchError &&
        error.code === "URL_GUARD_BLOCKED" &&
        message.includes(PROVIDER_URL_BLOCKED_MESSAGE)
      ) {
        const attemptedBaseUrl =
          rawBody && typeof rawBody === "object" && "baseUrl" in rawBody
            ? String((rawBody as { baseUrl?: unknown }).baseUrl || "")
            : "";
>>>>>>> Stashed changes
        logAuditEvent({
          action: "provider.validation.ssrf_blocked",
          actor: "admin",
          target: "provider-node",
          resourceType: "provider_validation",
          status: "blocked",
          ipAddress: auditContext.ipAddress || undefined,
          requestId: auditContext.requestId,
          metadata: {
            route: "/api/provider-nodes/validate",
            reason: message,
            baseUrl: sanitizeAuditBaseUrl(attemptedBaseUrl),
          },
        });
      }
      return NextResponse.json({ error: message }, { status });
    }
    console.log("Error validating provider node:", error);
    return NextResponse.json({ error: "Validation failed" }, { status: 500 });
  }
}
