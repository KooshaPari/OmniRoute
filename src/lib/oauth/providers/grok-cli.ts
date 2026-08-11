/**
 * Grok Build OAuth Provider — Device Code + Browser PKCE + Import Token Flows
 *
 * Three ways to connect, merged under one provider entry (#7013 reworked to
 * coexist with #7358 instead of replacing it):
 *   - Device code (primary, flowType): the official Grok Build CLI flow —
 *     requestDeviceCode()/pollToken() poll cli-chat-proxy's device-authorization
 *     endpoint (GROK_CLI_CONFIG). This stays the DEFAULT in OAuthModal.tsx so
 *     existing installs / docs referencing "grok login"-style device codes
 *     keep working unchanged.
 *   - Browser login (supportsBrowserPkce): PKCE authorization-code flow against
 *     auth.x.ai, reusing the same public client id as the sibling xai-oauth
 *     provider (see grok-cli-oauth.ts / GROK_BUILD_OAUTH_CONFIG). One click,
 *     no polling — offered as an alternative via the OAuthModal chooser.
 *   - Import token: user pastes the entire auth.json from ~/.grok/auth.json
 *     or just the JWT access token string. Kept as a fallback for headless /
 *     remote installs where neither a loopback callback nor device-code
 *     verification page can be reached.
 * All three paths converge on mapTokens() below and support automatic refresh
 * using the refresh_token (open-sse token-refresh reads config.tokenUrl
 * generically, independent of which flow acquired the tokens).
 */

import {
  getGrokBuildOAuthHeaders,
  GROK_BUILD_OAUTH_ISSUER,
  GROK_BUILD_OAUTH_REFERRER,
} from "@omniroute/open-sse/config/grokBuild.ts";
import { GROK_CLI_CONFIG, GROK_BUILD_OAUTH_CONFIG } from "../constants/oauth";
import {
  buildGrokBuildAuthUrl,
  exchangeGrokBuildToken,
  isGrokBuildBrowserTokens,
  mapGrokBuildBrowserTokens,
} from "./grok-cli-oauth";

interface GrokCliAuthInfo {
  user_id: string;
  email: string;
  team_id: string;
  tier: number;
  principal_type: string;
  principal_id: string;
  organization_id: string;
}

const EMPTY_STANDARD_TOKEN_FIELDS = {
  idToken: null,
  tokenType: null,
  scope: null,
  oauthExpiresIn: null,
} as const;

async function parseOAuthResponse(response: Response): Promise<Record<string, unknown>> {
  try {
    const value = await response.json();
    return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  } catch {
    return {
      error: "invalid_response",
      error_description: "xAI returned a non-JSON OAuth response",
    };
  }
}

function validateVerificationUri(value: string): void {
  if (
    [...value].some((character) => {
      const codePoint = character.codePointAt(0) ?? 0;
      return codePoint <= 0x1f || codePoint === 0x7f;
    })
  ) {
    throw new Error("Grok returned an invalid verification URL");
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Grok returned an invalid verification URL");
  }

  const isLocalHttp =
    url.protocol === "http:" && (url.hostname === "localhost" || url.hostname === "127.0.0.1");
  if (url.protocol !== "https:" && !isLocalHttp) {
    throw new Error("Grok returned an unsupported verification URL");
  }
}

/**
 * Device-code flow (#7358). Kept alongside the browser PKCE flow below (#7013
 * rework) — see grokCli.flowType, which stays "device_code" so it remains the
 * primary/default experience in OAuthModal.tsx and the route.ts device-code
 * action family.
 *
 * `grokCli.config` below is GROK_BUILD_OAUTH_CONFIG (the browser-PKCE shape —
 * required so it stays reference-equal for oauth-providers-config.test.ts and
 * so buildAuthUrl/exchangeToken keep receiving the right config). The
 * device-code endpoints and scope live on a DIFFERENT config (GROK_CLI_CONFIG:
 * deviceCodeUrl + a wider legacy scope set) that has no `authorizeUrl`/
 * `loopbackPort` shape, so requestDeviceCode/pollToken intentionally ignore
 * whatever config providers.ts passes them and always read GROK_CLI_CONFIG
 * directly.
 */
async function requestDeviceCode(_config?: unknown) {
  const config = GROK_CLI_CONFIG;
  const response = await fetch(config.deviceCodeUrl, {
    method: "POST",
    headers: getGrokBuildOAuthHeaders("ui"),
    body: new URLSearchParams({
      client_id: config.clientId,
      scope: config.scope,
      referrer: GROK_BUILD_OAUTH_REFERRER,
    }),
  });
  const data = await parseOAuthResponse(response);

  if (!response.ok) {
    throw new Error(
      typeof data.error_description === "string"
        ? data.error_description
        : "Grok device authorization failed"
    );
  }
  if (
    typeof data.device_code !== "string" ||
    typeof data.user_code !== "string" ||
    typeof data.verification_uri !== "string"
  ) {
    throw new Error("Grok device authorization response is incomplete");
  }
  if (!/^[A-Za-z0-9-]+$/.test(data.user_code)) {
    throw new Error("Grok returned an invalid device code");
  }
  validateVerificationUri(data.verification_uri);
  if (typeof data.verification_uri_complete === "string") {
    validateVerificationUri(data.verification_uri_complete);
  }

  return {
    device_code: data.device_code,
    user_code: data.user_code,
    verification_uri: data.verification_uri,
    verification_uri_complete:
      typeof data.verification_uri_complete === "string"
        ? data.verification_uri_complete
        : data.verification_uri,
    expires_in: typeof data.expires_in === "number" ? data.expires_in : 1800,
    interval: typeof data.interval === "number" ? data.interval : 5,
  };
}

