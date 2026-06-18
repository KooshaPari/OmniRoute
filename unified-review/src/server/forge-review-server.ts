/**
 * Standalone OmniRoute-compatible server for the "forge-review" provider.
 *
 * Run: `tsx src/server/forge-review-server.ts` (or compile + node)
 *
 * This server speaks OpenAI Chat Completions v1 protocol on /v1/chat/completions
 * and /health, and dispatches to the local `forge` CLI for actual review work.
 *
 * Configure OmniRoute to point at this server via:
 *   OMNIROUTE_FORGE_REVIEW_URL=http://localhost:9090/v1/chat/completions
 */
import { createServer, IncomingMessage, ServerResponse } from "http";
import { spawn } from "child_process";
import { z } from "zod";
import pino from "pino";

const logger = pino({ name: "forge-review-server" });
const PORT = parseInt(process.env.PORT || "9090", 10);
const HOST = process.env.HOST || "0.0.0.0";

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
  temperature: z.number().default(0.2),
  max_tokens: z.number().default(4000),
  stream: z.boolean().default(false),
});

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (c) => (body += c.toString()));
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

function send(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

function runForge(prompt: string, timeoutMs: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const cli = process.env.FORGE_CLI_PATH || "forge";
    const child = spawn(cli, ["--json", "--no-tui", "-p", prompt], {
      cwd: process.env.FORGE_CWD || process.cwd(),
      env: { ...process.env, FORCE_COLOR: "0" },
    });
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`forge timed out after ${timeoutMs}ms`));
    }, timeoutMs);
    let out = "";
    let err = "";
    child.stdout.on("data", (b) => (out += b.toString()));
    child.stderr.on("data", (b) => (err += b.toString()));
    child.on("error", (e) => { clearTimeout(timer); reject(e); });
    child.on("exit", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve(out);
      else reject(new Error(`forge exited ${code}: ${err.slice(0, 500)}`));
    });
  });
}

function extractJson(text: string) {
  try { return JSON.parse(text); } catch { /* fall through */ }
  const fence = text.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
  if (fence) { try { return JSON.parse(fence[1]); } catch { /* fall through */ } }
  const obj = text.match(/\{[\s\S]*\}/);
  if (obj) { try { return JSON.parse(obj[0]); } catch { /* fall through */ } }
  return { findings: [], summary: text.slice(0, 500) };
}

async function handleChatCompletions(req: IncomingMessage, res: ServerResponse) {
  const raw = await readBody(req);
  let body: unknown;
  try { body = JSON.parse(raw); }
  catch { return send(res, 400, { error: "invalid json" }); }

  const parsed = ChatRequestSchema.safeParse(body);
  if (!parsed.success) return send(res, 400, { error: "invalid", details: parsed.error.flatten() });
  const { model, messages, pr_context, temperature, max_tokens } = parsed.data;

  const system = messages.find((m) => m.role === "system")?.content || "";
  const userMsg = messages.filter((m) => m.role === "user").pop()?.content || "";
  const diff = pr_context?.diff || userMsg;
  const prompt = `${system}\n\n${userMsg}\n\nDiff:\n\`\`\`diff\n${(diff || "").slice(0, 80000)}\n\`\`\`\n\nOutput JSON: { findings: [...], summary: "..." }`;

  logger.info({ model, pr: pr_context?.pull_number }, "forge-review dispatch");
  try {
    const out = await runForge(prompt, 110_000);
    const result = extractJson(out);
    return send(res, 200, {
      id: `chatcmpl-forge-${Date.now()}`,
      object: "chat.completion",
      created: Math.floor(Date.now() / 1000),
      model,
      choices: [
        {
          index: 0,
          message: { role: "assistant", content: JSON.stringify(result) },
          finish_reason: "stop",
        },
      ],
      usage: {
        prompt_tokens: Math.floor(prompt.length / 4),
        completion_tokens: Math.floor((out?.length || 0) / 4),
        total_tokens: Math.floor((prompt.length + (out?.length || 0)) / 4),
      },
    });
  } catch (err) {
    logger.error({ err }, "forge failed");
    return send(res, 502, { error: "forge failed", message: String(err) });
  }
}

const server = createServer(async (req, res) => {
  // CORS for OmniRoute cross-origin
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Provider");
  if (req.method === "OPTIONS") { res.writeHead(204); return res.end(); }

  const url = new URL(req.url || "/", `http://${req.headers.host}`);

  if (url.pathname === "/health") {
    return send(res, 200, { ok: true, provider: "forge-review", pid: process.pid });
  }
  if (url.pathname === "/v1/models") {
    return send(res, 200, {
      object: "list",
      data: [{ id: "forge-code-review", object: "model", owned_by: "unified-review" }],
    });
  }
  if (url.pathname === "/v1/chat/completions" && req.method === "POST") {
    return handleChatCompletions(req, res);
  }
  return send(res, 404, { error: "not found" });
});

server.listen(PORT, HOST, () => {
  logger.info({ port: PORT, host: HOST }, "forge-review server listening");
});
