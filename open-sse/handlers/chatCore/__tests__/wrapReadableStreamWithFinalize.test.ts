import { describe, expect, it, vi } from "vitest";

import { wrapReadableStreamWithFinalize } from "../wrapReadableStreamWithFinalize.ts";

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

/**
 * Build a ReadableStream<Uint8Array> from a list of chunks. The stream
 * closes naturally after the last chunk.
 */
function streamFrom(chunks: Uint8Array[]): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk);
      controller.close();
    },
  });
}

/**
 * Build a ReadableStream that:
 *   - First read returns a chunk.
 *   - Second read errors.
 *
 * We use a pull-based source that tracks how many `pull` calls have happened
 * so the test can assert that the chunk arrives first, then the error.
 */
function streamThatErrorsOnRead(message: string): ReadableStream<Uint8Array> {
  let pulls = 0;
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      pulls += 1;
      if (pulls === 1) {
        controller.enqueue(new Uint8Array([0x01]));
      } else {
        controller.error(new Error(message));
      }
    },
  });
}

async function readAll<T>(stream: ReadableStream<T>): Promise<T[]> {
  const reader = stream.getReader();
  const out: T[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    out.push(value);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Behavior contract
// ---------------------------------------------------------------------------

describe("wrapReadableStreamWithFinalize", () => {
  it("forwards every chunk from the inner stream to the consumer", async () => {
    const finalize = vi.fn();
    const chunks = [new Uint8Array([1, 2]), new Uint8Array([3, 4, 5])];
    const wrapped = wrapReadableStreamWithFinalize(streamFrom(chunks), finalize);

    const out = await readAll(wrapped);
    expect(out).toEqual(chunks);
    expect(finalize).toHaveBeenCalledTimes(1);
  });

  it("invokes finalize exactly once on a clean close", async () => {
    const finalize = vi.fn();
    const wrapped = wrapReadableStreamWithFinalize(streamFrom([new Uint8Array([9])]), finalize);
    await readAll(wrapped);
    expect(finalize).toHaveBeenCalledTimes(1);
  });

  it("invokes finalize exactly once on an empty stream", async () => {
    const finalize = vi.fn();
    const empty = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.close();
      },
    });
    const wrapped = wrapReadableStreamWithFinalize(empty, finalize);
    await readAll(wrapped);
    expect(finalize).toHaveBeenCalledTimes(1);
  });

  it("invokes finalize when the inner stream errors and propagates the error", async () => {
    const finalize = vi.fn();
    const wrapped = wrapReadableStreamWithFinalize(
      streamThatErrorsOnRead("upstream broke"),
      finalize,
    );

    const reader = wrapped.getReader();
    await reader.read(); // first chunk
    await expect(reader.read()).rejects.toThrow("upstream broke");
    expect(finalize).toHaveBeenCalledTimes(1);
  });

  it("invokes finalize exactly once when the consumer cancels mid-stream", async () => {
    const finalize = vi.fn();
    const inner = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array([1]));
        controller.enqueue(new Uint8Array([2]));
        // never closes -- consumer will cancel
      },
    });
    const wrapped = wrapReadableStreamWithFinalize(inner, finalize);

    const reader = wrapped.getReader();
    await reader.read();
    await reader.cancel("user abort");

    expect(finalize).toHaveBeenCalledTimes(1);
  });

  it("never invokes finalize twice even when both close and cancel would trigger it", async () => {
    // Pathological: a stream that emits `done:true` and is then immediately
    // cancelled. We expect exactly one finalize.
    const finalize = vi.fn();
    const inner = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.close();
      },
    });
    const wrapped = wrapReadableStreamWithFinalize(inner, finalize);

    const reader = wrapped.getReader();
    await reader.read(); // done
    await reader.cancel("ignore me");
    expect(finalize).toHaveBeenCalledTimes(1);
  });

  it("swallows errors thrown by finalize so the consumer stream is not broken", async () => {
    const wrapped = wrapReadableStreamWithFinalize(
      streamFrom([new Uint8Array([1])]),
      () => {
        throw new Error("cleanup blew up");
      },
    );

    // Reading should succeed even though finalize() threw.
    const out = await readAll(wrapped);
    expect(out).toHaveLength(1);
  });

  it("does not double-finalize when finalize itself throws and stream closes", async () => {
    let calls = 0;
    const wrapped = wrapReadableStreamWithFinalize(
      streamFrom([new Uint8Array([1])]),
      () => {
        calls += 1;
        if (calls > 1) throw new Error("should never see two calls");
      },
    );

    await readAll(wrapped);
    expect(calls).toBe(1);
  });

  it("forwards the inner stream's cancel reason to the inner stream", async () => {
    const cancelSpy = vi.fn();
    const inner = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array([1]));
      },
      cancel(reason) {
        cancelSpy(reason);
      },
    });
    const wrapped = wrapReadableStreamWithFinalize(inner, () => {});

    const reader = wrapped.getReader();
    await reader.read();
    await reader.cancel("client gave up");
    expect(cancelSpy).toHaveBeenCalledWith("client gave up");
  });

  it("swallows errors thrown by the inner stream's cancel()", async () => {
    const wrapped = wrapReadableStreamWithFinalize(
      new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new Uint8Array([1]));
        },
        cancel() {
          throw new Error("inner cancel exploded");
        },
      }),
      () => {},
    );

    const reader = wrapped.getReader();
    await reader.read();
    // Must not throw.
    await reader.cancel("any reason");
  });

  it("works with string chunks", async () => {
    const finalize = vi.fn();
    const inner = new ReadableStream<string>({
      start(controller) {
        controller.enqueue("hello ");
        controller.enqueue("world");
        controller.close();
      },
    });
    const wrapped = wrapReadableStreamWithFinalize(inner, finalize);
    const out = await readAll(wrapped);
    expect(out.join("")).toBe("hello world");
    expect(finalize).toHaveBeenCalledTimes(1);
  });

  it("preserves chunk identity (no copy, no transform)", async () => {
    const finalize = vi.fn();
    const chunk = new Uint8Array([0xde, 0xad, 0xbe, 0xef]);
    const wrapped = wrapReadableStreamWithFinalize(streamFrom([chunk]), finalize);
    const [out] = await readAll(wrapped);
    expect(out).toBe(chunk); // exact same reference
  });

  it("does not invoke finalize before the consumer reads anything", async () => {
    const finalize = vi.fn();
    const inner = streamFrom([new Uint8Array([1]), new Uint8Array([2])]);
    const wrapped = wrapReadableStreamWithFinalize(inner, finalize);

    // Just construct the wrapper; don't read.
    expect(finalize).not.toHaveBeenCalled();
  });

  it("handles 100 sequential chunks without dropping or duplicating finalize", async () => {
    const finalize = vi.fn();
    const chunks = Array.from({ length: 100 }, (_, i) => new Uint8Array([i & 0xff]));
    const wrapped = wrapReadableStreamWithFinalize(streamFrom(chunks), finalize);

    const out = await readAll(wrapped);
    expect(out).toHaveLength(100);
    expect(out.map((c) => c[0])).toEqual(chunks.map((c) => c[0]));
    expect(finalize).toHaveBeenCalledTimes(1);
  });
});
