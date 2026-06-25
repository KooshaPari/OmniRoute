/**
 * Wrap a ReadableStream so that a finalize callback is invoked exactly once,
 * regardless of how the stream terminates (clean close, error, or cancel).
 *
 * The wrapper is fully backpressure-aware: it forwards the inner stream's
 * backpressure by awaiting `reader.read()` before calling `controller.enqueue()`,
 * and it preserves the standard `ReadableStream` contract (controller.enqueue,
 * controller.close, controller.error, cancel).
 *
 * Why this exists:
 *
 * chatCore has multiple call sites that need to release semaphores, close
 * upstream connections, or mark accounting buckets as "done" when a stream
 * reaches its terminal state.  Without a helper, every call site has to
 * reimplement the same dance: track a `finalized` flag, gate the callback
 * behind it, hook into the read loop AND the cancel path AND the error path.
 * That dance is easy to get subtly wrong (e.g. double-finalize under back
 * pressure, or a missed finalize on `controller.error()`).
 *
 * Behavior contract:
 *
 *   1. `finalize` runs at most once.
 *   2. `finalize` runs when:
 *      - The inner stream closes cleanly (`done === true`).
 *      - The inner stream errors (during `read()`).
 *      - The consumer cancels the wrapper (via `stream.cancel(reason)`).
 *   3. If `finalize` itself throws, the throw is silently swallowed -- the
 *      consumer's stream must never be broken by cleanup bookkeeping.
 *   4. The wrapper never re-emits the inner stream's `cancel(reason)`; the
 *      inner cancel is best-effort and any error is swallowed.
 *   5. The wrapper is generic over the chunk type `T` and works with both
 *      binary (`Uint8Array`) and string streams.
 *
 * @example
 *   const wrapped = wrapReadableStreamWithFinalize(response.body, () => {
 *     releaseSemaphore();
 *   });
 *   // Even if the consumer aborts mid-stream, releaseSemaphore() runs exactly
 *   // once.
 */
export function wrapReadableStreamWithFinalize<T>(
  readable: ReadableStream<T>,
  finalize: () => void,
): ReadableStream<T> {
  const reader = readable.getReader();
  let finalized = false;

  const runFinalize = (): void => {
    if (finalized) return;
    finalized = true;
    try {
      finalize();
    } catch {
      // Swallowed: cleanup bookkeeping must never break the consumer's stream.
    }
  };

  return new ReadableStream<T>({
    async pull(controller): Promise<void> {
      try {
        const { done, value } = await reader.read();
        if (done) {
          runFinalize();
          controller.close();
          return;
        }
        controller.enqueue(value);
      } catch (error) {
        runFinalize();
        controller.error(error);
      }
    },

    async cancel(reason): Promise<void> {
      runFinalize();
      try {
        await reader.cancel(reason);
      } catch {
        // Swallowed: best-effort inner cancel.
      }
    },
  });
}
