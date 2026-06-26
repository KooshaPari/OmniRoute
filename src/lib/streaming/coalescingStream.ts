/**
 * coalescingStream.ts — PR-038
 *
 * A TransformStream that batches small data chunks emitted within a configurable
 * time window (default 50 ms) into a single coalesced chunk.  This reduces the
 * number of SSE events sent to the client when the upstream produces many tiny
 * fragments, improving wire efficiency and reducing client-side DOM churn.
 *
 * The stream flushes its buffer whenever:
 *   1. The time window expires (a pending timer fires).
 *   2. A chunk larger than `maxBatchBytes` arrives (pass-through).
 *   3. The input stream closes (flush remainder).
 */

export interface CoalescingStreamOptions {
  /** Coalescing window in milliseconds (default 50). */
  windowMs?: number;
  /** Maximum combined byte size for a batch before forced flush (default 4096). */
  maxBatchBytes?: number;
}

const DEFAULT_WINDOW_MS = 50;
const DEFAULT_MAX_BATCH_BYTES = 4096;
const textEncoder = new TextEncoder();

export function createCoalescingStream(
  opts: CoalescingStreamOptions = {}
): TransformStream<Uint8Array, Uint8Array> {
  const windowMs = opts.windowMs ?? DEFAULT_WINDOW_MS;
  const maxBatchBytes = opts.maxBatchBytes ?? DEFAULT_MAX_BATCH_BYTES;

  let buffer: Uint8Array[] = [];
  let bufferSize = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let controller: TransformStreamDefaultController<Uint8Array> | null = null;
  let streamClosed = false;

  function flush() {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
    if (buffer.length === 0 || !controller) return;

    const combined = new Uint8Array(bufferSize);
    let offset = 0;
    for (const chunk of buffer) {
      combined.set(chunk, offset);
      offset += chunk.length;
    }
    controller.enqueue(combined);
    buffer = [];
    bufferSize = 0;
  }

  function scheduleFlush() {
    if (timer !== null || streamClosed) return;
    timer = setTimeout(() => {
      timer = null;
      flush();
    }, windowMs);
    // Allow pending microtasks to clear the timer if the stream closes
    if (timer && typeof (timer as any).unref === "function") {
      (timer as any).unref();
    }
  }

  return new TransformStream({
    start(ctrl) {
      controller = ctrl;
    },
    transform(chunk: Uint8Array, ctrl) {
      controller = ctrl;

      // Oversized chunk — flush existing buffer first, then pass through
      if (chunk.length >= maxBatchBytes) {
        flush();
        ctrl.enqueue(chunk);
        return;
      }

      buffer.push(chunk);
      bufferSize += chunk.length;

      if (bufferSize >= maxBatchBytes) {
        flush();
      } else if (buffer.length === 1) {
        // First chunk in a new window — start the timer
        scheduleFlush();
      }
    },
    flush(ctrl) {
      streamClosed = true;
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
      flush();
    },
  } as any);
}
