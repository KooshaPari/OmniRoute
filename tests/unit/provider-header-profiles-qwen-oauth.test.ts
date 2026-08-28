import assert from "node:assert/strict";
import test from "node:test";
import {
  getQwenCliUserAgent,
  getQwenOauthHeaders,
  getRuntimeVersion,
  normalizeStainlessArch,
  normalizeStainlessPlatform,
  QWEN_ACCEPT_LANGUAGE,
  QWEN_SEC_FETCH_MODE,
  QWEN_STAINLESS_LANG,
  QWEN_STAINLESS_PACKAGE_VERSION,
  QWEN_STAINLESS_RETRY_COUNT,
  QWEN_STAINLESS_RUNTIME,
} from "../../open-sse/config/providerHeaderProfiles.ts";

test("Qwen OAuth headers retain the full native client wire profile", () => {
  const userAgent = getQwenCliUserAgent();

  assert.deepEqual(getQwenOauthHeaders(), {
    "User-Agent": userAgent,
    "X-Dashscope-AuthType": "qwen-oauth",
    "X-Dashscope-CacheControl": "enable",
    "X-Dashscope-UserAgent": userAgent,
    "X-Stainless-Arch": normalizeStainlessArch(),
    "X-Stainless-Lang": QWEN_STAINLESS_LANG,
    "X-Stainless-Os": normalizeStainlessPlatform(),
    "X-Stainless-Package-Version": QWEN_STAINLESS_PACKAGE_VERSION,
    "X-Stainless-Retry-Count": QWEN_STAINLESS_RETRY_COUNT,
    "X-Stainless-Runtime": QWEN_STAINLESS_RUNTIME,
    "X-Stainless-Runtime-Version": getRuntimeVersion(),
    Connection: "keep-alive",
    "Accept-Language": QWEN_ACCEPT_LANGUAGE,
    "Sec-Fetch-Mode": QWEN_SEC_FETCH_MODE,
  });
});
