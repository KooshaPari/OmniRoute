import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

describe("dispatch monitoring (Option F)", () => {
  it("prometheus-rules.yaml exists and references dispatch metrics", () => {
    const path = resolve("ops/monitoring/prometheus-rules.yaml");
    assert.ok(existsSync(path), `file should exist at ${path}`);
    const content = readFileSync(path, "utf-8");
    assert.ok(
      content.includes("dispatch_tier_decisions_total") ||
        content.includes("dispatch"),
      "rules should reference dispatch metrics"
    );
    assert.ok(content.includes("record:"), "rules should include recording rules");
  });

  it("prometheus-alerts.yaml exists and defines alerts", () => {
    const path = resolve("ops/monitoring/prometheus-alerts.yaml");
    assert.ok(existsSync(path), `file should exist at ${path}`);
    const content = readFileSync(path, "utf-8");
    assert.ok(content.includes("alert:"), "should define at least one alert");
    assert.ok(
      content.includes("dispatch") || content.includes("tier"),
      "alerts should reference dispatch tiers"
    );
  });

  it("grafana-dashboard-dispatch.json exists and is valid JSON", () => {
    const path = resolve("ops/monitoring/grafana-dashboard-dispatch.json");
    assert.ok(existsSync(path), `file should exist at ${path}`);
    const content = readFileSync(path, "utf-8");
    const parsed = JSON.parse(content);
    assert.ok(parsed.title, "dashboard should have a title");
    assert.ok(
      parsed.title.toLowerCase().includes("dispatch") ||
        parsed.title.toLowerCase().includes("tier"),
      'dashboard title should reference dispatch tiers'
    );
    assert.ok(Array.isArray(parsed.panels), "dashboard should have panels array");
  });

  it("metricsRoute exports handleMetricsRequest", async () => {
    const { handleMetricsRequest } = await import("../../open-sse/rpc/metricsRoute.js");
    assert.ok(typeof handleMetricsRequest === "function", "handleMetricsRequest should be a function");

    // Test the handler produces a valid metrics Response
    const resp = await handleMetricsRequest();
    assert.ok(resp instanceof Response, "should return a Response object");
    assert.equal(resp.status, 200, "status should be 200");
    assert.match(
      resp.headers.get("content-type") ?? "",
      /text\/plain/,
      "content-type should be text/plain"
    );

    const body = await resp.text();
    assert.ok(body.includes("# HELP"), "body should contain HELP lines");
    assert.ok(
      body.includes("dispatch_tier_decisions_total") ||
        body.includes("dispatch_current_tier"),
      "body should contain dispatch metrics"
    );
  });
});
