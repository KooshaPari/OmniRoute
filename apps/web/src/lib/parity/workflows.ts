/** Browser and Tauri must expose the same user-visible workflow contract. */
export const desktopWorkflows = [
  "login",
  "provider-setup",
  "routing",
  "streaming",
  "health",
  "resilience",
  "settings",
  "audit-export",
  "recovery",
] as const;

export type DesktopWorkflow = (typeof desktopWorkflows)[number];

export const workflowPath: Record<DesktopWorkflow, string> = {
  login: "/login",
  "provider-setup": "/dashboard/providers",
  routing: "/v1/chat/completions",
  streaming: "/v1/chat/completions",
  health: "/health",
  resilience: "/dashboard/health",
  settings: "/dashboard/settings",
  "audit-export": "/dashboard/audit",
  recovery: "/dashboard/health",
};
