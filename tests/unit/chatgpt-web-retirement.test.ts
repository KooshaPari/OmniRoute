import assert from "node:assert/strict";
import test from "node:test";

import {
  CHATGPT_WEB_RETIRED_ERROR_CODE,
  CHATGPT_WEB_RETIRED_MESSAGE,
  RETIRED_COMMON_CHATGPT_WEB_PROVIDER_IDS,
  assertCommonChatGptWebModelAvailable,
  assertCommonChatGptWebProviderAvailable,
  isCommonChatGptWebRetiredProviderId,
  isCommonChatGptWebRetirementError,
} from "../../src/shared/constants/chatgptWebRetirement.ts";

test("cgpt-web is recognized as a retired provider id after alias normalization", () => {
  assert.equal(RETIRED_COMMON_CHATGPT_WEB_PROVIDER_IDS.has("cgpt-web"), true);
  assert.equal(isCommonChatGptWebRetiredProviderId("cgpt-web"), true);
  assert.equal(isCommonChatGptWebRetiredProviderId("  CGPT-Web  "), true);
  assert.equal(isCommonChatGptWebRetiredProviderId("cgpt-web\n"), true);
});

test("the clean-room chatgpt-web provider id and unrelated ids stay available", () => {
  assert.equal(isCommonChatGptWebRetiredProviderId("chatgpt-web"), false);
  assert.equal(isCommonChatGptWebRetiredProviderId("openai"), false);
  assert.equal(isCommonChatGptWebRetiredProviderId(undefined), false);
  assert.equal(isCommonChatGptWebRetiredProviderId(42), false);
});

test("every id in the retired set is detected after normalization", () => {
  assert.ok(RETIRED_COMMON_CHATGPT_WEB_PROVIDER_IDS.size > 0);
  for (const retiredId of RETIRED_COMMON_CHATGPT_WEB_PROVIDER_IDS) {
    assert.equal(isCommonChatGptWebRetiredProviderId(retiredId.toUpperCase()), true);
  }
});

test("assertCommonChatGptWebProviderAvailable throws PROVIDER_RETIRED with status 410", () => {
  let caught: unknown;
  try {
    assertCommonChatGptWebProviderAvailable("cgpt-web");
  } catch (error) {
    caught = error;
  }

  assert.ok(caught instanceof Error, "expected the guard to throw an Error");
  const retirementError = caught as Error & { code?: unknown; status?: unknown };
  assert.equal(retirementError.message, CHATGPT_WEB_RETIRED_MESSAGE);
  assert.equal(retirementError.code, CHATGPT_WEB_RETIRED_ERROR_CODE);
  assert.equal(retirementError.code, "PROVIDER_RETIRED");
  assert.equal(retirementError.status, 410);

  // Non-retired providers must pass through untouched.
  assert.equal(assertCommonChatGptWebProviderAvailable("chatgpt-web"), undefined);
  assert.equal(assertCommonChatGptWebProviderAvailable("openai"), undefined);
});

test("retirement errors are distinguishable from generic errors", () => {
  let retirementError: unknown;
  try {
    assertCommonChatGptWebProviderAvailable("cgpt-web");
  } catch (error) {
    retirementError = error;
  }

  assert.equal(isCommonChatGptWebRetirementError(retirementError), true);
  assert.equal(isCommonChatGptWebRetirementError(new Error("boom")), false);
  assert.equal(isCommonChatGptWebRetirementError({ code: "PROVIDER_RETIRED", status: 410 }), false);

  // Model ids that target the retired provider take the same path.
  assert.throws(
    () => assertCommonChatGptWebModelAvailable("cgpt-web/gpt-5"),
    (error: unknown) => isCommonChatGptWebRetirementError(error)
  );
  assert.equal(assertCommonChatGptWebModelAvailable("openai/gpt-5"), undefined);
});
