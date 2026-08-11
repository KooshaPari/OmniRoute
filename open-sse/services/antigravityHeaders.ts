import type { AntigravityClientProfile } from "@/shared/constants/antigravityClientProfile";
import {
  getCachedAntigravityCliVersion,
  getCachedAntigravityIdeVersion,
} from "./antigravityVersion.ts";

export const ANTIGRAVITY_IDE_NODE_API_CLIENT = "google-api-nodejs-client/10.3.0";
export const ANTIGRAVITY_IDE_NODE_X_GOOG_API_CLIENT = "gl-node/22.21.1";

type AntigravityHeaderProfile = "loadCodeAssist" | "fetchAvailableModels" | "models";

const ANTIGRAVITY_VERSION = ANTIGRAVITY_FALLBACK_VERSION;
// IDE desktop fingerprint synced with Antigravity-Manager v4.2.0 constants.rs.
export const ANTIGRAVITY_CHROME_VERSION = "142.0.7444.175";
export const ANTIGRAVITY_ELECTRON_VERSION = "39.2.3";
export const ANTIGRAVITY_LOAD_CODE_ASSIST_USER_AGENT = `vscode/1.X.X (Antigravity/${ANTIGRAVITY_FALLBACK_VERSION})`;
export const ANTIGRAVITY_LOAD_CODE_ASSIST_API_CLIENT = "";
export const ANTIGRAVITY_NODE_API_CLIENT = "google-api-nodejs-client/10.3.0";
// Harness/bootstrap X-Goog-Api-Client synced with CLIProxyAPI misc.AntigravityGoogAPIClientUA.
export const ANTIGRAVITY_CREDIT_PROBE_API_CLIENT = "gl-node/22.21.1";
export const ANTIGRAVITY_API_CLIENT = ANTIGRAVITY_CREDIT_PROBE_API_CLIENT;

function withOptionalBearerAuth(
  headers: Record<string, string>,
  accessToken?: string | null
): Record<string, string> {
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }
  return headers;
}

export function antigravityIdeUserAgent(version = getCachedAntigravityIdeVersion()): string {
  return `antigravity/ide/${version} ${ANTIGRAVITY_OS_TYPE}/${ANTIGRAVITY_ARCH}`;
}

/**
 * Antigravity desktop User-Agent:
 * "Antigravity/VERSION (PLATFORM) Chrome/142... Electron/39..."
 */
export function antigravityUserAgent(
  version = getCachedAntigravityVersion(),
  platform: NodeJS.Platform = process.platform
): string {
  return `antigravity/cli/${version} (aidev_client; os_type=${ANTIGRAVITY_OS_TYPE}; arch=${ANTIGRAVITY_ARCH}; auth_method=${authMethod})`;
}

export function antigravityIdeNodeUserAgent(version = getCachedAntigravityIdeVersion()): string {
  return `antigravity/${version} ${ANTIGRAVITY_OS_TYPE}/${ANTIGRAVITY_ARCH} ${ANTIGRAVITY_IDE_NODE_API_CLIENT}`;
}

export function getAntigravityOAuthUserAgent(profile: AntigravityClientProfile): string {
  return profile === "cli" ? antigravityCliUserAgent() : antigravityIdeNodeUserAgent();
}

export function getAntigravityContentHeaders(
  profile: AntigravityClientProfile,
  accessToken?: string | null
): Record<string, string> {
  return withOptionalBearerAuth(
    {
      "Content-Type": "application/json",
      "User-Agent": profile === "cli" ? antigravityCliUserAgent() : antigravityIdeUserAgent(),
    },
    accessToken
  );
}

export function getAntigravityIdeNodeHeaders(accessToken?: string | null): Record<string, string> {
  return withOptionalBearerAuth(
    {
      "Content-Type": "application/json",
      "User-Agent": antigravityIdeNodeUserAgent(),
      "X-Goog-Api-Client": ANTIGRAVITY_IDE_NODE_X_GOOG_API_CLIENT,
    },
    accessToken
  );
}

/** Native loadCodeAssist body metadata captured from both official clients. */
export function getAntigravityLoadCodeAssistMetadata(): Record<string, string> {
  return {
    ideType: "ANTIGRAVITY",
  };
}
