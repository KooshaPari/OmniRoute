import assert from "node:assert/strict";
import test from "node:test";

import {
  CHATGPT_WEB_RETIRED_ERROR_CODE,
  CHATGPT_WEB_RETIRED_MESSAGE,
  assertCommonChatGptWebProviderAvailable,
  isCommonChatGptWebRetiredProviderId,
  isCommonChatGptWebRetirementError,
} from "../../src/shared/constants/chatgptWebRetirement.ts";

test("cgpt-web is recognized as a retired provider", () => {
  assert.equal(isCommonChatGptWebRetiredProviderId("cgpt-web"), true);
  assert.equal(isCommonChatGptWebRetiredProviderId(" CGPT-Web "), true);

  assert.equal(isCommonChatGptWebRetiredProviderId("chatgpt-web"), false);
  assert.equal(isCommonChatGptWebRetiredProviderId(undefined), false);
  assert.equal(isCommonChatGptWebRetiredProviderId(null), false);
});

test("assertCommonChatGptWebProviderAvailable rejects cgpt-web with PROVIDER_RETIRED and HTTP 410", () => {
  assert.doesNotThrow(() => assertCommonChatGptWebProviderAvailable("chatgpt-web"));

  assert.throws(
    () => assertCommonChatGptWebProviderAvailable("cgpt-web"),
    (error: unknown) => {
      const typed = error as Error & { code?: unknown; status?: unknown; statusCode?: unknown };
      assert.equal(typed.code, CHATGPT_WEB_RETIRED_ERROR_CODE);
      assert.equal(typed.code, "PROVIDER_RETIRED");
      assert.equal(typed.status, 410);
      assert.equal(typed.statusCode ?? typed.status, 410);
      assert.equal(typed.message, CHATGPT_WEB_RETIRED_MESSAGE);
      return true;
    }
  );
});

test("isCommonChatGptWebRetirementError matches retirement errors only", () => {
  let retirementError: unknown;
  try {
    assertCommonChatGptWebProviderAvailable("cgpt-web");
  } catch (error) {
    retirementError = error;
  }

  assert.ok(retirementError instanceof Error);
  assert.equal(isCommonChatGptWebRetirementError(retirementError), true);
  assert.equal(isCommonChatGptWebRetirementError(new Error("x")), false);
  assert.equal(isCommonChatGptWebRetirementError(undefined), false);
  assert.equal(isCommonChatGptWebRetirementError({ code: "PROVIDER_RETIRED", status: 410 }), false);
});
