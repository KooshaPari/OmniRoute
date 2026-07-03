export type ConsoleEndpoint =
  | "health"
  | "providers"
  | "models"
  | "keys"
  | "virtual-keys"
  | "routing"
  | "compression/budget"
  | "usage/call-logs";

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
