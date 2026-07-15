/**
 * InAppLoginService — Device-code OAuth as default login path,
 * Playwright browser pool as fallback for providers that require a real browser.
 *
 * Opens a Playwright browser context, navigates to the provider's login page,
 * and polls for target cookies/tokens after the user completes login.
 * Falls back from device-code OAuth (RFC 8628) to Playwright if the provider
 * does not support device code or the flow fails.
 *
 * Used as the dashboard/web fallback path when Electron is not available.
 * For Electron-native login, see electron/loginManager.js.
 *
 * Events:
 *   "status" — { providerId: string, status: string, message: string }
 *     status values: starting, navigating, waiting, polling, complete, error, cancelled
 *   For device-code flows, status "device_code_ready" is emitted with the
 *     verification URL and user code in the message field, formatted as:
 *     "Please visit {url} and enter code: {code}"
 */

import { EventEmitter } from "events";
import { TOKEN_EXTRACTION_CONFIGS, TokenExtractionConfig, type TokenSource } from "./tokenExtractionConfig";
import { generatePKCE } from "@/lib/oauth/utils/pkce";

// ─── OAuth device-code provider imports ─────────────────────────────────────

let oauthProvidersModule: any = null;
let oauthProvidersFn: any = null;

async function getOauthProviders() {
  if (!oauthProvidersModule) {
    oauthProvidersModule = await import("@/lib/oauth/providers/index");
  }
  // Also lazy-load the providers gateway for finalizeTokens
  if (!oauthProvidersFn) {
    try {
      oauthProvidersFn = await import("@/lib/oauth/providers");
    } catch {
      // Not critical; some features may be unavailable
    }
  }
  return oauthProvidersModule.PROVIDERS;
}

/**
 * Map from tokenExtractionConfig provider IDs to OAuth device-code provider names.
 * Only providers that have both a tokenExtractionConfig entry AND a device-code OAuth
 * flow registered in the OAuth provider system are listed here.
 *
 * When startLogin() is called with one of these IDs and preferDeviceCode is true,
 * device-code OAuth is attempted before falling back to Playwright browser login.
 */
const DEVICE_CODE_PROVIDER_MAP: Record<string, string> = {
  // kimi-web → Kimi Coding OAuth provider (device_code flow)
  "kimi-web": "kimi-coding",
  // qwen-web → Qwen OAuth provider (device_code flow with PKCE)
  "qwen-web": "qwen",
};

// ─── Types ──────────────────────────────────────────────────────────────────

export interface LoginResult {
  success: boolean;
  credentials?: Record<string, string>;
  error?: string;
}

interface ActiveLogin {
  providerId: string;
  aborted: boolean;
}

// ─── Service ────────────────────────────────────────────────────────────────

export class InAppLoginService extends EventEmitter {
  private activeLogin: ActiveLogin | null = null;
  private _preferDeviceCode: boolean;

  /**
   * @param preferDeviceCode - Whether to prefer device-code OAuth over Playwright
   * browser login. Defaults to true. When true, startLogin() tries device code first
   * and falls back to Playwright on failure.
   */
  constructor(preferDeviceCode = true) {
    super();
    this._preferDeviceCode = preferDeviceCode;
  }

  /**
   * Get/set whether device code is preferred over Playwright browser login.
   */
  get preferDeviceCode(): boolean {
    return this._preferDeviceCode;
  }

  set preferDeviceCode(val: boolean) {
    this._preferDeviceCode = val;
  }

