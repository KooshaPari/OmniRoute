import { getOpenAICompatibleType } from "../services/provider.ts";
import type { ProviderCredentials } from "./base.ts";

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

export function sanitizePath(path: string): boolean {
  if (typeof path !== "string") return false;
  if (!path.startsWith("/")) return false;
  if (path.includes("\0")) return false;
  if (path.includes("..")) return false;
  if (path.length > 512) return false;
  return true;
}

function shouldForceResponsesUpstream(
  provider: string,
  body: unknown,
  credentials: ProviderCredentials | null
): boolean {
  if (!provider.startsWith("openai-compatible-")) return false;
  if (!isRecord(body)) return false;

  const providerSpecificData = credentials?.providerSpecificData ?? null;
  if (providerSpecificData?._omnirouteForceResponsesUpstream === true) return true;
  if (getOpenAICompatibleType(provider, providerSpecificData) === "responses") return false;

  const hasResponsesShape =
    body.input !== undefined ||
    body.previous_response_id !== undefined ||
    body.max_output_tokens !== undefined ||
    body.reasoning !== undefined;
  if (!hasResponsesShape) return false;

  const tools = Array.isArray(body.tools) ? body.tools : [];
  return tools.some((toolValue) => {
    if (!isRecord(toolValue)) return false;
    const toolType = typeof toolValue.type === "string" ? toolValue.type : "";
    return toolType === "namespace" || /^tool_search/.test(toolType);
  });
}

export function withForcedResponsesUpstream(
  provider: string,
  body: unknown,
  credentials: ProviderCredentials
): ProviderCredentials {
  if (!shouldForceResponsesUpstream(provider, body, credentials)) return credentials;
  return {
    ...credentials,
    providerSpecificData: {
      ...credentials.providerSpecificData,
      _omnirouteForceResponsesUpstream: true,
    },
  };
}
