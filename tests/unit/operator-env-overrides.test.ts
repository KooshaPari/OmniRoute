import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  classifyAdaptiveResourcePressure,
  DEFAULT_RESOURCE_PRESSURE_THRESHOLDS,
  type ResourceSignals,
} from "../../open-sse/utils/resourcePressurePolicy.ts";

const MiB = 1024 ** 2;
const SUFFIX = "\n...[truncated]";

// OMNIROUTE_MAX_TOOLS_LIMIT (#13190) and OMNIROUTE_MAX_TOOL_LENGTH are read
// once at module load, so each case must import a freshly evaluated copy after
// the env var is in place. The query string busts the ESM module cache.
async function freshConstants(): Promise<{ MAX_TOOLS_LIMIT: number }> {
  return (await import(`../../open-sse/config/constants.ts?fresh=${Date.now()}-${Math.random()}`)) as {
    MAX_TOOLS_LIMIT: number;
  };
}

async function freshLite(): Promise<{
  compressToolResults: (body: unknown) => { body: { messages: { content: string }[] }; applied: boolean };
}> {
  return (await import(`../../open-sse/services/compression/lite.ts?fresh=${Date.now()}-${Math.random()}`)) as {
    compressToolResults: (body: unknown) => { body: { messages: { content: string }[] }; applied: boolean };
  };
}

function toolBody(content: string) {
  return { messages: [{ role: "tool", content }] };
}

function psiSignals(someAvg10: number | null): ResourceSignals {
  return {
    observedAtMs: 1_000,
    v8: { heapUsedBytes: 100 * MiB, heapLimitBytes: 1_000 * MiB },
    process: {
      rssBytes: 200 * MiB,
      externalBytes: 10 * MiB,
      arrayBuffersBytes: MiB,
      availableBytes: null,
      constrainedBytes: null,
    },
    cgroup: { currentBytes: null, maxBytes: null, highBytes: null, fileBytes: null, events: null },
    psi: someAvg10 === null ? null : {
      someAvg10,
      someAvg60: someAvg10,
      someAvg300: someAvg10,
      fullAvg10: null,
      fullAvg60: null,
      fullAvg300: null,
    },
  };
}

describe("operator env overrides", () => {
  it("OMNIROUTE_MAX_TOOLS_LIMIT overrides the default tool limit", async () => {
    process.env.OMNIROUTE_MAX_TOOLS_LIMIT = "7";
    try {
      const mod = await freshConstants();
      assert.equal(mod.MAX_TOOLS_LIMIT, 7);
    } finally {
      delete process.env.OMNIROUTE_MAX_TOOLS_LIMIT;
    }
  });

  it("OMNIROUTE_MAX_TOOLS_LIMIT falls back to 128 when unset or invalid", async () => {
    delete process.env.OMNIROUTE_MAX_TOOLS_LIMIT;
    const unset = await freshConstants();
    assert.equal(unset.MAX_TOOLS_LIMIT, 128);

    process.env.OMNIROUTE_MAX_TOOLS_LIMIT = "not-a-number";
    try {
      const invalid = await freshConstants();
      assert.equal(invalid.MAX_TOOLS_LIMIT, 128);
    } finally {
      delete process.env.OMNIROUTE_MAX_TOOLS_LIMIT;
    }
  });

  it("OMNIROUTE_MAX_TOOL_LENGTH caps a single tool result", async () => {
    const content = "word ".repeat(600).trim();
    process.env.OMNIROUTE_MAX_TOOL_LENGTH = "500";
    try {
      const lite = await freshLite();
      const result = lite.compressToolResults(toolBody(content));
      assert.equal(result.applied, true);
      assert.ok(result.body.messages[0].content.endsWith(SUFFIX));
      assert.ok(result.body.messages[0].content.length <= 500 + SUFFIX.length);
    } finally {
      delete process.env.OMNIROUTE_MAX_TOOL_LENGTH;
    }
  });

  it("OMNIROUTE_MAX_TOOL_LENGTH defaults to 2000 when unset", async () => {
    const content = "word ".repeat(600).trim();
    delete process.env.OMNIROUTE_MAX_TOOL_LENGTH;
    const lite = await freshLite();
    const result = lite.compressToolResults(toolBody(content));
    assert.equal(result.applied, true);
    assert.ok(result.body.messages[0].content.length <= 2000 + SUFFIX.length);
    assert.ok(result.body.messages[0].content.length > 500 + SUFFIX.length);
  });

  it("OMNIROUTE_PRESSURE_PSI_DISABLED=true neutralises PSI pressure", () => {
    process.env.OMNIROUTE_PRESSURE_PSI_DISABLED = "true";
    try {
      const level = classifyAdaptiveResourcePressure(
        psiSignals(99),
        DEFAULT_RESOURCE_PRESSURE_THRESHOLDS
      );
      assert.equal(level.severity, "normal");
      assert.equal(level.reason, "none");
    } finally {
      delete process.env.OMNIROUTE_PRESSURE_PSI_DISABLED;
    }
  });

  it("PSI pressure is detected when the disable switch is absent", () => {
    delete process.env.OMNIROUTE_PRESSURE_PSI_DISABLED;
    const level = classifyAdaptiveResourcePressure(
      psiSignals(99),
      DEFAULT_RESOURCE_PRESSURE_THRESHOLDS
    );
    assert.equal(level.severity, "critical");
    assert.equal(level.reason, "psi_some");
  });
});
