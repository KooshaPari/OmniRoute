import type { RegistryEntry } from "../../shared.ts";

export const sensenovaProvider: RegistryEntry = {
  id: "sensenova",
  alias: "sensenova",
  format: "openai",
  executor: "default",
  baseUrl: "https://token.sensenova.cn/v1/chat/completions",
  authType: "apikey",
  authHeader: "bearer",
  // SenseNova Token Plan (validated 2026-07-06): the Token Plan endpoint is
  // OpenAI-compatible but enforces max_tokens in [1, 65536]. Its /models list
  // also currently advertises sensenova-u1-fast, but chat completions return
  // 404 "model is not found" for that model; U1 Fast belongs to image flows.
  models: [
    { id: "SenseNova-V6.5-Pro", name: "SenseNova V6.5 Pro", contextLength: 131072 },
    { id: "SenseNova-V6.5-Turbo", name: "SenseNova V6.5 Turbo", contextLength: 131072 },
    { id: "sensenova-6.7-flash-lite", name: "SenseNova 6.7 Flash-Lite" },
    // DeepSeek V4 Flash is served on SenseNova's free Token Plan (9router#2233).
    { id: "deepseek-v4-flash", name: "DeepSeek V4 Flash" },
    { id: "SenseChat-5", name: "SenseChat 5", contextLength: 131072 },
    { id: "SenseChat-5-Cantonese", name: "SenseChat 5 Cantonese", contextLength: 32768 },
    { id: "SenseChat-Turbo", name: "SenseChat Turbo", contextLength: 4096 },
    { id: "SenseChat-Vision", name: "SenseChat Vision", contextLength: 4096 },
    { id: "SenseChat-Character", name: "SenseChat Character", contextLength: 8192 },
    { id: "sensechat", name: "SenseChat" },
  ],
};
