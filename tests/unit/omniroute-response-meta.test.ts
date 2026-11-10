import test from "node:test";
import assert from "node:assert/strict";

import {
  buildOmniRouteResponseMetaHeaders,
  buildOmniRouteSseMetadataComment,
  formatOmniRouteCost,
  getOmniRouteTokenCounts,
} from "../../src/domain/omnirouteResponseMeta.ts";

test("getOmniRouteTokenCounts normalizes common usage shapes", () => {
  assert.deepEqual(
    getOmniRouteTokenCounts({
      prompt_tokens: 12,
      completion_tokens: 5,
    }),
    { input: 12, output: 5 }
  );
  assert.deepEqual(
    getOmniRouteTokenCounts({
      input_tokens: "9",
      output_tokens: "4",
    }),
    { input: 9, output: 4 }
  );
});

test("buildOmniRouteResponseMetaHeaders formats provider alias, tokens, latency, and cost", () => {
  const headers = buildOmniRouteResponseMetaHeaders({
    provider: "claude",
    model: "claude-sonnet-4-6",
    cacheHit: true,
    latencyMs: 1234.6,
    usage: {
      prompt_tokens: 11,
      completion_tokens: 7,
    },
    costUsd: 0.00123456789,
  });

  assert.equal(headers["X-OmniRoute-Provider"], "cc");
  assert.equal(headers["X-OmniRoute-Model"], "claude-sonnet-4-6");
  assert.equal(headers["X-OmniRoute-Cache-Hit"], "true");
  assert.equal(headers["X-OmniRoute-Latency-Ms"], "1235");
  assert.equal(headers["X-OmniRoute-Tokens-In"], "11");
  assert.equal(headers["X-OmniRoute-Tokens-Out"], "7");
  assert.equal(headers["X-OmniRoute-Response-Cost"], "0.0012345679");
});

test("buildOmniRouteSseMetadataComment emits comment lines compatible with SSE", () => {
  const comment = buildOmniRouteSseMetadataComment({
    provider: "openai",
    model: "gpt-4o-mini",
    usage: {
      prompt_tokens: 4,
      completion_tokens: 2,
    },
    latencyMs: 50,
    costUsd: formatOmniRouteCost(0),
  });

  assert.match(comment, /^: x-omniroute-cache-hit=false/m);
  assert.match(comment, /^: x-omniroute-provider=openai/m);
  assert.match(comment, /^: x-omniroute-model=gpt-4o-mini/m);
  assert.match(comment, /^: x-omniroute-tokens-in=4/m);
  assert.match(comment, /^: x-omniroute-tokens-out=2/m);
  assert.match(comment, /^: x-omniroute-response-cost=0\.0000000000/m);
});