  /**
   * Start a login flow for a provider.
   *
   * Tries device-code OAuth first (if preferDeviceCode is enabled and the provider
   * has a device-code OAuth entry), then falls back to Playwright browser login.
   *
   * @param providerId - e.g. "claude-web", "chatgpt-web", "kimi-web"
   * @param options.timeout - Total timeout in ms
   * @param options.preferDeviceCode - Override the instance default for this call
   */
  async startLogin(providerId: string, options?: { timeout?: number; preferDeviceCode?: boolean }): Promise<LoginResult> {
    const config = TOKEN_EXTRACTION_CONFIGS.get(providerId);
    if (!config) {
      this.emit("status", { providerId, status: "error", message: "No extraction config found" });
      return { success: false, error: `No extraction config for provider: ${providerId}` };
    }

    if (this.activeLogin) {
      this.emit("status", { providerId, status: "error", message: "A login is already in progress" });
      return { success: false, error: "A login process is already in progress" };
    }

    this.activeLogin = { providerId, aborted: false };
    this.emit("status", { providerId, status: "starting", message: `Starting login for ${config.displayName}...` });

    // Determine whether to try device code first
    const useDeviceCode = options?.preferDeviceCode ?? this._preferDeviceCode;
    const oauthProviderName = DEVICE_CODE_PROVIDER_MAP[providerId];

    if (useDeviceCode && oauthProviderName) {
      try {
        const result = await this.deviceCodeLogin(providerId, oauthProviderName, options?.timeout);
        if (result.success) {
          this.emit("status", {
            providerId,
            status: "complete",
            message: "Credentials obtained via device code login",
          });
          this.activeLogin = null;
          return result;
        }
        // Device code returned an error — fall through to browser
        this.emit("status", {
          providerId,
          status: "waiting",
          message: `Device code login: ${result.error || "failed"}, falling back to browser login...`,
        });
      } catch (error) {
        // Device code threw — fall through to browser
        const msg = error instanceof Error ? error.message : String(error);
        this.emit("status", {
          providerId,
          status: "waiting",
          message: `Device code login error (${msg}), falling back to browser login...`,
        });
      }
    }

    // Fall back to Playwright browser login
    try {
      const result = await this.browserFallbackLogin(config, options?.timeout);
      this.emit("status", {
        providerId,
        status: result.success ? "complete" : "error",
        message: result.success ? "Credentials extracted successfully" : (result.error || "Login failed"),
      });
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.emit("status", { providerId, status: "error", message });
      return { success: false, error: `Login failed: ${message}` };
    } finally {
      this.activeLogin = null;
    }
  }

