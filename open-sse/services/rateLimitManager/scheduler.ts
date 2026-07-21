import Bottleneck from "bottleneck";

type ScheduleOptions = { expiration?: number };

/** Schedule a request while allowing an AbortSignal to cancel queued work. */
export async function scheduleWithAbort<T>(
  limiter: Bottleneck,
  scheduleOpts: ScheduleOptions,
  fn: () => T | Promise<T>,
  signal: AbortSignal | null,
): Promise<T> {
  if (!signal) return limiter.schedule(scheduleOpts, () => Promise.resolve(fn()));

  let abortListener: (() => void) | undefined;
  const abortPromise = new Promise<never>((_, reject) => {
    const onAbort = () => {
      const reason = signal.reason;
      let err: Error;
      if (reason instanceof Error) {
        err = reason;
      } else if (typeof reason === "string") {
        err = new Error(reason);
      } else {
        err = new Error("The operation was aborted");
      }
      err.name = "AbortError";
      reject(err);
    };
    if (signal.aborted) {
      onAbort();
      return;
    }
    abortListener = onAbort;
    signal.addEventListener("abort", abortListener, { once: true });
  });

  try {
    return await Promise.race([
      limiter.schedule(scheduleOpts, () => Promise.resolve(fn())),
      abortPromise,
    ]);
  } finally {
    if (abortListener) signal.removeEventListener("abort", abortListener);
  }
}
