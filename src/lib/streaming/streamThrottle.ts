/**
 * streamThrottle.ts — PR-038
 *
 * Backpressure detection and throttling helper for SSE / chat-completion
 * streams.  Monitors enqueue latency and downstream consumer behaviour to
 * decide whether the producer should slow down.
 *
 * Usage:
 *   const throttle = new StreamThrottle({ highWaterMark: 16, windowMs: 1000 });
 *   if (throttle.shouldThrottle(chunkByteLength)) {
 *     await throttle.wait();
 *   }
 */

export interface StreamThrottleOptions {
  /** Max number of pending chunks before backpressure kicks in (default 16). */
  highWaterMark?: number;
  /** Sliding-window duration in ms (default 1000). */
  windowMs?: number;
  /** Ratio of slow-to-total enqueues that triggers throttle state (default 0.5). */
  throttleRatio?: number;
}

export interface ThrottleSnapshot {
  pendingCount: number;
  avgEnqueueMs: number;
  isThrottled: boolean;
  totalChunks: number;
  slowEnqueues: number;
}

class RollingWindow {
  private readonly samples: number[] = [];
  private idx = 0;
  constructor(private readonly size: number) {}

  push(val: number): void {
    if (this.samples.length < this.size) {
      this.samples.push(val);
    } else {
      this.samples[this.idx % this.size] = val;
    }
    this.idx++;
  }

  avg(): number {
    if (this.samples.length === 0) return 0;
    return this.samples.reduce((a, b) => a + b, 0) / this.samples.length;
  }

  get length(): number {
    return this.samples.length;
  }
}

export const DEFAULT_HIGH_WATER_MARK = 16;
export const DEFAULT_WINDOW_MS = 1000;
export const DEFAULT_THROTTLE_RATIO = 0.5;

export class StreamThrottle {
  private readonly highWaterMark: number;
  private readonly windowMs: number;
  private readonly throttleRatio: number;
  private readonly enqueueTimes: RollingWindow;

  private _pendingCount = 0;
  private _totalChunks = 0;
  private _slowEnqueues = 0;
  private _isThrottled = false;

  constructor(opts: StreamThrottleOptions = {}) {
    this.highWaterMark = opts.highWaterMark ?? DEFAULT_HIGH_WATER_MARK;
    this.windowMs = opts.windowMs ?? DEFAULT_WINDOW_MS;
    this.throttleRatio = opts.throttleRatio ?? DEFAULT_THROTTLE_RATIO;
    this.enqueueTimes = new RollingWindow(64);
  }

  /** Call when a chunk is enqueued into the downstream writable. */
  recordEnqueue(durationMs: number): void {
    this._totalChunks++;
    this.enqueueTimes.push(durationMs);

    if (durationMs > 5) {
      this._slowEnqueues++;
    }

    const ratio = this._totalChunks > 0 ? this._slowEnqueues / this._totalChunks : 0;
    this._isThrottled =
      this._pendingCount >= this.highWaterMark || ratio >= this.throttleRatio;
  }

  /** Call when a chunk is consumed from downstream. */
  recordDequeue(): void {
    if (this._pendingCount > 0) this._pendingCount--;
    // Re-evaluate throttle state
    const ratio = this._totalChunks > 0 ? this._slowEnqueues / this._totalChunks : 0;
    this._isThrottled =
      this._pendingCount >= this.highWaterMark || ratio >= this.throttleRatio;
  }

  /** Returns true if the producer should wait before sending more data. */
  shouldThrottle(chunkByteLength = 0): boolean {
    if (chunkByteLength > 0) {
      this._pendingCount++;
      const ratio = this._totalChunks > 0 ? this._slowEnqueues / this._totalChunks : 0;
      this._isThrottled =
        this._pendingCount >= this.highWaterMark || ratio >= this.throttleRatio;
    }
    return this._isThrottled;
  }

  /**
   * Wait until backpressure subsides or timeout elapses.
   * Returns true if we waited (caller may skip chunk), false if we timed out.
   */
  wait(timeoutMs = 500): Promise<boolean> {
    if (!this._isThrottled) return Promise.resolve(false);
    return new Promise((resolve) => {
      const start = performance.now();
      const check = () => {
        const ratio =
          this._totalChunks > 0 ? this._slowEnqueues / this._totalChunks : 0;
        this._isThrottled =
          this._pendingCount >= this.highWaterMark || ratio >= this.throttleRatio;

        if (!this._isThrottled || performance.now() - start >= timeoutMs) {
          resolve(this._isThrottled);
          return;
        }
        setImmediate(check);
      };
      check();
    });
  }

  /** Reset all counters. */
  reset(): void {
    this._pendingCount = 0;
    this._totalChunks = 0;
    this._slowEnqueues = 0;
    this._isThrottled = false;
  }

  /** Snapshot of current throttle state for observability. */
  snapshot(): ThrottleSnapshot {
    return {
      pendingCount: this._pendingCount,
      avgEnqueueMs: this.enqueueTimes.avg(),
      isThrottled: this._isThrottled,
      totalChunks: this._totalChunks,
      slowEnqueues: this._slowEnqueues,
    };
  }
}
