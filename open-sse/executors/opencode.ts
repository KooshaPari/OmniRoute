import { BaseExecutor, type ExecuteInput, type ProviderCredentials } from "./base.ts";
import { PROVIDERS } from "../config/constants.ts";
import { getModelTargetFormat } from "../config/providerModels.ts";
<<<<<<< Updated upstream
import {
  injectReasoningContentForThinkingModel,
  isThinkingMessageModel,
} from "../utils/reasoningContentInjector.ts";
import { runWithProxyContext } from "../utils/proxyFetch.ts";
import { forwardOpencodeClientHeaders } from "../utils/opencodeHeaders.ts";

/**
 * Per-account proxy configuration, persisted by NoAuthAccountCard under
 * `providerSpecificData.accountProxies` (keyed by the account id, which the UI
 * stores in `providerSpecificData.fingerprints`). Same shape mimocode uses.
 */
export interface OpencodeAccountProxyConfig {
  fingerprint: string;
  proxy: {
    type: string;
    host: string;
    port: number;
    username?: string;
    password?: string;
  } | null;
}

/** Runtime rotation/cooldown state for one "OpenCode Free" account. */
interface OpencodeAccountState {
  /** Account id (UI: providerSpecificData.fingerprints[i]); "" for the default direct account. */
  fingerprint: string;
  cooldownUntil: number;
  consecutiveFails: number;
  /** Resolved proxy config for this account (null = direct egress). */
  proxy: OpencodeAccountProxyConfig["proxy"];
}

const OPENCODE_COOLDOWN_BASE_MS = 5_000;
const OPENCODE_COOLDOWN_MAX_MS = 60_000;
=======
>>>>>>> Stashed changes

const EFFORT_LEVELS = ["low", "medium", "high", "max"] as const;

/**
 * Parse a DeepSeek V4 Pro model string with an effort-level suffix.
 * e.g. "deepseek-v4-pro-low" → { baseModel: "deepseek-v4-pro", effort: "low" }
 * Returns null if the model doesn't match the pattern.
 */
function parseDeepSeekEffortLevel(model: string): { baseModel: string; effort: string } | null {
  const m = String(model || "");
  const matchedLevel = EFFORT_LEVELS.find((level) => m.endsWith(`-${level}`));
  if (!matchedLevel) return null;
  const baseModel = m.slice(0, -matchedLevel.length - 1);
  if (baseModel.toLowerCase() !== "deepseek-v4-pro") return null;
  return { baseModel: "deepseek-v4-pro", effort: matchedLevel };
}

export class OpencodeExecutor extends BaseExecutor {
  _requestFormat: string | null = null;

  constructor(provider: string) {
    super(provider, PROVIDERS[provider] || PROVIDERS.openai);
  }

  async execute(input: ExecuteInput) {
    this._requestFormat = getModelTargetFormat(this.provider, input.model) || "openai";
    try {
<<<<<<< Updated upstream
      this.syncAccountsFromCredentials(input.credentials);

      const hasProxies = this.accounts.some((a) => a.proxy !== null);
      // Fast path: no multi-account proxy wiring configured → original behavior.
      if (this.accounts.length === 1 && !hasProxies) {
        return await super.execute(input);
      }

      const { log } = input;
      let lastResult: Awaited<ReturnType<BaseExecutor["execute"]>> | null = null;

      for (let attempt = 0; attempt < this.accounts.length; attempt++) {
        const account = this.pickAccount();
        const masked = OpencodeExecutor.maskAccountId(account.fingerprint);
        // #5217 (Gap 2): promoted debug→info so the per-request account/proxy
        // rotation selection is visible in the Console log view at the default
        // APP_LOG_LEVEL=info (users could not see which account/proxy was used).
        // Token stays masked — never log the full account id.
        log?.info?.(
          "OPENCODE",
          `dispatch via account ${masked} (idx ${attempt + 1}/${this.accounts.length})` +
            (account.proxy
              ? ` through proxy ${account.proxy.host}:${account.proxy.port}`
              : " direct")
        );

        // Pin egress to this account's proxy for the whole BaseExecutor dispatch
        // (incl. its intra-URL 429 retries). skipUpstreamRetry lets THIS loop own
        // the cross-account 429 fallback instead of BaseExecutor's same-key retry.
        const result = await runWithProxyContext(account.proxy, () =>
          super.execute({ ...input, skipUpstreamRetry: true })
        );
        lastResult = result;

        const status = result.response.status;
        if (status === 429) {
          this.markCooldown(account);
          log?.warn?.("OPENCODE", `Rate limited (429) on account ${masked}, rotating to next…`);
          continue;
        }

        this.markSuccess(account);
        return result;
      }

      // All accounts returned 429 (or errored) — surface the last response.
      return lastResult ?? (await super.execute(input));
=======
      return await super.execute(input);
>>>>>>> Stashed changes
    } finally {
      this._requestFormat = null;
    }
  }

  buildUrl(
    model: string,
    stream: boolean,
    urlIndex = 0,
    credentials: ProviderCredentials | null = null
  ) {
    void urlIndex;
    void credentials;

    const base = this.config.baseUrl;
    switch (this._requestFormat) {
      case "claude":
        return `${base}/messages`;
      case "openai-responses":
        return `${base}/responses`;
      case "gemini":
        return `${base}/models/${model}:${stream ? "streamGenerateContent?alt=sse" : "generateContent"}`;
      default:
        return `${base}/chat/completions`;
    }
  }

  buildHeaders(credentials: ProviderCredentials | null, stream = true) {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    const key = credentials?.apiKey || credentials?.accessToken;

    if (key) {
      if (this._requestFormat === "claude") {
        headers["x-api-key"] = key;
      } else {
        headers["Authorization"] = `Bearer ${key}`;
      }
    }

    if (this._requestFormat === "claude") {
      headers["anthropic-version"] = "2023-06-01";
    }

    if (stream) {
      headers["Accept"] = "text/event-stream";
    }

<<<<<<< Updated upstream
    if (clientHeaders) {
      forwardOpencodeClientHeaders(headers, clientHeaders, {
        synthesizeRequestId: true,
      });
    }

    void model;

=======
>>>>>>> Stashed changes
    return headers;
  }

  transformRequest(
    model: string,
    body: any,
    stream: boolean,
    credentials: ProviderCredentials
  ): any {
    const modifiedBody = super.transformRequest(model, body, stream, credentials);
    if (
      modifiedBody &&
      typeof modifiedBody === "object" &&
      Array.isArray(modifiedBody.tools) &&
      modifiedBody.tools.length > 128
    ) {
      modifiedBody.tools = modifiedBody.tools.slice(0, 128);
    }
<<<<<<< Updated upstream
    if (modifiedBody && typeof modifiedBody === "object" && !Array.isArray(modifiedBody)) {
      const mb = modifiedBody as Record<string, unknown>;
      const parsed = parseDeepSeekEffortLevel(model);
      if (parsed) {
        mb.model = parsed.baseModel;
        if (mb.reasoning_effort === undefined) {
          mb.reasoning_effort = parsed.effort;
        }
      }
    }
    // #1543 / upstream PR #1099: thinking-mode upstreams routed through OpenCode
    // (DeepSeek V4 Flash, Kimi, MiniMax, ...) require reasoning_content echoed
    // back on assistant messages, or they 400 with "reasoning_content must be
    // passed back". OpenAI clients drop it across turns, so we inject a
    // placeholder for the affected model families.
    if (isThinkingMessageModel(model)) {
      modifiedBody = injectReasoningContentForThinkingModel(modifiedBody);
    }
=======
>>>>>>> Stashed changes
    return modifiedBody;
  }
}
