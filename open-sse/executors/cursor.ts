declare const EdgeRuntime: string | undefined;
/**
 * CursorExecutor — Handles communication with the Cursor IDE API.
 *
 * This executor is the most complex due to Cursor's non-standard protocol:
 *
 * SECTION 1: Authentication (generateChecksum)
 *   - SHA-256 based checksum using machine ID and timestamp
 *   - WorkOS token refresh for session management
 *
 * SECTION 2: Request Encoding (transformRequest, buildHeaders)
 *   - ConnectRPC Protobuf binary encoding via cursorProtobuf.js
 *   - Chat body construction with model routing
 *
 * SECTION 3: Response Parsing (executeStream, parseEvent*)
 *   - Binary EventStream → SSE text conversion
 *   - Gzip decompression of response frames
 *   - HTTP/2 support with h2 fallback to fetch
 *
 * @see cursorProtobuf.js for Protobuf encoding/decoding utilities
 */

import { BaseExecutor, mergeUpstreamExtraHeaders } from "./base.ts";
<<<<<<< Updated upstream
import { generateTraceparent } from "../observability/traceparent.ts";
import { PROVIDERS, HTTP_STATUS } from "../config/constants.ts";
import {
  buildAgentRequestBody,
  decodeAgentServerMessage,
  decodeExecServerEvent,
  decodeKvServerEvent,
  encodeRequestContextResponse,
  encodeKvGetBlobResult,
  encodeKvSetBlobResult,
  encodeExecReadRejected,
  encodeExecWriteRejected,
  encodeExecDeleteRejected,
  encodeExecLsRejected,
  encodeExecShellRejected,
  encodeExecBackgroundShellSpawnRejected,
  encodeExecGrepError,
  encodeExecFetchError,
  encodeExecWriteShellStdinError,
  encodeExecDiagnosticsResult,
  flattenMessages,
  openAIToolsToMcpDefs,
  type ChatMessage,
  type EncodedImage,
  type ExecServerEvent,
  type McpToolDefinition,
  type OpenAITool,
} from "../utils/cursorAgentProtobuf.ts";
import { resolveCursorImages, extractImageUrls, CursorImageError } from "../utils/cursorImages.ts";
import {
  estimateInputTokens,
  estimateOutputTokens,
  addBufferToUsage,
} from "../utils/usageTracking.ts";
import { getCursorVersion } from "../utils/cursorVersionDetector.ts";
import { sanitizeErrorMessage } from "../utils/error.ts";
import { generateToolCallId } from "../translator/helpers/toolCallHelper.ts";
import {
  parseComposerToolCalls,
  createStreamingState,
  feedStreamingChunk,
  type StreamingState as ComposerStreamingState,
} from "../utils/composerToolCalls.ts";
import { cursorSessionManager, type CursorSession } from "../services/cursorSessionManager.ts";
import crypto from "crypto";
import * as fs from "node:fs";
import * as zlib from "node:zlib";
import { promisify } from "node:util";
import { toolChoiceDirectiveLine, buildCursorOutputConstraints } from "./cursor/prompt.ts";
import {
  isComposerModel,
  visibleComposerContentFromThinking,
  composerReasoningRemainder,
} from "./cursor/composer.ts";
// Composer helpers re-exported for external importers (tests).
export {
  isComposerModel,
  visibleComposerContentFromThinking,
  composerReasoningRemainder,
} from "./cursor/composer.ts";

// Reject reason text aligned with kaitranntt/CLIProxyAPIPlus — proven to
// keep cursor's model from retrying the same built-in tool indefinitely.
// The model adapts and either answers from context or uses declared MCP tools.
const BUILTIN_TOOL_REJECT_REASON =
  "Tool not available in this environment. Use the MCP tools provided instead.";
const gunzipAsync = promisify(zlib.gunzip);

// Tool-commit directive — adapted from composer-api's TOOL_SYSTEM_DIRECTIVE.
// composer-2.5 otherwise narrates intent ("Checking the weather...") and ends
// the turn ~20% of the time instead of actually invoking a declared tool. This
// directive, prepended to the user text only when the request declares tools,
// tells the model to commit to the tool call rather than describe it as prose.
const TOOL_COMMIT_DIRECTIVE = [
  "You are serving an OpenAI-compatible API request and the client has provided executable tools.",
  "When a tool is needed to answer (real-time data, web/search lookups, file or project operations), you MUST issue the actual tool call. Do NOT describe what you are about to do as prose and then stop — call the tool.",
  "Answer directly only when no tool is needed.",
  "Do not emit duplicate tool calls: call each operation once, then continue after the tool result is returned.",
  "Never claim that tools are unavailable.",
].join("\n");

// NOTE: composer-api primes the model into "agent mode" with a fabricated
// prior switch_mode exchange (AGENT_MODE_PRIMER). On OmniRoute's native-tool
// agent endpoint that primer is counterproductive — it references a
// non-existent switch_mode tool and measurably LOWERED the tool-call rate in
// live A/B (56% vs 69%), so it is intentionally not ported.

/**
 * Build the ExecClientMessage frame that responds to a built-in tool request.
 * Returns null for the request_context handshake (caller handles separately
 * to inject MCP tools in Phase 3) and for exec_mcp (model is invoking a
 * declared MCP tool — Phase 5 surfaces this as an OpenAI tool_calls delta).
 */
function buildExecRejection(event: ExecServerEvent): Buffer | null {
  switch (event.kind) {
    case "exec_request_context":
    case "exec_mcp":
      return null;
    case "exec_read":
      return encodeExecReadRejected(
        event.execMsgId,
        event.execId,
        event.path,
        BUILTIN_TOOL_REJECT_REASON
      );
    case "exec_write":
      return encodeExecWriteRejected(
        event.execMsgId,
        event.execId,
        event.path,
        BUILTIN_TOOL_REJECT_REASON
      );
    case "exec_delete":
      return encodeExecDeleteRejected(
        event.execMsgId,
        event.execId,
        event.path,
        BUILTIN_TOOL_REJECT_REASON
      );
    case "exec_ls":
      return encodeExecLsRejected(
        event.execMsgId,
        event.execId,
        event.path,
        BUILTIN_TOOL_REJECT_REASON
      );
    case "exec_grep":
      return encodeExecGrepError(event.execMsgId, event.execId, BUILTIN_TOOL_REJECT_REASON);
    case "exec_diagnostics":
      // Diagnostics has no rejection variant — return an empty success.
      return encodeExecDiagnosticsResult(event.execMsgId, event.execId);
    case "exec_shell":
    case "exec_shell_stream":
      return encodeExecShellRejected(
        event.execMsgId,
        event.execId,
        event.command,
        event.workingDir,
        BUILTIN_TOOL_REJECT_REASON
      );
    case "exec_bg_shell":
      return encodeExecBackgroundShellSpawnRejected(
        event.execMsgId,
        event.execId,
        event.command,
        event.workingDir,
        BUILTIN_TOOL_REJECT_REASON
      );
    case "exec_fetch":
      return encodeExecFetchError(
        event.execMsgId,
        event.execId,
        event.url,
        BUILTIN_TOOL_REJECT_REASON
      );
    case "exec_write_shell_stdin":
      return encodeExecWriteShellStdinError(
        event.execMsgId,
        event.execId,
        BUILTIN_TOOL_REJECT_REASON
      );
  }
}

