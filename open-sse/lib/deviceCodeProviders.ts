/**
 * Device-code OAuth support for providers that support the RFC 8628 flow.
 *
 * When a provider is listed here, `InAppLoginService` will use device-code
 * flow (no browser) instead of Playwright-based browser automation.
 */
export const DEVICE_CODE_PROVIDERS: Record<string, {
  deviceAuthorizationEndpoint: string;
  clientId: string;
  scopes: string[];
}> = {
  "qwen": {
    deviceAuthorizationEndpoint: "https://chat.qwen.ai/oauth/device/code",
    clientId: "qwen-cli",
    scopes: ["openid", "profile"],
  },
  "kiro": {
    deviceAuthorizationEndpoint: "https://api.kiro.dev/oauth/device/code",
    clientId: "kiro-cli",
    scopes: ["openid", "profile"],
  },
  "github": {
    deviceAuthorizationEndpoint: "https://github.com/login/device/code",
    clientId: "Iv1.b507a08c87ecfe98",
    scopes: ["repo"],
  },
  "kimi-coding": {
    deviceAuthorizationEndpoint: "https://kimi.moonshot.cn/oauth/device/code",
    clientId: "kimi-coding-cli",
    scopes: ["openid"],
  },
  "kilocode": {
    deviceAuthorizationEndpoint: "https://kilocode.ai/oauth/device/code",
    clientId: "kilocode-cli",
    scopes: ["openid", "profile"],
  },
  "codebuddy-cn": {
    deviceAuthorizationEndpoint: "https://api.codebuddy.cn/oauth/device/code",
    clientId: "codebuddy-cn-cli",
    scopes: ["openid"],
  },
};

export type DeviceCodeProvider = keyof typeof DEVICE_CODE_PROVIDERS;