  /**
   * Device-code OAuth login (no browser required).
   *
   * Requests a device code from the provider, emits a status event with the
   * verification URL and user code, then polls until the user authorizes or
   * a timeout occurs.
   */
  async deviceCodeLogin(
    providerId: string,
    oauthProviderName: string,
    timeout?: number
  ): Promise<LoginResult> {
    if (this.activeLogin?.aborted) {
      return { success: false, error: "Login cancelled" };
    }

    // Build the device code URL for the status event
    this.emit("status", {
      providerId,
      status: "starting",
      message: "Requesting device code...",
    });

    try {
      const providers = await getOauthProviders();
      const provider = providers[oauthProviderName];
      if (!provider) {
        return { success: false, error: `No OAuth provider found: ${oauthProviderName}` };
      }
      if (provider.flowType !== "device_code") {
        return { success: false, error: `Provider ${oauthProviderName} does not support device code flow` };
      }

      // Generate PKCE if the device code request expects a code challenge
      const { codeVerifier, codeChallenge } = generatePKCE();

      // Request device code
      let deviceCodeData: any;
      try {
        deviceCodeData = await provider.requestDeviceCode(provider.config, codeChallenge);
      } catch (e: any) {
        return { success: false, error: `Device code request failed: ${e?.message || e}` };
      }

      const deviceCode = deviceCodeData.device_code;
      const userCode = deviceCodeData.user_code;
      const verificationUri = deviceCodeData.verification_uri_complete
        || deviceCodeData.verification_uri
        || "https://example.com/device";
      const pollInterval = (deviceCodeData.interval || 5) * 1000;
      const expiresIn = (deviceCodeData.expires_in || 300) * 1000;

      this.emit("status", {
        providerId,
        status: "device_code_ready",
        message: `Please visit ${verificationUri} and enter code: ${userCode}`,
      });

      // Determine polling deadline
      const maxTimeout = timeout || expiresIn;
      const deadline = Date.now() + maxTimeout;
      const startTime = Date.now();

      // Poll for authorization
      let lastEmitTime = 0;

      while (Date.now() < deadline) {
        if (this.activeLogin?.aborted) {
          this.emit("status", { providerId, status: "cancelled", message: "Login cancelled by user" });
          return { success: false, error: "Login cancelled" };
        }

        await sleep(pollInterval);

        if (this.activeLogin?.aborted) {
          this.emit("status", { providerId, status: "cancelled", message: "Login cancelled by user" });
          return { success: false, error: "Login cancelled" };
        }

        // Emit progress every 30 seconds
        const elapsed = Date.now() - startTime;
        if (elapsed - lastEmitTime > 30000) {
          lastEmitTime = elapsed;
          this.emit("status", {
            providerId,
            status: "waiting",
            message: `Waiting for authorization... (${Math.round(elapsed / 1000)}s)`,
          });
        }

        // Poll token
        try {
          const result = await provider.pollToken(provider.config, deviceCode, codeVerifier);

          if (result.ok) {
            if (result.data?.access_token) {
              // Map tokens to credentials
              const mapped = provider.mapTokens ? provider.mapTokens(result.data) : result.data;

              this.emit("status", {
                providerId,
                status: "waiting",
                message: "Authorization received, finalizing...",
              });

              // Run postExchange if available
              let extra = null;
              if (provider.postExchange) {
                try {
                  extra = await provider.postExchange(result.data);
                } catch {
                  // Non-critical — best effort only
                }
              }

              // If mapTokens expects extra, provide it
              const finalTokens = provider.mapTokens
                ? provider.mapTokens(result.data, extra)
                : result.data;

              const credentials: Record<string, string> = {};
              if (finalTokens.accessToken) credentials["access_token"] = finalTokens.accessToken;
              if (finalTokens.refreshToken) credentials["refresh_token"] = finalTokens.refreshToken;
              if (finalTokens.idToken) credentials["id_token"] = finalTokens.idToken;
              if (finalTokens.access_token) credentials["access_token"] = finalTokens.access_token;
              if (finalTokens.refresh_token) credentials["refresh_token"] = finalTokens.refresh_token;
              if (finalTokens.id_token) credentials["id_token"] = finalTokens.id_token;

              return { success: true, credentials };
            }

            // Success response but no access_token yet
            continue;
          }

          // Not OK — check for pending/slow_down
          const errorCode = result.data?.error;
          if (errorCode === "authorization_pending" || errorCode === "slow_down") {
            continue;
          }
          if (errorCode === "expired_token") {
            return { success: false, error: "Device code expired. Please try again." };
          }
          if (errorCode === "access_denied") {
            return { success: false, error: "Authorization denied by user." };
          }

          // Other error
          const desc = result.data?.error_description || result.data?.message || errorCode || "unknown";
          return { success: false, error: `Polling failed: ${desc}` };
        } catch (e: any) {
          // Transient network error — keep polling until deadline
          continue;
        }
      }

      return { success: false, error: "Device code login timed out" };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return { success: false, error: `Device code login failed: ${msg}` };
    }
  }

