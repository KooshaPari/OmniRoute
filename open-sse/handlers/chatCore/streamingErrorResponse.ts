/**
 * Build a streaming SSE error response from upstream failures.
 *
 * Lifted verbatim out of chatCore.ts so the upstream consumer does not
 * need to ship 4,900+ lines of handler logic just to surface an error
 * to its own client.  The function is pure: it takes primitive inputs
 * and returns an immutable-shape ExecuteResult whose .response is a
 * pre-built Response carrying a text/event-stream body that
 * OpenAI/Claude/Gemini-style clients can parse.
 *
 * Wire format:
 *
 *   data: { "error": { "message": "...", "code": "...", "type": "..." } }\n\n
 *   data: [DONE]\n\n
 *
 * Headers always include:
 *   Content-Type: text/event-stream
 *   Cache-Control: no-cache, no-transform
 *   Connection: keep-alive
 *   X-Accel-Buffering: no
 *
 * ...so the response streams correctly through every reverse-proxy
 * tier (nginx, Envoy, Cloudflare, Vercel).
 */
export function createStreamingErrorResult(
  statusCode: number,
  message: string,
  code?: string,
  type?: string
) {
  const errorBody = buildErrorBody(statusCode, message);
  if (code) {
    errorBody.error.code = code;
  }
  if (type) {
    errorBody.error.type = type;
  }

  const body = `data: ${JSON.stringify(errorBody)}\n\ndata: [DONE]\n\n`;

  return {
    success: false as const,
    status: statusCode,
    error: message,
    response: new Response(body, {
      status: statusCode,
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    }),
  };
}

/**
 * Build the JSON error body that ships inside the SSE frame.
 *
 * Internal to createStreamingErrorResult.  Exported so sibling
 * helpers can re-use the same shape (e.g. when the non-streaming
 * path wants to return the same JSON body as the streaming fallback).
 */
export function buildErrorBody(
  statusCode: number,
  message: string
): {
  error: { message: string; type: string; code: string | null };
} {
  return {
    error: {
      message,
      type: errorTypeFromStatus(statusCode),
      code: null,
    },
  };
}

/**
 * Map an HTTP status code to the OpenAI-style error.type string used
 * by OmniRoute's error taxonomy. Matches the upstream mapping that
 * OpenAI publishes in their API reference (api_error,
 * invalid_request_error, authentication_error, rate_limit_error,
 * server_error).
 */
function errorTypeFromStatus(statusCode: number): string {
  if (statusCode === 401 || statusCode === 403) return "authentication_error";
  if (statusCode === 429) return "rate_limit_error";
  if (statusCode >= 500) return "server_error";
  if (statusCode >= 400) return "invalid_request_error";
  return "api_error";
}
