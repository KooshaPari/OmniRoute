import {
  ANTIGRAVITY_LOAD_CODE_ASSIST_API_CLIENT,
  ANTIGRAVITY_LOAD_CODE_ASSIST_USER_AGENT,
  getAntigravityLoadCodeAssistClientMetadata,
} from "@omniroute/open-sse/services/antigravityHeaders.ts";
import {
  GITHUB_COPILOT_API_VERSION,
  GITHUB_COPILOT_CHAT_PLUGIN_VERSION,
  GITHUB_COPILOT_CHAT_USER_AGENT,
  GITHUB_COPILOT_EDITOR_VERSION,
} from "@omniroute/open-sse/config/providerHeaderProfiles.ts";
<<<<<<< Updated upstream
import { resolvePublicCred } from "@omniroute/open-sse/utils/publicCreds.ts";
=======
>>>>>>> Stashed changes
import { buildGitLabOAuthEndpoints, GITLAB_DUO_DEFAULT_BASE_URL } from "../gitlab";

/**
 * OAuth Configuration Constants
 *
 * All credentials are read exclusively from environment variables.
 * Default values match the public CLI client IDs from .env.example
 * (auto-populated by scripts/sync-env.mjs on install).
 *
 * These are public OAuth client credentials for desktop/CLI applications
 * that rely on PKCE for security (RFC 8252), not on secret confidentiality.
 * Shared header/version fingerprints now come from the central provider
 * header profile module so OAuth, usage fetchers and executors stay aligned.
 */

// Claude OAuth Configuration (Authorization Code Flow with PKCE)
export const CLAUDE_CONFIG = {
  clientId: process.env.CLAUDE_OAUTH_CLIENT_ID || "9d1c250a-e61b-44d9-88ed-5944d1962f5e",
  authorizeUrl: "https://claude.ai/oauth/authorize",
  tokenUrl: "https://console.anthropic.com/v1/oauth/token",
  redirectUri:
    process.env.CLAUDE_CODE_REDIRECT_URI || "https://platform.claude.com/oauth/code/callback",
  scopes: [
    "org:create_api_key",
    "user:profile",
    "user:inference",
    "user:sessions:claude_code",
    "user:mcp_servers",
  ],
  codeChallengeMethod: "S256",
};

// Codex (OpenAI) OAuth Configuration (Authorization Code Flow with PKCE)
export const CODEX_CONFIG = {
  clientId: process.env.CODEX_OAUTH_CLIENT_ID || "app_EMoamEEZ73f0CkXaXp7hrann",
  authorizeUrl: "https://auth.openai.com/oauth/authorize",
  tokenUrl: "https://auth.openai.com/oauth/token",
  scope: "openid profile email offline_access",
  codeChallengeMethod: "S256",
  // Additional OpenAI-specific params
  extraParams: {
    id_token_add_organizations: "true",
    codex_cli_simplified_flow: "true",
    originator: "codex_cli_rs",
  },
};

<<<<<<< Updated upstream
=======
// Gemini (Google) OAuth Configuration (Standard OAuth2)
export const GEMINI_CONFIG = {
  clientId:
    process.env.GEMINI_CLI_OAUTH_CLIENT_ID ||
    process.env.GEMINI_OAUTH_CLIENT_ID ||
    "681255809395-oo8ft2oprdrnp9e3aqf6av3hmdib135j.apps.googleusercontent.com",
  clientSecret:
    process.env.GEMINI_CLI_OAUTH_CLIENT_SECRET || process.env.GEMINI_OAUTH_CLIENT_SECRET || "",
  authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
  tokenUrl: "https://oauth2.googleapis.com/token",
  userInfoUrl: "https://www.googleapis.com/oauth2/v1/userinfo",
  scopes: [
    "https://www.googleapis.com/auth/cloud-platform",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/userinfo.profile",
  ],
};

>>>>>>> Stashed changes
// Qwen OAuth Configuration (Device Code Flow with PKCE)
export const QWEN_CONFIG = {
  clientId: process.env.QWEN_OAUTH_CLIENT_ID || "f0304373b74a44d2b584a3fb70ca9e56",
  deviceCodeUrl: "https://chat.qwen.ai/api/v1/oauth2/device/code",
  tokenUrl: "https://chat.qwen.ai/api/v1/oauth2/token",
  scope: "openid profile email model.completion",
  codeChallengeMethod: "S256",
};

