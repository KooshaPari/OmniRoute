/**
 * Device-code OAuth support for providers that support the RFC 8628 flow.
 *
 * When a provider is listed here, `InAppLoginService` will use device-code
 * flow (no browser) instead of Playwright-based browser automation.
 */
import { resolvePublicCred } from "../utils/publicCreds";

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
    clientId: resolvePublicCred("qwen_cli_id"),
    scopes: ["openid", "profile"],
  },
  kiro: {
    deviceAuthorizationEndpoint: "https://api.kiro.dev/oauth/device/code",
    clientId: resolvePublicCred("kiro_cli_id"),
    scopes: ["openid", "profile"],
  },
  github: {
    deviceAuthorizationEndpoint: "https://github.com/login/device/code",
    clientId: resolvePublicCred("github_copilot_id"),
    scopes: ["repo"],
  },
  "kimi-coding": {
    deviceAuthorizationEndpoint: "https://kimi.moonshot.cn/oauth/device/code",
    clientId: resolvePublicCred("kimi_coding_cli_id"),
    scopes: ["openid"],
  },
  kilocode: {
    deviceAuthorizationEndpoint: "https://kilocode.ai/oauth/device/code",
    clientId: resolvePublicCred("kilocode_cli_id"),
    scopes: ["openid", "profile"],
  },
  "codebuddy-cn": {
    deviceAuthorizationEndpoint: "https://api.codebuddy.cn/oauth/device/code",
    clientId: resolvePublicCred("codebuddy_cn_cli_id"),
    scopes: ["openid"],
  },
};

export type DeviceCodeProvider = keyof typeof DEVICE_CODE_PROVIDERS;