const CURSOR_AGENT_HOST = "agentn.global.api5.cursor.sh";
const CURSOR_AGENT_PATH = "/agent.v1.AgentService/Run";
const CURSOR_AGENT_URL = `https://${CURSOR_AGENT_HOST}${CURSOR_AGENT_PATH}`;

// Detect cloud environment (Edge runtime, Cloudflare Workers, etc.)
=======
import { getCursorUserAgent } from "../config/providerHeaderProfiles.ts";
import { PROVIDERS, HTTP_STATUS } from "../config/constants.ts";
import {
  generateCursorBody,
  parseConnectRPCFrame,
  extractTextFromResponse,
} from "../utils/cursorProtobuf.ts";
import { estimateUsage } from "../utils/usageTracking.ts";
import { getCursorVersion } from "../utils/cursorVersionDetector.ts";
import { FORMATS } from "../translator/formats.ts";
import crypto from "crypto";
import { v5 as uuidv5 } from "uuid";
import zlib from "zlib";

// Detect cloud environment
>>>>>>> Stashed changes
const isCloudEnv = () => {
  if (typeof caches !== "undefined" && typeof caches === "object") return true;
  if (typeof EdgeRuntime !== "undefined") return true;
  return false;
};

// Lazy import http2 (only in Node.js environment)
let http2 = null;
if (!isCloudEnv()) {
  try {
    http2 = await import("http2");
  } catch {
    // http2 not available
  }
}

// --- SECTION 1: Authentication Constants ---
const COMPRESS_FLAG = {
  NONE: 0x00,
  GZIP: 0x01,
  GZIP_ALT: 0x02,
  GZIP_BOTH: 0x03,
};

const CURSOR_STREAM_DEBUG = process.env.CURSOR_STREAM_DEBUG === "1";
const debugLog = (...args: unknown[]) => {
  if (CURSOR_STREAM_DEBUG) console.log(...args);
};

function decompressPayload(payload, flags) {
  // Check if payload is JSON error (starts with {"error")
  if (payload.length > 10 && payload[0] === 0x7b && payload[1] === 0x22) {
    try {
      const text = payload.toString("utf-8");
      if (text.startsWith('{"error"')) {
        debugLog(`[DECOMPRESS] Detected JSON error, skipping decompression`);
        return payload;
      }
    } catch {}
  }

  if (
    flags === COMPRESS_FLAG.GZIP ||
    flags === COMPRESS_FLAG.GZIP_ALT ||
    flags === COMPRESS_FLAG.GZIP_BOTH
  ) {
    // Primary: try gzip decompression (standard gzip header 0x1f 0x8b)
    try {
      return zlib.gunzipSync(payload);
    } catch (gzipErr) {
      // Fallback: GZIP_ALT (0x02) and GZIP_BOTH (0x03) frames sometimes use
      // raw zlib deflate format instead of gzip wrapping (#250)
      try {
        return zlib.inflateSync(payload);
      } catch (deflateErr) {
        // Last resort: try raw deflate (no zlib header)
        try {
          return zlib.inflateRawSync(payload);
        } catch (rawErr) {
          debugLog(
            `[DECOMPRESS ERROR] flags=${flags}, payloadSize=${payload.length}, gzip=${gzipErr.message}, deflate=${deflateErr.message}, raw=${rawErr.message}`
          );
          debugLog(
            `[DECOMPRESS ERROR] First 50 bytes (hex):`,
            payload.slice(0, 50).toString("hex")
          );
          debugLog(
            `[DECOMPRESS ERROR] First 50 bytes (utf8):`,
            payload
              .slice(0, 50)
              .toString("utf8")
              .replace(/[^\x20-\x7E]/g, ".")
          );
          // Try to use payload as-is if all decompression methods fail
          return payload;
        }
      }
    }
  }
  return payload;
}

function createErrorResponse(jsonError) {
  const errorMsg =
    jsonError?.error?.details?.[0]?.debug?.details?.title ||
    jsonError?.error?.details?.[0]?.debug?.details?.detail ||
    jsonError?.error?.message ||
    "API Error";

  const isRateLimit = jsonError?.error?.code === "resource_exhausted";

  return new Response(
    JSON.stringify({
      error: {
        message: errorMsg,
        type: isRateLimit ? "rate_limit_error" : "api_error",
        code: jsonError?.error?.details?.[0]?.debug?.error || "unknown",
      },
    }),
    {
      status: isRateLimit ? HTTP_STATUS.RATE_LIMITED : HTTP_STATUS.BAD_REQUEST,
      headers: { "Content-Type": "application/json" },
    }
  );
}

