import { describe, expect, it } from "vitest";

import { desktopWorkflows, workflowPath } from "./workflows";

describe("desktop workflow parity contract", () => {
  it("keeps every workflow mapped to a public route or API path", () => {
    expect(desktopWorkflows).toHaveLength(9);
    for (const workflow of desktopWorkflows) {
      expect(workflowPath[workflow]).toMatch(/^\//);
    }
  });

  it("uses the same endpoint for streaming and non-streaming routing", () => {
    expect(workflowPath.routing).toBe(workflowPath.streaming);
  });
});
