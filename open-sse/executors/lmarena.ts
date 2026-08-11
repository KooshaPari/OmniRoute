/**
 * LMArenaExecutor — Arena (formerly LMArena) web-session provider.
 *
 * Routes requests through arena.ai create-evaluation with session cookies.
 * Upstream sits behind Cloudflare; traffic goes through tls-client-node Chrome
 * impersonation (see services/lmarenaTlsClient.ts).
 *
 * Helpers: open-sse/executors/lmarena/{cookie,models,stream,response}.ts
 */
import { v7 as uuidv7 } from "uuid";
import { BaseExecutor, type ExecuteInput } from "./base.ts";
import { tlsFetchLMArena, TlsClientUnavailableError } from "../services/lmarenaTlsClient.ts";
import { readLMArenaCookie, reconstructLMArenaCookie } from "./lmarena/cookie.ts";
import {
  LMARENA_STREAM_URL,
  LMARENA_USER_AGENT,
  buildLmarenaBrowserHeaders,
  markLMArenaCatalogModelDead,
  normalizeLMArenaModelsForCatalog,
  parseLMArenaInitialModels,
  pickLMArenaModelId,
  resolveLMArenaModelId,
  type LMArenaModelMetadata,
} from "./lmarena/models.ts";
import { formatArenaPrompt, parseArenaSSE } from "./lmarena/stream.ts";
import {
  buildArenaUpstreamHttpResponse,
  createOpenAIArenaStream,
  handleNonStreamingArenaResponse,
  mapFailedTlsResult,
  mapNetworkError,
  mapTlsUnavailable,
  missingCookieResult,
} from "./lmarena/response.ts";

export {
  reconstructLMArenaCookie,
  normalizeLMArenaModelsForCatalog,
  parseLMArenaInitialModels,
  pickLMArenaModelId,
  parseArenaSSE,
  markLMArenaCatalogModelDead,
  LMARENA_USER_AGENT,
};
export { clearLMArenaDeadCatalogModels } from "./lmarena/models.ts";
export type { LMArenaModelMetadata };

const LMARENA_USER_AGENT =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36";

const LMARENA_AUTH_COOKIE = "arena-auth-prod-v1";

interface ParsedCookie {
  name: string;
  value: string;
}

/**
 * Parse a raw `Cookie:`-style blob (`name=value; name2=value2; …`) into an
 * ordered list of name/value pairs. Whitespace around names is trimmed; values
 * are kept verbatim (they may legitimately contain `=`, e.g. base64 padding).
 */
function parseCookieBlob(blob: string): ParsedCookie[] {
  const pairs: ParsedCookie[] = [];
  for (const part of blob.split(";")) {
    const eq = part.indexOf("=");
    if (eq < 0) continue;
    const name = part.slice(0, eq).trim();
    if (!name) continue;
    const value = part.slice(eq + 1).trim();
    pairs.push({ name, value });
  }
  return pairs;
}

/**
 * Reconstruct LMArena's single `arena-auth-prod-v1` auth cookie from the
 * Supabase SSR chunked form.
 *
 * LMArena migrated to `@supabase/ssr`, which splits a large auth cookie across
 * `arena-auth-prod-v1.0`, `arena-auth-prod-v1.1`, … (ascending). The single
 * `arena-auth-prod-v1` cookie is then left empty. Following `@supabase/ssr`'s
 * `combineChunks`, we read chunks in ascending numeric order until one is
 * missing and `join("")` their raw values — NO base64-decode, NO JSON-parse.
 * The joined value typically starts with the literal `base64-` prefix; we keep
 * it verbatim (the upstream expects it).
 *
 * - If the blob already carries a non-empty `arena-auth-prod-v1=<value>`, it is
 *   returned unchanged (back-compat with the pre-migration single cookie).
 * - Otherwise the reconstructed `arena-auth-prod-v1=<joined>` is injected while
 *   every other cookie in the pasted jar is preserved.
 * - If neither the single cookie nor any `.N` chunk has a value, the blob is
 *   returned as-is so the existing missing-cookie path still fires.
 */
