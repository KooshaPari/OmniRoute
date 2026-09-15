/**
 * Early request-body validation for chat handler.
 *
 * Extracted from chat.ts to reduce the size of handleChatImplementation.
 * Validates message shape, model type, and scalar parameters before any
 * routing or upstream call is attempted.
 */

import { HTTP_STATUS } from "@omniroute/open-sse/config/constants.ts";
import { errorResponse } from "@omniroute/open-sse/utils/error.ts";
import type { Response as NodeResponse } from "node-fetch";

/**
 * Validate the messages array, model type, and common scalar params on a
 * chat request body.  Returns an error `Response` when validation fails,
 * or `null` when the body is acceptable.
 */
export function validateChatRequestBody(
  body: Record<string, unknown>,
  sourceFormat: string
): NodeResponse | Response | null {
  // Early guard: an invalid `messages` field is rejected here with a clear
  // OmniRoute-level 400 before any routing or upstream call (#5110, #6402).
  const msgBody = body as { messages?: unknown; input?: unknown };
  if ("messages" in msgBody && !Array.isArray(msgBody.messages)) {
    return errorResponse(HTTP_STATUS.BAD_REQUEST, "messages: Expected array");
  }
  if (Array.isArray(msgBody.messages) && msgBody.messages.length === 0) {
    return errorResponse(HTTP_STATUS.BAD_REQUEST, "messages: at least one message is required");
  }
  if (!("messages" in msgBody) && !("input" in msgBody) && sourceFormat !== "antigravity") {
    return errorResponse(HTTP_STATUS.BAD_REQUEST, "messages: Expected array, received undefined");
  }

  // Reject non-string `model` before it reaches downstream code that calls
  // `.toLowerCase()` / `.split()` / `.startsWith()` on it (crash-then-500 with an
  // empty body, escaping the error sanitizer — #6407).
  const rawModel = body.model;
  if (rawModel !== undefined && rawModel !== null && typeof rawModel !== "string") {
    return errorResponse(
      HTTP_STATUS.BAD_REQUEST,
      `model: Expected string, received ${Array.isArray(rawModel) ? "array" : typeof rawModel}`
    );
  }

  // Early schema validation for scalar params BEFORE provider/model resolution (#6412).
  {
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
  }

  return null;
}
