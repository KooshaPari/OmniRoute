import type { RegistryEntry } from "../../shared.ts";

// ClinePass: OpenAI-compat proxy to https://api.cline.bot/api/v1.
// Sourced from cline/cline clinepass.mdx (PR #11986 — "Forcefully enable
// ClinePass on the CLI"). Tracks diegosouzapw/OmniRoute#5518.
// Auth: `Authorization: Bearer $CLINE_API_KEY`.
export const clinepassProvider: RegistryEntry = {
  id: "clinepass",
  alias: "clinepass",
  format: "openai",
  executor: "default",
  baseUrl: "https://api.cline.bot/api/v1/chat/completions",
  authType: "apikey",
  authHeader: "bearer",
  // Real model list — see cline/cline docs/getting-started/clinepass.mdx table.
  // passthroughModels: true keeps the catalog fresh via live /v1/models
  // discovery at runtime.
  models: [
    { id: "cline-pass/glm-5.2",           name: "GLM 5.2" },
    { id: "cline-pass/kimi-k2.7-code",    name: "Kimi K2.7 Code" },
    { id: "cline-pass/kimi-k2.6",         name: "Kimi K2.6" },
    { id: "cline-pass/deepseek-v4-pro",   name: "DeepSeek V4 Pro" },
    { id: "cline-pass/deepseek-v4-flash", name: "DeepSeek V4 Flash" },
    { id: "cline-pass/mimo-v2.5",         name: "Mimo V2.5" },
    { id: "cline-pass/mimo-v2.5-pro",     name: "Mimo V2.5 Pro" },
    { id: "cline-pass/minimax-m3",        name: "MiniMax M3" },
    { id: "cline-pass/qwen3.7-max",       name: "Qwen3.7 Max" },
    { id: "cline-pass/qwen3.7-plus",      name: "Qwen3.7 Plus" },
  ],
  passthroughModels: true,
};
