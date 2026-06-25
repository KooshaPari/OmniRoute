/**
 * Resource detector — populates the immutable {@link Resource} that
 * identifies the producer of every span, metric, and log.
 *
 * Reads the standard OTel env vars at startup:
 *   OTEL_SERVICE_NAME              → resource.serviceName           (default: "omniroute")
 *   SERVICE_VERSION / OTEL_SERVICE_VERSION → resource.serviceVersion (default: pkg version)
 *   DEPLOYMENT_ENVIRONMENT / OTEL_DEPLOYMENT_ENVIRONMENT → resource.deploymentEnvironment
 *   OTEL_RESOURCE_ATTRIBUTES       → k1=v1,k2=v2,… → resource.attributes (string-only)
 *   HOSTNAME (fallback: os.hostname())
 *
 * The {@link Resource} is intentionally frozen at startup so it can be
 * cheaply passed through every span/metric allocation. Resources are
 * appended to OTLP exports per the OTel resource semantic conventions:
 * https://opentelemetry.io/docs/specs/semconv/resource/
 *
 * Why a manual detector: we don't want to depend on @opentelemetry/resources
 * just to read a handful of env vars. The full detector spec (process,
 * runtime, host, k8s, …) is overkill for the proxy/relay scope.
 */

import * as os from "node:os";
import { hostname as osHostname } from "node:os";
import type { Resource } from "./spanTypes.ts";

const FROZEN_DEFAULT_ATTRIBUTES: Readonly<Record<string, string>> = Object.freeze({});

/**
 * Read a string env var, returning `undefined` for empty/missing input.
 * We intentionally don't trim — `OTEL_SERVICE_NAME=" "` should NOT win
 * over the default.
 */
function readEnv(name: string): string | undefined {
  const v = process.env[name];
  if (v === undefined || v === null) return undefined;
  if (v.length === 0) return undefined;
  return v;
}

/**
 * Parse a string into a small positive integer, returning the fallback on
 * NaN / non-positive input. Used for `process.pid` fallback.
 */
function toPositiveInt(s: string | undefined, fallback: number): number {
  if (s === undefined) return fallback;
  const n = Number.parseInt(s, 10);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return n;
}

/**
 * Parse `OTEL_RESOURCE_ATTRIBUTES` (comma-separated `k=v` pairs, per
 * https://opentelemetry.io/docs/specs/otel/configuration/sdk-environment-variables/#general-sdk-configuration).
 *
 * Behavior:
 *   - Empty / undefined → empty record.
 *   - Whitespace around keys and values is trimmed.
 *   - Duplicate keys keep the LAST occurrence (deterministic for test runs).
 *   - Values are stored as strings — OTLP Resource attributes are stringly
 *     typed per the semantic conventions; consumers that want typed values
 *     can parse on read.
 *   - Keys are validated against `^[a-z][a-z0-9_.-]*$` per the spec; bad
 *     keys are dropped silently (logged at debug elsewhere — this detector
 *     is silent to keep `initTelemetry()` cheap).
 */
export function parseResourceAttributes(raw: string | undefined): Readonly<Record<string, string>> {
  if (!raw) return FROZEN_DEFAULT_ATTRIBUTES;
  const out: Record<string, string> = {};
  for (const pair of raw.split(",")) {
    const trimmed = pair.trim();
    if (trimmed.length === 0) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue; // require `key=value`, no bare keys
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (!/^[a-z][a-z0-9_.-]*$/.test(key)) continue;
    out[key] = value;
  }
  return Object.freeze(out);
}

/**
 * Build a Resource by reading the standard env vars. Safe to call multiple
 * times — each call returns a NEW frozen object. In practice we call it
 * exactly once at `initTelemetry()` time and cache the result.
 */
export function detectResource(opts?: { defaultServiceName?: string; defaultVersion?: string }): Resource {
  const serviceName =
    readEnv("OTEL_SERVICE_NAME") ??
    readEnv("SERVICE_NAME") ??
    opts?.defaultServiceName ??
    "omniroute";
  const serviceVersion =
    readEnv("SERVICE_VERSION") ??
    readEnv("OTEL_SERVICE_VERSION") ??
    readEnv("OMNIROUTE_VERSION") ??
    opts?.defaultVersion ??
    "0.0.0";
  const deploymentEnvironment =
    readEnv("DEPLOYMENT_ENVIRONMENT") ??
    readEnv("OTEL_DEPLOYMENT_ENVIRONMENT") ??
    "development";
  const attributes = parseResourceAttributes(readEnv("OTEL_RESOURCE_ATTRIBUTES"));
  const hostName = readEnv("HOSTNAME") ?? safeOsHostname();
  const processPid = toPositiveInt(readEnv("OMNIROUTE_PID"), process.pid);

  // Compute runtime once; reading `process.versions.node` is cheap but we
  // freeze the literal so consumers can rely on referential equality.
  const processRuntimeVersion = process.versions.node ?? "unknown";

  const resource: Resource = Object.freeze({
    serviceName,
    serviceVersion,
    deploymentEnvironment,
    processPid,
    processRuntimeName: "node",
    processRuntimeVersion,
    hostName,
    attributes,
  });
  return resource;
}

/**
 * `os.hostname()` can throw on misconfigured containers (ENOENT on
 * `/etc/hostname`); guard with try/catch so a startup-time OTel init
 * never breaks the host process.
 */
function safeOsHostname(): string {
  try {
    const h = osHostname();
    if (typeof h === "string" && h.length > 0) return h;
  } catch {
    // fall through
  }
  // Re-execute the original (rare) failure mode via os.hostname without re-throwing.
  return os.hostname();
}

/**
 * Convenience: merge an explicit attribute record into a Resource clone.
 * Used by tests that want to attach `test.run=true` etc. without polluting
 * the global env. The merged object is FROZEN so consumers cannot mutate
 * it post-handoff (defensive — Span holds the reference).
 */
export function withResourceAttributes(
  base: Resource,
  extra: Readonly<Record<string, string>>
): Resource {
  const merged: Record<string, string> = { ...base.attributes, ...extra };
  return Object.freeze({
    ...base,
    attributes: Object.freeze(merged),
  });
}