// Qoder OAuth Configuration (Authorization Code)
const QODER_OAUTH_AUTHORIZE_URL = process.env.QODER_OAUTH_AUTHORIZE_URL || "";
const QODER_OAUTH_TOKEN_URL = process.env.QODER_OAUTH_TOKEN_URL || "";
const QODER_OAUTH_USERINFO_URL = process.env.QODER_OAUTH_USERINFO_URL || "";
const QODER_OAUTH_CLIENT_ID = process.env.QODER_OAUTH_CLIENT_ID || "";
const QODER_OAUTH_CLIENT_SECRET = process.env.QODER_OAUTH_CLIENT_SECRET || "";
const QODER_OAUTH_ENABLED =
  !!QODER_OAUTH_AUTHORIZE_URL &&
  !!QODER_OAUTH_TOKEN_URL &&
  !!QODER_OAUTH_USERINFO_URL &&
  !!QODER_OAUTH_CLIENT_ID &&
  !!QODER_OAUTH_CLIENT_SECRET;

export const QODER_CONFIG = {
  enabled: QODER_OAUTH_ENABLED,
  clientId: QODER_OAUTH_CLIENT_ID,
  clientSecret: QODER_OAUTH_CLIENT_SECRET,
  authorizeUrl: QODER_OAUTH_AUTHORIZE_URL,
  tokenUrl: QODER_OAUTH_TOKEN_URL,
  userInfoUrl: QODER_OAUTH_USERINFO_URL,
  extraParams: {
    loginMethod: "phone",
    type: "phone",
  },
};

<<<<<<< Updated upstream
// CodeBuddy CN (Tencent — copilot.tencent.com) OAuth Configuration
// (Custom Device-Auth Flow: POST stateUrl → open authUrl → GET pollUrl?state=).
// No client_id/secret — the upstream CLI ships none.
export const CODEBUDDY_CN_CONFIG = {
  baseUrl: "https://copilot.tencent.com",
  stateUrl: "https://copilot.tencent.com/v2/plugin/auth/state",
  tokenUrl: "https://copilot.tencent.com/v2/plugin/auth/token",
  refreshUrl: "https://copilot.tencent.com/v2/plugin/auth/token/refresh",
  userAgent: "CLI/2.63.2 CodeBuddy/2.63.2",
  platform: "CLI",
  pollInterval: 5000,
};

// Grok Build (xAI) OAuth Configuration (Import-Token Flow with refresh)
// Public client_id resolved through resolvePublicCred so it is never a literal.
export const GROK_CLI_CONFIG = {
  clientId: resolvePublicCred("grok_id", "GROK_OAUTH_CLIENT_ID"),
  tokenUrl: "https://auth.x.ai/oauth2/token",
};

=======
>>>>>>> Stashed changes
// Kimi Coding OAuth Configuration (Device Code Flow)
export const KIMI_CODING_CONFIG = {
  clientId: process.env.KIMI_CODING_OAUTH_CLIENT_ID || "17e5f671-d194-4dfb-9706-5516cb48c098",
  deviceCodeUrl: "https://auth.kimi.com/api/oauth/device_authorization",
  tokenUrl: "https://auth.kimi.com/api/oauth/token",
};

// KiloCode OAuth Configuration (Custom Device Auth Flow)
export const KILOCODE_CONFIG = {
  apiBaseUrl: "https://api.kilo.ai",
  initiateUrl: "https://api.kilo.ai/api/device-auth/codes",
  pollUrlBase: "https://api.kilo.ai/api/device-auth/codes",
};

// Cline OAuth Configuration (Local Callback Flow via app.cline.bot)
export const CLINE_CONFIG = {
  appBaseUrl: "https://app.cline.bot",
  apiBaseUrl: "https://api.cline.bot",
  authorizeUrl: "https://api.cline.bot/api/v1/auth/authorize",
  tokenExchangeUrl: "https://api.cline.bot/api/v1/auth/token",
  refreshUrl: "https://api.cline.bot/api/v1/auth/refresh",
};

