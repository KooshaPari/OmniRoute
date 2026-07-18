import { readFile } from "node:fs/promises";

import { compareBenchmarkReports } from "../src/observability/compare-benchmark-reports";

const [firstPath, secondPath] = process.argv.slice(2);
if (!firstPath || !secondPath) throw new Error("two benchmark report paths are required");
compareBenchmarkReports(
  JSON.parse(await readFile(firstPath, "utf8")),
  JSON.parse(await readFile(secondPath, "utf8")),
);
console.log("two-run benchmark contract passed");