async function pollToken(_config: unknown, deviceCode: string) {
  const config = GROK_CLI_CONFIG;
  const response = await fetch(config.tokenUrl, {
    method: "POST",
    headers: getGrokBuildOAuthHeaders("ui"),
    body: new URLSearchParams({
      client_id: config.clientId,
      device_code: deviceCode,
      grant_type: "urn:ietf:params:oauth:grant-type:device_code",
    }),
  });

  return { ok: response.ok, data: await parseOAuthResponse(response) };
}

type ParsedGrokJwt = {
  email: string | null;
  authInfo: GrokCliAuthInfo | null;
  exp: number | null;
} {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return { email: null, authInfo: null, exp: null };

function emptyGrokJwt(): ParsedGrokJwt {
  return { email: null, authInfo: null, exp: null };
}

    const payload = JSON.parse(Buffer.from(base64, "base64").toString("utf-8"));
    return {
      email: payload.email || null,
      authInfo: {
        user_id: payload.sub || "",
        email: payload.email || "",
        team_id: payload.team_id || "",
        tier: payload.tier || 1,
        principal_type: payload.principal_type || "User",
      },
      exp: typeof payload.exp === "number" ? payload.exp : null,
    };
  } catch {
    return { email: null, authInfo: null, exp: null };
  }
  base64 = base64.replace(/-/g, "+").replace(/_/g, "/");

  try {
    const payload = JSON.parse(Buffer.from(base64, "base64").toString("utf-8"));
    return payload && typeof payload === "object" && !Array.isArray(payload)
      ? (payload as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function jwtString(payload: Record<string, unknown>, key: string): string {
  return typeof payload[key] === "string" ? payload[key] : "";
}

function parseJwtPayload(token: string): ParsedGrokJwt {
  const payload = decodeJwtPayload(token);
  if (!payload) return emptyGrokJwt();

  const principalType = jwtString(payload, "principal_type");
  const principalId = jwtString(payload, "principal_id");
  const normalizedPrincipalType = principalType.toLowerCase();
  const isTeamPrincipal = normalizedPrincipalType === "team" && principalId.length > 0;
  const isOrganizationPrincipal =
    normalizedPrincipalType === "organization" && principalId.length > 0;
  const email = jwtString(payload, "email");

  return {
    email: email || null,
    authInfo: {
      user_id: isTeamPrincipal || isOrganizationPrincipal ? principalId : jwtString(payload, "sub"),
      email,
      team_id: jwtString(payload, "team_id") || (isTeamPrincipal ? principalId : ""),
      tier: (payload.tier as number) || 1,
      principal_type: principalType,
      principal_id: principalId,
      organization_id:
        jwtString(payload, "organization_id") || (isOrganizationPrincipal ? principalId : ""),
    },
    exp: typeof payload.exp === "number" ? payload.exp : null,
  };
}

/**
 * Extract the JWT access token and refresh_token from user input.
 * Accepts either:
 *   - Raw JWT string (no refresh_token available)
 *   - The entire auth.json object: { "https://auth.x.ai::...": { "key": "eyJ...", "refresh_token": "..." } }
 */
function extractTokenAndRefresh(input: unknown): {
  accessToken: string;
  refreshToken: string | null;
  rawAuthJson: Record<string, unknown> | null;
} {
  // Direct JWT string
  if (typeof input === "string")
    return { accessToken: input, refreshToken: null, rawAuthJson: null };

  if (input && typeof input === "object") {
    const obj = input as Record<string, unknown>;

    // The route handler wraps the token: { accessToken: <token> }.
    // Unwrap once before checking the inner value.
    const inner =
      typeof obj.accessToken === "object" && obj.accessToken !== null
        ? (obj.accessToken as Record<string, unknown>)
        : obj;

    // auth.json format: { "https://auth.x.ai::...": { key: "eyJ...", refresh_token: "..." } }
    if (inner && typeof inner === "object") {
      const innerKeys = Object.keys(inner);
      for (const k of innerKeys) {
        const entry = inner[k];
        if (entry && typeof entry === "object" && "key" in entry) {
          const e = entry as Record<string, unknown>;
          if (typeof e.key === "string" && e.key.startsWith("eyJ")) {
            return {
              accessToken: e.key,
              refreshToken: typeof e.refresh_token === "string" ? e.refresh_token : null,
              rawAuthJson: inner as Record<string, unknown>,
            };
          }
        }
      }
    }

    // Raw JWT passed as { accessToken: "eyJ..." }
    if (typeof obj.accessToken === "string" && obj.accessToken.length > 0) {
      return {
        accessToken: obj.accessToken,
        refreshToken: typeof obj.refreshToken === "string" ? obj.refreshToken : null,
        rawAuthJson: null,
      };
    }
  }

  return { accessToken: "", refreshToken: null, rawAuthJson: null };
}

export const grokCli = {
  config: GROK_CLI_CONFIG,
  flowType: "import_token",
  mapTokens: (token: unknown) => {
    const { accessToken, refreshToken, rawAuthJson } = extractTokenAndRefresh(token);
    const { email, authInfo } = parseJwtPayload(accessToken);

    return {
      accessToken,
      refreshToken,
      expiresIn,
      email,
      providerSpecificData: {
        userId: authInfo?.user_id || null,
        teamId: authInfo?.team_id || null,
        tier: authInfo?.tier || 1,
        principalType: authInfo?.principal_type || "User",
        rawAuthJson: rawAuthJson || undefined,
      },
    };
  },
};