// Antigravity OAuth Configuration (Standard OAuth2 with Google)
export const ANTIGRAVITY_CONFIG = {
  clientId:
    process.env.ANTIGRAVITY_OAUTH_CLIENT_ID ||
    "1071006060591-tmhssin2h21lcre235vtolojh4g403ep.apps.googleusercontent.com",
  clientSecret:
    process.env.ANTIGRAVITY_OAUTH_CLIENT_SECRET || "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",
  authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
  tokenUrl: "https://oauth2.googleapis.com/token",
  userInfoUrl: "https://www.googleapis.com/oauth2/v1/userinfo",
  // No "openid" scope — the working 9router flow requests only the Cloud Code /
  // userinfo scopes below. "openid" (with PKCE) routed Google into the hanging
  // `firstparty/nativeapp` consent. Match 9router exactly (antigravity login fix).
  scopes: [
    "https://www.googleapis.com/auth/cloud-platform",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/userinfo.profile",
    "https://www.googleapis.com/auth/cclog",
    "https://www.googleapis.com/auth/experimentsandconfigs",
  ],
  // Antigravity specific
  apiEndpoint: "https://cloudcode-pa.googleapis.com",
  apiVersion: "v1internal",
  loadCodeAssistEndpoint: "https://cloudcode-pa.googleapis.com/v1internal:loadCodeAssist",
  onboardUserEndpoint: "https://cloudcode-pa.googleapis.com/v1internal:onboardUser",
  fetchAvailableModelsEndpoint:
    "https://cloudcode-pa.googleapis.com/v1internal:fetchAvailableModels",
  loadCodeAssistUserAgent: ANTIGRAVITY_LOAD_CODE_ASSIST_USER_AGENT,
  loadCodeAssistApiClient: ANTIGRAVITY_LOAD_CODE_ASSIST_API_CLIENT,
  loadCodeAssistClientMetadata: getAntigravityLoadCodeAssistClientMetadata(),
};

// OpenAI OAuth Configuration (Authorization Code Flow with PKCE)
// Re-uses CODEX_CONFIG.clientId to avoid duplication — same provider, different originator.
export const OPENAI_CONFIG = {
  clientId: CODEX_CONFIG.clientId,
  authorizeUrl: "https://auth.openai.com/oauth/authorize",
  tokenUrl: "https://auth.openai.com/oauth/token",
  scope: "openid profile email offline_access",
  codeChallengeMethod: "S256",
  extraParams: {
    id_token_add_organizations: "true",
    originator: "openai_native",
  },
};

// GitHub Copilot OAuth Configuration (Device Code Flow)
export const GITHUB_CONFIG = {
  clientId: process.env.GITHUB_OAUTH_CLIENT_ID || "Iv1.b507a08c87ecfe98",
  deviceCodeUrl: "https://github.com/login/device/code",
  tokenUrl: "https://github.com/login/oauth/access_token",
  userInfoUrl: "https://api.github.com/user",
  scopes: "read:user",
  apiVersion: GITHUB_COPILOT_API_VERSION,
  copilotTokenUrl: "https://api.github.com/copilot_internal/v2/token",
  userAgent: GITHUB_COPILOT_CHAT_USER_AGENT,
  editorVersion: GITHUB_COPILOT_EDITOR_VERSION,
  editorPluginVersion: GITHUB_COPILOT_CHAT_PLUGIN_VERSION,
};

const GITLAB_DUO_ENDPOINTS = buildGitLabOAuthEndpoints(GITLAB_DUO_DEFAULT_BASE_URL);

export const GITLAB_DUO_CONFIG = {
  baseUrl: GITLAB_DUO_ENDPOINTS.root,
  clientId: process.env.GITLAB_DUO_OAUTH_CLIENT_ID || process.env.GITLAB_OAUTH_CLIENT_ID || "",
  clientSecret:
    process.env.GITLAB_DUO_OAUTH_CLIENT_SECRET || process.env.GITLAB_OAUTH_CLIENT_SECRET || "",
  authorizeUrl: GITLAB_DUO_ENDPOINTS.authorizeUrl,
  tokenUrl: GITLAB_DUO_ENDPOINTS.tokenUrl,
  userInfoUrl: GITLAB_DUO_ENDPOINTS.userUrl,
  directAccessUrl: GITLAB_DUO_ENDPOINTS.directAccessUrl,
  scope: "ai_features read_user",
  codeChallengeMethod: "S256",
};

