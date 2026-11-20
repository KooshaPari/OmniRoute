import assert from "node:assert/strict";
import test from "node:test";

import {
  assertCommonChatGptWebProviderAvailable,
  CHATGPT_WEB_RETIRED_ERROR_CODE,
  isCommonChatGptWebRetiredProviderId,
  isCommonChatGptWebRetirementError,
  RETIRED_COMMON_CHATGPT_WEB_PROVIDER_IDS,
} from "../../src/shared/constants/chatgptWebRetirement.ts";

test("cgpt-web is recognized as retired", () => {
  assert.equal(RETIRED_COMMON_CHATGPT_WEB_PROVIDER_IDS.has("cgpt-web"), true);
  assert.equal(isCommonChatGptWebRetiredProviderId("cgpt-web"), true);
  assert.equal(isCommonChatGptWebRetiredProviderId(" CGPT-WEB "), true);
  assert.equal(isCommonChatGptWebRetiredProviderId("chatgpt-web"), false);
  assert.equal(isCommonChatGptWebRetiredProviderId(undefined), false);
});

test("assertCommonChatGptWebProviderAvailable throws PROVIDER_RETIRED with HTTP 410", () => {
  assert.equal(CHATGPT_WEB_RETIRED_ERROR_CODE, "PROVIDER_RETIRED");
  assert.doesNotThrow(() => assertCommonChatGptWebProviderAvailable("chatgpt-web"));
  assert.doesNotThrow(() => assertCommonChatGptWebProviderAvailable(undefined));

  assert.throws(
    () => assertCommonChatGptWebProviderAvailable("cgpt-web"),
    (error: unknown) => {
      const typed = error as Error & { code?: string; status?: number; statusCode?: number };
      assert.equal(typed.code, "PROVIDER_RETIRED");
      assert.equal(typed.status, 410);
      assert.equal(typed.statusCode ?? typed.status, 410);
      return true;
    }
  );
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
});
