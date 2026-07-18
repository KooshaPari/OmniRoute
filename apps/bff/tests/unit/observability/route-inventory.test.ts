import { describe, expect, it } from "vitest";

import inventory from "../../../../../config/performance/v4-latency-inventory.json";
import app from "../../../src/index";
import {
  assertUnique,
  inventorySha256,
} from "../../../src/observability/benchmark-contract";

describe("v4 registered route inventory", () => {
  it("matches the normalized count and hash committed for benchmark evidence", () => {
    const registeredRoutes = [...new Set<string>(
      app.routes.map((entry: { method: string; path: string }) => `${entry.method} ${entry.path}`),
    )].sort((left, right) => left.localeCompare(right, "en"));

    expect(() => assertUnique(registeredRoutes, "route inventory")).not.toThrow();
    expect(registeredRoutes).toHaveLength(inventory.registeredRouteCount);
    expect(inventorySha256(registeredRoutes)).toBe(inventory.registeredRouteSha256);
  });
});
