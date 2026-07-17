import { describe, expect, it } from "vitest";

import { unavailableMessage } from "./unavailable";

describe("unavailable telemetry consumer contract", () => {
  it("renders an explicit source-backed unavailable message", () => {
    expect(
      unavailableMessage(
        { status: "unavailable", source: "no-runtime-aggregation" },
        "Runtime latency aggregation"
      )
    ).toBe("Runtime latency aggregation is unavailable (no-runtime-aggregation).");
  });

  it("does not label available or absent responses", () => {
    expect(unavailableMessage({}, "Telemetry")).toBeNull();
    expect(unavailableMessage(null, "Telemetry")).toBeNull();
  });
});