export function reconstructLMArenaCookie(rawCookie: string): string {
  if (!rawCookie || !rawCookie.trim()) return rawCookie;

  const pairs = parseCookieBlob(rawCookie);

  // Back-compat: a non-empty single cookie is already usable — forward verbatim.
  const existing = pairs.find((p) => p.name === LMARENA_AUTH_COOKIE);
  if (existing && existing.value) return rawCookie;

  // Collect chunk values keyed by their numeric index (`arena-auth-prod-v1.<N>`).
  const chunkPrefix = `${LMARENA_AUTH_COOKIE}.`;
  const chunks = new Map<number, string>();
  for (const { name, value } of pairs) {
    if (!name.startsWith(chunkPrefix)) continue;
    const idxRaw = name.slice(chunkPrefix.length);
    if (!/^\d+$/.test(idxRaw)) continue;
    chunks.set(Number(idxRaw), value);
  }

  // Join in ascending order until a chunk is missing (combineChunks semantics).
  const joinedParts: string[] = [];
  for (let i = 0; chunks.has(i); i++) {
    joinedParts.push(chunks.get(i) ?? "");
  }
  const joined = joinedParts.join("");

  // No usable session anywhere → return as-is so the missing-cookie path fires.
  if (!joined) return rawCookie;

  // Inject the reconstructed single cookie while preserving the rest of the jar
  // (drop the empty base cookie and the now-redundant chunks).
  const preserved = pairs.filter(
    (p) => p.name !== LMARENA_AUTH_COOKIE && !p.name.startsWith(chunkPrefix)
  );
  const rebuilt = [
    `${LMARENA_AUTH_COOKIE}=${joined}`,
    ...preserved.map((p) => `${p.name}=${p.value}`),
  ];
  return rebuilt.join("; ");
}

function readLMArenaCookie(credentials: unknown): string {
  if (!credentials || typeof credentials !== "object") return "";
  const c = credentials as Record<string, unknown>;
  const direct = typeof c.cookie === "string" ? c.cookie : "";
  if (direct.trim()) return reconstructLMArenaCookie(direct);
  const apiKey = typeof c.apiKey === "string" ? c.apiKey : "";
  if (apiKey.trim()) return reconstructLMArenaCookie(apiKey);
  const psd = c.providerSpecificData;
  if (psd && typeof psd === "object") {
    const nested = (psd as Record<string, unknown>).cookie;
    if (typeof nested === "string" && nested.trim()) return reconstructLMArenaCookie(nested);
  }
  return "";
}

interface ArenaSSEEvent {
  type: "text" | "thinking" | "error" | "done" | "heartbeat";
  content?: string;
}

export function parseArenaSSE(line: string): ArenaSSEEvent | null {
  if (line.startsWith("a0:")) {
    try {
      const content = JSON.parse(line.substring(3));
      return { type: "text", content: typeof content === "string" ? content : content.text || "" };
    } catch {
      return null;
    }
  } else if (line.startsWith("ag:")) {
    try {
      const content = JSON.parse(line.substring(3));
      return {
        type: "thinking",
        content: typeof content === "string" ? content : content.thinking || "",
      };
    } catch {
      return null;
    }
  } else if (line.startsWith("a3:") || line.startsWith("ae:")) {
    try {
      const content = JSON.parse(line.substring(3));
      return {
        type: "error",
        content: typeof content === "string" ? content : content.error || JSON.stringify(content),
      };
    } catch {
      return { type: "error", content: line.substring(3) };
    }
  } else if (line.startsWith("ad:")) {
    return { type: "done" };
  } else if (line.startsWith("a2:")) {
    return { type: "heartbeat" };
  }
  return null;
}

export class LMArenaExecutor extends BaseExecutor {
  constructor(providerConfig = {}) {
    super("lmarena", { format: "openai", ...providerConfig });
  }

