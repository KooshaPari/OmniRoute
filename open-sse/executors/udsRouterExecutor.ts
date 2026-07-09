// UDS Router Executor — proxies OpenAI-compatible requests to the omniroute Rust
// data plane over a Unix Domain Socket.
//
// Registered as both "uds-router" and "uds" in the executor registry
// (executors/index.ts). When the socket is reachable and the caller sets
// stream: true in the request body, the executor returns a streaming Response
// with a ReadableStream body. Otherwise it collects the full non-streaming
// response and returns it as a JSON-parsed ExecutorResult.
//
// Reference: SPEC.md §17 polyglot binding tiers (T2 UDS RPC)

import { BaseExecutor } from "@/open-sse/executors/base";
import type { ExecutorResult, ModelInfo, ProviderCredentials } from "@/open-sse/types";
import {
  forwardToDataPlane,
  forwardToDataPlaneStreaming,
  udsHealthCheck,
} from "@/open-sse/services/udsRouter";

export class UDSRouterExecutor extends BaseExecutor {
  readonly provider: string;

  constructor(provider: string, credentials: ProviderCredentials) {
    super(provider, credentials);
    this.provider = provider;
  }

  /** Returns the socket availability. */
  health(): boolean {
    return udsHealthCheck();
  }

  async execute(
    body: string,
    model: string,
    modelInfo: ModelInfo,
    providerSpecificData: Record<string, unknown>,
    type: string | undefined,
    headers: Record<string, string>
  ): Promise<ExecutorResult> {
    const apiKey = this.credentials.apiKey || this.credentials.accessToken || "";

    if (!apiKey) {
      throw new Error(`UDSRouterExecutor: no API key available for provider ${this.provider}`);
    }

    // Detect streaming — check the body for stream: true
    let isStream = false;
    try {
      const parsed = JSON.parse(body);
      if (parsed.stream === true) {
        isStream = true;
      }
    } catch {
      // Not JSON — treat as non-streaming
    }

    if (isStream) {
      return this.executeStreaming(body, apiKey);
    }

    return this.executeNonStreaming(body, apiKey);
  }

  private async executeNonStreaming(body: string, apiKey: string): Promise<ExecutorResult> {
    const result = await forwardToDataPlane(body, apiKey, this.provider);

    if (!result) {
      // UDS unavailable — let the caller fall back
      throw new Error(`UDSRouterExecutor: data plane unavailable for ${this.provider}`);
    }

    // Build a web Response from the collected UDS response
    const response = new Response(result.body, {
      status: result.statusCode,
      headers: {
        "content-type": result.headers["content-type"] ?? "application/json",
      },
    });

    return {
      response,
      url: "",
      headers: new Headers(),
      transformedBody: false,
    };
  }

  private async executeStreaming(body: string, apiKey: string): Promise<ExecutorResult> {
    const response = await forwardToDataPlaneStreaming(body, apiKey, this.provider);

    if (!response) {
      throw new Error(`UDSRouterExecutor: data plane streaming unavailable for ${this.provider}`);
    }

    return {
      response,
      url: "",
      headers: new Headers(),
      transformedBody: false,
    };
  }
}
