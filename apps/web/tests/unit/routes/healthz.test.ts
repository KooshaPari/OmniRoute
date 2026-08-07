import { describe, expect, it } from "vitest";

import { GET } from "../../../src/routes/healthz/+server";

describe("renderer health route", () => {
  it("returns a stable readiness contract", async () => {
    const response = await GET({} as Parameters<typeof GET>[0]);

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/json");
    expect(await response.json()).toEqual({ status: "ok", service: "argismonitor-renderer" });
  });
});
