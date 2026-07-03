import type { ManagementIpcRequest, ManagementIpcResponse } from "../ipc/contracts";

export type ManagementRpcFrame = {
  protocol: "omniroute.management.rpc";
  version: 1;
  request: ManagementIpcRequest;
};

export type ManagementRpcResultFrame = {
  protocol: "omniroute.management.rpc";
  version: 1;
  response: ManagementIpcResponse;
};

export function encodeManagementRpcFrame(request: ManagementIpcRequest): string {
  return `${JSON.stringify({ protocol: "omniroute.management.rpc", version: 1, request })}\n`;
}

export function decodeManagementRpcFrame(frame: string): ManagementRpcFrame {
  const decoded = JSON.parse(frame) as ManagementRpcFrame;
  if (decoded.protocol !== "omniroute.management.rpc" || decoded.version !== 1) {
    throw new Error("Unsupported OmniRoute management RPC frame");
  }
  return decoded;
}

export function encodeManagementRpcResponse(response: ManagementIpcResponse): string {
  return `${JSON.stringify({ protocol: "omniroute.management.rpc", version: 1, response })}\n`;
}