  /**
   * Run the Playwright browser login flow.
   * Extracted from the original runBrowserLogin, kept as a fallback for providers
   * that do not support device-code OAuth.
   */
  async browserFallbackLogin(
    config: TokenExtractionConfig,
    timeout?: number
  ): Promise<LoginResult> {
    const pollInterval = config.pollingConfig.pollInterval || 1000;
    const maxTimeout = timeout || config.pollingConfig.timeout || 300_000;
    const minLoginTime = config.pollingConfig.minLoginTime || 5000;
    const providerId = config.providerId;

    // Dynamically import Playwright (it's a heavy dep, only load when needed)
    let playwright: any;
    try {
      playwright = await import("playwright");
    } catch {
      return { success: false, error: "Playwright is not installed. Use Electron for native login." };
    }

    if (this.activeLogin?.aborted) {
      return { success: false, error: "Login cancelled" };
    }

    // Launch browser
    this.emit("status", { providerId, status: "starting", message: "Launching browser..." });
    const browser = await playwright.chromium.launch({
      headless: false, // User must interact with the login page
    });

    try {
      const context = await browser.newContext({
        viewport: { width: 1280, height: 800 },
        locale: "en-US",
      });
      const page = await context.newPage();

      // Navigate to login URL
      this.emit("status", { providerId, status: "navigating", message: `Loading ${config.loginUrl}` });
      await page.goto(config.loginUrl, { waitUntil: "domcontentloaded", timeout: 30000 });

      // Poll for success URL + token extraction
      const maxPolls = Math.floor(maxTimeout / pollInterval);
      const credentials: Record<string, string> = {};
      const startTime = Date.now();

      for (let i = 0; i < maxPolls; i++) {
        if (this.activeLogin?.aborted) {
          this.emit("status", { providerId, status: "cancelled", message: "Login cancelled by user" });
          return { success: false, error: "Login cancelled" };
        }

        // Emit progress every 30 seconds
        if (i > 0 && i % 30 === 0) {
          this.emit("status", {
            providerId,
            status: "waiting",
            message: `Waiting for login... (${Math.round(i / 60)}m)`,
          });
        }

        // Wait before polling (respect minLoginTime on first iteration)
        if (Date.now() - startTime < minLoginTime) {
          await sleep(pollInterval);
          continue;
        }

        // Gather cookies from browser context
        const cookies = await context.cookies();
        const tokenSources = config.tokenSources;

        // Check cookie-based sources
        for (const source of tokenSources) {
          if (source.type === "cookie") {
            const domain = source.domain || undefined;
            const matched = cookies.find(
              (c: any) =>
                c.name === source.name &&
                (!domain || c.domain.includes(domain.replace(/^\./, "")))
            );
            if (matched && !credentials[source.name]) {
              credentials[source.name] = matched.value;
            }
          }
        }

        // Check localStorage-based tokens
        for (const source of tokenSources) {
          if (source.type === "localStorage" && !credentials[source.key]) {
            try {
              const value = await page.evaluate((key: string) => localStorage.getItem(key), source.key);
              if (value && typeof value === "string") {
                credentials[source.key] = value;
              }
            } catch {
              // localStorage access may fail on some domains
            }
          }
          if (source.type === "sessionStorage" && !credentials[source.key]) {
            try {
              const value = await page.evaluate((key: string) => sessionStorage.getItem(key), source.key);
              if (value && typeof value === "string") {
                credentials[source.key] = value;
              }
            } catch {
              // sessionStorage access may fail on some domains
            }
          }
        }

        // Check if all required tokens are found
        const requiredKeys = tokenSources.map((s) =>
          s.type === "cookie" ? s.name : s.type === "localStorage" || s.type === "sessionStorage" ? s.key : s.name
        );
        const allFound = requiredKeys.every((k) => credentials[k] !== undefined);

        if (allFound && Object.keys(credentials).length > 0) {
          return { success: true, credentials };
        }

        // Check for success URL pattern
        if (config.successUrlPattern) {
          try {
            const currentUrl = page.url();
            if (config.successUrlPattern.test(currentUrl) && Object.keys(credentials).length > 0) {
              return { success: true, credentials };
            }
          } catch {
            // URL access may fail on some pages
          }
        }

        await sleep(pollInterval);
      }

      return { success: false, error: "Login timed out" };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.emit("status", { providerId, status: "error", message });
      return { success: false, error: `Login failed: ${message}` };
    } finally {
      await browser.close().catch(() => {});
    }
  }

  /**
   * Cancel the current login flow
   */
  cancel(): void {
    if (this.activeLogin) {
      this.emit("status", {
        providerId: this.activeLogin.providerId,
        status: "cancelled",
        message: "Login cancelled by user",
      });
      this.activeLogin.aborted = true;
      this.activeLogin = null;
    }
  }

  /**
   * Get the active provider ID, if any
   */
  getActiveProvider(): string | null {
    return this.activeLogin?.providerId || null;
  }

  /**
   * Check if a login flow is in progress
   */
  isActive(): boolean {
    return this.activeLogin !== null && !this.activeLogin.aborted;
  }
}

// ─── Sleep helper ───────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Singleton ──────────────────────────────────────────────────────────────

export const inAppLoginService = new InAppLoginService();
