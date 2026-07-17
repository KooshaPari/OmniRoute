import { mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import os from "node:os";
import path from "node:path";

import app from "../src/index";
import { summarizeLatencySamples, type LatencySampleV1 } from "../src/observability/latency";
import inventory from "../../../config/performance/v4-latency-inventory.json";

const sourceCommit = process.env.SOURCE_COMMIT;
if (!sourceCommit || !/^[0-9a-f]{40}$/.test(sourceCommit)) {
  throw new Error("SOURCE_COMMIT must be an exact 40-character commit SHA");
}
const sourceTree = process.env.SOURCE_TREE;
if (!sourceTree || !/^[0-9a-f]{40}$/.test(sourceTree)) {
  throw new Error("SOURCE_TREE must be an exact 40-character tree SHA");
}

const output = process.argv[2];
if (!output) throw new Error("usage: bun scripts/benchmark-latency.ts <output.json>");
const outputPath = path.resolve(output);

const warmupCount = 10;
const sampleCount = 100;
const routes = inventory.benchmarkedRoutes;
const declared = new Set(app.routes.map((route) => `${route.method} ${route.path}`));
const registeredRoutes = [...declared].sort();
const registeredRouteSha256 = createHash("sha256")
  .update(JSON.stringify(registeredRoutes))
  .digest("hex");
if (
  registeredRoutes.length !== inventory.registeredRouteCount ||
  registeredRouteSha256 !== inventory.registeredRouteSha256
) {
  throw new Error(
    `registered route inventory drift: count=${registeredRoutes.length} sha256=${registeredRouteSha256}`
  );
}
for (const route of routes) {
  if (!declared.has(`${route.method} ${route.path}`)) {
    throw new Error(`inventory route is not registered: ${route.method} ${route.path}`);
  }
}

async function request(pathname: string): Promise<{ durationMs: number; status: number }> {
  const start = Bun.nanoseconds();
  const response = await app.request(`http://localhost${pathname}`);
  await response.arrayBuffer();
  return { durationMs: (Bun.nanoseconds() - start) / 1_000_000, status: response.status };
}

const results = [];
for (const route of routes) {
  for (let index = 0; index < warmupCount; index++) await request(route.path);
  const samples: LatencySampleV1[] = [];
  for (let index = 0; index < sampleCount; index++) {
    const measured = await request(route.path);
    samples.push({
      schemaVersion: 1,
      route: route.path,
      method: route.method as LatencySampleV1["method"],
      ...measured,
    });
  }
  results.push({ route: route.path, method: route.method, ...summarizeLatencySamples(samples) });
}

const report = {
  schemaVersion: 1,
  sourceCommit,
  sourceTree,
  benchmark: {
    transport: "hono-in-process-localhost-request",
    externalNetwork: false,
    warmupCount,
    sampleCount,
    percentileMethod: "nearest-rank",
    errorDefinition: "HTTP status >= 500",
  },
  environment: {
    runtime: `bun ${Bun.version}`,
    platform: process.platform,
    architecture: process.arch,
    cpuCount: os.cpus().length,
  },
  rssBytes: process.memoryUsage.rss(),
  routeInventory: {
    count: registeredRoutes.length,
    sha256: registeredRouteSha256,
    routes: registeredRoutes,
  },
  routes: results,
};

try {
  await mkdir(path.dirname(outputPath), { recursive: true });
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
}
await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
console.log(`wrote ${outputPath} for ${sourceCommit}`);
