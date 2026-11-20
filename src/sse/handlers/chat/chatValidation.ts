/**
 * Early chat request body validation.
 *
 * Extracted from chat.ts — validates messages, model, and scalar params
 * before any routing or upstream call, returning a 400 Response on failure.
 */

import { errorResponse } from "@omniroute/open-sse/utils/error.ts";
import { HTTP_STATUS } from "@omniroute/open-sse/config/constants.ts";
import * as log from "../utils/logger";

/**
 * Validate the chat request body for messages, model type, and scalar params.
 * Returns `Response` on validation failure, `null` when the body is valid.
 *
 * This runs early — before any routing/model resolution — so the client gets
 * a clear 400 with the offending field name instead of a misleading 404.
 */
export function validateChatBody(
  body: Record<string, unknown>,
  sourceFormat: string
): Response | null {
  // --- Messages validation (#5110, #6402) ---
  const msgBody = body as { messages?: unknown; input?: unknown };
  if ("messages" in msgBody && !Array.isArray(msgBody.messages)) {
    log.warn("CHAT", "Rejecting request with non-array messages");
    return errorResponse(HTTP_STATUS.BAD_REQUEST, "messages: Expected array");
  }
  if (Array.isArray(msgBody.messages) && msgBody.messages.length === 0) {
    log.warn("CHAT", "Rejecting request with empty messages array");
    return errorResponse(HTTP_STATUS.BAD_REQUEST, "messages: at least one message is required");
  }
  if (!("messages" in msgBody) && !("input" in msgBody) && sourceFormat !== "antigravity") {
    log.warn("CHAT", "Rejecting request with missing messages");
    return errorResponse(HTTP_STATUS.BAD_REQUEST, "messages: Expected array, received undefined");
  }

  // --- Model type validation (#6407) ---
  const rawModel = body.model;
  if (rawModel !== undefined && rawModel !== null && typeof rawModel !== "string") {
    log.warn("CHAT", `Rejecting non-string model (typeof=${typeof rawModel})`);
    return errorResponse(
      HTTP_STATUS.BAD_REQUEST,
      `model: Expected string, received ${Array.isArray(rawModel) ? "array" : typeof rawModel}`
    );
  }

  // --- Scalar param validation (#6412) ---
  // Kept narrow to widely-supported OpenAI-spec params so we don't reject
  // legitimate provider-specific fields.
  const b = body as {
    temperature?: unknown;
    top_p?: unknown;
    max_tokens?: unknown;
    n?: unknown;
  };
  const badParam = (name: string, msg: string) =>
    errorResponse(HTTP_STATUS.BAD_REQUEST, `${name}: ${msg}`);
  if (b.temperature !== undefined) {
    if (typeof b.temperature !== "number" || Number.isNaN(b.temperature)) {
      return badParam("temperature", "must be a number");
    }
    if (b.temperature < 0 || b.temperature > 2) {
      return badParam("temperature", "must be between 0 and 2");
    }
  }
  if (b.top_p !== undefined) {
    if (typeof b.top_p !== "number" || Number.isNaN(b.top_p)) {
      return badParam("top_p", "must be a number");
    }
    if (b.top_p < 0 || b.top_p > 1) {
      return badParam("top_p", "must be between 0 and 1");
    }
  }
  if (b.max_tokens !== undefined) {
    if (typeof b.max_tokens !== "number" || !Number.isInteger(b.max_tokens) || b.max_tokens < 1) {
      return badParam("max_tokens", "must be a positive integer");
    }
  }
  if (b.n !== undefined) {
    if (typeof b.n !== "number" || !Number.isInteger(b.n) || b.n < 1) {
      return badParam("n", "must be a positive integer");
    }
  }

  return null;
}
