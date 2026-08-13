/**
 * KimiWebExecutor — Moonshot AI Chat via www.kimi.com (international)
 *
 * Routes requests through Kimi's consumer chat API on the international domain.
 * Originally this executor targeted `kimi.moonshot.cn` (mainland-CN consumer
 * chat). That domain now redirects every visitor outside CN to
 * `https://www.kimi.com/`, which speaks a completely different API surface:
 *
 *   - Endpoint:  POST /apiv2/kimi.gateway.chat.v1.ChatService/Chat
 *   - Protocol:  Connect-RPC (unary envelope framing — 5-byte header + JSON)
 *   - Auth:      `Authorization: Bearer <JWT>` + `Cookie: kimi-auth=<JWT>`
 *   - Body:      Connect-framed `{scenario, message:{role,blocks:[{text:{content}}]},
 *                options:{thinking,enable_plugin}}`
 *   - Response:  Connect-framed stream of events carrying deltas with one of
 *                `mask: "block.text.content"` (answer) or
 *                `mask: "block.think.content"` (reasoning), emitted via
 *                `op: "set"` (initial) and `op: "append"` (incremental).
 *
 * Cookie handling: the user pastes their full Cookie header from www.kimi.com.
 * We extract the `kimi-auth` JWT from it (it is the only cookie the upstream
 * actually consults) and use it both as the Bearer token and as the Cookie we
 * send back, so we don't leak the user's analytics cookies (Ga, CF, HM, ...).
 *
 * The `x-msh-*` / `x-traffic-id` / `x-msh-shield-data` headers the SPA sends
 * are NOT required — verified by stripping them one at a time against a live
 * session; the upstream returns the same response either way.
 */
import { BaseExecutor, type ExecuteInput } from "./base.ts";
import {
  makeExecutorErrorResult as makeErrorResult,
  sanitizeErrorMessage,
} from "../utils/error.ts";
import { extractKimiJwt } from "@/lib/providers/webCookieAuth";

export { extractKimiJwt };

const BASE_URL = "https://www.kimi.com";
const CHAT_URL = `${BASE_URL}/apiv2/kimi.gateway.chat.v1.ChatService/Chat`;
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36";

export class KimiWebExecutor extends BaseExecutor {
  constructor() {
    super("kimi-web", { id: "kimi-web", baseUrl: BASE_URL });
  }

  private buildKimiHeaders(jwt: string): Record<string, string> {
    const headers: Record<string, string> = {
      "Content-Type": "application/connect+json",
      Accept: "*/*",
      "User-Agent": USER_AGENT,
      Origin: BASE_URL,
      Referer: `${BASE_URL}/`,
      "connect-protocol-version": "1",
    };
    if (jwt) {
      headers["Authorization"] = `Bearer ${jwt}`;
      headers["Cookie"] = `kimi-auth=${jwt}`;
    }
    return headers;
  }

  private buildRequestBody(prompt: string, wantThinking: boolean): string {
    return JSON.stringify({
      scenario: DEFAULT_SCENARIO,
      tools: [{ type: "TOOL_TYPE_SEARCH", search: {} }, { type: "TOOL_TYPE_CRON_JOB" }],
      message: {
        role: "user",
        blocks: [{ message_id: "", text: { content: prompt } }],
        scenario: DEFAULT_SCENARIO,
      },
      options: { thinking: wantThinking, enable_plugin: true },
    });
  }

