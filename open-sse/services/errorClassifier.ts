import {
  isAccountDeactivated,
  isCreditsExhausted,
  isDailyQuotaExhausted,
  isOAuthInvalidToken,
} from "./accountFallback.ts";
import { getProviderCategory } from "../config/providerRegistry.ts";

export function isEmptyContentResponse(responseBody: unknown): boolean {
  if (!responseBody || typeof responseBody !== "object") return false;

  const body = responseBody as Record<string, unknown>;

  if (Array.isArray(body.choices)) {
    const firstChoice = body.choices[0] as Record<string, unknown> | undefined;
    if (!firstChoice) return true;

    const message = firstChoice.message as Record<string, unknown> | undefined;
    const delta = firstChoice.delta as Record<string, unknown> | undefined;

    const content = message?.content ?? delta?.content;
    const reasoningContent = message?.reasoning_content ?? delta?.reasoning_content;
    const hasToolCalls =
      (Array.isArray(message?.tool_calls) && (message.tool_calls as unknown[]).length > 0) ||
      (Array.isArray(delta?.tool_calls) && (delta.tool_calls as unknown[]).length > 0);

    const hasContent = content !== null && content !== undefined && content !== "";
    const hasReasoning =
      reasoningContent !== null && reasoningContent !== undefined && reasoningContent !== "";

    return !hasContent && !hasReasoning && !hasToolCalls;
  }

  if (Array.isArray(body.content)) {
    return body.content.length === 0;
  }

  if (typeof body.text === "string") {
    return body.text.trim() === "";
  }

  if ("content" in body) {
    const content = body.content;
    return content === null || content === undefined || content === "";
  }

  return false;
}

export const PROVIDER_ERROR_TYPES = {
  RATE_LIMITED: "rate_limited",
  UNAUTHORIZED: "unauthorized",
  ACCOUNT_DEACTIVATED: "account_deactivated",
  FORBIDDEN: "forbidden",
  SERVER_ERROR: "server_error",
  QUOTA_EXHAUSTED: "quota_exhausted",
  PROJECT_ROUTE_ERROR: "project_route_error",
  CONTEXT_OVERFLOW: "context_overflow",
  OAUTH_INVALID_TOKEN: "oauth_invalid_token",
  EMPTY_CONTENT: "empty_content",
  /**
   * SCP (Service Control Policy) deny from AWS Bedrock — account/role has an
   * explicit deny in an organization SCP that blocks the requested action.
   * Unlike a generic 403, this is a security policy signal that will NOT be
   * resolved by falling back to another credential for the same provider.
   * Marked non-terminal so the router can try other providers rather than
   * permanently banning the connection.
   */
  SCOPE_SCP_DENIED: "scope_scp_denied",
};

export const CONTEXT_OVERFLOW_SIGNALS = [
  "context overflow",
  "prompt too large",
  "context window",
  "maximum context",
  "exceeds context",
  "input too long",
  "token limit",
  "too many tokens",
  "context length",
  "exceed.*context",
  "messages exceed",
];

export const CONTEXT_OVERFLOW_REGEX = new RegExp(CONTEXT_OVERFLOW_SIGNALS.join("|"), "i");

export function isContextOverflow(errorText: string): boolean {
  return CONTEXT_OVERFLOW_REGEX.test(String(errorText || ""));
}

function responseBodyToString(responseBody: unknown): string {
  if (typeof responseBody === "string") return responseBody;
  if (responseBody !== null && typeof responseBody === "object") {
    try {
      return JSON.stringify(responseBody);
    } catch {
      return "";
    }
  }
  return "";
}

/**
 * Detect AWS SCP (Service Control Policy) explicit-deny patterns in Bedrock
 * error responses.  Returns true when the response body contains the
 * signature of an AWS SCP block rather than a simple IAM permission issue.
 */
function isBedrockScpDeny(bodyStr: string, provider: string | null | undefined): boolean {
  if (provider !== "bedrock") return false;
  const lower = bodyStr.toLowerCase();
  return (
    lower.includes("accessdeniedexception") ||
    (lower.includes("access denied") && lower.includes("explicit deny")) ||
    lower.includes("explicit deny in a service control policy")
  );
}

function shouldPreserveQuotaSignalsFor429(provider?: string | null): boolean {
  if (!provider) return true;
  return getProviderCategory(provider) === "oauth";
}

export function classifyProviderError(
  statusCode: number,
  responseBody: unknown,
  provider?: string | null
): string | null {
  const bodyStr = responseBodyToString(responseBody);
  const creditsExhausted = isCreditsExhausted(bodyStr);
  const accountDeactivated = isAccountDeactivated(bodyStr);
  const oauthInvalid = isOAuthInvalidToken(bodyStr);
  const preserveQuota429 = shouldPreserveQuotaSignalsFor429(provider);

  if (creditsExhausted && [400, 402, 403].includes(statusCode)) {
    return PROVIDER_ERROR_TYPES.QUOTA_EXHAUSTED;
  }

  if (creditsExhausted && statusCode === 429 && preserveQuota429) {
    return PROVIDER_ERROR_TYPES.QUOTA_EXHAUSTED;
  }

  // API-key providers route 429 cooldowns through the resilience-aware fallback layer.
  // OAuth providers keep their existing quota semantics because some of them encode
  // longer quota windows as 429 responses.
  if (statusCode === 429) {
    if (preserveQuota429 && isDailyQuotaExhausted(bodyStr)) {
      return PROVIDER_ERROR_TYPES.QUOTA_EXHAUSTED;
    }
    return PROVIDER_ERROR_TYPES.RATE_LIMITED;
  }

  if (statusCode === 401) {
    if (oauthInvalid) {
      return PROVIDER_ERROR_TYPES.OAUTH_INVALID_TOKEN;
    }
    return accountDeactivated
      ? PROVIDER_ERROR_TYPES.ACCOUNT_DEACTIVATED
      : PROVIDER_ERROR_TYPES.UNAUTHORIZED;
  }

  if (statusCode === 402) return PROVIDER_ERROR_TYPES.QUOTA_EXHAUSTED;
  if (statusCode === 403 && accountDeactivated) {
    return PROVIDER_ERROR_TYPES.ACCOUNT_DEACTIVATED;
  }
  if (statusCode === 403) {
    // AWS SCP explicit deny — organization-level policy blocks this action.
    // Scoped to "bedrock" so other providers are unaffected.  Marked
    // non-terminal (scope_scp_denied) so the router can try other providers
    // instead of permanently banning the connection.
    if (isBedrockScpDeny(bodyStr, provider)) {
      return PROVIDER_ERROR_TYPES.SCOPE_SCP_DENIED;
    }
    if (bodyStr.includes("has not been used in project")) {
      return PROVIDER_ERROR_TYPES.PROJECT_ROUTE_ERROR;
    }
    if (provider && getProviderCategory(provider) === "apikey") {
      return null;
    }
    return PROVIDER_ERROR_TYPES.FORBIDDEN;
  }
  if (statusCode >= 500) return PROVIDER_ERROR_TYPES.SERVER_ERROR;

  if (statusCode === 400 && isContextOverflow(bodyStr)) {
    return PROVIDER_ERROR_TYPES.CONTEXT_OVERFLOW;
  }

  return null;
}
