import type { Worker } from "node:worker_threads";

type WorkerReadinessEvents = Pick<Worker, "on" | "once" | "removeListener">;

export function waitForMitmWorkerReady(
  worker: WorkerReadinessEvents,
  timeoutMs = 10_000
): Promise<number> {
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      clearTimeout(timeout);
      worker.removeListener("message", onMessage);
      worker.removeListener("error", onError);
      worker.removeListener("exit", onExit);
    };
    const settleError = (error: Error) => {
      cleanup();
      reject(error);
    };
    const onMessage = (message: unknown) => {
      if (typeof message !== "object" || message === null || !("port" in message)) return;
      const port = Number((message as { port: unknown }).port);
      if (!Number.isInteger(port) || port <= 0 || port > 65_535) return;
      cleanup();
      resolve(port);
    };
    const onError = (error: Error) => settleError(error);
    const onExit = (code: number) =>
      settleError(new Error(`MITM worker exited before startup (code ${code})`));
    const timeout = setTimeout(
      () => settleError(new Error(`MITM worker did not report readiness within ${timeoutMs}ms`)),
      timeoutMs
    );

    worker.on("message", onMessage);
    worker.once("error", onError);
    worker.once("exit", onExit);
  });
}