  async execute(input: ExecuteInput) {
    const { body, credentials, signal, stream: wantStream } = input;
    const bodyObj = (body || {}) as Record<string, unknown>;

    const rawCredential = String(credentials?.apiKey ?? "").trim();
    const jwt = extractKimiJwt(rawCredential);
    if (!jwt) {
      return makeErrorResult(
        400,
        "Missing Kimi session — paste the full Cookie header from www.kimi.com (must contain kimi-auth=<JWT>) or just the JWT itself.",
        body,
        CHAT_URL
      );
    }

    const messages = (bodyObj.messages as Array<{ role: string; content: unknown }>) || [];
    const modelId = (bodyObj.model as string) || "kimi-default";
    // Decide thinking intent. A user sending `reasoning_effort: "none"` is
    // explicit — honour it even when the model id suggests a thinking variant.
    // Otherwise thinking models (kimi-k2.6 etc.) default to thinking on.
    const modelWantsThinking = /k2\.6|k2-6|think/i.test(modelId);
    const wantThinking = bodyObj.reasoning_effort === "none" ? false : modelWantsThinking;

    const prompt = foldMessages(messages);
    const reqBody = this.buildRequestBody(prompt, wantThinking);
    const reqHeaders = this.buildKimiHeaders(jwt);

    // Connect framing wraps the JSON body in a 5-byte envelope. Without it the
    // upstream returns `invalid_argument` for every request.
    const framedBody = frameConnectMessage(reqBody);

    let upstream: Response;
    try {
      upstream = await fetch(CHAT_URL, {
        method: "POST",
        headers: reqHeaders,
        body: new Uint8Array(framedBody),
        signal,
      });
    } catch (err) {
      return makeErrorResult(
        502,
        `Kimi fetch failed: ${err instanceof Error ? err.message : "unknown"}`,
        body,
        CHAT_URL
      );
    }

    if (!upstream.ok) {
      const errText = await upstream.text().catch(() => "");
      return makeErrorResult(
        upstream.status,
        `Kimi error: ${sanitizeErrorMessage(errText)}`,
        body,
        CHAT_URL
      );
    }

    const encoder = new TextEncoder();
    const id = `chatcmpl-kimi-${Date.now()}`;
    const created = Math.floor(Date.now() / 1000);

    const emitChunk = (
      controller: ReadableStreamDefaultController,
      delta: Record<string, unknown>,
      finish: string | null = null
    ) => {
      const chunk = {
        id,
        object: "chat.completion.chunk",
        created,
        model: modelId,
        choices: [{ index: 0, delta, finish_reason: finish }],
      };
      controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
    };

    // The upstream is a Connect-framed stream regardless of whether the
    // client asked for SSE — Kimi always streams. For non-streaming clients
    // we buffer the full response below.
    const sourceStream = upstream.body ?? new ReadableStream({ start: (c) => c.close() });

    if (wantStream) {
      const outStream = new ReadableStream({
        async start(controller) {
          const reader = sourceStream.getReader();
          let buffer = new Uint8Array(0);
          let emittedRole = false;
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              if (value) {
                const merged = new Uint8Array(buffer.length + value.length);
                merged.set(buffer, 0);
                merged.set(value, buffer.length);
                buffer = merged;

                let offset = 0;
                while (offset < buffer.length) {
                  const { consumed, frame } = decodeConnectFrame(buffer, offset);
                  if (consumed === -1) {
                    // Frame header claims a length above MAX_FRAME_LEN — stream-fatal.
                    controller.error(new Error("Kimi Connect frame exceeded MAX_FRAME_LEN"));
                    return;
                  }
                  if (consumed === 0) break; // need more bytes
                  offset += consumed;
                  if (!frame?.message) continue;

                  const delta = extractDelta(frame.message);
                  if (delta) {
                    if (!emittedRole) {
                      emittedRole = true;
                      emitChunk(controller, { role: "assistant", content: "" });
                    }
                    if (delta.kind === "think") {
                      emitChunk(controller, { reasoning_content: delta.text });
                    } else {
                      emitChunk(controller, { content: delta.text });
                    }
                  }
                  if (isEndOfStream(frame.message)) {
                    emitChunk(controller, {}, "stop");
                    controller.enqueue(encoder.encode("data: [DONE]\n\n"));
                    controller.close();
                    return;
                  }
                }
                // Compact the buffer.
                buffer = buffer.subarray(offset);
              }
            }
            // Stream ended without an explicit COMPLETED marker — flush a stop.
            if (!emittedRole) {
              emitChunk(controller, { role: "assistant", content: "" });
            }
            emitChunk(controller, {}, "stop");
            controller.enqueue(encoder.encode("data: [DONE]\n\n"));
            controller.close();
          } catch (err) {
            if (!signal?.aborted) {
              try {
                controller.error(err);
              } catch {
                /* controller already closed */
              }
            }
          }
        },
      });

      return {
        response: new Response(outStream, {
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
          },
        }),
        url: CHAT_URL,
        headers: reqHeaders,
        transformedBody: JSON.parse(reqBody),
      };
    }

    // Non-streaming: collect all Connect-frame deltas into one completion.
    let answer = "";
    let reasoning = "";
    const reader = sourceStream.getReader();
    let buffer = new Uint8Array(0);
    let sawSuccessfulEndStream = false;
    try {
      readLoop: while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (!value) continue;
        const merged = new Uint8Array(buffer.length + value.length);
        merged.set(buffer, 0);
        merged.set(value, buffer.length);
        buffer = merged;

        let offset = 0;
        while (offset < buffer.length) {
          const { consumed, frame } = decodeConnectFrame(buffer, offset);
          if (consumed === -1) throw new Error("Kimi Connect frame exceeded MAX_FRAME_LEN");
          if (consumed === 0) break;
          offset += consumed;
          if (!frame) continue;
          if ((frame.flags & 0x02) !== 0) {
            const endStreamError = getConnectEndStreamError(frame);
            if (endStreamError) throw new Error(`Kimi Connect EndStream error: ${endStreamError}`);
            sawSuccessfulEndStream = true;
            break readLoop;
          }
          if (!frame.message) continue;
          const delta = extractDelta(frame.message);
          if (delta) {
            if (delta.kind === "think") reasoning += delta.text;
            else answer += delta.text;
          }
        }
        buffer = buffer.subarray(offset);
      }
      if (!sawSuccessfulEndStream) {
        throw new Error("Kimi Connect stream ended without a successful EndStream frame");
      }
    } catch (error) {
      return makeErrorResult(
        502,
        `Kimi Connect protocol error: ${error instanceof Error ? error.message : "unknown"}`,
        body,
        CHAT_URL
      );
    }

    const message: Record<string, unknown> = { role: "assistant", content: answer };
    if (reasoning) message.reasoning_content = reasoning;
    const completion = {
      id,
      object: "chat.completion",
      created,
      model: modelId,
      choices: [{ index: 0, message, finish_reason: "stop" }],
    };
    return {
      response: new Response(JSON.stringify(completion), {
        headers: { "Content-Type": "application/json" },
      }),
      url: CHAT_URL,
      headers: reqHeaders,
      transformedBody: JSON.parse(reqBody),
    };
  }
}
