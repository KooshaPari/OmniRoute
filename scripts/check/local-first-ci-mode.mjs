#!/usr/bin/env node

import { appendFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

export function resolveLocalFirstMode({ eventName, refName, defaultBranch, dispatchMode }) {
  if (eventName === "push") {
    if (!refName || !defaultBranch) throw new Error("push mode requires refName and defaultBranch");
    return refName === defaultBranch ? "record" : "live";
  }
  if (eventName === "pull_request") return "live";
  if (eventName === "workflow_dispatch") {
    if (dispatchMode === "live" || dispatchMode === "verify") return dispatchMode;
    throw new Error(`unsupported workflow_dispatch mode: ${dispatchMode || "<empty>"}`);
  }
  throw new Error(`unsupported Local-First CI event: ${eventName || "<empty>"}`);
}

function main() {
  const mode = resolveLocalFirstMode({
    eventName: process.env.EVENT_NAME,
    refName: process.env.REF_NAME,
    defaultBranch: process.env.DEFAULT_BRANCH,
    dispatchMode: process.env.DISPATCH_MODE,
  });
  const output = process.env.GITHUB_OUTPUT;
  if (!output) throw new Error("GITHUB_OUTPUT is required");
  appendFileSync(output, `mode=${mode}\n`, { encoding: "utf8" });
  console.log(`Selected Local-First CI mode: ${mode}`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) main();
