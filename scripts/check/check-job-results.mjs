#!/usr/bin/env node

import { pathToFileURL } from "node:url";

export function evaluateJobResults(needs, allowedSkipped = new Set()) {
  return Object.entries(needs).flatMap(([job, value]) => {
    const result = value && typeof value === "object" && typeof value.result === "string"
      ? value.result
      : "unknown";
    return result === "success" || (result === "skipped" && allowedSkipped.has(job))
      ? []
      : [`${job}: ${result}`];
  });
}

function main() {
  let needs;
  try {
    needs = JSON.parse(process.env.NEEDS_JSON ?? "");
  } catch {
    console.error("Invalid or missing NEEDS_JSON");
    process.exitCode = 1;
    return;
  }
  if (!needs || typeof needs !== "object" || Array.isArray(needs)) {
    console.error("NEEDS_JSON must be an object");
    process.exitCode = 1;
    return;
  }
  const allowedSkipped = new Set(
    (process.env.ALLOW_SKIPPED ?? "").split(",").map((value) => value.trim()).filter(Boolean),
  );
  const failures = evaluateJobResults(needs, allowedSkipped);
  if (failures.length > 0) {
    console.error(`Protected aggregate failed:\n${failures.map((item) => `- ${item}`).join("\n")}`);
    process.exitCode = 1;
    return;
  }
  console.log(`Protected aggregate passed (${Object.keys(needs).length} authoritative jobs).`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
