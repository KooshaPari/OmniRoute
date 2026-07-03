import { describe, expect, it } from "vitest";
import { buildComboDecisionTraceHeader, withComboDecisionTraceHeader } from "../decisionTrace.ts";

describe("combo decision trace headers", () => {
  it("encodes the selected route details into a response header", async () => {
    const response = new Response("ok", {
      status: 201,
      headers: { "X-Existing": "yes" },
    });

    const traced = withComboDecisionTraceHeader(response, {
      strategy: "round-robin",
      provider: "openai",
      model: "gpt-4.1",
      connectionId: "conn-42",
      fallbackCount: 2,
      latencyMs: 123,
    });

    expect(traced.status).toBe(201);
    expect(traced.headers.get("X-Existing")).toBe("yes");
    expect(traced.headers.get("X-OmniRoute-Decision")).toBe(
      "strategy=round-robin&provider=openai&model=gpt-4.1&connectionId=conn-42&fallbackCount=2&latencyMs=123"
    );
    expect(await traced.text()).toBe("ok");
  });

  it("keeps the header compact when optional values are missing", () => {
    expect(
      buildComboDecisionTraceHeader({
        strategy: "weighted",
        provider: "anthropic",
        model: "claude-sonnet-4",
      })
    ).toBe("strategy=weighted&provider=anthropic&model=claude-sonnet-4");
  });
});
