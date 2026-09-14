/**
 * Regression test for #10711.
 *
 * The Hermes Agent dashboard "Apply" flow (HermesAgentToolCard.tsx) only
 * ever sends `keyId` (never a raw `apiKey`). generateHermesAgentConfig()
 * used to never resolve `keyId` at all, so `providers.omniroute.api_key`,
 * `delegation.api_key`, and every `auxiliary.*.api_key` were written with
 * the hardcoded placeholder "YOUR_OMNIROUTE_API_KEY_HERE", yielding 401s
 * against OmniRoute for every real user.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import * as yaml from "js-yaml";
import { generateHermesAgentConfig } from "../../../src/lib/cli-helper/config-generator/hermes-agent.ts";

interface HermesAgentParsedConfig {
  providers: { omniroute: { api_key: string } };
  delegation: { api_key: string };
  auxiliary: Record<string, { api_key: string }>;
}

test("#10711: generateHermesAgentConfig writes placeholder api_key when only keyId is supplied (no apiKey)", async () => {
  const result = await generateHermesAgentConfig({
    baseUrl: "http://localhost:20128",
    keyId: "some-stored-key-id", // what the real dashboard flow actually sends
    apiKey: null, // never resolved server-side — this is the bug
    selections: [
      { role: "default", model: "gpt-4o" },
      { role: "delegation", model: "gpt-4o" },
      { role: "vision", model: "gpt-4o-vision" },
    ],
  });

  assert.equal(result.error, undefined);
  const parsed = yaml.load(result.yaml) as HermesAgentParsedConfig;

  // generateHermesAgentConfig() itself never resolves keyId (that now happens
  // in the route handler before calling it) -- confirms the fallthrough this
  // bug depends on still exists at this layer, and that an explicit apiKey
  // (as the resolved route now passes) overrides the placeholder.
  assert.equal(parsed.providers.omniroute.api_key, "YOUR_OMNIROUTE_API_KEY_HERE");
});

test("#10711: an explicit apiKey (as resolved server-side from keyId) is written everywhere, never the placeholder", async () => {
  const result = await generateHermesAgentConfig({
    baseUrl: "http://localhost:20128",
    keyId: "some-stored-key-id",
    apiKey: "sk-resolved-real-key-value",
    selections: [
      { role: "default", model: "gpt-4o" },
      { role: "delegation", model: "gpt-4o" },
      { role: "vision", model: "gpt-4o-vision" },
    ],
  });

  assert.equal(result.error, undefined);
  const parsed = yaml.load(result.yaml) as HermesAgentParsedConfig;

  assert.equal(parsed.providers.omniroute.api_key, "sk-resolved-real-key-value");
  assert.equal(parsed.delegation.api_key, "sk-resolved-real-key-value");
  assert.equal(parsed.auxiliary.vision.api_key, "sk-resolved-real-key-value");
});
