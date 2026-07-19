import * as fs from "fs";
import * as path from "path";

/** Create a filesystem-backed logger for Responses API stream diagnostics. */
export function createResponsesLogger(model, logsDir = null) {
  if (typeof fs.mkdirSync !== "function") {
    return null;
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "").slice(0, 15);
  const uniqueId = Math.random().toString(36).slice(2, 8);
  const baseDir =
    logsDir || (typeof globalThis.process !== "undefined" ? globalThis.process.cwd() : ".");
  const logDir = path.join(baseDir, "logs", `responses_${model}_${timestamp}_${uniqueId}`);

  try {
    fs.mkdirSync(logDir, { recursive: true });
  } catch {
    return null;
  }

  const inputEvents = [];
  const outputEvents = [];

  return {
    logInput: (event) => {
      inputEvents.push(event);
    },
    logOutput: (event) => {
      outputEvents.push(event);
    },
    flush: () => {
      try {
        fs.writeFileSync(path.join(logDir, "1_input_stream.txt"), inputEvents.join("\n"));
        fs.writeFileSync(path.join(logDir, "2_output_stream.txt"), outputEvents.join("\n"));
      } catch (error) {
        globalThis.console.log("[RESPONSES] Failed to write logs:", error.message);
      }
    },
  };
}
