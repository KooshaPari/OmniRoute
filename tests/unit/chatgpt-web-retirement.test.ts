import assert from "node:assert/strict";
import test from "node:test";

import {
  assertCommonChatGptWebProviderAvailable,
  CHATGPT_WEB_RETIRED_ERROR_CODE,
  CHATGPT_WEB_RETIRED_MESSAGE,
  isCommonChatGptWebRetiredProviderId,
  isCommonChatGptWebRetirementError,
  RETIRED_COMMON_CHATGPT_WEB_PROVIDER_IDS,
} from "../../src/shared/constants/chatgptWebRetirement.ts";
import { isReservedProviderPrefix } from "../../src/shared/constants/reservedProviderPrefixes.ts";
import { getRegistryEntry, REGISTRY } from "../../open-sse/config/providerRegistry.ts";
import { getExecutor, hasSpecializedExecutor } from "../../open-sse/executors/index.ts";
import { AI_PROVIDERS } from "../../src/shared/constants/providers.ts";

function isRetirementError(error: unknown): boolean {
  const typed = error as Error & { code?: string; status?: number };
  assert.equal(typed.code, CHATGPT_WEB_RETIRED_ERROR_CODE);
  assert.equal(typed.status, 410);
  assert.equal(typed.message, CHATGPT_WEB_RETIRED_MESSAGE);
  return true;
}

test("cgpt-web is in the retired set and normalization recognizes it case-insensitively", () => {
  assert.equal(RETIRED_COMMON_CHATGPT_WEB_PROVIDER_IDS.has("cgpt-web"), true);
  assert.equal(isCommonChatGptWebRetiredProviderId("cgpt-web"), true);
  assert.equal(isCommonChatGptWebRetiredProviderId("  CGPT-WEB  "), true);
  assert.equal(isCommonChatGptWebRetiredProviderId("chatgpt-web"), false);
  assert.equal(isCommonChatGptWebRetiredProviderId("theme-cgpt-web"), false);
  assert.equal(isCommonChatGptWebRetiredProviderId(undefined), false);
  assert.equal(isCommonChatGptWebRetiredProviderId(42), false);
});

test("alias/prefix normalization reserves the retired cgpt-web id", () => {
  assert.equal(isReservedProviderPrefix("cgpt-web"), true);
  assert.equal(isReservedProviderPrefix("CGPT-WEB"), true);
  assert.equal(isReservedProviderPrefix("cgpt-web-extra"), false);
});

test("assertCommonChatGptWebProviderAvailable throws PROVIDER_RETIRED with HTTP 410", () => {
  assert.throws(() => assertCommonChatGptWebProviderAvailable("cgpt-web"), isRetirementError);
  assert.throws(() => assertCommonChatGptWebProviderAvailable(" CGPT-WEB "), isRetirementError);

  // A normal (live) provider is not rejected. The helper is the single guard
  // used by chat resolution and executor selection, so a no-throw here proves
  // the retirement only targets cgpt-web.
  assert.doesNotThrow(() => assertCommonChatGptWebProviderAvailable("chatgpt-web"));
  assert.doesNotThrow(() => assertCommonChatGptWebProviderAvailable(undefined));
});

test("getExecutor rejects the retired cgpt-web provider", async () => {
  assert.equal(getRegistryEntry("cgpt-web"), null);
  assert.equal(hasSpecializedExecutor("cgpt-web"), false);
  await assert.rejects(() => getExecutor("cgpt-web"), isRetirementError);
});

test("clean-room chatgpt-web (and its codex aliases) remain live", async () => {
  assert.ok(REGISTRY["chatgpt-web"]);
  assert.ok(AI_PROVIDERS["chatgpt-web"]);
  assert.ok(getRegistryEntry("chatgpt-web"));
  assert.equal(hasSpecializedExecutor("chatgpt-web"), true);
  assert.ok(await getExecutor("chatgpt-web"));

  assert.ok(getRegistryEntry("chatgpt-web-codex"));
  assert.ok(getRegistryEntry("cgpt-codex"));
  assert.equal(hasSpecializedExecutor("chatgpt-web-codex"), true);
  assert.equal(hasSpecializedExecutor("cgpt-codex"), true);
  assert.equal(isCommonChatGptWebRetiredProviderId("chatgpt-web-codex"), false);
  assert.equal(isCommonChatGptWebRetiredProviderId("cgpt-codex"), false);
});

test("isCommonChatGptWebRetirementError only matches retirement errors", () => {
  let retirementError: unknown;
  try {
    assertCommonChatGptWebProviderAvailable("cgpt-web");
  } catch (error) {
    retirementError = error;
  }

  assert.equal(isCommonChatGptWebRetirementError(retirementError), true);
  assert.equal(isCommonChatGptWebRetirementError(new Error("x")), false);
  assert.equal(isCommonChatGptWebRetirementError(null), false);
  assert.equal(isCommonChatGptWebRetirementError(undefined), false);
});
