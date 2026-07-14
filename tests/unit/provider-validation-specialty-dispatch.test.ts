import assert from "node:assert/strict";
import { afterEach, test } from "node:test";

import { validateProviderApiKey } from "../../src/lib/providers/validation.ts";
import { getSpecialtyValidator } from "../../src/lib/providers/validation/specialtyProviders.ts";

const originalFetch = globalThis.fetch;
const originalAuggieBin = process.env.AUGGIE_BIN;

afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalAuggieBin === undefined) delete process.env.AUGGIE_BIN;
  else process.env.AUGGIE_BIN = originalAuggieBin;
});

test("specialty dispatch preserves all provider-specific validation routes", () => {
  for (const provider of ["v0-vercel", "auggie", "nanobanana", "petals", "poolside"]) {
    assert.equal(
      typeof getSpecialtyValidator(provider),
      "function",
      `${provider} must not fall through to generic registry validation`
    );
  }
});

test("auggie validation checks the local CLI instead of an HTTP models endpoint", async () => {
  process.env.AUGGIE_BIN = "/definitely/missing/auggie";

  const result = await validateProviderApiKey({ provider: "auggie", apiKey: "" });

  assert.equal(result.valid, false);
  assert.equal(result.unsupported, false);
  assert.match(result.error || "", /Auggie CLI not found/i);
});

test("nanobanana remains routed through image-provider validation", async () => {
  const validator = getSpecialtyValidator("nanobanana");
  assert.equal(typeof validator, "function");

  const result = await validator!({ apiKey: "nanobanana-key" });

  assert.deepEqual(result, {
    valid: false,
    error: "Provider validation not supported",
    unsupported: true,
  });
});

test("petals validation posts the form-encoded generation probe", async () => {
  globalThis.fetch = async (url, init = {}) => {
    assert.equal(String(url), "https://chat.petals.dev/api/v1/generate");
    assert.equal(init.method, "POST");
    assert.equal((init.headers as Record<string, string>).Authorization, "Bearer petals-key");
    const body = new URLSearchParams(String(init.body));
    assert.equal(body.get("inputs"), "test");
    assert.equal(body.get("max_new_tokens"), "1");
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  };

  const result = await validateProviderApiKey({ provider: "petals", apiKey: "petals-key" });

  assert.deepEqual(result, { valid: true, error: null, method: "petals_generate" });
});

test("poolside validation uses chat completions because the provider has no models endpoint", async () => {
  globalThis.fetch = async (url, init = {}) => {
    assert.equal(String(url), "https://api.poolside.ai/v1/chat/completions");
    assert.equal(init.method, "POST");
    assert.equal((init.headers as Record<string, string>).Authorization, "Bearer poolside-key");
    const body = JSON.parse(String(init.body));
    assert.equal(body.model, "poolside-model");
    return new Response(JSON.stringify({ error: "payload rejected" }), { status: 400 });
  };

  const result = await validateProviderApiKey({ provider: "poolside", apiKey: "poolside-key" });

  assert.deepEqual(result, { valid: true, error: null });
});
