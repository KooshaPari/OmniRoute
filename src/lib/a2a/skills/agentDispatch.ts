/**
 * Agent Dispatch A2A Skill
 *
 * Dispatches coding tasks to external agent CLIs (forge, codex, claude).
 * The skill spawns the specified CLI binary with the user's prompt and
 * captures the result. This is a fire-and-execute dispatch — the skill
 * returns once the CLI exits (or the timeout fires). Long-running agents
 * should use an appropriate timeout.
 *
 * Available engines and their invocation convention:
 *   - forge: forge "<prompt>"
 *   - codex: codex "<prompt>"          (also accepts pipe/stdin)
 *   - claude: claude -p "<prompt>"     (-p flag for one-off prompts)
 *
 * The engine binary is resolved from:
 *   1. The environment variable (e.g. FORGE_BIN, CODEX_BIN, CLAUDE_BIN)
 *   2. The system PATH via the binary name
 *
 * Inputs (via task.metadata):
 *   - engine   (optional, "forge" | "codex" | "claude", default: "forge")
 *   - cwd      (optional, string, default: process.cwd())
 *   - timeout  (optional, number ms, default: 300000)
 *
 * The dispatch prompt is taken from task.messages where role === "user".
 *
 * Output (artifacts[0].content is JSON on success, text on error):
 *   success: { success: true, engine, cwd, exitCode, stdout, stderr }
 *   error:   { error: "missing_metadata"|"invalid_input"|"dispatch_failed",
 *              message }
 *
 * Result metadata:
 *   success: true  → { success: true, engine, exitCode }
 *   success: false → { success: false, error, ... }
 */
import { spawn } from "child_process";
import { z } from "zod";
import { A2ATask } from "../taskManager";
import { A2ASkillResult } from "../taskExecution";

// ── Engine registry ──────────────────────────────────────────────────────────

interface EngineEntry {
  /** The binary name to spawn. */
  binary: string;
  /** Environment variable override for the binary path. */
  envBinKey: string;
  /**
   * Build the argument vector from the prompt.
   * Different CLIs have different conventions:
   *   - forge/codex: pass prompt as a positional argument
   *   - claude: requires -p flag for one-off prompts
   */
  buildArgs: (prompt: string) => string[];
  /** Human-readable display name. */
  displayName: string;
}

const ENGINE_REGISTRY: Record<string, EngineEntry> = {
  forge: {
    binary: "forge",
    envBinKey: "FORGE_BIN",
    displayName: "ForgeCode",
    buildArgs: (prompt) => [prompt],
  },
  codex: {
    binary: "codex",
    envBinKey: "CODEX_BIN",
    displayName: "OpenAI Codex CLI",
    buildArgs: (prompt) => [prompt],
  },
  claude: {
    binary: "claude",
    envBinKey: "CLAUDE_BIN",
    displayName: "Anthropic Claude Code CLI",
    buildArgs: (prompt) => ["-p", prompt],
  },
};

const VALID_ENGINES = new Set(Object.keys(ENGINE_REGISTRY));

// ── Zod schema ───────────────────────────────────────────────────────────────

const AgentDispatchParamsSchema = z.object({
  engine: z
    .string()
    .refine((v) => VALID_ENGINES.has(v), {
      message: `engine must be one of: ${Array.from(VALID_ENGINES).join(", ")}`,
    })
    .default("forge"),
  cwd: z.string().optional().default(process.cwd()),
  timeout: z.number().optional().default(300000), // 5 minutes default
});

type AgentDispatchParams = z.infer<typeof AgentDispatchParamsSchema>;

// ── Error sanitization ───────────────────────────────────────────────────────

/**
 * Sanitize error messages to prevent leaking stack traces and file paths.
 * Keeps the first line only, strips path-like patterns.
 */
function sanitizeErrorMessage(message: unknown): string {
  let str = typeof message === "string" ? message : String(message ?? "");
  if (str.length > 4096) str = str.slice(0, 4096);
  const nl = str.indexOf("\n");
  const firstLine = nl >= 0 ? str.slice(0, nl) : str;
  const parts = firstLine.split(/(\s+)/);
  for (let i = 0; i < parts.length; i++) {
    if (/(\/|[A-Za-z]:)[^\s]*\.(ts|tsx|js|jsx|mjs|cjs)/i.test(parts[i])) {
      parts[i] = "<path>";
    }
  }
  return parts.join("");
}

// ── Binary resolution ────────────────────────────────────────────────────────

/**
 * Resolve the engine binary path. Priority:
 * 1. Environment variable override (e.g. FORGE_BIN="/path/to/forge")
 * 2. Default binary name in the PATH
 */
function resolveBinary(engine: string): string {
  const entry = ENGINE_REGISTRY[engine];
  if (!entry) return engine;

  const envOverride = process.env[entry.envBinKey];
  if (envOverride && envOverride.trim().length > 0) {
    return envOverride.trim();
  }
  return entry.binary;
}

// ── Subprocess spawn ─────────────────────────────────────────────────────────

interface SpawnResult {
  success: boolean;
  stdout: string;
  stderr: string;
  exitCode: number;
}

