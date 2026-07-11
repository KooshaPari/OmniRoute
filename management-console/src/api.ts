export type ConsoleEndpoint =
  | "health"
  | "providers"
  | "models"
  | "keys"
  | "virtual-keys"
  | "routing"
  | "compression/budget"
  | "usage/call-logs"
  | "tokn";

export type ManagementResult<T> = {
  ok: boolean;
  source: string;
  data?: T;
  error?: string;
};

const DEFAULT_BASE_URL = "http://localhost:20128";

export function managementBaseUrl(): string {
  const configured = localStorage.getItem("omniroute.management.baseUrl");
  return (configured || DEFAULT_BASE_URL).replace(/\/$/, "");
}

export function setManagementBaseUrl(value: string): void {
  localStorage.setItem("omniroute.management.baseUrl", value.replace(/\/$/, ""));
}

export async function fetchManagement<T>(endpoint: ConsoleEndpoint): Promise<ManagementResult<T>> {
  const source = `/api/management/${endpoint}`;
  const url = `${managementBaseUrl()}${source}`;

  try {
    const response = await fetch(url, {
      headers: { accept: "application/json" },
      credentials: "include",
    });
    const data = (await response.json().catch(() => null)) as T;
    return response.ok
      ? { ok: true, source, data }
      : { ok: false, source, data, error: `HTTP ${response.status}` };
  } catch (error) {
    return { ok: false, source, error: error instanceof Error ? error.message : String(error) };
  }
}


export interface ToknStats {
  ok: boolean;
  source: string;
  rustReachable: boolean;
  stats?: {
    implKind: "native" | "ts-fallback";
    version: string;
    healthy: boolean;
    transport: string;
  };
  error?: string;
  hint?: string;
  timestamp?: string;
}

export interface ToknDecision {
  ok: boolean;
  source: string;
  decision?: {
    provider: string;
    model: string;
    fallbackChain: string[];
    source: "native" | "ts-fallback";
  };
  error?: string;
  hint?: string;
}

export async function postToknDecide(model: string, tenantId?: string): Promise<ToknDecision> {
  const url = `${managementBaseUrl()}/api/management/tokn/decide`;
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ model, ...(tenantId ? { tenantId } : {}) }),
      credentials: "include",
    });
    const data = (await response.json().catch(() => null)) as ToknDecision | null;
    return response.ok
      ? (data as ToknDecision) ?? { ok: true, source: url }
      : { ok: false, source: url, error: `HTTP ${response.status}` };
  } catch (error) {
    return { ok: false, source: url, error: error instanceof Error ? error.message : String(error) };
  }
}
