import assert from "node:assert/strict";
import test from "node:test";

const { isRequestScopedUpstreamFailure } = await import("../../../open-sse/services/combo/comboPredicates.ts");
const { getComboFailureLogError } = await import("../../../src/sse/handlers/comboFailureLogging.ts");

test("request-scoped combo failures never poison provider-wide resilience", () => {
  for (const error of [
    { code: "context_length_exceeded" },
    { code: "upstream_empty_response" },
    { code: "upstream_response_failed" },
    { code: "combo_target_timeout" },
    { code: "stream_readiness_timeout" },
    { type: "stream_early_eof" },
  ]) {
    assert.equal(isRequestScopedUpstreamFailure(error), true);
  }
  assert.equal(isRequestScopedUpstreamFailure({ code: "provider_unavailable" }), false);
});

test("combo failure logging preserves safe upstream detail and falls back safely", async () => {
  const detailed = new Response(JSON.stringify({ error: { message: "Target context limit reached" } }), { status: 400 });
  assert.equal(await getComboFailureLogError(detailed, "default"), "[400] Target context limit reached");
  assert.equal(await getComboFailureLogError(new Response("not-json", { status: 503 }), "default"), "[503] Combo \"default\" failed");
});
