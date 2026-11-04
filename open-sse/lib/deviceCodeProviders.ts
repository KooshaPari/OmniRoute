/**
 * Device-code OAuth support for providers that support the RFC 8628 flow.
 *
 * When a provider is listed here, `InAppLoginService` will use device-code
 * flow (no browser) instead of Playwright-based browser automation.
 *
 * `clientId` values are public OAuth clients shipped inside each vendor's own
 * CLI (RFC 8628 device flow, no client secret). They are stored in the
 * public-cred registry — masked at rest with an env override — instead of as
 * source literals, per Hard Rule #11 / check:public-creds.
 */
import { resolvePublicCredMulti } from "../utils/publicCreds";

export const DEVICE_CODE_PROVIDERS: Record<
  string,
  {
    deviceAuthorizationEndpoint: string;
    clientId: string;
    scopes: string[];
  }
> = {
  qwen: {
    deviceAuthorizationEndpoint: "https://chat.qwen.ai/oauth/device/code",
    get clientId() {
      return resolvePublicCredMulti("qwen_cli_id", ["QWEN_DEVICE_CLIENT_ID"]);
    },
    scopes: ["openid", "profile"],
  },
  kiro: {
    deviceAuthorizationEndpoint: "https://api.kiro.dev/oauth/device/code",
    get clientId() {
      return resolvePublicCredMulti("kiro_cli_id", ["KIRO_DEVICE_CLIENT_ID"]);
    },
    scopes: ["openid", "profile"],
  },
  github: {
    deviceAuthorizationEndpoint: "https://github.com/login/device/code",
    get clientId() {
      return resolvePublicCredMulti("github_copilot_id", ["GITHUB_DEVICE_CLIENT_ID"]);
    },
    scopes: ["repo"],
  },
  "kimi-coding": {
    deviceAuthorizationEndpoint: "https://kimi.moonshot.cn/oauth/device/code",
    get clientId() {
      return resolvePublicCredMulti("kimi_coding_id", ["KIMI_CODING_DEVICE_CLIENT_ID"]);
    },
    scopes: ["openid"],
  },
  kilocode: {
    deviceAuthorizationEndpoint: "https://kilocode.ai/oauth/device/code",
    get clientId() {
      return resolvePublicCredMulti("kilocode_id", ["KILOCODE_DEVICE_CLIENT_ID"]);
    },
    scopes: ["openid", "profile"],
  },
  "codebuddy-cn": {
    deviceAuthorizationEndpoint: "https://api.codebuddy.cn/oauth/device/code",
    get clientId() {
      return resolvePublicCredMulti("codebuddy_cn_id", ["CODEBUDDY_CN_DEVICE_CLIENT_ID"]);
    },
    scopes: ["openid"],
  },
};

export type DeviceCodeProvider = keyof typeof DEVICE_CODE_PROVIDERS;
