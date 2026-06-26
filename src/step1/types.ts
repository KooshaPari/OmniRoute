// Step-1 PR1: types shared across the bun/hono/bifrost HTTP sidecar layer.
// Single source of truth — no duplicated interfaces.

export type ProviderId =
  | "openai"
  | "anthropic"
  | "google"
  | "mistral"
  | "cohere"
  | "groq"
  | "openrouter"
  | "together"
  | "fireworks"
  | "deepseek"
  | "xai"
  | "perplexity"
  | "replicate"
  | "bedrock"
  | "azure"
  | "vertex"
  | "github-models"
  | "huggingface"
  | "anyscale"
  | "deepinfra"
  | "zai"
  | "novita"
  | "alibaba";

export type ProviderKind = "api-key" | "oauth-device-code" | "web-cookie";

export type ProviderStatus = "ready" | "needs-auth" | "needs-config" | "unsupported" | "error";

export interface ProviderDescriptor {
  readonly id: ProviderId;
  readonly kind: ProviderKind;
  readonly label: string;
  readonly baseUrl: string | null;
  readonly modelsEndpoint: string | null;
  readonly supportsStreaming: boolean;
  readonly supportsToolUse: boolean;
  readonly notes: string | undefined;
}

export interface ProviderReport {
  readonly descriptor: ProviderDescriptor;
  readonly status: ProviderStatus;
  readonly authSource: "env" | "config" | "interactive" | "missing";
  readonly lastChecked: number; // epoch ms
}

export interface ChatMessage {
  readonly role: "system" | "user" | "assistant" | "tool";
  readonly content: string;
}

export interface ChatRequest {
  readonly model: string;
  readonly messages: readonly ChatMessage[];
  readonly temperature: number | undefined;
  readonly maxTokens: number | undefined;
  readonly stream: boolean;
  readonly tools: readonly unknown[] | undefined;
}

export interface ChatResponse {
  readonly id: string;
  readonly model: string;
  readonly provider: ProviderId;
  readonly content: string;
  readonly usage: {
    readonly promptTokens: number;
    readonly completionTokens: number;
    readonly totalTokens: number;
  };
}
