import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";

/** Create a filesystem-backed logger for Responses API stream diagnostics. */
export function createResponsesLogger(model, logsDir = null) {
  if (fs.mkdirSync === undefined) {
    return null;
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "").slice(0, 15);
  const uniqueId = crypto.randomBytes(4).toString("hex");
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
