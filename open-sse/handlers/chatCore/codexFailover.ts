import { getCodexModelScope } from "../../config/codexQuotaScopes.ts";
import { getProviderConnectionById, updateProviderConnection } from "@/lib/db/providers";
import { createLogger } from "@/shared/utils/logger";

const log = createLogger("chat-core:codexFailover");

type CodexFailoverCredentials = {
  connectionId?: string | null;
  providerSpecificData?: unknown;
};

function asProviderData(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

export async function markCodexScopeRateLimited(params: {
  failedConnectionId: string;
  model: string | null;
  rateLimitedUntil: string;
  credentials?: CodexFailoverCredentials | null;
}): Promise<void> {
  const connection = await getProviderConnectionById(params.failedConnectionId).catch((err) => {
    log.warn(
      { err, failedConnectionId: params.failedConnectionId },
      "chat-core:codexFailover: failed to load connection for scope-rate-limit update — falling back to in-memory credentials"
    );
    return null;
  });
  const existingProviderData = connection
    ? asProviderData(connection.providerSpecificData)
    : asProviderData(params.credentials?.providerSpecificData);
  const existingScopeMap = asProviderData(existingProviderData.codexScopeRateLimitedUntil);
  const nextProviderData = {
    ...existingProviderData,
    codexScopeRateLimitedUntil: {
      ...existingScopeMap,
      [getCodexModelScope(params.model || "")]: params.rateLimitedUntil,
    },
  };

  updateProviderConnection(params.failedConnectionId, {
    ...(connection ? { providerSpecificData: nextProviderData } : {}),
    lastError: "429 rate limited — codex account rotation",
    errorCode: 429,
  }).catch(() => {});

  if (params.credentials && String(params.credentials.connectionId) === params.failedConnectionId) {
    params.credentials.providerSpecificData = nextProviderData;
  }
}
