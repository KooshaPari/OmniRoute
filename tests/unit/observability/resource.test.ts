/**
 * Resource detector tests.
 *
 * Covers:
 * - parseResourceAttributes: empty input, key=value pairs, comma-separated,
 *   whitespace trim, duplicate keys (last wins), invalid keys dropped
 * - detectResource: reads OTEL_SERVICE_NAME / SERVICE_VERSION /
 *   DEPLOYMENT_ENVIRONMENT, falls back to defaults, picks up
 *   OTEL_RESOURCE_ATTRIBUTES, OTEL_SERVICE_VERSION, OMNIROUTE_VERSION
 * - withResourceAttributes: merges extras into a frozen clone
 *
 * Each test stashes & restores env so it doesn't leak state into siblings.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  detectResource,
  parseResourceAttributes,
  withResourceAttributes,
} from "../../../src/lib/observability/resource.ts";

function withEnv<T>(patch: Record<string, string | undefined>, fn: () => T): T {
  const snapshot: Record<string, string | undefined> = {};
  for (const k of Object.keys(patch)) {
    snapshot[k] = process.env[k];
  }
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  try {
    return fn();
  } finally {
    for (const [k, v] of Object.entries(snapshot)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}

test("parseResourceAttributes: empty input → empty record", () => {
  assert.deepEqual({ ...parseResourceAttributes(undefined) }, {});
  assert.deepEqual({ ...parseResourceAttributes("") }, {});
});

test("parseResourceAttributes: parses single k=v pair", () => {
  const out = parseResourceAttributes("deployment.region=us-east-1");
  assert.equal(out["deployment.region"], "us-east-1");
});

test("parseResourceAttributes: parses multiple pairs comma-separated", () => {
  const out = parseResourceAttributes("k1=v1,k2=v2,k3=v3");
  assert.equal(out.k1, "v1");
  assert.equal(out.k2, "v2");
  assert.equal(out.k3, "v3");
});

test("parseResourceAttributes: trims whitespace around keys and values", () => {
  const out = parseResourceAttributes("  k1 = v1 , k2 = v2 ");
  assert.equal(out.k1, "v1");
  assert.equal(out.k2, "v2");
});

test("parseResourceAttributes: duplicate keys keep the LAST value", () => {
  const out = parseResourceAttributes("k=v1,k=v2");
  assert.equal(out.k, "v2");
});

test("parseResourceAttributes: invalid keys are dropped (must start with lowercase letter)", () => {
  const out = parseResourceAttributes("BadKey=v,1bad=v,good=v");
  assert.equal(out.BadKey, undefined);
  assert.equal(out["1bad"], undefined);
  assert.equal(out.good, "v");
});

test("parseResourceAttributes: bare keys without `=` are dropped", () => {
  const out = parseResourceAttributes("k1,k2=v2");
  assert.equal(out.k1, undefined);
  assert.equal(out.k2, "v2");
});

test("detectResource: reads OTEL_SERVICE_NAME from env", () => {
  withEnv({ OTEL_SERVICE_NAME: "my-service" }, () => {
    const r = detectResource();
    assert.equal(r.serviceName, "my-service");
  });
});

test("detectResource: reads SERVICE_VERSION then OTEL_SERVICE_VERSION then OMNIROUTE_VERSION", () => {
  withEnv(
    {
      SERVICE_VERSION: "1.0.0",
      OTEL_SERVICE_VERSION: undefined,
      OMNIROUTE_VERSION: undefined,
    },
    () => {
      const r = detectResource();
      assert.equal(r.serviceVersion, "1.0.0");
    }
  );
  withEnv(
    {
      SERVICE_VERSION: undefined,
      OTEL_SERVICE_VERSION: "2.0.0",
      OMNIROUTE_VERSION: undefined,
    },
    () => {
      const r = detectResource();
      assert.equal(r.serviceVersion, "2.0.0");
    }
  );
});

test("detectResource: reads DEPLOYMENT_ENVIRONMENT", () => {
  withEnv({ DEPLOYMENT_ENVIRONMENT: "staging" }, () => {
    const r = detectResource();
    assert.equal(r.deploymentEnvironment, "staging");
  });
});

test("detectResource: falls back to defaults when no env set", () => {
  withEnv(
    {
      OTEL_SERVICE_NAME: undefined,
      SERVICE_NAME: undefined,
      SERVICE_VERSION: undefined,
      OTEL_SERVICE_VERSION: undefined,
      OMNIROUTE_VERSION: undefined,
      DEPLOYMENT_ENVIRONMENT: undefined,
      OTEL_DEPLOYMENT_ENVIRONMENT: undefined,
    },
    () => {
      const r = detectResource();
      assert.equal(typeof r.serviceName, "string");
      assert.ok(r.serviceName.length > 0);
      assert.equal(typeof r.serviceVersion, "string");
      assert.equal(r.deploymentEnvironment, "development");
    }
  );
});

test("detectResource: OTEL_RESOURCE_ATTRIBUTES parsed into attributes", () => {
  withEnv({ OTEL_RESOURCE_ATTRIBUTES: "deployment.region=eu-west-1,k8s.pod.name=p1" }, () => {
    const r = detectResource();
    assert.equal(r.attributes["deployment.region"], "eu-west-1");
    assert.equal(r.attributes["k8s.pod.name"], "p1");
  });
});

test("withResourceAttributes: merges extras into a frozen clone", () => {
  withEnv({}, () => {
    const base = detectResource({ defaultServiceName: "svc-a", defaultVersion: "0.1" });
    const merged = withResourceAttributes(base, { "test.flag": "1" });
    assert.equal(merged.serviceName, "svc-a");
    assert.equal(merged.serviceVersion, "0.1");
    assert.equal(merged.attributes["test.flag"], "1");
    // Original base should not see the merged attribute.
    assert.equal(base.attributes["test.flag"], undefined);
  });
});