  // Public to match BaseExecutor.buildUrl — a subclass may widen visibility but not
  // narrow it. This was masked behind the buildHeaders TS2416 until that one cleared.
  buildUrl(_model: string, _credentials: unknown): string {
    return LMARENA_STREAM_URL;
  }

  protected buildRequestHeaders(
    _model: string,
    credentials: unknown,
    _body: unknown
  ): Record<string, string> {
    const cookie = readLMArenaCookie(credentials);
    const headers = buildLmarenaBrowserHeaders({
      "Content-Type": "application/json",
      Accept: "text/event-stream",
    });
    if (cookie) headers.Cookie = cookie;
    return headers;
  }

  protected transformRequest(body: unknown, model: string): unknown {
    const openaiBody = body as Record<string, unknown>;
    const messages = openaiBody.messages as Array<{ role: string; content: string }>;

    return {
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
      model,
      stream: openaiBody.stream || false,
    };
  }

  async execute(input: ExecuteInput) {
    const { model, body, stream, credentials, signal, log } = input;
    const url = this.buildUrl(model, credentials);
    const headers = this.buildRequestHeaders(model, credentials, body);
    const cookie = readLMArenaCookie(credentials);

    if (!cookie) {
      return missingCookieResult(url, headers, this.transformRequest(body, model, credentials));
    }

    const arenaModelId = await resolveLMArenaModelId(model, log);
    const transformedBody = this.transformRequest(body, arenaModelId, credentials) as Record<
      string,
      unknown
    >;

    log?.info?.(
      "LMArenaExecutor",
      arenaModelId === model
        ? `Executing request for model: ${model}`
        : `Executing request for model: ${model} (${arenaModelId})`
    );

    try {
      return await this.dispatchTls(url, headers, transformedBody, {
        model,
        arenaModelId,
        stream: !!stream,
        signal,
        log,
      });
    } catch (error) {
      if (error instanceof TlsClientUnavailableError) {
        log?.error?.("LMArenaExecutor", `TLS client unavailable: ${error.message}`);
        return mapTlsUnavailable(error, url, headers, transformedBody);
      }
      const message = error instanceof Error ? error.message : String(error);
      log?.error?.("LMArenaExecutor", `Request failed: ${message}`);
      return mapNetworkError(message, url, headers, transformedBody);
    }
  }

  private async dispatchTls(
    url: string,
    headers: Record<string, string>,
    transformedBody: Record<string, unknown>,
    ctx: {
      model: string;
      arenaModelId: string;
      stream: boolean;
      signal?: AbortSignal;
      log?: ExecuteInput["log"];
    }
  ) {
    const tlsResult = await tlsFetchLMArena(url, {
      method: "POST",
      headers,
      body: JSON.stringify(transformedBody),
      signal: ctx.signal,
      stream: ctx.stream,
      streamEofSymbol: "__OMNIROUTE_LMARENA_EOF_NEVER__",
    });

    const failed = mapFailedTlsResult({
      status: tlsResult.status,
      text: tlsResult.text,
      hasRecaptcha: transformedBody.recaptchaV3Token != null,
      model: ctx.model,
      arenaModelId: ctx.arenaModelId,
      url,
      headers,
      transformedBody,
    });
    if (failed) return failed;

    const upstream = buildArenaUpstreamHttpResponse({
      stream: ctx.stream,
      status: tlsResult.status,
      text: tlsResult.text,
      body: tlsResult.body,
    });

    const response = ctx.stream
      ? await this.handleStreamingResponse(upstream, ctx.model, ctx.signal, ctx.log)
      : await handleNonStreamingArenaResponse(upstream, ctx.model);

    return { response, url, headers, transformedBody };
  }

  private async handleStreamingResponse(
    response: Response,
    model: string,
    signal?: AbortSignal,
    log?: ExecuteInput["log"]
  ): Promise<Response> {
    const reader = response.body?.getReader();
    if (!reader) throw new Error("No response body for streaming");

    const out = createOpenAIArenaStream({ reader, model, signal, log });
    return new Response(out, {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  }
}
