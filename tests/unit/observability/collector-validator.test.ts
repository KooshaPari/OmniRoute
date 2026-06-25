/**
 * @file tests/unit/observability/collector-validator.test.ts
 *
 * PR-010 — Unit tests for scripts/validate-otel-collector.mjs.
 *
 * These tests exercise the validator programmatically (not via the CLI) so
 * they can construct minimal stub YAML / .env documents and assert that each
 * PR-010 hard rule fires the right error message when violated.
 *
 * Coverage (6 cases):
 *   1. valid config passes
 *   2. missing pipeline exporter fails
 *   3. memory_limiter missing fails
 *   4. batch missing fails
 *   5. redact missing required field fails
 *   6. env var missing fails
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  validateCollectorConfig,
  REQUIRED_REDACT_HEADERS,
  PLATFORM_ENV_VARS,
  extractEnvRefs,
} from "../../../scripts/validate-otel-collector.mjs";

// -----------------------------------------------------------------------------
// Minimal fixture builder
// -----------------------------------------------------------------------------

function buildValidConfig(): string {
  return [
    "receivers:",
    "  otlp:",
    "    protocols: { grpc: { endpoint: 0.0.0.0:4317 }, http: { endpoint: 0.0.0.0:4318 } }",
    "processors:",
    "  memory_limiter: { check_interval: 1s }",
    "  batch: { timeout: 10s }",
    "  attributes/redact:",
    "    actions:",
    ...REQUIRED_REDACT_HEADERS.map((k) => `      - key: ${k}\n        action: delete`),
    "  tail_sampling:",
    "    decision_wait: 10s",
    "    policies:",
    "      - name: errors",
    "        type: status_code",
    "        status_code: { status_codes: [ERROR] }",
    "      - name: baseline",
    "        type: probabilistic",
    "        probabilistic: { sampling_percentage: 10 }",
    "exporters:",
    "  logging: { loglevel: info }",
    "service:",
    "  pipelines:",
    "    traces:",
    "      receivers: [otlp]",
    "      processors: [memory_limiter, attributes/redact, tail_sampling, batch]",
    "      exporters: [logging]",
    "    metrics:",
    "      receivers: [otlp]",
    "      processors: [memory_limiter, batch]",
    "      exporters: [logging]",
    "    logs:",
    "      receivers: [otlp]",
    "      processors: [memory_limiter, batch]",
    "      exporters: [logging]",
    "",
  ].join("\n");
}

function buildMinimalEnv(): string {
  // Two documented + one commented-out to verify both forms count.
  return [
    "# doc",
    "OTEL_AUTH_TOKEN=changeme",
    "# JAEGER_ENDPOINT=jaeger:4317",
    "",
  ].join("\n");
}

// -----------------------------------------------------------------------------
// extractEnvRefs sanity (small smoke)
// -----------------------------------------------------------------------------

describe("validate-otel-collector.extractEnvRefs", () => {
  it("finds ${env:FOO} references", () => {
    const refs = extractEnvRefs("endpoint: ${env:JAEGER_ENDPOINT:-jaeger:4317}");
    assert.deepEqual(refs, ["JAEGER_ENDPOINT"]);
  });
  it("filters out platform vars when requested (caller's job)", () => {
    const refs = extractEnvRefs(
      "id: ${env:HOSTNAME}\nendpoint: ${env:JAEGER_ENDPOINT}",
    );
    assert.deepEqual(refs, ["HOSTNAME", "JAEGER_ENDPOINT"]);
    assert.equal(PLATFORM_ENV_VARS.has("HOSTNAME"), true);
  });
});

// -----------------------------------------------------------------------------
// 1. valid config passes
// -----------------------------------------------------------------------------

describe("validateCollectorConfig — happy path", () => {
  it("passes a minimal valid config + env example", () => {
    const r = validateCollectorConfig(buildValidConfig(), buildMinimalEnv());
    assert.equal(r.ok, true, `unexpected errors: ${r.errors.join("\n")}`);
    assert.deepEqual(r.errors, []);
    assert.equal(r.summary.receivers, 1);
    assert.equal(r.summary.exporters, 1);
    assert.equal(r.summary.pipelines, 3);
  });
});

// -----------------------------------------------------------------------------
// 2. missing pipeline exporter fails
// -----------------------------------------------------------------------------

describe("validateCollectorConfig — orphan exporter", () => {
  it("fails when an exporter is declared but not referenced by any pipeline", () => {
    const yaml = [
      "receivers: { otlp: { protocols: { grpc: { endpoint: 0.0.0.0:4317 } } } }",
      "processors:",
      "  memory_limiter: {}",
      "  batch: {}",
      "  attributes/redact:",
      "    actions:",
      ...REQUIRED_REDACT_HEADERS.map(
        (k) => `      - key: ${k}\n        action: delete`,
      ),
      "  tail_sampling:",
      "    policies:",
      "      - type: status_code",
      "        status_code: { status_codes: [ERROR] }",
      "      - type: probabilistic",
      "        probabilistic: { sampling_percentage: 10 }",
      "exporters:",
      "  logging: {}",
      "  unused: {}",
      "service:",
      "  pipelines:",
      "    traces:",
      "      receivers: [otlp]",
      "      processors: [memory_limiter, attributes/redact, tail_sampling, batch]",
      "      exporters: [logging]",
      "",
    ].join("\n");
    const r = validateCollectorConfig(yaml, "");
    assert.equal(r.ok, false);
    assert.ok(
      r.errors.some((e) => /exporter "unused" is declared but never used/.test(e)),
      `expected orphan-exporter error, got: ${r.errors.join("\n")}`,
    );
  });
});

// -----------------------------------------------------------------------------
// 3. memory_limiter missing fails
// -----------------------------------------------------------------------------

describe("validateCollectorConfig — memory_limiter missing", () => {
  it("fails when memory_limiter is absent from a pipeline", () => {
    const yaml = [
      "receivers: { otlp: { protocols: { grpc: { endpoint: 0.0.0.0:4317 } } } }",
      "processors:",
      "  batch: {}",
      "  attributes/redact:",
      "    actions:",
      ...REQUIRED_REDACT_HEADERS.map(
        (k) => `      - key: ${k}\n        action: delete`,
      ),
      "  tail_sampling:",
      "    policies:",
      "      - type: status_code",
      "        status_code: { status_codes: [ERROR] }",
      "      - type: probabilistic",
      "        probabilistic: { sampling_percentage: 10 }",
      "exporters:",
      "  logging: {}",
      "service:",
      "  pipelines:",
      "    traces:",
      "      receivers: [otlp]",
      "      processors: [attributes/redact, tail_sampling, batch]",
      "      exporters: [logging]",
      "",
    ].join("\n");
    const r = validateCollectorConfig(yaml, "");
    assert.equal(r.ok, false);
    assert.ok(
      r.errors.some((e) => /missing required processor "memory_limiter"/.test(e)),
      `expected memory_limiter-missing error, got: ${r.errors.join("\n")}`,
    );
  });
});

// -----------------------------------------------------------------------------
// 4. batch missing fails
// -----------------------------------------------------------------------------

describe("validateCollectorConfig — batch missing", () => {
  it("fails when batch is absent from a pipeline", () => {
    const yaml = [
      "receivers: { otlp: { protocols: { grpc: { endpoint: 0.0.0.0:4317 } } } }",
      "processors:",
      "  memory_limiter: {}",
      "  attributes/redact:",
      "    actions:",
      ...REQUIRED_REDACT_HEADERS.map(
        (k) => `      - key: ${k}\n        action: delete`,
      ),
      "  tail_sampling:",
      "    policies:",
      "      - type: status_code",
      "        status_code: { status_codes: [ERROR] }",
      "      - type: probabilistic",
      "        probabilistic: { sampling_percentage: 10 }",
      "exporters:",
      "  logging: {}",
      "service:",
      "  pipelines:",
      "    traces:",
      "      receivers: [otlp]",
      "      processors: [memory_limiter, attributes/redact, tail_sampling]",
      "      exporters: [logging]",
      "",
    ].join("\n");
    const r = validateCollectorConfig(yaml, "");
    assert.equal(r.ok, false);
    assert.ok(
      r.errors.some((e) => /missing required processor "batch"/.test(e)),
      `expected batch-missing error, got: ${r.errors.join("\n")}`,
    );
  });
});

// -----------------------------------------------------------------------------
// 5. redact missing required field fails
// -----------------------------------------------------------------------------

describe("validateCollectorConfig — redact missing field", () => {
  it("fails when attributes/redact does not strip x-api-key", () => {
    const yaml = [
      "receivers: { otlp: { protocols: { grpc: { endpoint: 0.0.0.0:4317 } } } }",
      "processors:",
      "  memory_limiter: {}",
      "  batch: {}",
      "  attributes/redact:",
      "    actions:",
      // include only 2 of the 3 required headers
      "      - key: http.request.header.cookie",
      "        action: delete",
      "      - key: http.request.header.authorization",
      "        action: delete",
      "  tail_sampling:",
      "    policies:",
      "      - type: status_code",
      "        status_code: { status_codes: [ERROR] }",
      "      - type: probabilistic",
      "        probabilistic: { sampling_percentage: 10 }",
      "exporters:",
      "  logging: {}",
      "service:",
      "  pipelines:",
      "    traces:",
      "      receivers: [otlp]",
      "      processors: [memory_limiter, attributes/redact, tail_sampling, batch]",
      "      exporters: [logging]",
      "",
    ].join("\n");
    const r = validateCollectorConfig(yaml, "");
    assert.equal(r.ok, false);
    assert.ok(
      r.errors.some((e) =>
        /attributes\/redact must delete "http\.request\.header\.x-api-key"/.test(e),
      ),
      `expected x-api-key-redact error, got: ${r.errors.join("\n")}`,
    );
  });

  it("fails when attributes/redact processor is not defined at all", () => {
    const yaml = [
      "receivers: { otlp: { protocols: { grpc: { endpoint: 0.0.0.0:4317 } } } }",
      "processors:",
      "  memory_limiter: {}",
      "  batch: {}",
      "exporters:",
      "  logging: {}",
      "service:",
      "  pipelines:",
      "    traces:",
      "      receivers: [otlp]",
      "      processors: [memory_limiter, batch]",
      "      exporters: [logging]",
      "",
    ].join("\n");
    const r = validateCollectorConfig(yaml, "");
    assert.equal(r.ok, false);
    assert.ok(
      r.errors.some((e) => /"attributes\/redact" is not defined/.test(e)),
      `expected redact-missing error, got: ${r.errors.join("\n")}`,
    );
  });
});

// -----------------------------------------------------------------------------
// 6. env var missing fails
// -----------------------------------------------------------------------------

describe("validateCollectorConfig — env var documentation", () => {
  it("fails when collector.yaml references an env var not in .env.example", () => {
    const yaml = [
      "receivers: { otlp: { protocols: { grpc: { endpoint: 0.0.0.0:4317 } } } }",
      "processors:",
      "  memory_limiter: {}",
      "  batch: {}",
      "  attributes/redact:",
      "    actions:",
      ...REQUIRED_REDACT_HEADERS.map(
        (k) => `      - key: ${k}\n        action: delete`,
      ),
      "  tail_sampling:",
      "    policies:",
      "      - type: status_code",
      "        status_code: { status_codes: [ERROR] }",
      "      - type: probabilistic",
      "        probabilistic: { sampling_percentage: 10 }",
      "exporters:",
      "  logging: {}",
      "service:",
      "  telemetry:",
      "    metrics: { address: 0.0.0.0:8888 }",
      "  pipelines:",
      "    traces:",
      "      receivers: [otlp]",
      "      processors: [memory_limiter, attributes/redact, tail_sampling, batch]",
      "      exporters: [logging]",
      "      # referenced but not in .env.example below:",
      "      # (we'll use a different processor env that IS referenced)",
      "",
    ].join("\n")
      .replace(
        "service:",
        "exporters:\n  logging: {}\n  custom: { endpoint: \"${env:UNDOCUMENTED_VAR:-foo}\" }",
      );

    // The above `.replace` keeps the YAML valid by adding a second exporter
    // and wiring it; but simpler: just drop the replace and use a direct
    // string template.
    const yaml2 = [
      "receivers: { otlp: { protocols: { grpc: { endpoint: 0.0.0.0:4317 } } } }",
      "processors:",
      "  memory_limiter: {}",
      "  batch: {}",
      "  attributes/redact:",
      "    actions:",
      ...REQUIRED_REDACT_HEADERS.map(
        (k) => `      - key: ${k}\n        action: delete`,
      ),
      "  tail_sampling:",
      "    policies:",
      "      - type: status_code",
      "        status_code: { status_codes: [ERROR] }",
      "      - type: probabilistic",
      "        probabilistic: { sampling_percentage: 10 }",
      "exporters:",
      "  logging: { endpoint: \"${env:UNDOCUMENTED_VAR:-default}\" }",
      "service:",
      "  pipelines:",
      "    traces:",
      "      receivers: [otlp]",
      "      processors: [memory_limiter, attributes/redact, tail_sampling, batch]",
      "      exporters: [logging]",
      "",
    ].join("\n");

    const env = "OTEL_AUTH_TOKEN=changeme\n"; // UNDOCUMENTED_VAR not present

    const r = validateCollectorConfig(yaml2, env);
    assert.equal(r.ok, false);
    assert.ok(
      r.errors.some((e) =>
        /env var "UNDOCUMENTED_VAR" is referenced in collector\.yaml but not documented/.test(
          e,
        ),
      ),
      `expected undocumented-env error, got: ${r.errors.join("\n")}`,
    );
  });

  it("accepts commented-out documentation in .env.example", () => {
    // Same shape as the failing case but UNDOCUMENTED_VAR is mentioned as a
    // comment in .env.example → should pass.
    const yaml = [
      "receivers: { otlp: { protocols: { grpc: { endpoint: 0.0.0.0:4317 } } } }",
      "processors:",
      "  memory_limiter: {}",
      "  batch: {}",
      "  attributes/redact:",
      "    actions:",
      ...REQUIRED_REDACT_HEADERS.map(
        (k) => `      - key: ${k}\n        action: delete`,
      ),
      "  tail_sampling:",
      "    policies:",
      "      - type: status_code",
      "        status_code: { status_codes: [ERROR] }",
      "      - type: probabilistic",
      "        probabilistic: { sampling_percentage: 10 }",
      "exporters:",
      "  logging: { endpoint: \"${env:UNDOCUMENTED_VAR:-default}\" }",
      "service:",
      "  pipelines:",
      "    traces:",
      "      receivers: [otlp]",
      "      processors: [memory_limiter, attributes/redact, tail_sampling, batch]",
      "      exporters: [logging]",
      "",
    ].join("\n");
    const env = "# UNDOCUMENTED_VAR=placeholder\n";
    const r = validateCollectorConfig(yaml, env);
    // Should still pass w.r.t. env documentation (other rules may warn).
    assert.equal(
      r.errors.some((e) => /UNDOCUMENTED_VAR.*not documented/.test(e)),
      false,
      `commented-out doc should count, but got: ${r.errors.join("\n")}`,
    );
  });
});