/**
 * keepaliveStream.ts — PR-038
 *
 * A TransformStream that injects SSE keep-alive pings into idle streams.
 *
 * When no data has been forwarded for `intervalMs` (default 15 000 ms / 15 s)
 * a keep-alive line (`: keepalive\n\n`) is emitted to the downstream.  This
 * prevents proxies, load balancers, and client-side HTTP parsers from timing
 * out idle SSE connections — especially important for long-thinking models
 * that can take 30+ seconds before emitting their first token.
 */

export interface KeepaliveStreamOptions {
  /** Idle interval in milliseconds before a keepalive is sent (default 15_000). */
  intervalMs?: number;
  /**
   * Custom keep-alive payload.  If a string it is written as-is.
   * If a function, it is called each time the keepalive fires so the caller
   * can stamp a timestamp or sequence number.
   */
  keepaliveData?: string | (() => string);
}

const DEFAULT_INTERVAL_MS = 15_000;
const DEFAULT_KEEPALIVE_LINE = ": keepalive\n\n";
const textEncoder = new TextEncoder();

export function createKeepaliveStream(
  opts: KeepaliveStreamOptions = {}
): TransformStream<Uint8Array, Uint8Array> {
  const intervalMs = opts.intervalMs ?? DEFAULT_INTERVAL_MS;
  const getKeepalive: () => string =
    typeof opts.keepaliveData === "function"
      ? opts.keepaliveData
      : () => opts.keepaliveData ?? DEFAULT_KEEPALIVE_LINE;

  let timer: ReturnType<typeof setInterval> | null = null;
  let controller: TransformStreamDefaultController<Uint8Array> | null = null;
  let streamActive = true;

  function startTimer() {
    stopTimer();
    if (!streamActive) return;
    timer = setInterval(() => {
      if (!streamActive || !controller) return;
      try {
        controller.enqueue(textEncoder.encode(getKeepalive()));
      } catch {
        // Stream may have errored — stop sending keepalives
        stopTimer();
      }
    }, intervalMs);
    if (timer && typeof (timer as any).unref === "function") {
      (timer as any).unref();
    }
  }

  function stopTimer() {
    if (timer !== null) {
      clearInterval(timer);
      timer = null;
    }
  }

  function resetTimer() {
    // Restart the interval window each time real data passes through
    stopTimer();
    startTimer();
  }

  return new TransformStream({
    start(ctrl) {
      controller = ctrl;
      startTimer();
    },
    transform(chunk: Uint8Array, ctrl) {
      controller = ctrl;
      // Forward the chunk and bump the idle timer
      ctrl.enqueue(chunk);
      resetTimer();
    },
    flush() {
      streamActive = false;
      stopTimer();
    },
    cancel() {
      streamActive = false;
      stopTimer();
    },
  } as any);
}
