/**
 * OmniRoute-compatible /v1/chat/completions endpoint for the "forge-review" provider.
 *
 * This is what OmniRoute dispatches to when a request lands on the "forge-review" provider.
 * We exec the local `forge` CLI as a subprocess and normalize its output to OpenAI chat
 * completion format.
 *
 * Run: configured via OMNIROUTE_FORGE_REVIEW_URL env var on the OmniRoute server.
 *   e.g. OMNIROUTE_FORGE_REVIEW_URL=http://unified-review.example.com/api/forge-review
 */
import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import pino from "pino";
import { z } from "zod";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const logger = pino({ name: "unified-review:forge-review-endpoint" });

const ChatRequestSchema = z.object({
  model: z.string().default("forge-code-review"),
  messages: z
    .array(
      z.object({
        role: z.enum(["system", "user", "assistant"]),
        content: z.string(),
      }),
    )
    .min(1),
  pr_context: z
    .object({
      owner: z.string(),
      repo: z.string(),
      pull_number: z.number(),
      head_sha: z.string(),
      base_sha: z.string(),
      diff: z.string().optional(),
    })
    .optional(),
  temperature: z.number().min(0).max(2).default(0.2),
  max_tokens: z.number().int().positive().default(4000),
  stream: z.boolean().default(false),
});

/** Run forge CLI in a subprocess and capture its output */
function runForge(prompt: string, timeoutMs: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const cli = process.env.FORGE_CLI_PATH || "forge";
    const child = spawn(cli, ["--json", "--no-tui", "-p", prompt], {
      cwd: process.env.FORGE_CWD || process.cwd(),
      env: { ...process.env, FORCE_COLOR: "0" },
    });

    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`forge CLI timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (b) => (stdout += b.toString()));
    child.stderr.on("data", (b) => (stderr += b.toString()));

    child.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on("exit", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve(stdout);
      else reject(new Error(`forge exited ${code}: ${stderr.slice(0, 500)}`));
    });
  });
}

/** Try to extract JSON from a free-form LLM response */
function extractJson(text: string): { findings: Array<{ severity: string; file: string; line: number; message: string; suggestion?: string; category?: string; confidence?: string }>; summary?: string } {
  // Try direct parse
  try {
    return JSON.parse(text);
  } catch {
    // Try fenced code block
    const fence = text.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
    if (fence) {
      try { return JSON.parse(fence[1]); } catch { /* fall through */ }
    }
    // Try any object-looking region
    const obj = text.match(/\{[\s\S]*\}/);
    if (obj) {
      try { return JSON.parse(obj[0]); } catch { /* fall through */ }
    }
    return { findings: [], summary: text.slice(0, 500) };
  }
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const parsed = ChatRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid request", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { model, messages, pr_context, temperature, max_tokens, stream } = parsed.data;

  // Build a focused prompt from the messages
  const system = messages.find((m) => m.role === "system")?.content || "";
  const userMsgs = messages.filter((m) => m.role === "user");
  const userMsg = userMsgs[userMsgs.length - 1]?.content || "";

  // Pull diff from pr_context if available
  const diff = pr_context?.diff || userMsg;

  const prompt = `${system}

PR: ${pr_context?.owner ?? "?"}/${pr_context?.repo ?? "?"}#${pr_context?.pull_number ?? "?"}
Commit: ${pr_context?.head_sha ?? "?"}
Model temperature: ${temperature} | max_tokens: ${max_tokens}

${userMsg}

Diff:
\`\`\`diff
${(diff || "").slice(0, 80000)}
\`\`\`

Output a single JSON object with this exact shape:
{
  "findings": [
    {"severity":"critical|warning|info|suggestion", "category":"security|performance|maintainability|style|bug|test|documentation", "file":"<path>", "line":<int>, "message":"<one line>", "suggestion":"<optional code>"}
  ],
  "summary": "<one paragraph>"
}`;

  logger.info({ model, pr: pr_context?.pull_number, msg_count: messages.length }, "forge-review request received");

  try {
    const raw = await runForge(prompt, 110_000);
    const parsed = extractJson(raw);
    const findingsCount = parsed.findings?.length ?? 0;

    // OpenAI chat completion response shape
    return NextResponse.json({
      id: `chatcmpl-forge-${Date.now()}`,
      object: "chat.completion",
      created: Math.floor(Date.now() / 1000),
      model,
      choices: [
        {
          index: 0,
          message: {
            role: "assistant",
            content: JSON.stringify(parsed),
          },
          finish_reason: "stop",
        },
      ],
      usage: {
        prompt_tokens: prompt.length / 4, // approx
        completion_tokens: (raw?.length || 0) / 4,
        total_tokens: (prompt.length + (raw?.length || 0)) / 4,
      },
      x_finding_count: findingsCount,
    });
  } catch (err) {
    logger.error({ err }, "forge-review failed");
    return NextResponse.json(
      { error: "forge-review failed", message: String(err) },
      { status: 502 },
    );
  }
}

export async function GET() {
  return NextResponse.json({
    provider: "forge-review",
    description: "OmniRoute-compatible endpoint for local Forge code review",
    methods: ["POST"],
    schema: "openai chat.completions v1",
    required_env: ["FORGE_CLI_PATH (default: 'forge')", "FORGE_CWD (default: cwd)"],
  });
}
