#!/usr/bin/env node
// Validate machine-readable WBS and QA traceability artifacts against each other.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const states = new Set(["todo", "wip", "ok", "blocked", "defer", "hold"]);
const readJson = (file) => JSON.parse(fs.readFileSync(path.join(ROOT, file), "utf8"));
const fail = (message) => { throw new Error(message); };

function uniqueIds(items, label) {
  const ids = new Set();
  for (const item of items) {
    if (typeof item.id !== "string" || !item.id) fail(`${label} item has no id`);
    if (ids.has(item.id)) fail(`duplicate ${label} id: ${item.id}`);
    ids.add(item.id);
  }
  return ids;
}

function validateDag(items, ids) {
  const visiting = new Set();
  const visited = new Set();
  const visit = (id) => {
    if (visiting.has(id)) fail(`dependency cycle at ${id}`);
    if (visited.has(id)) return;
    visiting.add(id);
    const item = items.find((candidate) => candidate.id === id);
    for (const dep of item.depends_on) {
      if (!ids.has(dep)) fail(`${id} depends on unknown work item ${dep}`);
      visit(dep);
    }
    visiting.delete(id);
    visited.add(id);
  };
  for (const id of ids) visit(id);
}

function main() {
  const dag = readJson("work/forward-work.json");
  const qa = readJson("work/qa-matrix.json");
  if (dag.schema_version !== "1.0" || qa.schema_version !== "1.0") fail("unsupported schema version");
  const laneIds = uniqueIds(dag.lanes, "lane");
  const workIds = uniqueIds(dag.work_items, "work");
  const qaIds = uniqueIds(qa.requirements, "QA requirement");
  validateDag(dag.work_items, workIds);
  for (const lane of dag.lanes) {
    if (!states.has(lane.state)) fail(`invalid lane state: ${lane.id}`);
  }
  for (const item of dag.work_items) {
    if (!states.has(item.state)) fail(`invalid work state: ${item.id}`);
    if (!laneIds.has(item.lane)) fail(`${item.id} references unknown lane ${item.lane}`);
    if (!Array.isArray(item.evidence) || item.evidence.length === 0) fail(`${item.id} has no evidence`);
    if (!Array.isArray(item.depends_on)) fail(`${item.id} depends_on must be an array`);
  }
  for (const req of qa.requirements) {
    if (!states.has(req.state)) fail(`invalid QA state: ${req.id}`);
    if (!Array.isArray(req.work_items) || req.work_items.length === 0) fail(`${req.id} has no linked work items`);
    for (const id of req.work_items) if (!workIds.has(id)) fail(`${req.id} references unknown work item ${id}`);
    if (!Array.isArray(req.verification) || req.verification.length === 0) fail(`${req.id} has no verification`);
  }
  console.log(`work traceability: PASS (${laneIds.size} lanes, ${workIds.size} work items, ${qaIds.size} QA requirements)`);
}

try { main(); } catch (error) { console.error(`work traceability: FAIL — ${error.message}`); process.exitCode = 1; }
