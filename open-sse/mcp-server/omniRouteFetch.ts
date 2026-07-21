import { resolveOmniRouteBaseUrl } from "../../src/shared/utils/resolveOmniRouteBaseUrl.ts";
import { getMcpHttpAuthHeadersForInternalFetch } from "./httpAuthContext.ts";

const OMNIROUTE_BASE_URL = resolveOmniRouteBaseUrl();

/** Call an internal OmniRoute API while preserving the current MCP caller identity. */
export async function omniRouteFetch(path: string, options: RequestInit = {}): Promise<unknown> {
  const url = `${OMNIROUTE_BASE_URL}${path}`;
  const apiKey = globalThis.process.env.OMNIROUTE_API_KEY || "";
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...getMcpHttpAuthHeadersForInternalFetch(),
    ...(options.headers as Record<string, string>),
  };
  if (apiKey && !headers.Authorization) headers.Authorization = `Bearer ${apiKey}`;
  const signal = options.signal || globalThis.AbortSignal.timeout(10000);
  const response = await globalThis.fetch(url, { ...options, headers, signal });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "Unknown error");
    throw new Error(`OmniRoute API error [${response.status}]: ${errorText}`);
  }
  return response.json();
}
