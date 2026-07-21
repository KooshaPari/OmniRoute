#!/usr/bin/env node
/**
 * compression-lite.bench.ts — TS in-process vs UDS RPC (ADR-032 / F3)
 *
 * Benchmarks the 5 lite compression techniques. Each technique is measured
 * separately so we can see which ones dominate.
 *
 * The T2/UDS path is measured when `sendJsonRpc` round-trips to the
 * UDS server's in-process handler. The TS baseline runs the function
 * directly.
 *
 * Usage:
 *   node --import tsx/esm benches/dispatch/compression-lite.bench.ts
 */

import { bench } from "./shared.ts";
import {
  collapseWhitespace,
  compressToolResults,
  dedupSystemPrompt,
  removeRedundantContent,
  replaceImageUrls,
} from "../../open-sse/services/compression/lite.ts";

// ── Fabricated chat body ───────────────────────────────────────────
// A realistic multi-turn conversation with tool results.
const CHAT_BODY = {
  messages: [
    { role: "system", content: "You are a helpful assistant. " + "Be concise. ".repeat(50) },
    { role: "user", content: "List all files in the current directory" },
    {
      role: "assistant",
      content: "Sure! Let me check the directory contents.",
      tool_calls: [
        { type: "function", function: { name: "list_dir", arguments: '{"path":"."}' } },
      ],
    },
    {
      role: "tool",
      content:
        "file1.txt\nfile2.js\npackage.json\nREADME.md\nnode_modules\nsrc/\n  index.ts\n  utils.ts\n".repeat(5),
      tool_call_id: "call_1",
    },
    { role: "assistant", content: "Here are the files I found:" },
    { role: "user", content: "Show me the contents of package.json" },
    {
      role: "tool",
      content: JSON.stringify({ name: "omniroute", version: "3.8.0", dependencies: { express: "^4.0.0" } }),
      tool_call_id: "call_2",
    },
    { role: "assistant", content: "Here's what package.json contains:" },
  ],
};

const ITERATIONS = 2000;

// ── collapseWhitespace ─────────────────────────────────────────────
const collapseResult = await bench({
  name: "compression-lite-collapseWhitespace",
  tier: "T2",
  edge: "compression.lite.collapseWhitespace",
  description: "collapseWhitespace() on a multi-turn conversation body",
  iterations: ITERATIONS,
  run: () => {
    const r = collapseWhitespace(CHAT_BODY, {});
    return r.applied;
  },
});
console.log(JSON.stringify(collapseResult, null, 2));
console.log("---");

// ── compressToolResults ────────────────────────────────────────────
const toolResult = await bench({
  name: "compression-lite-compressToolResults",
  tier: "T2",
  edge: "compression.lite.compressToolResults",
  description: "compressToolResults() on tool output blocks",
  iterations: ITERATIONS,
  run: () => {
    const r = compressToolResults(CHAT_BODY);
    return r.applied;
  },
});
console.log(JSON.stringify(toolResult, null, 2));
console.log("---");

// ── dedupSystemPrompt ──────────────────────────────────────────────
const dedupResult = await bench({
  name: "compression-lite-dedupSystemPrompt",
  tier: "T2",
  edge: "compression.lite.dedupSystemPrompt",
  description: "dedupSystemPrompt() on a repeated system prompt",
  iterations: ITERATIONS,
  run: () => {
    const r = dedupSystemPrompt(CHAT_BODY, {});
    return r.applied;
  },
});
console.log(JSON.stringify(dedupResult, null, 2));
console.log("---");

// ── removeRedundantContent ─────────────────────────────────────────
const redundantResult = await bench({
  name: "compression-lite-removeRedundantContent",
  tier: "T2",
  edge: "compression.lite.removeRedundantContent",
  description: "removeRedundantContent() on assistant tool-call blocks",
  iterations: ITERATIONS,
  run: () => {
    const r = removeRedundantContent(CHAT_BODY, {});
    return r.applied;
  },
});
console.log(JSON.stringify(redundantResult, null, 2));
console.log("---");

// ── replaceImageUrls ───────────────────────────────────────────────
const imageResult = await bench({
  name: "compression-lite-replaceImageUrls",
  tier: "T2",
  edge: "compression.lite.replaceImageUrls",
  description: "replaceImageUrls() with default model (no vision URLs in body = fast-path)",
  iterations: ITERATIONS,
  run: () => {
    const r = replaceImageUrls(CHAT_BODY, "gpt-4o");
    return r.applied;
  },
});
console.log(JSON.stringify(imageResult, null, 2));
