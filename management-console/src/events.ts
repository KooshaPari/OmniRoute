import { managementBaseUrl } from "./api";

export type ManagementEvent = {
  type: "snapshot" | "heartbeat" | string;
  timestamp: string;
  data: Record<string, unknown>;
};

export type ManagementEventHandlers = {
  onEvent: (event: ManagementEvent) => void;
  onStatus?: (status: string) => void;
};

export function connectManagementEvents(handlers: ManagementEventHandlers): () => void {
  const url = `${managementBaseUrl()}/api/management/events`;
  const source = new EventSource(url, { withCredentials: true });

  const handle = (event: MessageEvent<string>) => {
    try {
      handlers.onEvent(JSON.parse(event.data) as ManagementEvent);
    } catch (error) {
      handlers.onStatus?.(error instanceof Error ? error.message : String(error));
    }
  };

  source.addEventListener("snapshot", handle);
  source.addEventListener("heartbeat", handle);
  source.onopen = () => handlers.onStatus?.("events online");
  source.onerror = () => handlers.onStatus?.("events reconnecting");

  return () => source.close();
}
