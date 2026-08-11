/**
 * DoubaoWebExecutor — Dola Global web chat via dola.com.
 *
 * The provider id remains `doubao-web` for compatibility with existing saved
 * provider connections, but the global consumer service now runs through Dola.
 *
 * Endpoint: POST https://www.dola.com/chat/completion
 * Auth: Session cookies from www.dola.com
 */
import { randomUUID } from "node:crypto";
import { BaseExecutor, type ExecuteInput } from "./base.ts";
import { makeExecutorErrorResult as makeErrorResult, normalizeCookie } from "../utils/error.ts";

const BASE_URL = "https://www.dola.com";
const CHAT_URL = `${BASE_URL}/chat/completion`;
const DEFAULT_MODEL = "dola-speed";
const DOLA_BOT_ID = "7339470689562525703";
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36";

export class DoubaoWebExecutor extends BaseExecutor {
  constructor() {
    super("doubao-web", { id: "doubao-web", baseUrl: BASE_URL });
  }

  private createHeaders(cookieHeader: string): Record<string, string> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "User-Agent": USER_AGENT,
      Accept: "text/event-stream",
      Referer: `${BASE_URL}/chat/`,
      Origin: BASE_URL,
      "Agw-Js-Conv": "str",
    };
    if (cookieHeader) headers.Cookie = cookieHeader;
    return headers;
  }

  private async collectText(upstream: Response, modelId: string): Promise<string> {
    const raw = await upstream.text();
    const state = createDolaTextExtractionState(modelId);
    const deltas: string[] = [];

    for (const block of raw.split(/\r?\n\r?\n/)) {
      const event = parseSseBlock(block);
      if (event) deltas.push(...extractDolaTextDeltas(event.data, state));
    }
    deltas.push(...flushDolaTextExtractionState(state));

    return deltas.join("");
  }

  private createStream(upstream: Response, modelId: string, signal?: AbortSignal | null) {
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    const state = createDolaTextExtractionState(modelId);
    let sentDone = false;

    return new ReadableStream({
      async start(controller) {
        const reader = upstream.body?.getReader();
        if (!reader) {
          controller.close();
          return;
        }
        let buffer = "";
        let errored = false;
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";
            for (const line of lines) {
              if (!line.startsWith("data:")) continue;
              const data = line.slice(5).trim();
              if (data === "[DONE]") {
                controller.enqueue(encoder.encode("data: [DONE]\n\n"));
                continue;
              }
              try {
                const parsed = JSON.parse(data);
                const text = parsed.choices?.[0]?.delta?.content || "";
                if (text) {
                  const chunk = {
                    id: `chatcmpl-doubao-${Date.now()}`,
                    object: "chat.completion.chunk",
                    created: Math.floor(Date.now() / 1000),
                    model: modelId,
                    choices: [{ index: 0, delta: { content: text }, finish_reason: null }],
                  };
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
                }
              } catch {}
            }
          }
        } catch (err) {
          if (!signal?.aborted) {
            errored = true;
            controller.error(err);
          }
          return;
        } finally {
          if (errored) return;
          for (const text of flushDolaTextExtractionState(state)) {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify(openAiChunk(modelId, text))}\n\n`)
            );
          }
          if (!sentDone) controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        }
      },
    });
  }

  async execute(input: ExecuteInput) {
    const { body, credentials, signal, stream: wantStream } = input;
    const bodyObj = asRecord(body);
    const providerSpecificData = credentials?.providerSpecificData;
    const rawCredential = toString(credentials?.apiKey);
    const cookieHeader = buildDolaCookieHeader(rawCredential, providerSpecificData);
    const requestedModel = toString(bodyObj.model) || input.model || DEFAULT_MODEL;
    const modelId = requestedModel.split("/").pop() || DEFAULT_MODEL;
    const prompt = foldMessages(bodyObj.messages);
    const fingerprint = resolveDolaFingerprint(cookieHeader, providerSpecificData, rawCredential);
    const transformedBody = buildDolaPayload(
      prompt,
      modelId,
      cookieHeader,
      providerSpecificData,
      rawCredential
    );
    const query = buildDolaQueryParams(cookieHeader, providerSpecificData, rawCredential);
    const url = `${CHAT_URL}?${query.toString()}`;
    const reqHeaders = this.createHeaders(cookieHeader);

    if (!extractCookieValue(cookieHeader, "sessionid")) {
      return {
        ...makeErrorResult(
          401,
          "Dola Web requires a www.dola.com Cookie header containing at least sessionid, ttwid, and s_v_web_id.",
          body,
          url
        ),
        headers: reqHeaders,
        transformedBody,
      };
    }
    if (!fingerprint) {
      return {
        ...makeErrorResult(
          401,
          "Dola Web requires the browser fingerprint value from www.dola.com. Add s_v_web_id=... from Cookies or fp=verify_... from a Network chat/completion request URL.",
          body,
          url
        ),
        headers: reqHeaders,
        transformedBody,
      };
    }

    let upstream: Response;
    try {
      upstream = await fetch(url, {
        method: "POST",
        headers: reqHeaders,
        body: JSON.stringify(transformedBody),
        signal,
      });
    } catch (err) {
      return {
        ...makeErrorResult(
          502,
          `Dola fetch failed: ${err instanceof Error ? err.message : "unknown"}`,
          body,
          url
        ),
        headers: reqHeaders,
        transformedBody,
      };
    }

    if (!upstream.ok) {
      const errText = await upstream.text().catch(() => "");
      return {
        ...makeErrorResult(upstream.status, `Dola error: ${errText}`, body, url),
        headers: reqHeaders,
        transformedBody,
      };
    }

    const contentType = upstream.headers.get("Content-Type") || "";
    if (!contentType.toLowerCase().includes("text/event-stream")) {
      const text = await upstream.text().catch(() => "");
      return {
        ...makeErrorResult(502, `Dola returned non-SSE response: ${text}`, body, url),
        headers: reqHeaders,
        transformedBody,
      };
    }

    if (!wantStream) {
      const content = await this.collectText(upstream, modelId);
      if (isDolaBusyMessage(content)) {
        return {
          ...makeErrorResult(429, "Dola is temporarily busy. Please try again later.", body, url),
          headers: reqHeaders,
          transformedBody,
        };
      }
      return {
        response: new Response(JSON.stringify(openAiCompletion(modelId, content)), {
          headers: { "Content-Type": "application/json" },
        }),
        url,
        headers: reqHeaders,
        transformedBody,
      };
    }

    return {
      response: new Response(stream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      }),
      url,
      headers: reqHeaders,
      transformedBody,
    };
  }
}
