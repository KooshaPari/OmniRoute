export type DashboardConnectionStatus = {
  label: string;
  detail: string;
  tone: "success" | "warning";
};

export function dashboardConnectionStatus(bffHealthy: boolean): DashboardConnectionStatus {
  if (bffHealthy) {
    return {
      label: "Connected to BFF",
      detail: "Dashboard data is available from the local control plane.",
      tone: "success",
    };
  }

  return {
    label: "BFF unavailable",
    detail: "Start the local BFF to load live dashboard data.",
    tone: "warning",
  };
}
