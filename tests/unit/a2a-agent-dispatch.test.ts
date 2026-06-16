/**
 * Agent Dispatch A2A Skill Tests
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import assert from "node:assert/strict";

const fixtureDir = path.dirname(fileURLToPath(import.meta.url));
const mockDriverCli = path.join(fixtureDir, "../fixtures/mock-driver-cli.mjs");

function makeTask(overrides: Record<string, unknown> = {}) {
  return {
    id: "task-1",
    skill: "agent-dispatch",
    state: "submitted" as const,
    input: {
      skill: "agent-dispatch",
      messages: [{ role: "user", content: "Write a hello world function" }],
      metadata: {},
      ...(overrides.input as object),
    },
    artifacts: [],
    events: [],
    metadata: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 300_000).toISOString(),
    ...overrides,
  };
}

test("A2A_SKILL_HANDLERS registers agent-dispatch", async () => {
  const { A2A_SKILL_HANDLERS } = await import("../../src/lib/a2a/taskExecution.ts");
  assert.equal(typeof A2A_SKILL_HANDLERS["agent-dispatch"], "function");
});

test("executeAgentDispatch returns JSON artifact via SUBSTRATE_BIN fixture", async () => {
  const original = process.env.SUBSTRATE_BIN;
  process.env.SUBSTRATE_BIN = mockDriverCli;

  try {
    const { executeAgentDispatch } = await import("../../src/lib/a2a/skills/agentDispatch.ts");
    const result = await executeAgentDispatch(makeTask() as never);

    assert.equal(result.metadata.success, true);
    assert.equal(result.artifacts[0]?.type, "json");
    assert.match(result.artifacts[0]?.content || "", /"status":\s*"ok"/);
    assert.equal(result.metadata.engine, "forge");
  } finally {
    if (original === undefined) delete process.env.SUBSTRATE_BIN;
    else process.env.SUBSTRATE_BIN = original;
  }
});

test("executeAgentDispatch rejects invalid engine metadata", async () => {
  const { executeAgentDispatch } = await import("../../src/lib/a2a/skills/agentDispatch.ts");
  const result = await executeAgentDispatch(
    makeTask({
      input: {
        skill: "agent-dispatch",
        messages: [{ role: "user", content: "Generate code" }],
        metadata: { engine: "invalid-engine" },
      },
    }) as never
  );

  assert.equal(result.metadata.success, false);
  assert.equal(result.artifacts[0]?.type, "error");
  assert.match(result.artifacts[0]?.content || "", /Invalid dispatch parameters/);
});

test("executeAgentDispatch requires a user message", async () => {
  const { executeAgentDispatch } = await import("../../src/lib/a2a/skills/agentDispatch.ts");
  const result = await executeAgentDispatch(
    makeTask({
      input: {
        skill: "agent-dispatch",
        messages: [{ role: "assistant", content: "No user prompt here" }],
        metadata: {},
      },
    }) as never
  );

  assert.equal(result.metadata.success, false);
  assert.equal(result.artifacts[0]?.content, "No user message content to dispatch");
});

test("executeAgentDispatch sanitizes subprocess errors", async () => {
  const original = process.env.SUBSTRATE_BIN;
  process.env.SUBSTRATE_BIN = path.join(fixtureDir, "../fixtures/mock-driver-cli-fail.mjs");

  try {
    const { executeAgentDispatch } = await import("../../src/lib/a2a/skills/agentDispatch.ts");
    const result = await executeAgentDispatch(makeTask() as never);

    assert.equal(result.metadata.success, false);
    const error = String(result.metadata.error || result.artifacts[0]?.content || "");
    assert.equal(error.includes("at /"), false);
    assert.equal(error.includes(".ts:"), false);
    assert.match(error, /Error in/i);
  } finally {
    if (original === undefined) delete process.env.SUBSTRATE_BIN;
    else process.env.SUBSTRATE_BIN = original;
  }
});

test("executeA2ATaskWithState completes agent-dispatch tasks", async () => {
  const original = process.env.SUBSTRATE_BIN;
  process.env.SUBSTRATE_BIN = mockDriverCli;

  try {
    const { A2A_SKILL_HANDLERS, executeA2ATaskWithState } =
      await import("../../src/lib/a2a/taskExecution.ts");
    const { getTaskManager } = await import("../../src/lib/a2a/taskManager.ts");

    const tm = getTaskManager();
    const task = tm.createTask({
      skill: "agent-dispatch",
      messages: [{ role: "user", content: "test dispatch" }],
      metadata: { engine: "forge" },
    });

    tm.updateTask(task.id, "working");
    const result = await executeA2ATaskWithState(tm, task, A2A_SKILL_HANDLERS["agent-dispatch"]);
    assert.equal(result.metadata.success, true);

    const updated = tm.getTask(task.id);
    assert.equal(updated?.state, "completed");
    assert.ok(updated?.artifacts.length);
  } finally {
    if (original === undefined) delete process.env.SUBSTRATE_BIN;
    else process.env.SUBSTRATE_BIN = original;
  }
});