function parseCursorJsonErrorFrame(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function isToolBoundaryAbort(jsonError: unknown, toolCallCount: number) {
  if (!jsonError || toolCallCount <= 0) return false;
  const e = jsonError as Record<string, unknown>;
  const err = e?.error as Record<string, unknown> | undefined;
  const details = (err?.details as Record<string, unknown>[] | undefined)?.[0];
  const debug = details?.debug as Record<string, unknown> | undefined;
  const debugDetails = debug?.details as Record<string, unknown> | undefined;
  const code = (err?.code as string) || "";
  const debugError = (debug?.error as string) || "";
  const title = (debugDetails?.title as string) || "";
  const detail = (debugDetails?.detail as string) || "";
  const message = `${title} ${detail}`.toLowerCase();
  const isAbortedCode = code === "aborted" || debugError === "ERROR_USER_ABORTED_REQUEST";
  return isAbortedCode && message.includes("tool call ended before result was received");
}

function mergeToolCallDelta(existing, incoming) {
  const mergedName = incoming?.function?.name || existing?.function?.name || "";
  const existingArgs = existing?.function?.arguments || "";
  const deltaArgs = incoming?.function?.arguments || "";
  return {
    id: incoming.id || existing.id,
    type: "function",
    function: {
      name: mergedName,
      arguments: `${existingArgs}${deltaArgs}`,
    },
    isLast: Boolean(existing?.isLast || incoming?.isLast),
    index: existing?.index ?? incoming?.index ?? 0,
  };
}

type CursorHttpResponse = {
  status: number;
  headers: Record<string, unknown>;
  body: Buffer;
};

<<<<<<< Updated upstream
function tryParseJsonError(payload: Buffer): { message: string; status: number } | null {
  if (payload.length < 2 || payload[0] !== 0x7b) return null;
  try {
    const text = payload.toString("utf8");
    if (!text.includes('"error"')) return null;
    const parsed = JSON.parse(text);
    const err = parsed?.error || {};
    const message =
      err?.details?.[0]?.debug?.details?.title ||
      err?.details?.[0]?.debug?.details?.detail ||
      err?.message ||
      text;
    const status =
      err?.code === "resource_exhausted" ? HTTP_STATUS.RATE_LIMITED : HTTP_STATUS.BAD_REQUEST;
    return { message, status };
  } catch {
    return null;
  }
}

// ─── Phase 4: streaming dispatch context ───────────────────────────────────
//
// One StreamCtx flows through a single execute() call. It owns the live
// SSE emission state (responseId, created timestamp, model id, role-chunk
// flag) plus aggregate state (totalText, tokenDelta) needed for the final
// usage chunk and JSON-mode aggregation. Phases 5 (tool calls) and 8
// (end-signal hardening) extend it.

export type StreamCtx = {
  responseId: string;
  created: number;
  model: string;
  emit: (chunk: string) => void;
  emittedRoleChunk: boolean;
  totalText: string;
  thinkingText: string;
  tokenDelta: number;
  // End-signal tracking (Phase 8 hardens this further).
  receivedText: boolean;
  kvAfterTextSeen: boolean;
  endReason: "turn_ended" | "kv_after_text" | "tool_calls" | "server_end" | null;
  // Mid-stream JSON error (rare; emitted once with the error code).
  midStreamError: { message: string; status: number } | null;
  // Phase 5: tool-call indexing for parallel calls. Each McpArgs gets a
  // monotonically-increasing index in the OpenAI delta. emittedToolCalls
  // tracks how many were emitted so finalizeSseStream picks the right
  // finish_reason ("tool_calls" vs "stop").
  emittedToolCallIndex: number;
  // Captured tool calls (for JSON-mode aggregation). Each entry maps to
  // one OpenAI tool_calls[] item.
  toolCalls: Array<{
    id: string;
    name: string;
    argumentsJson: string;
  }>;
  // Phase 6: maps OpenAI tool_call_id → cursor exec info, so a follow-up
  // role:"tool" message can be answered on the open h2 stream via
  // encodeExecMcpResult.
  pendingToolCalls: Map<string, { execMsgId: number; execId: string; toolName: string }>;
  // Composer thinking-as-content (decolua/9router#1310): tracks how much of
  // the visible suffix (after the last `</think>`) has already been streamed
  // out as `content` deltas, so we only emit the incremental tail per frame.
  composerVisibleEmittedLength: number;
  // Composer DeepSeek-format inline tool-call parser state (decolua/9router#1335).
  // Null for non-Composer models (no overhead). When set, the streaming parser
  // holds back text inside `<｜tool▁calls▁begin｜>...<｜tool▁calls▁end｜>` markers
  // and emits structured tool_calls SSE chunks once the block closes.
  composerToolParserState: ComposerStreamingState | null;
  // True once we've emitted structured tool_calls from the inline Composer parser
  // (to avoid double-emitting if the block appears in multiple accumulated frames).
  composerInlineToolCallsEmitted: boolean;
};

export function newStreamCtx(model: string, emit: (chunk: string) => void): StreamCtx {
  return {
    responseId: `chatcmpl-cursor-${Date.now()}`,
    created: Math.floor(Date.now() / 1000),
    model,
    emit,
    emittedRoleChunk: false,
    totalText: "",
    thinkingText: "",
    tokenDelta: 0,
    receivedText: false,
    kvAfterTextSeen: false,
    endReason: null,
    midStreamError: null,
    emittedToolCallIndex: 0,
    toolCalls: [],
    pendingToolCalls: new Map(),
    composerVisibleEmittedLength: 0,
    composerToolParserState: isComposerModel(model) ? createStreamingState() : null,
    composerInlineToolCallsEmitted: false,
  };
}

function emitChunk(ctx: StreamCtx, delta: object, finishReason: string | null = null) {
  const payload = {
    id: ctx.responseId,
    object: "chat.completion.chunk",
    created: ctx.created,
    model: ctx.model,
    choices: [{ index: 0, delta, finish_reason: finishReason }],
  };
  ctx.emit(`data: ${JSON.stringify(payload)}\n\n`);
}

export function buildCursorUsage(ctx: StreamCtx, body: { messages?: ChatMessage[] }) {
  const promptTokens = estimateInputTokens(body);
  const completionTokens =
    ctx.tokenDelta > 0
      ? ctx.tokenDelta
      : estimateOutputTokens(ctx.totalText.length + ctx.thinkingText.length);
  const usage: Record<string, unknown> = {
    prompt_tokens: promptTokens,
    completion_tokens: completionTokens,
    total_tokens: promptTokens + completionTokens,
    estimated: true,
  };
  if (ctx.thinkingText.length > 0) {
    usage.completion_tokens_details = {
      reasoning_tokens: estimateOutputTokens(ctx.thinkingText.length),
    };
  }
  return addBufferToUsage(usage);
}

function emitUsage(ctx: StreamCtx, body: { messages?: ChatMessage[] }) {
  // Always emit a usage chunk on the success path — the OpenAI streaming
  // contract is that every completed response carries usage. buildCursorUsage
  // already degrades cleanly to prompt-only counts when the model produced no
  // text/thinking (e.g. an empty turn), so there's no need to skip it. The
  // mid-stream-error path in finalizeSseStream returns before calling this, so
  // errored responses still don't get a spurious usage chunk.
  const usage = buildCursorUsage(ctx, body);
  const payload = {
    id: ctx.responseId,
    object: "chat.completion.chunk",
    created: ctx.created,
    model: ctx.model,
    choices: [],
    usage,
  };
  ctx.emit(`data: ${JSON.stringify(payload)}\n\n`);
}

function emitDone(ctx: StreamCtx) {
  ctx.emit("data: [DONE]\n\n");
}

/**
 * Process one decoded Connect-RPC frame payload: dispatch ExecServerMessage
 * events (rejection / context ack / mcp_args), decode AgentServerMessage
 * interaction updates, and emit OpenAI SSE deltas for any text content.
 *
 * Returns true if an end-of-response signal was observed.
 *
 * The h2 `req` (used to write rejection acks back on the same stream) is
 * passed via opts so this function works for both the streaming h2 path
 * and the buffered fetch fallback (where opts.req is undefined).
 *
 * Mutates `ackedExecIds` so each exec_id is dispatched exactly once even
 * when the same payload is seen multiple times during incremental decoding.
 */
export function processFrame(
  payload: Buffer,
  ctx: StreamCtx,
  ackedExecIds: Set<string>,
  opts: {
    h2Req?: import("http2").ClientHttp2Stream;
    mcpTools?: McpToolDefinition[];
    blobStore?: Map<string, Buffer>;
  } = {}
): void {
  // 1. JSON error envelope (Connect-RPC style — usually status > 200).
  const jsonError = tryParseJsonError(payload);
  if (jsonError) {
    if (ctx.totalText.length === 0) {
      ctx.midStreamError = jsonError;
      ctx.endReason = "server_end";
    } else {
      // Already streamed content — terminate cleanly.
      ctx.endReason = "server_end";
    }
    return;
  }

  // 2a. KV server message: cursor requesting a blob (system prompt) or
  // saving an assistant turn. We reply on the same stream so the model
  // proceeds. The opaque request_metadata is echoed so cursor can match
  // request to response.
  const kvEvent = decodeKvServerEvent(payload);
  if (kvEvent && opts.h2Req) {
    if (kvEvent.kind === "kv_get_blob") {
      const hex = kvEvent.blobId.toString("hex");
      const blob = opts.blobStore?.get(hex) ?? Buffer.alloc(0);
      try {
        opts.h2Req.write(encodeKvGetBlobResult(kvEvent.kvId, blob, kvEvent.requestMetadata));
      } catch {}
    } else if (kvEvent.kind === "kv_set_blob") {
      if (opts.blobStore) {
        opts.blobStore.set(kvEvent.blobId.toString("hex"), kvEvent.blobData);
      }
      try {
        opts.h2Req.write(encodeKvSetBlobResult(kvEvent.kvId, kvEvent.requestMetadata));
      } catch {}
    }
  }

  // 2b. ExecServerMessage dispatch (request_context, built-in rejection, mcp).
  // Dedup by kind+execId+execMsgId — request_context and mcp_args both
  // arrive with empty execId in the current cursor schema, so a single
  // execId-only set would collapse them.
  const event = decodeExecServerEvent(payload);
  const dedupKey = event ? `${event.kind}:${event.execId}:${event.execMsgId}` : "";
  if (event && !ackedExecIds.has(dedupKey)) {
    ackedExecIds.add(dedupKey);
    if (event.kind === "exec_request_context") {
      if (opts.h2Req) {
        try {
          // Cursor receives tools via AgentRunRequest.mcp_tools (request body)
          // — sending them again in the request_context ack causes the
          // server to stall silently. Empty ack only.
          opts.h2Req.write(encodeRequestContextResponse(event.execMsgId, event.execId));
        } catch {}
      }
    } else if (event.kind === "exec_mcp") {
      // Phase 5: surface the model-invoked MCP tool as an OpenAI tool_calls
      // SSE delta. Two chunks are emitted per call: an init chunk with the
      // tool's id+name+empty args, then a chunk with the JSON-stringified
      // args. Parallel tool calls share one finish chunk (Phase 8 closes).
      if (!ctx.emittedRoleChunk) {
        emitChunk(ctx, { role: "assistant", content: "" });
        ctx.emittedRoleChunk = true;
      }
      const idx = ctx.emittedToolCallIndex++;
      const openAIToolCallId = generateToolCallId();
      const argumentsJson = JSON.stringify(event.args ?? {});
      emitChunk(ctx, {
        tool_calls: [
          {
            index: idx,
            id: openAIToolCallId,
            type: "function",
            function: { name: event.toolName, arguments: "" },
          },
        ],
      });
      emitChunk(ctx, {
        tool_calls: [
          {
            index: idx,
            function: { arguments: argumentsJson },
          },
        ],
      });
      ctx.toolCalls.push({
        id: openAIToolCallId,
        name: event.toolName,
        argumentsJson,
      });
      // Phase 6: remember the cursor exec ids so a follow-up role:"tool"
      // message can be replied with encodeExecMcpResult on the open h2 stream.
      ctx.pendingToolCalls.set(openAIToolCallId, {
        execMsgId: event.execMsgId,
        execId: event.execId,
        toolName: event.toolName,
      });
      // Cursor pauses after mcp_args waiting for the client to either send
      // a tool result via ExecMcpResult or close the stream. We mark
      // endReason now so driveH2 returns; the session manager keeps the h2
      // alive for the next OpenAI call (which arrives with role:"tool").
      ctx.endReason = "tool_calls";
    } else {
      const rejection = buildExecRejection(event);
      if (rejection && opts.h2Req) {
        try {
          opts.h2Req.write(rejection);
        } catch {}
      }
    }
  }

  // 3. Interaction update deltas → OpenAI SSE chunks.
  let deltas;
  try {
    deltas = decodeAgentServerMessage(payload);
  } catch (err) {
    debugLog("[cursor-agent] decode failed:", (err as Error).message);
    return;
  }
  for (const d of deltas) {
    if (d.kind === "text" && d.text) {
      if (!ctx.emittedRoleChunk) {
        emitChunk(ctx, { role: "assistant", content: "" });
        ctx.emittedRoleChunk = true;
      }
      ctx.totalText += d.text;
      ctx.receivedText = true;
      emitChunk(ctx, { content: d.text });
    } else if (d.kind === "thinking" && d.text) {
      if (!ctx.emittedRoleChunk) {
        emitChunk(ctx, { role: "assistant", content: "" });
        ctx.emittedRoleChunk = true;
      }
      ctx.thinkingText += d.text;
      ctx.receivedText = true;
      // Composer (decolua/9router#1310) encodes the visible reply inside the
      // thinking field, after a final `</think>` marker. Emit the post-marker
      // suffix as plain `content` (so OpenAI-compatible clients see the reply)
      // and keep the pre-marker chain-of-thought out of `reasoning_content` —
      // it was never intended for the user.
      if (isComposerModel(ctx.model)) {
        const visible = visibleComposerContentFromThinking(ctx.thinkingText);
        if (visible.length > ctx.composerVisibleEmittedLength) {
          // Feed the full accumulated visible text into the DeepSeek inline
          // tool-call streaming parser (decolua/9router#1335). It tracks how
          // much has already been safely emitted and returns only the new
          // safe delta — i.e. text that precedes any `<｜tool▁calls▁begin｜>`
          // marker (or a partial prefix of one). When the closing marker
          // arrives, it sets ready=true and provides the parsed tool_calls.
          if (ctx.composerToolParserState) {
            const parseOut = feedStreamingChunk(ctx.composerToolParserState, visible);
            // composerVisibleEmittedLength tracks what the parser has "emitted"
            // — stays in sync via state.emitted.
            ctx.composerVisibleEmittedLength = ctx.composerToolParserState.emitted;
            if (parseOut.safeDelta) {
              ctx.totalText += parseOut.safeDelta;
              emitChunk(ctx, { content: parseOut.safeDelta });
            }
            if (
              parseOut.ready &&
              parseOut.toolCalls.length > 0 &&
              !ctx.composerInlineToolCallsEmitted
            ) {
              ctx.composerInlineToolCallsEmitted = true;
              for (const tc of parseOut.toolCalls) {
                const toolCallIndex = ctx.emittedToolCallIndex++;
                ctx.toolCalls.push({
                  id: tc.id,
                  name: tc.function.name,
                  argumentsJson: tc.function.arguments,
                });
                emitChunk(ctx, {
                  tool_calls: [
                    {
                      index: toolCallIndex,
                      id: tc.id,
                      type: "function",
                      function: { name: tc.function.name, arguments: tc.function.arguments },
                    },
                  ],
                });
              }
            }
          } else {
            // Non-composer or state not initialised — fall back to direct emit.
            const deltaContent = visible.slice(ctx.composerVisibleEmittedLength);
            ctx.composerVisibleEmittedLength = visible.length;
            ctx.totalText += deltaContent;
            emitChunk(ctx, { content: deltaContent });
          }
        }
      } else {
        emitChunk(ctx, { reasoning_content: d.text });
      }
    } else if (d.kind === "token_delta") {
      ctx.tokenDelta += d.tokens;
    } else if (d.kind === "turn_ended") {
      ctx.endReason = "turn_ended";
    } else if (d.kind === "tool_call_completed" && ctx.toolCalls.length > 0) {
      // Phase 6: model paused awaiting tool result. driveH2 returns but the
      // h2 stream stays open — the session manager keeps it alive for the
      // next OpenAI call (which will arrive with role:"tool" results).
      ctx.endReason = "tool_calls";
    } else if (d.kind === "kv_server_message" && ctx.receivedText) {
      // Cursor short-circuits turn_ended for plain chats — kv_server_message
      // after text means the model finished and the server is saving the
      // turn. Phase 8 keeps both signals as defense-in-depth.
      //
      // Safe vs tool calls: when the model invokes a tool, the exec_mcp event
      // always arrives at or before this kv checkpoint (verified across many
      // live composer-2.5 trials — a tool call never follows kv_after_text), so
      // endReason is already "tool_calls" by the time we get here. Ending on
      // kv_after_text therefore never truncates a pending tool call.
      ctx.kvAfterTextSeen = true;
      ctx.endReason = "kv_after_text";
    }
  }
}

=======
>>>>>>> Stashed changes
export class CursorExecutor extends BaseExecutor {
  constructor() {
    super("cursor", PROVIDERS.cursor);
  }

  buildUrl() {
    return `${this.config.baseUrl}${this.config.chatPath || ""}`;
  }

  // Jyh cipher checksum for Cursor API authentication
  generateChecksum(machineId) {
    const timestamp = Math.floor(Date.now() / 1000000);
    const byteArray = new Uint8Array([
      (timestamp >> 40) & 0xff,
      (timestamp >> 32) & 0xff,
      (timestamp >> 24) & 0xff,
      (timestamp >> 16) & 0xff,
      (timestamp >> 8) & 0xff,
      timestamp & 0xff,
    ]);

    let t = 165;
    for (let i = 0; i < byteArray.length; i++) {
      byteArray[i] = ((byteArray[i] ^ t) + (i % 256)) & 0xff;
      t = byteArray[i];
    }

    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
    let encoded = "";

    for (let i = 0; i < byteArray.length; i += 3) {
      const a = byteArray[i];
      const b = i + 1 < byteArray.length ? byteArray[i + 1] : 0;
      const c = i + 2 < byteArray.length ? byteArray[i + 2] : 0;

      encoded += alphabet[a >> 2];
      encoded += alphabet[((a & 3) << 4) | (b >> 4)];

      if (i + 1 < byteArray.length) {
        encoded += alphabet[((b & 15) << 2) | (c >> 6)];
      }
      if (i + 2 < byteArray.length) {
        encoded += alphabet[c & 63];
      }
    }

    return `${encoded}${machineId}`;
  }

  buildHeaders(credentials) {
    const accessToken = credentials.accessToken;
    const ghostMode = credentials.providerSpecificData?.ghostMode !== false;
<<<<<<< Updated upstream
    const cleanToken = accessToken.includes("::") ? accessToken.split("::")[1] : accessToken;
    const requestId = crypto.randomUUID();
    const traceParent = generateTraceparent({ sampled: true });
=======
>>>>>>> Stashed changes

    // Use stored machineId, or derive a stable one from the access token
    // (cursor-agent imports don't provide a machineId)
    const machineId =
      credentials.providerSpecificData?.machineId ||
      crypto.createHash("sha256").update(accessToken).digest("hex");

    const cleanToken = accessToken.includes("::") ? accessToken.split("::")[1] : accessToken;

    return {
      authorization: `Bearer ${cleanToken}`,
      "connect-accept-encoding": "gzip",
      "connect-protocol-version": "1",
      "content-type": "application/connect+proto",
      "user-agent": getCursorUserAgent(getCursorVersion()),
      "x-amzn-trace-id": `Root=${crypto.randomUUID()}`,
      "x-client-key": crypto.createHash("sha256").update(cleanToken).digest("hex"),
      "x-cursor-checksum": this.generateChecksum(machineId),
      "x-cursor-client-version": getCursorVersion(),
      "x-cursor-client-type": "ide",
      "x-cursor-client-os":
        process.platform === "win32"
          ? "windows"
          : process.platform === "darwin"
            ? "macos"
            : "linux",
      "x-cursor-client-arch": process.arch === "arm64" ? "aarch64" : "x64",
      "x-cursor-client-device-type": "desktop",
      "x-cursor-user-agent": getCursorUserAgent(getCursorVersion()),
      "x-cursor-config-version": crypto.randomUUID(),
      "x-cursor-timezone": Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
      "x-ghost-mode": ghostMode ? "true" : "false",
      "x-request-id": crypto.randomUUID(),
      "x-session-id": uuidv5(cleanToken, uuidv5.DNS),
    };
  }

  transformRequest(model, body, stream, credentials) {
    // Messages are already translated by chatCore (claude→openai→cursor)
    // Do NOT call buildCursorRequest again — double-translation drops tool_results
    const messages = body.messages || [];
    const tools = body.tools || [];
    const reasoningEffort = body.reasoning_effort || null;
    return generateCursorBody(messages, model, tools, reasoningEffort);
  }

  async makeFetchRequest(
    url: string,
    headers: Record<string, string>,
    body: Uint8Array,
    signal?: AbortSignal
  ): Promise<CursorHttpResponse> {
    const response = await fetch(url, {
      method: "POST",
      headers,
      body: body as unknown as BodyInit,
      signal,
    });

    return {
      status: response.status,
      headers: Object.fromEntries(response.headers.entries()),
      body: Buffer.from(await response.arrayBuffer()),
    };
  }

  makeHttp2Request(
    url: string,
    headers: Record<string, string>,
    body: Uint8Array,
    signal?: AbortSignal
  ): Promise<CursorHttpResponse> {
    if (!http2) {
      throw new Error("http2 module not available");
    }

    return new Promise<CursorHttpResponse>((resolve, reject) => {
      const urlObj = new URL(url);
      const client = http2.connect(`https://${urlObj.host}`);
      const chunks = [];
      let responseHeaders = {};

      client.on("error", reject);

      const req = client.request({
        ":method": "POST",
        ":path": urlObj.pathname,
        ":authority": urlObj.host,
        ":scheme": "https",
        ...headers,
      });

      req.on("response", (hdrs) => {
        responseHeaders = hdrs;
      });
      req.on("data", (chunk) => {
        chunks.push(chunk);
      });
      req.on("end", () => {
        client.close();
        resolve({
          status:
            typeof responseHeaders[":status"] === "number"
              ? responseHeaders[":status"]
              : Number(responseHeaders[":status"] || HTTP_STATUS.SERVER_ERROR),
          headers: responseHeaders,
          body: Buffer.concat(chunks),
        });
      });
      req.on("error", (err) => {
        client.close();
        reject(err);
      });

      if (signal) {
        signal.addEventListener("abort", () => {
          req.close();
          client.close();
          reject(new Error("Request aborted"));
        });
      }

      req.write(body);
      req.end();
    });
  }

  async execute({ model, body, stream, credentials, signal, log, upstreamExtraHeaders }) {
    const url = this.buildUrl();
    const headers = this.buildHeaders(credentials);
    mergeUpstreamExtraHeaders(headers, upstreamExtraHeaders);
    const transformedBody = await this.transformRequest(model, body, stream, credentials);

    try {
      const response: CursorHttpResponse = http2
        ? await this.makeHttp2Request(url, headers, transformedBody, signal)
        : await this.makeFetchRequest(url, headers, transformedBody, signal);

<<<<<<< Updated upstream
  /**
   * Emit the trailing SSE chunks (finish + usage + DONE) onto an already-open
   * stream. Called once driveH2 returns and ctx.endReason is set. The
   * mid-stream-error path emits an error chunk instead.
   */
  private finalizeSseStream(ctx: StreamCtx, body: { messages?: ChatMessage[] }) {
    if (ctx.midStreamError && ctx.totalText.length === 0) {
      const payload = {
        id: ctx.responseId,
        object: "chat.completion.chunk",
        created: ctx.created,
        model: ctx.model,
        choices: [],
        error: {
          message: ctx.midStreamError.message,
          type:
            ctx.midStreamError.status === HTTP_STATUS.RATE_LIMITED
              ? "rate_limit_error"
              : "api_error",
        },
      };
      ctx.emit(`data: ${JSON.stringify(payload)}\n\n`);
      ctx.emit("data: [DONE]\n\n");
      return;
    }
    if (!ctx.emittedRoleChunk) {
      // Edge case: empty response. Emit a role chunk so clients see at least
      // one delta before finish.
      emitChunk(ctx, { role: "assistant", content: "" });
    }

    // End-of-stream Composer inline tool-call fallback (decolua/9router#1335):
    // if the entire response arrived as a single big chunk (or the streaming
    // parser state never reached "ready"), try a full non-streaming parse on
    // the accumulated visible content so we still emit structured tool_calls
    // and don't leak the markers as plain text.
    if (isComposerModel(ctx.model) && !ctx.composerInlineToolCallsEmitted && ctx.totalText) {
      const parsed = parseComposerToolCalls(ctx.totalText);
      if (parsed.toolCalls.length > 0) {
        ctx.composerInlineToolCallsEmitted = true;
        // Replace totalText with the residual (markers stripped).
        ctx.totalText = parsed.content;
        for (const tc of parsed.toolCalls) {
          const toolCallIndex = ctx.emittedToolCallIndex++;
          ctx.toolCalls.push({
            id: tc.id,
            name: tc.function.name,
            argumentsJson: tc.function.arguments,
          });
          emitChunk(ctx, {
            tool_calls: [
              {
                index: toolCallIndex,
                id: tc.id,
                type: "function",
                function: { name: tc.function.name, arguments: tc.function.arguments },
              },
            ],
          });
        }
      }
    }

    // OpenAI finish_reason: "tool_calls" if the model invoked any declared
    // tool, else "stop". A turn with mixed text + tool_calls finishes with
    // "tool_calls" (the tool calls are the actionable signal for the client).
    const finishReason = ctx.toolCalls.length > 0 ? "tool_calls" : "stop";
    emitChunk(ctx, {}, finishReason);
    emitUsage(ctx, body);
    emitDone(ctx);
  }
=======
      if (response.status !== 200) {
        const errorText = response.body?.toString() || "Unknown error";
        const errorResponse = new Response(
          JSON.stringify({
            error: {
              message: `[${response.status}]: ${errorText}`,
              type: "invalid_request_error",
              code: "",
            },
          }),
          {
            status: response.status,
            headers: { "Content-Type": "application/json" },
          }
        );
        return { response: errorResponse, url, headers, transformedBody: body };
      }
>>>>>>> Stashed changes

      const transformedResponse =
        stream !== false
          ? this.transformProtobufToSSE(response.body, model, body)
          : this.transformProtobufToJSON(response.body, model, body);

      return { response: transformedResponse, url, headers, transformedBody: body };
    } catch (error) {
      const errorResponse = new Response(
        JSON.stringify({
          error: {
            message: error.message,
            type: "connection_error",
            code: "",
          },
        }),
        {
          status: HTTP_STATUS.SERVER_ERROR,
          headers: { "Content-Type": "application/json" },
        }
      );
      return { response: errorResponse, url, headers, transformedBody: body };
    }
  }

  transformProtobufToJSON(buffer, model, body) {
    const responseId = `chatcmpl-cursor-${Date.now()}`;
    const created = Math.floor(Date.now() / 1000);

    let offset = 0;
    let totalContent = "";
    const toolCalls = [];
    const toolCallsMap = new Map(); // Track streaming tool calls by ID
    const finalizedIds = new Set<string>();
    let frameCount = 0;

    debugLog(`[CURSOR BUFFER] Total length: ${buffer.length} bytes`);

    while (offset < buffer.length) {
      if (offset + 5 > buffer.length) {
        debugLog(
          `[CURSOR BUFFER] Reached end, offset=${offset}, remaining=${buffer.length - offset}`
        );
        break;
      }

      const flags = buffer[offset];
      const length = buffer.readUInt32BE(offset + 1);

      debugLog(
        `[CURSOR BUFFER] Frame ${frameCount + 1}: flags=0x${flags.toString(16).padStart(2, "0")}, length=${length}`
      );

      if (offset + 5 + length > buffer.length) {
        debugLog(
          `[CURSOR BUFFER] Incomplete frame, offset=${offset}, length=${length}, buffer.length=${buffer.length}`
        );
        break;
      }

      let payload = buffer.slice(offset + 5, offset + 5 + length);
      offset += 5 + length;
      frameCount++;

      payload = decompressPayload(payload, flags);
      if (!payload) {
        debugLog(`[CURSOR BUFFER] Frame ${frameCount}: decompression failed, skipping`);
        continue;
      }

      // Check for JSON error frames (byte guard: skip toString on non-JSON frames)
      if (payload.length > 0 && payload[0] === 0x7b) {
        try {
          const text = payload.toString("utf-8");
          if (text.includes('"error"')) {
            const hasContent = totalContent || toolCallsMap.size > 0;
            debugLog(
              `[CURSOR BUFFER] Error frame (hasContent=${hasContent}): ${text.slice(0, 500)}`
            );
            if (hasContent) {
              break;
            }
            return createErrorResponse(JSON.parse(text));
          }
        } catch {}
      }

      const result = extractTextFromResponse(new Uint8Array(payload));
      debugLog(`[CURSOR DECODED] Frame ${frameCount}:`, result);

      if (result.error) {
        const hasContent = totalContent || toolCallsMap.size > 0;
        debugLog(`[CURSOR BUFFER] Decoded error (hasContent=${hasContent}): ${result.error}`);
        // If we already have content, treat error as stream termination
        if (hasContent) {
          break;
        }
        return new Response(
          JSON.stringify({
            error: {
              message: result.error,
              type: "rate_limit_error",
              code: "rate_limited",
            },
          }),
          {
            status: HTTP_STATUS.RATE_LIMITED,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      if (result.toolCall) {
        const tc = result.toolCall;

        if (toolCallsMap.has(tc.id)) {
          // Accumulate arguments for existing tool call
          const existing = toolCallsMap.get(tc.id);
          existing.function.arguments += tc.function.arguments;
          existing.isLast = tc.isLast;
        } else {
          // New tool call
          toolCallsMap.set(tc.id, { ...tc });
        }

        // Push to final array when isLast is true
        if (tc.isLast) {
          const finalToolCall = toolCallsMap.get(tc.id);
          finalizedIds.add(tc.id);
          toolCalls.push({
            id: finalToolCall.id,
            type: finalToolCall.type,
            function: {
              name: finalToolCall.function.name,
              arguments: finalToolCall.function.arguments,
            },
          });
        }
      }

      if (result.text) totalContent += result.text;
    }

<<<<<<< Updated upstream
    // Non-streaming: chat.completion shape. Include tool_calls in the
    // assistant message when the model invoked any (Phase 5).

    // Composer DeepSeek inline tool-call fallback (decolua/9router#1335): for
    // non-streaming requests, the streaming parser never runs — parse the
    // accumulated visible content once here instead.
    if (isComposerModel(ctx.model) && !ctx.composerInlineToolCallsEmitted && ctx.totalText) {
      const parsed = parseComposerToolCalls(ctx.totalText);
      if (parsed.toolCalls.length > 0) {
        ctx.composerInlineToolCallsEmitted = true;
        ctx.totalText = parsed.content;
        for (const tc of parsed.toolCalls) {
          ctx.toolCalls.push({
            id: tc.id,
            name: tc.function.name,
            argumentsJson: tc.function.arguments,
          });
        }
      }
    }

    const usage = buildCursorUsage(ctx, body);
    const finishReason = ctx.toolCalls.length > 0 ? "tool_calls" : "stop";
    const message: {
      role: "assistant";
      content: string | null;
      reasoning_content?: string;
      tool_calls?: Array<{
        id: string;
        type: "function";
        function: { name: string; arguments: string };
      }>;
    } = {
      role: "assistant",
      content: ctx.totalText.length > 0 ? ctx.totalText : null,
    };
    if (ctx.thinkingText.length > 0) {
      // Composer: strip the visible reply (after `</think>`) from the reasoning
      // payload so it is not duplicated — it already lives in message.content
      // via the processFrame thinking handler.
      const reasoningPayload = isComposerModel(ctx.model)
        ? composerReasoningRemainder(ctx.thinkingText)
        : ctx.thinkingText;
      if (reasoningPayload.length > 0) {
        message.reasoning_content = reasoningPayload;
=======
    debugLog(
      `[CURSOR BUFFER] Parsed ${frameCount} frames, toolCallsMap size: ${toolCallsMap.size}, finalized toolCalls: ${toolCalls.length}`
    );

    // Finalize all remaining tool calls in map (in case stream ended without isLast=true)
    for (const [id, tc] of toolCallsMap.entries()) {
      // Check if already in final array
      if (!finalizedIds.has(id)) {
        debugLog(`[CURSOR BUFFER] Finalizing incomplete tool call: ${id}, isLast=${tc.isLast}`);
        toolCalls.push({
          id: tc.id,
          type: tc.type,
          function: {
            name: tc.function.name,
            arguments: tc.function.arguments,
          },
        });
>>>>>>> Stashed changes
      }
    }

    debugLog(`[CURSOR BUFFER] Final toolCalls count: ${toolCalls.length}`);

    const message: Record<string, unknown> = {
      role: "assistant",
      content: totalContent || null,
    };

    if (toolCalls.length > 0) {
      message.tool_calls = toolCalls;
    }

    const usage = estimateUsage(body, totalContent.length, FORMATS.OPENAI);

    const completion = {
      id: responseId,
      object: "chat.completion",
      created,
      model,
      choices: [
        {
          index: 0,
          message,
          finish_reason: toolCalls.length > 0 ? "tool_calls" : "stop",
        },
      ],
      usage,
    };

    return new Response(JSON.stringify(completion), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  transformProtobufToSSE(buffer, model, body) {
    const responseId = `chatcmpl-cursor-${Date.now()}`;
    const created = Math.floor(Date.now() / 1000);

    const chunks = [];
    let offset = 0;
    let totalContent = "";
    const toolCalls = [];
    const toolCallsMap = new Map(); // Track streaming tool calls by ID
    const finalizedIds = new Set<string>();
    const emittedToolCallIds = new Set<string>();
    let frameCount = 0;

    debugLog(`[CURSOR BUFFER SSE] Total length: ${buffer.length} bytes`);

    while (offset < buffer.length) {
      if (offset + 5 > buffer.length) {
        debugLog(
          `[CURSOR BUFFER SSE] Reached end, offset=${offset}, remaining=${buffer.length - offset}`
        );
        break;
      }

      const flags = buffer[offset];
      const length = buffer.readUInt32BE(offset + 1);

      debugLog(
        `[CURSOR BUFFER SSE] Frame ${frameCount + 1}: flags=0x${flags.toString(16).padStart(2, "0")}, length=${length}`
      );

      if (offset + 5 + length > buffer.length) {
        debugLog(
          `[CURSOR BUFFER SSE] Incomplete frame, offset=${offset}, length=${length}, buffer.length=${buffer.length}`
        );
        break;
      }

      let payload = buffer.slice(offset + 5, offset + 5 + length);
      offset += 5 + length;
      frameCount++;

      payload = decompressPayload(payload, flags);
      if (!payload) {
        debugLog(`[CURSOR BUFFER SSE] Frame ${frameCount}: decompression failed, skipping`);
        continue;
      }

      // Check for JSON error frames (byte-guard: only decode if starts with '{')
      if (payload[0] === 0x7b) {
        try {
          const text = payload.toString("utf-8");
          if (text.includes('"error"')) {
            const hasContent = chunks.length > 0 || totalContent || toolCallsMap.size > 0;
            debugLog(
              `[CURSOR BUFFER SSE] Error frame (hasContent=${hasContent}): ${text.slice(0, 500)}`
            );
            if (hasContent) {
              break;
            }
            return createErrorResponse(JSON.parse(text));
          }
        } catch {}
      }

      const result = extractTextFromResponse(new Uint8Array(payload));
      debugLog(`[CURSOR DECODED SSE] Frame ${frameCount}:`, result);

      if (result.error) {
        const hasContent = chunks.length > 0 || totalContent || toolCallsMap.size > 0;
        debugLog(`[CURSOR BUFFER SSE] Decoded error (hasContent=${hasContent}): ${result.error}`);
        // If we already have content, treat error as stream termination
        if (hasContent) {
          break;
        }
        return new Response(
          JSON.stringify({
            error: {
              message: result.error,
              type: "rate_limit_error",
              code: "rate_limited",
            },
          }),
          {
            status: HTTP_STATUS.RATE_LIMITED,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      if (result.toolCall) {
        const tc = result.toolCall;

        if (chunks.length === 0) {
          chunks.push(
            `data: ${JSON.stringify({
              id: responseId,
              object: "chat.completion.chunk",
              created,
              model,
              choices: [
                {
                  index: 0,
                  delta: { role: "assistant", content: "" },
                  finish_reason: null,
                },
              ],
            })}\n\n`
          );
        }

        if (toolCallsMap.has(tc.id)) {
          // Accumulate arguments for existing tool call
          const existing = toolCallsMap.get(tc.id);
          const oldArgsLen = existing.function.arguments.length;
          existing.function.arguments += tc.function.arguments;
          existing.isLast = tc.isLast;

          // Stream the delta arguments
          if (tc.function.arguments) {
            emittedToolCallIds.add(tc.id);
            chunks.push(
              `data: ${JSON.stringify({
                id: responseId,
                object: "chat.completion.chunk",
                created,
                model,
                choices: [
                  {
                    index: 0,
                    delta: {
                      tool_calls: [
                        {
                          index: existing.index,
                          id: tc.id,
                          type: "function",
                          function: {
                            name: tc.function.name,
                            arguments: tc.function.arguments,
                          },
                        },
                      ],
                    },
                    finish_reason: null,
                  },
                ],
              })}\n\n`
            );
          }
        } else {
          // New tool call - assign index and add to map
          const toolCallIndex = toolCalls.length;
          finalizedIds.add(tc.id);
          toolCalls.push({ ...tc, index: toolCallIndex });
          toolCallsMap.set(tc.id, { ...tc, index: toolCallIndex });

          // Stream initial tool call with name
          emittedToolCallIds.add(tc.id);
          chunks.push(
            `data: ${JSON.stringify({
              id: responseId,
              object: "chat.completion.chunk",
              created,
              model,
              choices: [
                {
                  index: 0,
                  delta: {
                    tool_calls: [
                      {
                        index: toolCallIndex,
                        id: tc.id,
                        type: "function",
                        function: {
                          name: tc.function.name,
                          arguments: tc.function.arguments,
                        },
                      },
                    ],
                  },
                  finish_reason: null,
                },
              ],
            })}\n\n`
          );
        }
      }

      if (result.text) {
        totalContent += result.text;
        chunks.push(
          `data: ${JSON.stringify({
            id: responseId,
            object: "chat.completion.chunk",
            created,
            model,
            choices: [
              {
                index: 0,
                delta:
                  chunks.length === 0 && toolCalls.length === 0
                    ? { role: "assistant", content: result.text }
                    : { content: result.text },
                finish_reason: null,
              },
            ],
          })}\n\n`
        );
      }
    }

    debugLog(
      `[CURSOR BUFFER SSE] Parsed ${frameCount} frames, toolCallsMap size: ${toolCallsMap.size}, toolCalls array: ${toolCalls.length}`
    );

    // Finalize all remaining tool calls in map (stream may have ended without isLast=true)
    for (const [id, tc] of toolCallsMap.entries()) {
      if (!finalizedIds.has(id)) {
        debugLog(`[CURSOR BUFFER SSE] Finalizing incomplete tool call: ${id}, isLast=${tc.isLast}`);
        const toolCallIndex = toolCalls.length;
        toolCalls.push({
          id: tc.id,
          type: tc.type,
          index: toolCallIndex,
          function: {
            name: tc.function.name,
            arguments: tc.function.arguments,
          },
        });

        // Emit SSE chunk for the finalized tool call if not already emitted
        if (!emittedToolCallIds.has(tc.id)) {
          chunks.push(
            `data: ${JSON.stringify({
              id: responseId,
              object: "chat.completion.chunk",
              created,
              model,
              choices: [
                {
                  index: 0,
                  delta: {
                    tool_calls: [
                      {
                        index: toolCallIndex,
                        id: tc.id,
                        type: "function",
                        function: {
                          name: tc.function.name,
                          arguments: tc.function.arguments,
                        },
                      },
                    ],
                  },
                  finish_reason: null,
                },
              ],
            })}\n\n`
          );
        }
      }
    }

    if (chunks.length === 0 && toolCalls.length === 0) {
      chunks.push(
        `data: ${JSON.stringify({
          id: responseId,
          object: "chat.completion.chunk",
          created,
          model,
          choices: [
            {
              index: 0,
              delta: { role: "assistant", content: "" },
              finish_reason: null,
            },
          ],
        })}\n\n`
      );
    }

    const usage = estimateUsage(body, totalContent.length, FORMATS.OPENAI);

    chunks.push(
      `data: ${JSON.stringify({
        id: responseId,
        object: "chat.completion.chunk",
        created,
        model,
        choices: [
          {
            index: 0,
            delta: {},
            finish_reason: toolCalls.length > 0 ? "tool_calls" : "stop",
          },
        ],
        usage,
      })}\n\n`
    );
    chunks.push("data: [DONE]\n\n");

    return new Response(chunks.join(""), {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  }

  async refreshCredentials() {
    return null;
  }
}

export default CursorExecutor;
