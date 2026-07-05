/**
 * bifrost-shadow-wiring.test — WP-B4.
 *
 * Verifies `wrapBifrostExecutorWithShadow` in `bifrostShadowWrap.ts`:
 *  - happy path: bifrost+legacy agree → live = bifrost, no event
 *  - divergence: bifrost+legacy disagree → live = bifrost, event with low score
 *  - kill switch: disable() stops firing shadow calls
 *  - extractText robustness: missing fields handled
 *
 * Uses node:test (per house style: `npm exec --yes tsx -- --test ...`).
 */

import { test } from "node:test";
import { strict as assert } from "node:assert";
import {
  wrapBifrostExecutorWithShadow,
  type BifrostShadowWrapped,
} from "../../open-sse/executors/bifrostShadowWrap.ts";

interface ExecResult {
  response: { body: { text: string } };
}

function makeExecutor(result: ExecResult) {
  return {
    execute: async () => result,
  };
}

function tick(): Promise<void> {
  return new Promise((r) => setImmediate(r));
}

test("returns the bifrost live result when bifrost+legacy agree", async () => {
  const events: Array<{ provider: string; agreementScore: number }> = [];
  const bifrost = makeExecutor({ response: { body: { text: "hello" } } });
  const legacy = async () => ({ response: { body: { text: "hello" } } });
  const w: BifrostShadowWrapped<typeof bifrost> = wrapBifrostExecutorWithShadow(
    bifrost,
    {
      provider: "openai",
      legacyExecute: legacy,
      recordEvent: (e) => events.push({ provider: e.provider, agreementScore: e.agreementScore }),
    },
  );
  const result = (await w.wrapped.execute({})) as ExecResult;
  assert.equal(result.response.body.text, "hello");
  await tick();
  assert.equal(events.length, 1);
  assert.ok(events[0].agreementScore > 0.9, `expected >0.9 got ${events[0].agreementScore}`);
});

test("returns bifrost live result even when legacy disagrees", async () => {
  const events: Array<{ provider: string; agreementScore: number }> = [];
  const bifrost = makeExecutor({ response: { body: { text: "BIFROST" } } });
  const legacy = async () => ({ response: { body: { text: "LEGACY" } } });
  const w = wrapBifrostExecutorWithShadow(bifrost, {
    provider: "openai",
    legacyExecute: legacy,
    recordEvent: (e) => events.push({ provider: e.provider, agreementScore: e.agreementScore }),
  });
  const result = (await w.wrapped.execute({})) as ExecResult;
  assert.equal(result.response.body.text, "BIFROST");
  await tick();
  assert.equal(events.length, 1);
  assert.ok(events[0].agreementScore < 0.5, `expected <0.5 got ${events[0].agreementScore}`);
});

test("disable() stops firing shadow calls", async () => {
  const events: Array<{ provider: string; agreementScore: number }> = [];
  const bifrost = makeExecutor({ response: { body: { text: "x" } } });
  const legacy = async () => ({ response: { body: { text: "x" } } });
  const w = wrapBifrostExecutorWithShadow(bifrost, {
    provider: "openai",
    legacyExecute: legacy,
    recordEvent: (e) => events.push({ provider: e.provider, agreementScore: e.agreementScore }),
  });
  w.disable();
  await w.wrapped.execute({});
  await tick();
  assert.equal(events.length, 0);
});

test("handles missing response fields without throwing", async () => {
  const events: Array<{ provider: string; agreementScore: number }> = [];
  const bifrost = { execute: async () => ({ response: {} }) };
  const legacy = async () => null;
  const w = wrapBifrostExecutorWithShadow(bifrost, {
    provider: "openai",
    legacyExecute: legacy,
    recordEvent: (e) => events.push({ provider: e.provider, agreementScore: e.agreementScore }),
  });
  const result = (await w.wrapped.execute({})) as { response: Record<string, unknown> };
  assert.deepEqual(result.response, {});
  await tick();
  assert.equal(events.length, 0);
});