// Kiro OAuth Configuration
// Supports multiple auth methods:
// 1. AWS Builder ID (Device Code Flow)
// 2. AWS IAM Identity Center/IDC (Device Code Flow with custom startUrl/region)
// 3. Google/GitHub Social Login (Authorization Code Flow - manual callback)
// 4. Import Token (paste refresh token from Kiro IDE)
export const KIRO_CONFIG = {
  // AWS SSO OIDC endpoints for Builder ID/IDC (Device Code Flow)
  ssoOidcEndpoint: "https://oidc.us-east-1.amazonaws.com",
  registerClientUrl: "https://oidc.us-east-1.amazonaws.com/client/register",
  deviceAuthUrl: "https://oidc.us-east-1.amazonaws.com/device_authorization",
  tokenUrl: "https://oidc.us-east-1.amazonaws.com/token",
  // AWS Builder ID default start URL
  startUrl: "https://view.awsapps.com/start",
  // Client registration params
  clientName: "kiro-oauth-client",
  clientType: "public",
  scopes: ["codewhisperer:completions", "codewhisperer:analysis", "codewhisperer:conversations"],
  grantTypes: ["urn:ietf:params:oauth:grant-type:device_code", "refresh_token"],
  issuerUrl: "https://identitycenter.amazonaws.com/ssoins-722374e8c3c8e6c6",
  // Social auth endpoints (Google/GitHub via AWS Cognito)
  socialAuthEndpoint: "https://prod.us-east-1.auth.desktop.kiro.dev",
  socialLoginUrl: "https://prod.us-east-1.auth.desktop.kiro.dev/login",
  socialTokenUrl: "https://prod.us-east-1.auth.desktop.kiro.dev/oauth/token",
  socialRefreshUrl: "https://prod.us-east-1.auth.desktop.kiro.dev/refreshToken",
  // Auth methods
  authMethods: ["builder-id", "idc", "google", "github", "import"],
};

// Cursor OAuth Configuration (Import Token from Cursor IDE)
// Cursor stores credentials in SQLite database: state.vscdb
// Keys: cursorAuth/accessToken, storage.serviceMachineId
export const CURSOR_CONFIG = {
  // API endpoints
  apiEndpoint: "https://api2.cursor.sh",
  chatEndpoint: "/aiserver.v1.ChatService/StreamUnifiedChatWithTools",
  modelsEndpoint: "/aiserver.v1.AiService/GetDefaultModelNudgeData",
  // Additional endpoints
  api3Endpoint: "https://api3.cursor.sh", // Telemetry
  agentEndpoint: "https://agent.api5.cursor.sh", // Privacy mode
  agentNonPrivacyEndpoint: "https://agentn.api5.cursor.sh", // Non-privacy mode
  // Client metadata
  clientVersion: "3.2.14",
  clientType: "ide",
  // Token storage locations (for user reference)
  tokenStoragePaths: {
    linux: "~/.config/Cursor/User/globalStorage/state.vscdb",
    macos: "/Users/<user>/Library/Application Support/Cursor/User/globalStorage/state.vscdb",
    windows: "%APPDATA%\\Cursor\\User\\globalStorage\\state.vscdb",
  },
  // Database keys
  dbKeys: {
    accessToken: "cursorAuth/accessToken",
    machineId: "storage.serviceMachineId",
  },
};

<<<<<<< Updated upstream
// Trae IDE Configuration (#2658)
//
// Trae is an AI-native IDE by ByteDance. Authentication is currently imported
// token only — users sign in inside Trae and paste the resulting API token
// here. ByteDance has not published a public OAuth client_id/secret or a CLI
// with extractable credentials, so no automated discovery is possible yet.
// If ByteDance ever publishes a public device-code or PKCE flow, swap
// flowType in src/lib/oauth/providers/trae.ts and wire endpoints below.
export const TRAE_CONFIG = {
  apiEndpoint: "https://api.trae.ai",
  clientType: "ide",
  tokenStoragePaths: {
    linux: "~/.config/Trae/User/globalStorage/state.vscdb",
    macos: "/Users/<user>/Library/Application Support/Trae/User/globalStorage/state.vscdb",
    windows: "%APPDATA%\\Trae\\User\\globalStorage\\state.vscdb",
  },
  // Chat completions path (mirrored from OpenAI-compatible providers)
  chatEndpoint: "/v1/chat/completions",
  // Trae website — users retrieve their token here after signing in
  webUrl: "https://trae.ai",
  // SOLO remote agent base — the executor's real upstream. Also set as the
  // provider registry baseUrl, which is the source of truth at request time.
  soloApiEndpoint: "https://core-normal.trae.ai/api/remote/v1",
  // SOLO model catalogue endpoint (relative to soloApiEndpoint).
  modelsEndpoint: "/models?functions=solo_agent_remote,solo_work_remote",
  // Authorization scheme: `Authorization: Cloud-IDE-JWT <token>` (RS256).
  authScheme: "Cloud-IDE-JWT",
  // Observed Cloud-IDE-JWT lifetime — drives default expiry hints.
  tokenLifetimeDays: 14,
  // Token storage note — solo.trae.ai exposes no public SQLite/keychain path,
  // so the token is captured via the /authorize flow or pasted manually.
  tokenNote:
    "Authorize via trae.ai in the popup, or sign in to solo.trae.ai and paste the Cloud-IDE-JWT from the Authorization header (~14-day lifetime).",
};

