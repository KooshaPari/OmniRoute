import { describe, expect, it } from "vitest";

import app from "./index";

describe("BFF health endpoint", () => {
  it("reports the service as healthy", async () => {
    const response = await app.request("http://localhost/healthz");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      status: "ok",
      service: "argismonitor-bff",
    });
  });
});
