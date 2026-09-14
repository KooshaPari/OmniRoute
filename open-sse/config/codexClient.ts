import {
  CODEX_CLI_RS_ORIGINATOR,
  DEFAULT_CODEX_CLIENT_VERSION,
  getCodexCliRsHeaders as buildCodexCliRsHeaders,
} from "@/shared/constants/codexClient";

export {
  DEFAULT_CODEX_CLIENT_VERSION,
  CODEX_CLI_RS_ORIGINATOR,
} from "@/shared/constants/codexClient";
const DEFAULT_CODEX_USER_AGENT_PLATFORM = "Windows 10.0.26200";
const DEFAULT_CODEX_USER_AGENT_ARCH = "x64";
const CODEX_VERSION_OVERRIDE_ENV = "CODEX_CLIENT_VERSION";
const CODEX_USER_AGENT_OVERRIDE_ENV = "CODEX_USER_AGENT";
const SAFE_HEADER_TOKEN_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,31}$/;
const SAFE_HEADER_VALUE_PATTERN = /^[\x20-\x7E]{1,200}$/;
const SAFE_CODEX_SESSION_ID_PATTERN = /^[A-Za-z0-9._:-]{1,200}$/;

function getSafeEnvValue(name: string, pattern: RegExp): string | null {
  const raw = process.env[name];
  if (typeof raw !== "string") return null;
  const normalized = raw.trim();
  if (!normalized || !pattern.test(normalized)) {
    return null;
  }
  return normalized;
}

export function getCodexClientVersion(): string {
  return (
    getSafeEnvValue(CODEX_VERSION_OVERRIDE_ENV, SAFE_HEADER_TOKEN_PATTERN) ||
    DEFAULT_CODEX_CLIENT_VERSION
  );
}

export function getCodexUserAgent(): string {
  const override = getSafeEnvValue(CODEX_USER_AGENT_OVERRIDE_ENV, SAFE_HEADER_VALUE_PATTERN);
  if (override) {
    return override;
  }

  return `codex-cli/${getCodexClientVersion()} (${DEFAULT_CODEX_USER_AGENT_PLATFORM}; ${DEFAULT_CODEX_USER_AGENT_ARCH})`;
}

export function getCodexDefaultHeaders(): Record<string, string> {
  return {
    Version: getCodexClientVersion(),
    "Openai-Beta": "responses=experimental",
    "X-Codex-Beta-Features": "responses_websockets",
    "User-Agent": getCodexUserAgent(),
  };
}

export function getCodexCliRsHeaders(): Record<string, string> {
  return buildCodexCliRsHeaders(getCodexClientVersion());
}

/**
 * Identity for the credential face (auth.openai.com: token exchange / refresh).
 * The real Codex client sends only `originator` + `User-Agent` on that face
 * (codex-rs login/default_client.rs default_headers()); the `Version` header
 * gate exists only on the chatgpt.com/backend-api inference face, so it is
 * deliberately omitted here. Mirrors sub2api v0.1.178
 * ApplyCodexCanonicalAuthIdentity.
 */
export function getCodexAuthIdentityHeaders(): Record<string, string> {
  return {
    "User-Agent": getCodexUserAgent(),
    originator: CODEX_CLI_RS_ORIGINATOR,
  };
}

/**
 * Canonical Codex CLI identity for server-initiated calls against the
 * chatgpt.com/backend-api face that are not tied to one end-client request
 * (usage / quota / models manifest / reset-credits). Same UA/version chain as
 * inference so these calls do not show up upstream as anonymous half-identities.
 */
export function getCodexBackendIdentityHeaders(): Record<string, string> {
  return {
    "User-Agent": getCodexUserAgent(),
    originator: CODEX_CLI_RS_ORIGINATOR,
    Version: getCodexClientVersion(),
  };
}

export function normalizeCodexSessionId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return SAFE_CODEX_SESSION_ID_PATTERN.test(normalized) ? normalized : null;
}
