import test from "node:test";
import assert from "node:assert/strict";

import {
  StreamThrottle,
  DEFAULT_HIGH_WATER_MARK,
  DEFAULT_WINDOW_MS,
  DEFAULT_THROTTLE_RATIO,
} from "../../../src/lib/streaming/streamThrottle.ts";
import { createCoalescingStream } from "../../../src/lib/streaming/coalescingStream.ts";
import { createKeepaliveStream } from "../../../src/lib/streaming/keepaliveStream.ts";

const textEncoder = new TextEncoder();

// ─── Helpers ────────────────────────────────────────────────────────────────

async function collectStream(
  input: Uint8Array[],
  transform: TransformStream<Uint8Array, Uint8Array>
): Promise<string> {
  const source = new ReadableStream({
    start(controller) {
      for (const chunk of input) {
        controller.enqueue(chunk);
      }
      controller.close();
    },
  });
  return new Response(source.pipeThrough(transform)).text();
}

// ─── StreamThrottle — 4 tests ───────────────────────────────────────────────

test("StreamThrottle defaults are exported as constants", () => {
  assert.equal(DEFAULT_HIGH_WATER_MARK, 16);
  assert.equal(DEFAULT_WINDOW_MS, 1000);
  assert.equal(DEFAULT_THROTTLE_RATIO, 0.5);
});

test("StreamThrottle detects backpressure from highWaterMark", () => {
  const t = new StreamThrottle({ highWaterMark: 3, windowMs: 10000 });

  // Stay under the limit — not throttled
  assert.equal(t.shouldThrottle(1), false);
  assert.equal(t.shouldThrottle(1), false);

  // Third chunk pushes pendingCount to 3 which equals highWaterMark
  assert.equal(t.shouldThrottle(1), true);

  // Record dequeues — pending drops back
  t.recordDequeue();
  t.recordDequeue();
  t.recordDequeue();
  assert.equal(t.snapshot().isThrottled, false);
});

test("StreamThrottle detects backpressure from slow enqueue ratio", () => {
  const t = new StreamThrottle({
    highWaterMark: 100,
    throttleRatio: 0.3,
    windowMs: 10000,
  });

  // 3 fast enqueues
  t.recordEnqueue(1);
  t.recordEnqueue(2);
  t.recordEnqueue(1);

  // 1 slow enqueue — 1/4 = 0.25, below 0.3
  t.recordEnqueue(10);
  assert.equal(t.snapshot().isThrottled, false);

  // Another slow enqueue — 2/5 = 0.4, above 0.3 → throttled
  t.recordEnqueue(12);
  assert.equal(t.snapshot().isThrottled, true);
});

test("StreamThrottle.reset clears all state", () => {
  const t = new StreamThrottle({ highWaterMark: 2 });
  t.shouldThrottle(1); // pendingCount=1, not throttled yet
  t.shouldThrottle(1); // pendingCount=2, throttled
  assert.equal(t.snapshot().isThrottled, true);

  t.reset();
  const s = t.snapshot();
  assert.equal(s.pendingCount, 0);
  assert.equal(s.totalChunks, 0);
  assert.equal(s.slowEnqueues, 0);
  assert.equal(s.isThrottled, false);
});

// ─── CoalescingStream — 3 tests ─────────────────────────────────────────────

test("createCoalescingStream batches small chunks within the window", async () => {
  const result = await collectStream(
    [
      textEncoder.encode("A"),
      textEncoder.encode("B"),
      textEncoder.encode("C"),
    ],
    createCoalescingStream({ windowMs: 200, maxBatchBytes: 4096 })
  );

  // All three tiny chunks should coalesce into one output chunk
  assert.equal(result, "ABC");
});

test("createCoalescingStream flushes oversize chunk immediately", async () => {
  // Build a chunk that exceeds maxBatchBytes
  const big = "X".repeat(300);
  const result = await collectStream(
    [
      textEncoder.encode("a"),
      textEncoder.encode(big),
      textEncoder.encode("b"),
    ],
    createCoalescingStream({ windowMs: 5000, maxBatchBytes: 200 })
  );

  assert.equal(result, "a" + big + "b");
});

test("createCoalescingStream flushes remaining buffer on close", async () => {
  const result = await collectStream(
    [textEncoder.encode("hello "), textEncoder.encode("world")],
    createCoalescingStream({ windowMs: 5000, maxBatchBytes: 4096 })
  );

  assert.equal(result, "hello world");
});

// ─── KeepaliveStream — 3 tests ──────────────────────────────────────────────

test("createKeepaliveStream forwards data unchanged", async () => {
  const result = await collectStream(
    [textEncoder.encode("hello "), textEncoder.encode("world")],
    createKeepaliveStream({ intervalMs: 5000 })
  );

  assert.equal(result, "hello world");
});

test("createKeepaliveStream emits keepalive on idle stream", async () => {
  const chunks: string[] = [];
  const source = new ReadableStream({
    start(controller) {
      controller.enqueue(textEncoder.encode("first\n"));
    },
  });

  const ke = createKeepaliveStream({
    intervalMs: 50,
    keepaliveData: ": ka\n\n",
  });

  const reader = source.pipeThrough(ke).getReader();

  // Read first data chunk
  const first = await reader.read();
  assert.equal(first.done, false);
  assert.ok(first.value);
  chunks.push(new TextDecoder().decode(first.value));

  // Wait for keepalive
  await new Promise((r) => setTimeout(r, 120));

  // Read any pending (keepalive) chunks
  for (let i = 0; i < 3; i++) {
    const next = await reader.read();
    if (next.done) break;
    chunks.push(new TextDecoder().decode(next.value));
  }
  reader.cancel();

  const combined = chunks.join("");
  assert.ok(combined.includes(": ka"), "should contain keepalive marker");
  assert.ok(combined.includes("first"), "should contain original data");
});

test("createKeepaliveStream stops timer after stream closes", async () => {
  const ke = createKeepaliveStream({ intervalMs: 50, keepaliveData: ": ping\n\n" });

  // Close immediately
  const source = new ReadableStream({
    start(ctrl) {
      ctrl.enqueue(textEncoder.encode("data"));
      ctrl.close();
    },
  });

  const result = await new Response(source.pipeThrough(ke)).text();
  assert.equal(result, "data");
  // No keepalive should have been emitted since stream closed before interval
});
