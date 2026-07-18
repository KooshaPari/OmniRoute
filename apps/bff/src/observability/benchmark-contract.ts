import { createHash } from "node:crypto";
import { z } from "zod";

const sha = z.string().regex(/^[0-9a-f]{40}$/);
export const NormalizedRouteTemplateSchema = z.string().min(1).max(160)
  .refine((value) => value.startsWith("/") && value.split("/").slice(1).every((segment) => {
    const candidate = segment.startsWith(":") ? segment.slice(1) : segment;
    const allowed = segment.startsWith(":") ? /^\w+$/ : /^[A-Za-z][\w.~-]*$/;
    return candidate.length > 0 && /^[A-Za-z]/.test(candidate) && allowed.test(candidate);
  }), "route must contain normalized literal or parameter segments")
  .refine((value) => !/[?#%@]/.test(value), "route must not contain query, fragment, credentials, or escapes");
const method = z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]);
const duration = z.number().finite().nonnegative().max(60_000);

export const RawSampleSchema = z.object({
  sequence: z.number().int().min(0).max(9999),
  durationMs: duration,
  status: z.number().int().min(100).max(599),
}).strict();

export const RouteResultSchema = z.object({
  schemaVersion: z.literal(1),
  route: NormalizedRouteTemplateSchema,
  method,
  sampleCount: z.number().int().min(50).max(1000),
  errorCount: z.number().int().min(0).max(1000),
  errorRate: z.number().finite().min(0).max(1),
  p50Ms: duration,
  p95Ms: duration,
  p99Ms: duration,
  samples: z.array(RawSampleSchema).min(50).max(1000),
}).strict();

export const BenchmarkReportSchema = z.object({
  schemaVersion: z.literal(2),
  sourceCommit: sha,
  sourceTree: sha,
  benchmark: z.object({
    transport: z.literal("bun-loopback-tcp-built-bff"),
    hostname: z.literal("127.0.0.1"),
    warmupCount: z.number().int().min(10).max(1000),
    sampleCount: z.number().int().min(50).max(1000),
    percentileMethod: z.literal("nearest-rank"),
    errorDefinition: z.literal("HTTP status >= 500"),
    clock: z.literal("Bun.nanoseconds"),
  }).strict(),
  networkPolicy: z.object({
    mode: z.literal("deny-non-loopback-network"),
    guardCoverage: z.tuple([
      z.literal("global.fetch"), z.literal("Bun.connect"), z.literal("node:net.connect"),
      z.literal("node:net.createConnection"), z.literal("node:dns.lookup"), z.literal("node:dns.resolve"),
    ]),
    guardActivations: z.tuple([
      "global.fetch", "Bun.connect", "node:net.connect", "node:net.createConnection",
      "node:dns.lookup", "node:dns.resolve",
    ].map((api) => z.object({ api: z.literal(api), blocked: z.literal(true) }).strict()) as any),
    allowedLoopbackAttempts: z.number().int().positive().max(10_000),
    blockedNonLoopbackAttempts: z.literal(0),
  }).strict(),
  environment: z.object({
    runtime: z.string().regex(/^bun \d+\.\d+\.\d+$/),
    runnerImage: z.string().min(1).max(80),
    platform: z.enum(["linux", "darwin", "win32"]),
    architecture: z.enum(["x64", "arm64"]),
    cpuCount: z.number().int().min(1).max(1024),
  }).strict(),
  rssBytes: z.number().int().positive().max(16 * 1024 * 1024 * 1024),
  routeInventory: z.object({
    count: z.number().int().min(1).max(500),
    sha256: z.string().regex(/^[0-9a-f]{64}$/),
    routes: z.array(z.string().min(3).max(200)).min(1).max(500),
  }).strict(),
  routes: z.array(RouteResultSchema).min(1).max(20),
}).strict();

export type BenchmarkReport = z.infer<typeof BenchmarkReportSchema>;

export function routeKey(value: { method: string; route: string }): string {
  return `${value.method} ${value.route}`;
}

export function assertUnique(values: string[], label: string): void {
  if (new Set(values).size !== values.length) throw new Error(`${label} contains duplicates`);
}

export function inventorySha256(routes: string[]): string {
  return createHash("sha256").update(JSON.stringify(routes)).digest("hex");
}
