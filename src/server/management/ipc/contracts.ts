export type ManagementIpcTransport = "unix-socket" | "windows-named-pipe" | "loopback-http";

export type ManagementIpcCommand =
  | "daemon.status"
  | "daemon.start"
  | "daemon.stop"
  | "daemon.restart"
  | "console.open"
  | "providers.refresh"
  | "events.subscribe";

export type ManagementIpcRequest<TPayload = Record<string, unknown>> = {
  id: string;
  command: ManagementIpcCommand;
  payload?: TPayload;
  deadlineMs?: number;
};

export type ManagementIpcResponse<TResult = unknown> = {
  id: string;
  ok: boolean;
  result?: TResult;
  error?: {
    code: string;
    message: string;
  };
};

export type ManagementIpcEndpoint = {
  platform: "darwin" | "linux" | "win32" | "fallback";
  transport: ManagementIpcTransport;
  address: string;
};

export function defaultManagementIpcEndpoint(platform = process.platform): ManagementIpcEndpoint {
  if (platform === "win32") {
    return {
      platform: "win32",
      transport: "windows-named-pipe",
      address: "\\\\.\\pipe\\omniroute-daemon",
    };
  }

  if (platform === "darwin") {
    return {
      platform: "darwin",
      transport: "unix-socket",
      address: "/tmp/omniroute-daemon.sock",
    };
  }

  if (platform === "linux") {
    return {
      platform: "linux",
      transport: "unix-socket",
      address: `${process.env.XDG_RUNTIME_DIR || "/tmp"}/omniroute/daemon.sock`,
    };
  }

  return {
    platform: "fallback",
    transport: "loopback-http",
    address: "http://localhost:20128/api/management",
  };
}
