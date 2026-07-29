import { describe, expect, it } from "vitest";

import { dashboardConnectionStatus } from "../../../src/lib/dashboard/home-status";

describe("dashboard connection status", () => {
  it("shows a connected state only when the BFF health check succeeds", () => {
    expect(dashboardConnectionStatus(true)).toEqual({
      label: "Connected to BFF",
      detail: "Dashboard data is available from the local control plane.",
      tone: "success",
    });
  });

  it("makes an unavailable control plane explicit instead of presenting placeholder metrics", () => {
    expect(dashboardConnectionStatus(false)).toEqual({
      label: "BFF unavailable",
      detail: "Start the local BFF to load live dashboard data.",
      tone: "warning",
    });
  });
});
