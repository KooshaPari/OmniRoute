/**
 * Format-skills helper leaf.
 *
 * Lifted verbatim from chatCore.ts so the upstream consumer does not
 * need to ship 4,900+ lines of handler logic just to map a wire format
 * to its skills provider / model id.
 *
 * The Skills API (Anthropic /v1/skills, OpenAI /v1/skills,
 * Gemini function_declarations) needs a per-format provider label
 * and a per-format model id. Both are static lookups, so they live
 * here as pure, exhaustively-typed functions.
 */
import { FORMATS } from "../../translator/formats";

export type SkillsProviderLabel = "openai" | "anthropic" | "google" | "other";

/**
 * Map a wire format string to the Skills-API provider label.
 *
 * - FORMATS.CLAUDE -> "anthropic"
 * - FORMATS.GEMINI -> "google"
 * - everything else -> "openai" (the default wire format)
 */
export function getSkillsProviderForFormat(format: string): SkillsProviderLabel {
  switch (format) {
    case FORMATS.CLAUDE:
      return "anthropic";
    case FORMATS.GEMINI:
      return "google";
    default:
      return "openai";
  }
}

/**
 * Map a wire format string to the canonical Skills-API model id.
 *
 * - FORMATS.CLAUDE -> "claude"
 * - FORMATS.GEMINI -> "gemini"
 * - everything else -> "openai"
 */
export function getSkillsModelIdForFormat(format: string): string {
  switch (format) {
    case FORMATS.CLAUDE:
      return "claude";
    case FORMATS.GEMINI:
      return "gemini";
    default:
      return "openai";
  }
}
