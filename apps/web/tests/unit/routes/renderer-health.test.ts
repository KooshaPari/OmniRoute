import { describe, expect, it } from "vitest";

import { GET } from "../../../src/routes/healthz/+server";

describe("renderer health route", () => {
  it("returns an OK JSON readiness response", async () => {
    const response = await GET({} as Parameters<typeof GET>[0]);

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");
    await expect(response.json()).resolves.toEqual({
      status: "ok",
      service: "argismonitor-renderer",
    });
  });
});
