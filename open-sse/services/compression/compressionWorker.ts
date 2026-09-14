import { parentPort } from "node:worker_threads";
import {
  applyCompression,
  applyStackedCompression,
  type StackedCompressionStep,
} from "./strategySelector.ts";
import type {
  CompressionWorkerJob,
  CompressionWorkerMessage,
} from "./compressionWorkerProtocol.ts";

if (!parentPort) throw new Error("compressionWorker must run in a worker thread");
parentPort.on("message", (job: CompressionWorkerJob) => {
  try {
    const onEngineStep = (step: StackedCompressionStep) =>
      parentPort.postMessage({
        id: job.id,
        type: "step",
        step,
      } satisfies CompressionWorkerMessage);
    const result =
      job.mode === "stacked"
        ? applyStackedCompression(job.body, job.options?.config?.stackedPipeline, {
            ...job.options,
            onEngineStep,
          })
        : applyCompression(job.body, job.mode, job.options);
    parentPort.postMessage({
      id: job.id,
      type: "result",
      result,
    } satisfies CompressionWorkerMessage);
  } catch (error) {
    parentPort.postMessage({
      id: job.id,
      type: "error",
      error: error instanceof Error ? error.message : String(error),
    } satisfies CompressionWorkerMessage);
  }
});
