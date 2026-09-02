import test from "node:test";
import assert from "node:assert/strict";
import {
  ChatAdmissionController,
  admitChatRequest,
  admitChatStructure,
  releaseChatAdmissionAfterHandler,
  releaseChatAdmissionWhenDone,
} from "../../src/shared/middleware/chatBodyAdmission.ts";

test("admitChatRequest rebuilds a bounded body and releases its heavyweight lease", async () => {
  const controller = new ChatAdmissionController(1);
  const body = JSON.stringify({ model: "test/model", messages: [{ role: "user", content: "hi" }] });
  const request = new Request("http://localhost/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", "content-length": String(body.length) },
    body,
  });

  const admission = await admitChatRequest(request, {
    controller,
    largeBodyBytes: 1,
    hardMaxBytes: 1024,
    queueMs: 0,
  });

  assert.equal(admission.admit, true);
  if (!admission.admit) return;
  assert.equal(controller.activeHeavy, 1);
  assert.equal(await admission.request.text(), body);
  admission.lease?.release();
  assert.equal(controller.activeHeavy, 0);
});

test("admitChatStructure returns a retryable rejection when structural capacity is held", async () => {
  const controller = new ChatAdmissionController(1, undefined, 0);
  const held = controller.tryAcquireHeavy();
  assert.ok(held);

  const result = await admitChatStructure({ messages: [{ role: "user", content: "x" }] }, null, {
    controller,
    heavyMessages: 1,
    queueMs: 0,
    heapPressureCheck: () => true,
  });

  assert.equal(result.admit, false);
  if (!result.admit) assert.equal(result.response.status, 503);
  held.release();
  assert.equal(controller.activeHeavy, 0);
});

test("response and handler failure paths release admission leases exactly once", async () => {
  const controller = new ChatAdmissionController(1);
  const streamLease = controller.tryAcquireHeavy();
  assert.ok(streamLease);
  const streamed = releaseChatAdmissionWhenDone(
    new Response("data: ok\n\n", { headers: { "content-type": "text/event-stream" } }),
    streamLease
  );
  assert.equal(streamLease.released, false);
  await streamed.text();
  assert.equal(streamLease.released, true);

  const failedLease = controller.tryAcquireHeavy();
  assert.ok(failedLease);
  await assert.rejects(
    releaseChatAdmissionAfterHandler(Promise.reject(new Error("handler failed")), failedLease),
    /handler failed/
  );
  assert.equal(failedLease.released, true);
  assert.equal(controller.activeHeavy, 0);
});
