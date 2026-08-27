export const desktopParityMatrix = {
  login: { path: "/login", kind: "browser" },
  "provider-setup": { path: "/dashboard/providers", kind: "browser" },
  routing: { path: "/v1/chat/completions", kind: "api" },
  streaming: { path: "/v1/chat/completions", kind: "api" },
  health: { path: "/health", kind: "api" },
  resilience: { path: "/dashboard/health", kind: "browser" },
  settings: { path: "/dashboard/settings", kind: "browser" },
  "audit-export": { path: "/dashboard/audit", kind: "browser" },
  recovery: { path: "/dashboard/health", kind: "browser" },
} as const;

export type DesktopParityWorkflow = keyof typeof desktopParityMatrix;
