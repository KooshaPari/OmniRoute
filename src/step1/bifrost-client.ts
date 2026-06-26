// Step-1 PR1: bifrost sidecar client.
// @maximhq/bifrost is a Go-based CLI gateway; we talk HTTP to it.
//
//   npm install @maximhq/bifrost   # downloads the Go binary
//   import { startBifrost } from "@maximhq/bifrost";   // spawns + returns URL
//
// Our TS layer never re-implements LLM logic — it just routes ChatRequest
// to whichever provider bifrost has loaded. This keeps the OmniRoute
// migration minimal: replace `src/lib/llm/*` (Next.js + hand-rolled
// provider code) with one HTTP call per chat.
import type { ChatRequest, ChatResponse, ProviderId } from "./types.js";

export interface BifrostHandle {
  readonly url: string; // e.g. http://127.0.0.1:49152
  readonly version: string; // bifrost semver
  readonly loadedProviders: readonly ProviderId[];
}

export async function probeBifrost(url: string): Promise<BifrostHandle> {
  const res = await fetch(`${url}/health`);
  if (!res.ok) {
    throw new Error(`bifrost sidecar not reachable at ${url}: ${res.status}`);
  }
  const body = (await res.json()) as {
    version: string;
    providers: readonly ProviderId[];
  };
  return { url, version: body.version, loadedProviders: body.providers };
}

export async function chat(
  bifrost: BifrostHandle,
  provider: ProviderId,
  req: ChatRequest
): Promise<ChatResponse> {
  const url = `${bifrost.url}/v1/${provider}/chat/completions`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      model: req.model,
      messages: req.messages,
      temperature: req.temperature,
      max_tokens: req.maxTokens,
      stream: req.stream,
      tools: req.tools,
    }),
  });
  if (!res.ok) {
    throw new Error(`bifrost ${provider} ${req.model}: ${res.status} ${await res.text()}`);
  }
  return (await res.json()) as ChatResponse;
}

export async function listModels(
  bifrost: BifrostHandle,
  provider: ProviderId
): Promise<readonly string[]> {
  const res = await fetch(`${bifrost.url}/v1/${provider}/models`);
  if (!res.ok) {
    throw new Error(`bifrost list models ${provider}: ${res.status}`);
  }
  const body = (await res.json()) as { data: readonly { id: string }[] };
  return body.data.map((m) => m.id);
}
