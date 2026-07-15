export const SERVICE_BACKEND_PLUGIN_IDS = ["9router", "cliproxyapi"] as const;

export type ServiceBackendPluginId = (typeof SERVICE_BACKEND_PLUGIN_IDS)[number];

export const SERVICE_BACKEND_EXPOSURE_TOOL_BY_PLUGIN_ID: Record<
  ServiceBackendPluginId,
  "9router" | "cliproxy"
> = {
  "9router": "9router",
  cliproxyapi: "cliproxy",
};

export function getServiceToolFromPluginId(
  pluginId: string
): "9router" | "cliproxy" | undefined {
  return SERVICE_BACKEND_EXPOSURE_TOOL_BY_PLUGIN_ID[
    pluginId as keyof typeof SERVICE_BACKEND_EXPOSURE_TOOL_BY_PLUGIN_ID
  ];
}

const SERVICE_BACKEND_PLUGIN_ID_SET = new Set<string>(SERVICE_BACKEND_PLUGIN_IDS);

export function isServiceBackendPluginId(pluginId: string): pluginId is ServiceBackendPluginId {
  return SERVICE_BACKEND_PLUGIN_ID_SET.has(pluginId);
}
