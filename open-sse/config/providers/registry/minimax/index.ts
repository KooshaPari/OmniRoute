import type { RegistryEntry } from "../../shared.ts";
import { getAnthropicCompatHeaders, ANTHROPIC_VERSION_HEADER } from "../../shared.ts";

export const minimaxProvider: RegistryEntry = {
  id: "minimax",
  alias: "minimax",
  format: "claude",
  executor: "default",
  baseUrl: "https://api.minimax.io/anthropic/v1/messages",
  modelsUrl: "https://api.minimax.io/v1/models",
  urlSuffix: "?beta=true",
  authType: "apikey",
  authHeader: "bearer",
  headers: getAnthropicCompatHeaders(),
  models: [
    // T12/T28: MiniMax default upgraded from M2.5 to M2.7 to M3
    // #3110: MiniMax M3 — frontier coding model with 1M context
    { id: "MiniMax-M3", name: "MiniMax M3", contextLength: 1048576, supportsVision: true },
  ],
};
