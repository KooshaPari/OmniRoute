#!/usr/bin/env node

import { appendFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

export function resolveLocalFirstMode({ eventName, refName, defaultBranch }) {
  if (eventName === "push") {
    if (!refName || !defaultBranch) throw new Error("push mode requires refName and defaultBranch");
    return refName === defaultBranch ? "verify" : "live";
  }
  if (eventName === "pull_request" || eventName === "workflow_dispatch") return "live";
  throw new Error(`unsupported Local-First CI event: ${eventName || "<empty>"}`);
}

function main() {
  const mode = resolveLocalFirstMode({
    eventName: process.env.EVENT_NAME,
    refName: process.env.REF_NAME,
    defaultBranch: process.env.DEFAULT_BRANCH,
  });
  const output = process.env.GITHUB_OUTPUT;
  if (!output) throw new Error("GITHUB_OUTPUT is required");
  appendFileSync(output, `mode=${mode}\n`, { encoding: "utf8" });
  console.log(`Selected Local-First CI mode: ${mode}`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) main();
