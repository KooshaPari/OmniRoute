#!/usr/bin/env node
/**
 * Test fixture: mock substrate driver-cli for agent-dispatch unit tests.
 * Prints JSON to stdout and exits 0.
 */
const engineArg = process.argv.find((arg) => arg.startsWith("--engine="));
const engine = engineArg ? engineArg.slice("--engine=".length) : "unknown";

console.log(JSON.stringify({ status: "ok", engine }));
process.exit(0);
