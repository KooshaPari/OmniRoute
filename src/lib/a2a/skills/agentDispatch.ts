/**
 * Agent Dispatch A2A Skill
 * Dispatches coding tasks to the substrate engine (forge or other drivers).
 */

import * as childProcess from "node:child_process";
import { z } from "zod";
import { sanitizeErrorMessage } from "@omniroute/open-sse/utils/sanitizeMessage";
import type { A2ATask, TaskArtifact } from "../taskManager";

const AgentDispatchParamsSchema = z.object({
  cwd: z.string().optional().default(process.cwd()),
  engine: z.enum(["forge", "codex", "claude"]).optional().default("forge"),
  timeout: z.number().int().positive().optional().default(300_000),
});

type AgentDispatchParams = z.infer<typeof AgentDispatchParamsSchema>;

export interface AgentDispatchResult {
  artifacts: TaskArtifact[];
  metadata: Record<string, unknown>;
}

function parseDispatchParams(metadata?: Record<string, unknown>): AgentDispatchParams {
  return AgentDispatchParamsSchema.parse(metadata || {});
}

function resolveSubstrateSpawn(substrateBin: string, args: string[]) {
  if (substrateBin.endsWith(".mjs") || substrateBin.endsWith(".js")) {
    return {
      command: process.execPath,
      args: [substrateBin, ...args],
    };
  }

  if (substrateBin === "cargo") {
    return {
      command: substrateBin,
      args: ["run", "-q", "-p", "driver-cli", "--", ...args],
    };
  }

  return { command: substrateBin, args };
}

function invokeSubstrate(
  args: string[],
  timeout: number,
  cwd: string
): Promise<{
  success: boolean;
  stdout: string;
  stderr: string;
  exitCode: number;
}> {
  return new Promise((resolve) => {
    const substrateBin = process.env.SUBSTRATE_BIN || "cargo";
    const { command, args: spawnArgs } = resolveSubstrateSpawn(substrateBin, args);

    const proc = childProcess.spawn(command, spawnArgs, {
      cwd,
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    let settled = false;

    const finish = (result: {
      success: boolean;
      stdout: string;
      stderr: string;
      exitCode: number;
    }) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutHandle);
      resolve(result);
    };

    proc.stdout?.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    proc.stderr?.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    const timeoutHandle = setTimeout(() => {
      proc.kill();
      finish({
        success: false,
        stdout,
        stderr: `Timeout after ${timeout}ms`,
        exitCode: 124,
      });
    }, timeout + 1000);

    proc.on("close", (code) => {
      finish({
        success: (code || 0) === 0,
        stdout,
        stderr,
        exitCode: code || 0,
      });
    });

    proc.on("error", (err) => {
      finish({
        success: false,
        stdout,
        stderr: err.message,
        exitCode: 1,
      });
    });
  });
}

function errorResult(message: string, exitCode?: number): AgentDispatchResult {
  const safeMessage = sanitizeErrorMessage(message);
  return {
    artifacts: [{ type: "error", content: safeMessage }],
    metadata: {
      error: safeMessage,
      success: false,
      ...(exitCode !== undefined ? { exitCode } : {}),
    },
  };
}

export async function executeAgentDispatch(task: A2ATask): Promise<AgentDispatchResult> {
  let params: AgentDispatchParams;
  try {
    params = parseDispatchParams(task.input.metadata);
  } catch (err) {
    const message =
      err instanceof z.ZodError
        ? `Invalid dispatch parameters: ${err.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ")}`
        : err instanceof Error
          ? err.message
          : String(err);
    return errorResult(message);
  }

  const prompt = task.input.messages
    .filter((message) => message.role === "user")
    .map((message) => message.content)
    .join("\n");

  if (!prompt.trim()) {
    return errorResult("No user message content to dispatch");
  }

  const args = ["dispatch", `--engine=${params.engine}`, `--cwd=${params.cwd}`, "--", prompt];
  const result = await invokeSubstrate(args, params.timeout, params.cwd);

  if (!result.success) {
    const errorMsg =
      result.stderr || result.stdout || `Process exited with code ${result.exitCode}`;
    return errorResult(errorMsg, result.exitCode);
  }

  let parsedResult: unknown;
  try {
    parsedResult = JSON.parse(result.stdout);
  } catch {
    parsedResult = result.stdout;
  }

  const content =
    typeof parsedResult === "string" ? parsedResult : JSON.stringify(parsedResult, null, 2);

  return {
    artifacts: [
      {
        type: typeof parsedResult === "object" && parsedResult !== null ? "json" : "text",
        content,
      },
    ],
    metadata: {
      engine: params.engine,
      cwd: params.cwd,
      success: true,
      exitCode: result.exitCode,
    },
  };
}
