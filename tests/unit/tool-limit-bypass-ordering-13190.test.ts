// #13190 — tool-limit bypass must be evaluated BEFORE the provider/default
// limit. An operator's explicit `bypassDefaultToolLimit` override takes
// precedence over any detected provider limit, so a request the operator chose
// to send untruncated must keep every tool.

import test from "node:test";
import assert from "node:assert/strict";

import { prepareUpstreamBody } from "../../open-sse/handlers/chatCore/upstreamBody.ts";

const serial = { concurrency: false };

function manyTools(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    type: "function",
    function: { name: `t${i}`, parameters: {} },
  }));
}

function baseOpts(tools: ReturnType<typeof manyTools>, provider = "openai") {
  return {
    translatedBody: { model: "m", messages: [], tools },
    modelToCall: "m",
    provider,
    targetFormat: "openai",
    credentials: {},
  };
}

test("#13190 — bypassDefaultToolLimit=true keeps every tool", serial, async () => {
  const out = await prepareUpstreamBody({
    ...baseOpts(manyTools(200)),
    bypassDefaultToolLimit: true,
  });
  assert.equal(out.tools?.length, 200);
});

test("#13190 — without the bypass the default limit still applies", serial, async () => {
  const out = await prepareUpstreamBody({
    ...baseOpts(manyTools(200)),
    bypassDefaultToolLimit: false,
  });
  assert.equal(out.tools?.length, 128);
});

// grok-cli carries a PROACTIVE known limit of 200 (toolLimitDetector.ts).
// On pristine main `getKnownToolLimit` runs BEFORE the bypass check and its
// branch returns early, so a 250-tool request is cut to 200 and the operator's
// override is silently defeated. Checking bypass first preserves all 250.
test("#13190 — bypass beats a provider's known tool limit", serial, async () => {
  const out = await prepareUpstreamBody({
    ...baseOpts(manyTools(250), "grok-cli"),
    bypassDefaultToolLimit: true,
  });
  assert.equal(
    out.tools?.length,
    250,
    `known provider limit must not win over the bypass (got ${out.tools?.length}, expected 250)`
  );
});

test("#13190 — the same request without the bypass is still cut to the known limit", serial, async () => {
  const out = await prepareUpstreamBody({
    ...baseOpts(manyTools(250), "grok-cli"),
    bypassDefaultToolLimit: false,
  });
  assert.equal(out.tools?.length, 200);
});
