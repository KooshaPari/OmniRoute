const OPENAI_FINISH_REASONS = new Set([
  "stop",
  "length",
  "tool_calls",
  "content_filter",
  "function_call",
]);

const SAFETY_FINISH_REASONS = new Set([
  "safety",
  "recitation",
  "blocklist",
  "prohibited_content",
  "content_filtered",
  "policy_violation",
  "malformed_response",
]);

// Gemini/Antigravity reasons that indicate an aborted turn rather than a
// successful completion. Claude translators map these to `tool_use` so callers
// do not mistake a failed tool call for a clean end_turn.
const ABORT_FINISH_REASONS = new Set([
  "malformed_function_call",
  "unexpected_tool_call",
  "finish_reason_unspecified",
  "other",
  "language",
  "no_image",
]);

export function isAbortFinishReason(value: unknown): boolean {
  return typeof value === "string" && ABORT_FINISH_REASONS.has(value.toLowerCase());
}

export function normalizeOpenAICompatibleFinishReason(value: unknown): unknown {
  if (typeof value !== "string") return value;

  const normalized = value.toLowerCase();
  if (OPENAI_FINISH_REASONS.has(normalized)) return normalized;
  if (normalized === "max_tokens") return "length";
  if (SAFETY_FINISH_REASONS.has(normalized)) return "content_filter";

  return normalized;
}

export function normalizeOpenAICompatibleFinishReasonString(
  value: unknown,
  fallback = "stop"
): string {
  const normalized = normalizeOpenAICompatibleFinishReason(value);
  return typeof normalized === "string" && normalized ? normalized : fallback;
}