/**
 * Spawn the engine binary with the prompt and capture output.
 * Uses the same pattern as cliRuntime.ts::runProcess but simplified
 * for direct prompt dispatch rather than healthchecks.
 */
function spawnEngine(
  binary: string,
  args: string[],
  cwd: string,
  timeout: number,
): Promise<SpawnResult> {
  return new Promise((resolve) => {
    // Security: reject commands with shell metacharacters
    if (/[;&|`$<>\n\r]/.test(binary)) {
      resolve({
        success: false,
        stdout: "",
        stderr: "Rejected: unsafe binary path contains shell metacharacters",
        exitCode: -1,
      });
      return;
    }

    let stdout = "";
    let stderr = "";

    const proc = spawn(binary, args, {
      cwd,
      timeout,
      stdio: ["ignore", "pipe", "pipe"],
      // Windows: .cmd/.bat wrappers need the shell; bare .exe does not.
      ...(process.platform === "win32" && /\.(cmd|bat)$/i.test(binary)
        ? { shell: true }
        : {}),
    });

    proc.stdout?.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });

    proc.stderr?.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    // Extra safety: OS-level timer in case proc doesn't respond to SIGKILL
    const killTimer = setTimeout(() => {
      proc.kill("SIGKILL");
    }, timeout + 5000);

    proc.on("close", (code) => {
      clearTimeout(killTimer);
      resolve({
        success: (code ?? 1) === 0,
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        exitCode: code ?? 1,
      });
    });

    proc.on("error", (err) => {
      clearTimeout(killTimer);
      resolve({
        success: false,
        stdout: stdout.trim(),
        stderr: `Failed to spawn ${binary}: ${err.message}`,
        exitCode: 1,
      });
    });
  });
}

// ── Metadata parsing ─────────────────────────────────────────────────────────

function parseDispatchParams(metadata?: Record<string, unknown>): AgentDispatchParams {
  try {
    return AgentDispatchParamsSchema.parse(metadata || {});
  } catch (err) {
    if (err instanceof z.ZodError) {
      throw new Error(
        `Invalid dispatch parameters: ${err.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join("; ")}`,
      );
    }
    throw err;
  }
}

// ── A2A entry point ──────────────────────────────────────────────────────────

/**
 * Execute the agent-dispatch A2A skill.
 *
 * Extracts the dispatch prompt from the last user message in the task,
 * resolves the engine binary, spawns it, and returns the captured output.
 */
export async function executeAgentDispatch(task: A2ATask): Promise<A2ASkillResult> {
  // ── Validate and parse parameters ────────────────────────────────────────
  let params: AgentDispatchParams;
  try {
    params = parseDispatchParams(task.metadata);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      artifacts: [
        {
          type: "error",
          content: sanitizeErrorMessage(message),
        },
      ],
      metadata: {
        error: sanitizeErrorMessage(message),
        success: false,
      },
    };
  }

  // ── Extract the prompt from user messages ────────────────────────────────
  const prompt = task.messages
    .filter((m) => m.role === "user")
    .map((m) => m.content)
    .join("\n")
    .trim();

  if (!prompt) {
    const errMsg = "No user message content to dispatch";
    return {
      artifacts: [
        {
          type: "error",
          content: errMsg,
        },
      ],
      metadata: {
        error: errMsg,
        success: false,
      },
    };
  }

  // ── Resolve the engine binary ────────────────────────────────────────────
  const engine = params.engine;
  const entry = ENGINE_REGISTRY[engine];
  const binary = resolveBinary(engine);
  const args = entry.buildArgs(prompt);

  // ── Spawn the engine ─────────────────────────────────────────────────────
  const result = await spawnEngine(binary, args, params.cwd, params.timeout);

  if (!result.success) {
    // Build a descriptive error message
    const parts: string[] = [];
    if (result.stderr) parts.push(result.stderr);
    if (result.exitCode !== 0) {
      parts.push(`Process exited with code ${result.exitCode}`);
    }
    // If both are empty, the binary likely wasn't found
    if (parts.length === 0) {
      parts.push(
        `${entry.displayName} (${binary}) is not installed or not found on PATH. Install it or set ${entry.envBinKey} to the full binary path.`,
      );
    }
    const errorMsg = parts.join("; ");

    return {
      artifacts: [
        {
          type: "error",
          content: sanitizeErrorMessage(errorMsg),
        },
      ],
      metadata: {
        error: sanitizeErrorMessage(errorMsg),
        success: false,
        engine,
        exitCode: result.exitCode,
      },
    };
  }

  // ── Try to parse JSON from stdout ────────────────────────────────────────
  let parsedResult: unknown;
  try {
    parsedResult = JSON.parse(result.stdout);
  } catch {
    parsedResult = result.stdout;
  }

  return {
    artifacts: [
      {
        type: typeof parsedResult === "object" ? "data" : "text",
        content:
          typeof parsedResult === "string"
            ? parsedResult
            : JSON.stringify(parsedResult, null, 2),
      },
    ],
    metadata: {
      engine,
      cwd: params.cwd,
      success: true,
      exitCode: result.exitCode,
      stdoutLength: result.stdout.length,
    },
  };
}
