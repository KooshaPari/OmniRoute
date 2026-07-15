import test from "node:test";
import assert from "node:assert/strict";

import { executeRecordedTriageChatCompletion } from "../../src/lib/issueAgent/execution.ts";
import { createRecordedTriageRun } from "../../src/lib/issueAgent/recordedTriage.ts";

test("recorded triage invokes the normal chat-completions seam with configured routing", async () => {
  const run = createRecordedTriageRun({
    issueUrl: "https://github.com/KooshaPari/OmniRoute/issues/5980",
    recordedContext: {
      title: "Execute issue-agent runs through OmniRoute routing",
      body: "Use the configured provider and model.",
    },
  });
  let received: Request | undefined;

  const response = await executeRecordedTriageChatCompletion(
    {
      run,
      model: "gpt-4.1-mini",
      provider: "openai",
      routingPolicy: "quality",
      timeoutMs: 5_000,
    },
    async (request) => {
      received = request;
      return new Response(JSON.stringify({ id: "chatcmpl-issue-agent" }), {
        headers: { "Content-Type": "application/json" },
      });
    }
  );

  assert.equal(received?.url, "http://localhost/api/v1/chat/completions");
  assert.equal(received?.method, "POST");
  assert.equal(received?.headers.get("X-OmniRoute-Mode"), "quality");
  assert.ok(received?.signal, "the chat request must carry the timeout AbortSignal");

  const body = (await received!.json()) as Record<string, unknown>;
  assert.equal(body.model, "openai/gpt-4.1-mini");
  assert.equal(body.stream, false);
  assert.equal(body.temperature, 0);
  assert.equal(body.max_tokens, 1200);
  assert.equal(response.status, 200);
  assert.equal(response.terminalState, "succeeded");
  assert.equal(response.completionStatus, "succeeded");
  assert.deepEqual(response.body, { id: "chatcmpl-issue-agent" });
  assert.match(JSON.stringify(body.messages), /#5980/);
});

test("recorded triage maps 429 quota-exhausted error into budget_stopped terminal state", async () => {
  const run = createRecordedTriageRun({
    issueUrl: "https://github.com/KooshaPari/OmniRoute/issues/5980",
    recordedContext: {
      title: "Check budget stop behavior",
      body: "Route this through the normal seam.",
    },
  });

  const response = await executeRecordedTriageChatCompletion(
    {
      run,
      model: "gpt-4.1-mini",
      provider: "openai",
      routingPolicy: "quality",
      timeoutMs: 5_000,
    },
    async () =>
      new Response("Quota exhausted. Individual quota reached. Contact administrator to enable overages.", {
        status: 429,
        headers: { "Content-Type": "text/plain" },
      })
  );

  assert.equal(response.status, 429);
  assert.equal(response.terminalState, "budget_stopped");
  assert.equal(response.completionStatus, "budget_stopped");
  assert.equal(
    response.terminalError,
    "Quota exhausted. Individual quota reached. Contact administrator to enable overages."
  );
});

test("recorded triage marks timeout as timed_out terminal state", async () => {
  const run = createRecordedTriageRun({
    issueUrl: "https://github.com/KooshaPari/OmniRoute/issues/5980",
    recordedContext: {
      title: "Timeout behavior",
      body: "Long-running routing path.",
    },
  });

  const response = await executeRecordedTriageChatCompletion(
    {
      run,
      timeoutMs: 5,
      routingPolicy: "quality",
    },
    async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
      throw new DOMException("The operation was aborted.", "AbortError");
    }
  );

  assert.equal(response.status, 408);
  assert.equal(response.terminalState, "timed_out");
  assert.equal(response.completionStatus, "timed_out");
  assert.equal(response.timedOutMs, 5);
  assert.equal(response.terminalError, "Execution timed out after 5ms");
});
