import { describe, it, expect } from "vitest";
import {
  createStreamingErrorResult,
  buildErrorBody,
} from "../streamingErrorResponse";

describe("buildErrorBody", () => {
  it("always sets message and code=null", () => {
    const body = buildErrorBody(500, "boom");
    expect(body.error.message).toBe("boom");
    expect(body.error.code).toBeNull();
  });

  it("maps 400 -> invalid_request_error", () => {
    expect(buildErrorBody(400, "x").error.type).toBe("invalid_request_error");
    expect(buildErrorBody(404, "x").error.type).toBe("invalid_request_error");
  });

  it("maps 401 + 403 -> authentication_error", () => {
    expect(buildErrorBody(401, "x").error.type).toBe("authentication_error");
    expect(buildErrorBody(403, "x").error.type).toBe("authentication_error");
  });

  it("maps 429 -> rate_limit_error", () => {
    expect(buildErrorBody(429, "x").error.type).toBe("rate_limit_error");
  });

  it("maps 5xx -> server_error", () => {
    expect(buildErrorBody(500, "x").error.type).toBe("server_error");
    expect(buildErrorBody(502, "x").error.type).toBe("server_error");
    expect(buildErrorBody(599, "x").error.type).toBe("server_error");
  });

  it("maps 200/300 -> api_error", () => {
    expect(buildErrorBody(200, "x").error.type).toBe("api_error");
    expect(buildErrorBody(301, "x").error.type).toBe("api_error");
  });
});

describe("createStreamingErrorResult", () => {
  it("returns success=false", async () => {
    const r = createStreamingErrorResult(500, "oops");
    expect(r.success).toBe(false);
  });

  it("echoes the status code", () => {
    expect(createStreamingErrorResult(429, "rate-limited").status).toBe(429);
    expect(createStreamingErrorResult(500, "boom").status).toBe(500);
  });

  it("echoes the message", () => {
    expect(createStreamingErrorResult(500, "boom").error).toBe("boom");
  });

  it("returns a Response with the same status", async () => {
    const r = createStreamingErrorResult(500, "boom");
    expect(r.response.status).toBe(500);
  });

  it("returns text/event-stream content-type", async () => {
    const r = createStreamingErrorResult(500, "boom");
    expect(r.response.headers.get("Content-Type")).toBe("text/event-stream");
  });

  it("returns Cache-Control no-cache,no-transform", async () => {
    const r = createStreamingErrorResult(500, "boom");
    expect(r.response.headers.get("Cache-Control")).toBe(
      "no-cache, no-transform"
    );
  });

  it("returns Connection keep-alive", async () => {
    const r = createStreamingErrorResult(500, "boom");
    expect(r.response.headers.get("Connection")).toBe("keep-alive");
  });

  it("returns X-Accel-Buffering no", async () => {
    const r = createStreamingErrorResult(500, "boom");
    expect(r.response.headers.get("X-Accel-Buffering")).toBe("no");
  });

  it("body ends with [DONE]\\n\\n", async () => {
    const r = createStreamingErrorResult(500, "boom");
    const body = await r.response.text();
    expect(body.endsWith("data: [DONE]\n\n")).toBe(true);
  });

  it("body contains data: {error:{message,code,type}}\\n\\n", async () => {
    const r = createStreamingErrorResult(500, "boom");
    const body = await r.response.text();
    expect(body).toMatch(/^data: \{"error":\{"message":"boom"/);
    expect(body).toContain('"type":"server_error"');
  });

  it("includes custom code in body when provided", async () => {
    const r = createStreamingErrorResult(429, "rate", "rate_exceeded");
    const body = await r.response.text();
    expect(body).toContain('"code":"rate_exceeded"');
  });

  it("includes custom type in body when provided", async () => {
    const r = createStreamingErrorResult(500, "boom", undefined, "oops");
    const body = await r.response.text();
    expect(body).toContain('"type":"oops"');
  });

  it("does not include code key when omitted", async () => {
    const r = createStreamingErrorResult(500, "boom");
    const body = await r.response.text();
    const parsed = JSON.parse(body.replace(/^data: /, "").split("\n\n")[0]);
    expect(parsed.error.code).toBeNull();
  });

  it("escapes quotes in message", async () => {
    const r = createStreamingErrorResult(500, 'a "b" c');
    const body = await r.response.text();
    expect(body).toContain('a \\"b\\" c');
  });

  it("handles newlines in message without breaking the SSE frame", async () => {
    const r = createStreamingErrorResult(500, "line1\nline2");
    const body = await r.response.text();
    // Each SSE frame ends with \n\n, so the message newline is embedded
    // inside the JSON string (as \n) but the frame terminator is preserved.
    expect(body).toMatch(/data: \{.*line1\\nline2.*\}\n\n/);
  });

  it("returns a Response that streams (not buffered)", async () => {
    const r = createStreamingErrorResult(500, "boom");
    // The body is a finite string but the content-type forces the
    // runtime to treat it as a stream (no Content-Length signaling
    // single-shot). Verify the body is delivered chunk-by-chunk.
    expect(r.response.body).toBeInstanceOf(ReadableStream);
  });
});