// Windsurf / Devin CLI Configuration
//
// 2026-05-29 (Phase 1 hotfix):
//   The browser PKCE flow targeting https://app.devin.ai/editor/signin returned
//   404 post-rebrand. PKCE-only fields (`authorizeUrl`, `codeChallengeMethod`,
//   `callbackPort`, `callbackPath`, `apiServerUrl`, `exchangePath`) are kept
//   below for archival reference but are NO LONGER consumed by any code path —
//   the provider exports flowType="import_token" only.
//
//   Phase 2 will reintroduce browser login via Firebase OAuth + RegisterUser
//   (ported from fendoushaonian/WindSurf-gRPC-API).
//   Spec: _tasks/superpowers/specs/2026-05-29-windsurf-login-fix-design.md.
//
// Active fields:
//   - inferenceUrl       → used by WindsurfExecutor (open-sse/executors/windsurf.ts)
//   - showAuthTokenUrl   → reference URL; the real token only renders when the
//                          IDE "Windsurf: Provide Auth Token" command opens it
//                          with an IDE-supplied ?state= param (see field below)
//   - firebaseApiKey     → reserved for Phase 2
//   - ideName            → sent in extension headers
export const WINDSURF_CONFIG = {
  // RETIRED 2026-05-29 — endpoint returns 404 post-rebrand. Phase 2 will replace.
  authorizeUrl: "https://app.devin.ai/editor/signin",
  // RETIRED 2026-05-29 — PKCE flow disabled, see header comment.
  codeChallengeMethod: "S256" as const,
  // RETIRED 2026-05-29 — no callback server is started for windsurf/devin-cli.
  callbackPort: 0,
  // RETIRED 2026-05-29 — no callback path is registered for windsurf/devin-cli.
  callbackPath: "/auth/callback",
  // RETIRED 2026-05-29 — exchange endpoint no longer reached because PKCE is disabled.
  apiServerUrl: "https://server.codeium.com",
  // RETIRED 2026-05-29 — see apiServerUrl.
  exchangePath: "/exa.seat_management_pb.SeatManagementService/ExchangePKCEAuthorizationCode",
  // ── Active fields (still consumed by runtime) ─────────────────────────────
  // Inference server URL (gRPC-web requests go here)
  inferenceUrl: "https://server.self-serve.windsurf.com",
  // Primary login path: the user runs the "Windsurf: Provide Auth Token" command
  // inside the Windsurf/VS Code IDE (or clicks the Jupyter "Get Windsurf
  // Authentication Token" button), which opens this URL WITH an IDE-supplied
  // `?state=<xyz>` param and renders the token. Opening this bare URL directly
  // only shows a "Redirecting" page with no token (#3324).
  showAuthTokenUrl: "https://windsurf.com/show-auth-token",
  // Token refresh via Firebase Secure Token Service (reserved for Phase 2).
  // Default is the public Firebase Web client identifier embedded in the
  // Windsurf/Devin CLI binary; users may override via WINDSURF_FIREBASE_API_KEY.
  firebaseApiKey: resolvePublicCred("windsurf_fb", "WINDSURF_FIREBASE_API_KEY"),
  firebaseTokenUrl: "https://securetoken.googleapis.com/v1/token",
  // IDE identity sent with every gRPC request
  ideName: "windsurf",
  ideVersion: "3.14.0",
  extensionVersion: "3.14.0",
};

=======
>>>>>>> Stashed changes
// OAuth timeout (5 minutes)
export const OAUTH_TIMEOUT = 300000;

// Provider list
export const PROVIDERS = {
  CLAUDE: "claude",
  CODEX: "codex",
  GEMINI: "gemini",
  QWEN: "qwen",
  QODER: "qoder",
  ANTIGRAVITY: "antigravity",
  KIMI_CODING: "kimi-coding",
  OPENAI: "openai",
  GITHUB: "github",
  GITLAB_DUO: "gitlab-duo",
  KIRO: "kiro",
  AMAZON_Q: "amazon-q",
  CURSOR: "cursor",
  KILOCODE: "kilocode",
  CLINE: "cline",
<<<<<<< Updated upstream
  WINDSURF: "windsurf",
  DEVIN_CLI: "devin-cli",
  TRAE: "trae",
  CODEBUDDY_CN: "codebuddy-cn",
  GROK_CLI: "grok-cli",
=======
>>>>>>> Stashed changes
};
