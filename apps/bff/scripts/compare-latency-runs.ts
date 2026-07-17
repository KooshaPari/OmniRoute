import { readFile } from "node:fs/promises";
import { z } from "zod";

const MetricSchema = z.object({
  route: z.string(),
  method: z.string(),
  sampleCount: z.number().int().positive(),
  errorRate: z.number(),
  p50Ms: z.number(),
  p95Ms: z.number(),
  p99Ms: z.number(),
});
const ReportSchema = z.object({
  schemaVersion: z.literal(1),
  sourceCommit: z.string().regex(/^[0-9a-f]{40}$/),
  sourceTree: z.string().regex(/^[0-9a-f]{40}$/),
  routes: z.array(MetricSchema),
});

const [firstPath, secondPath] = process.argv.slice(2);
if (!firstPath || !secondPath) throw new Error("two benchmark report paths are required");
const first = ReportSchema.parse(JSON.parse(await readFile(firstPath, "utf8")));
const second = ReportSchema.parse(JSON.parse(await readFile(secondPath, "utf8")));
if (first.sourceCommit !== second.sourceCommit) throw new Error("source commit mismatch");
if (first.sourceTree !== second.sourceTree) throw new Error("source tree mismatch");

const absoluteToleranceMs = 5;
const relativeTolerance = 1;
for (const left of first.routes) {
  const right = second.routes.find(
    (candidate) => candidate.route === left.route && candidate.method === left.method
  );
  if (!right) throw new Error(`missing route in second run: ${left.method} ${left.route}`);
  if (left.sampleCount !== right.sampleCount || left.errorRate !== right.errorRate) {
    throw new Error(`sample/error mismatch for ${left.method} ${left.route}`);
  }
  for (const metric of ["p50Ms", "p95Ms", "p99Ms"] as const) {
    const delta = Math.abs(left[metric] - right[metric]);
    const allowed = Math.max(absoluteToleranceMs, left[metric] * relativeTolerance);
    if (delta > allowed) {
      throw new Error(
        `${left.method} ${left.route} ${metric} delta ${delta}ms exceeds ${allowed}ms`
      );
    }
  }
}
console.log(`two-run tolerance passed for ${first.sourceCommit}`);
