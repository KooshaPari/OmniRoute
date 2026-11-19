import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { LocalDlpModerationGuardrail } from "../../../src/lib/guardrails/localDlpModeration.ts";

const ORIGINAL_ENABLED = process.env.DLP_MODERATION_ENABLED;
const ORIGINAL_MODE = process.env.DLP_MODERATION_MODE;

afterEach(() => {
  if (ORIGINAL_ENABLED === undefined) {
    delete process.env.DLP_MODERATION_ENABLED;
  } else {
    process.env.DLP_MODERATION_ENABLED = ORIGINAL_ENABLED;
  }
  if (ORIGINAL_MODE === undefined) {
    delete process.env.DLP_MODERATION_MODE;
  } else {
    process.env.DLP_MODERATION_MODE = ORIGINAL_MODE;
  }
});

test("disabled by default performs no behavior", async () => {
  delete process.env.DLP_MODERATION_ENABLED;
  delete process.env.DLP_MODERATION_MODE;

  const guardrail = new LocalDlpModerationGuardrail();
  const payload = {
    messages: [{ role: "user", content: "fake AKIAIOSFODNN7EXAMPLE" }],
  };
  const snapshot = structuredClone(payload);

  const result = await guardrail.preCall(payload, {});

  assert.equal(guardrail.enabled, false);
  assert.deepEqual(result, { block: false });
  assert.deepEqual(payload, snapshot);
});

test("warn mode leaves payload unchanged and exposes no matched values", async () => {
  process.env.DLP_MODERATION_ENABLED = "true";
  process.env.DLP_MODERATION_MODE = "warn";

  const guardrail = new LocalDlpModerationGuardrail();
  const secret = "AKIAIOSFODNN7EXAMPLE";
  const payload = {
    messages: [{ role: "user", content: `before ${secret} after` }],
  };
  const snapshot = structuredClone(payload);

  const result = await guardrail.preCall(payload, {});

  assert.equal(result?.block, false);
  assert.equal(result?.modifiedPayload, undefined);
  assert.ok((result?.meta?.count as number) >= 1);
  assert.ok((result?.meta?.categories as string[]).includes("aws_access_key"));
  assert.equal(result?.meta?.matches, undefined);
  assert.ok(!JSON.stringify(result).includes(secret));
  assert.deepEqual(payload, snapshot);
});

test("redact mode replaces sensitive strings", async () => {
  process.env.DLP_MODERATION_ENABLED = "true";
  process.env.DLP_MODERATION_MODE = "redact";

  const guardrail = new LocalDlpModerationGuardrail();
  const secret = "AKIAIOSFODNN7EXAMPLE";
  const payload = {
    messages: [{ role: "user", content: `before ${secret} after` }],
  };
  const snapshot = structuredClone(payload);

  const result = await guardrail.preCall(payload, {});

  assert.equal(result?.block, false);
  const modified = result?.modifiedPayload as { messages: { content: string }[] };
  assert.equal(
    modified.messages[0].content,
    "before [REDACTED:aws_access_key] after"
  );
  assert.ok(!JSON.stringify(modified).includes(secret));
  assert.deepEqual(payload, snapshot);
});

test("block mode returns the block response with a generic message", async () => {
  process.env.DLP_MODERATION_ENABLED = "true";
  process.env.DLP_MODERATION_MODE = "block";

  const guardrail = new LocalDlpModerationGuardrail();
  const secret = "AKIAIOSFODNN7EXAMPLE";
  const payload = {
    messages: [{ role: "user", content: `secret ${secret}` }],
  };
  const snapshot = structuredClone(payload);

  const result = await guardrail.preCall(payload, {});

  assert.equal(result?.block, true);
  assert.equal(result?.message, "Blocked by local DLP policy");
  assert.equal(result?.modifiedPayload, undefined);
  assert.ok((result?.meta?.count as number) >= 1);
  assert.ok(!JSON.stringify(result).includes(secret));
  assert.deepEqual(payload, snapshot);
});

test("clean payload is unchanged", async () => {
  process.env.DLP_MODERATION_ENABLED = "true";
  process.env.DLP_MODERATION_MODE = "warn";

  const guardrail = new LocalDlpModerationGuardrail();
  const payload = {
    messages: [{ role: "user", content: "nothing sensitive here" }],
  };
  const snapshot = structuredClone(payload);

  const result = await guardrail.preCall(payload, {});

  assert.deepEqual(result, { block: false });
  assert.equal(result?.modifiedPayload, undefined);
  assert.deepEqual(payload, snapshot);
});

test("does not mutate input payload", async () => {
  process.env.DLP_MODERATION_ENABLED = "true";
  process.env.DLP_MODERATION_MODE = "redact";

  const guardrail = new LocalDlpModerationGuardrail();
  const payload = {
    messages: [{ role: "user", content: "contact fake.person@example.test" }],
    nested: { args: "api_key = \"fakeApiKeyValue1234567890\"" },
  };
  const snapshot = structuredClone(payload);

  await guardrail.preCall(payload, {});

  assert.deepEqual(payload, snapshot);
});
