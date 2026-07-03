/**
 * chatCore execution-credentials resolver (Quality Gate v2 / Fase 9 — chatCore god-file
 * decomposition, #3501).
 *
 * Pure builder extracted from handleChatCore: derives the per-execution credentials object from the
 * resolved request context. Applies the native-Codex passthrough endpoint override, forces
 * apiType=responses (and the responses-upstream marker) for Azure AI Foundry / OCI when the model
 * routes to the OpenAI Responses format, and threads the Claude Code session id when present.
 * Side-effect-free; behaviour is byte-identical to the previous inline closure.
 */

import { FORMATS } from "../../translator/formats.ts";

type CredentialsLike =
  | {
      providerSpecificData?: Record<string, unknown> | null;
      [key: string]: unknown;
    }
  | null
  | undefined;

export function resolveExecutionCredentials(opts: {
  credentials: CredentialsLike;
  nativeCodexPassthrough: boolean;
  endpointPath: string;
  targetFormat: string;
  provider: string | null | undefined;
  ccSessionId: string | null;
}) {
  const { credentials, nativeCodexPassthrough, endpointPath, targetFormat, provider, ccSessionId } =
    opts;

  const nextCredentials = nativeCodexPassthrough
    ? { ...credentials, requestEndpointPath: endpointPath }
    : credentials;

  const providerSpecificData =
    nextCredentials?.providerSpecificData &&
    typeof nextCredentials.providerSpecificData === "object"
      ? { ...nextCredentials.providerSpecificData }
      : {};

  // Some providers (Azure AI Foundry, OCI, openai-compatible-*) choose upstream
  // endpoint path from providerSpecificData.apiType. When a model routes to
  // OpenAI Responses format, force apiType=responses unless explicitly set,
  // and set the force-upstream marker so the executor routes to /v1/responses
  // natively (#5483, PR #5637).
  const needsResponsesEndpoint =
    provider === "azure-ai" ||
    provider === "oci" ||
    (provider && provider.startsWith("openai-compatible-"));

  if (
    targetFormat === FORMATS.OPENAI_RESPONSES &&
    needsResponsesEndpoint &&
    providerSpecificData.apiType !== "responses"
  ) {
    providerSpecificData.apiType = "responses";
  }

  if (targetFormat === FORMATS.OPENAI_RESPONSES && needsResponsesEndpoint) {
    providerSpecificData._omnirouteForceResponsesUpstream = true;
  }

  const withApiType = {
    ...nextCredentials,
    providerSpecificData,
  };

  if (!ccSessionId) return withApiType;

  return {
    ...withApiType,
    providerSpecificData: {
      ...(withApiType?.providerSpecificData || {}),
      ccSessionId,
    },
  };
}
