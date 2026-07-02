import assert from "node:assert/strict";
import { test } from "node:test";

import {
  createIssueAgentRun,
  listIssueAgentRuns,
  MAX_ISSUE_AGENT_RUNS,
  resetIssueAgentRunsForTests,
  saveIssueAgentRun,
} from "../../../../src/lib/issueAgent/runs.ts";
import type { IssueAgentMode } from "../../../../src/lib/issueAgent/settings.ts";

test("run creation records report, triage, fix, and combined modes without executing git", () => {
  const modes: IssueAgentMode[] = ["report", "triage", "fix", "triage-and-fix"];
  const runs = modes.map((mode) =>
    createIssueAgentRun({
      issueRef: "owner/repo#123",
      mode,
      log: {
        method: "POST",
        path: "/v1/chat/completions",
        status: 500,
        authorization: "Bearer secret",
      },
      now: () => new Date("2026-06-30T12:00:00.000Z"),
      idFactory: () => `run-${mode}`,
    })
  );

  assert.deepEqual(
    runs.map((run) => run.mode),
    modes
  );
  assert.deepEqual(
    runs.map((run) => run.settings.mode),
    modes
  );
  assert.deepEqual(
    runs.map((run) => run.id),
    ["run-report", "run-triage", "run-fix", "run-triage-and-fix"]
  );
  assert.deepEqual(
    runs.map((run) => run.status),
    ["recorded", "recorded", "recorded", "recorded"]
  );
  assert.match(runs[0].diagnostics.summary, /POST/);
  assert.doesNotMatch(runs[0].diagnostics.redactedPreview, /secret/);
});

test("fix run is blocked when prerequisite checks fail", () => {
  const run = createIssueAgentRun({
    issueRef: "owner/repo#123",
    mode: "fix",
    prerequisiteCheck: { ok: false, missing: ["gh"] },
    now: () => new Date("2026-06-30T12:00:00.000Z"),
    idFactory: () => "run-fix-blocked",
  });

  assert.equal(run.status, "blocked");
  assert.deepEqual(run.prerequisiteCheck?.missing, ["gh"]);
});

test("saved runs are bounded to the newest max run count", () => {
  resetIssueAgentRunsForTests();

  for (let index = 0; index < MAX_ISSUE_AGENT_RUNS + 5; index += 1) {
    saveIssueAgentRun(
      createIssueAgentRun({
        issueRef: `owner/repo#${index}`,
        mode: "triage",
        now: () => new Date(Date.UTC(2026, 5, 30, 12, 0, index)),
      })
    );
  }

  const runs = listIssueAgentRuns();
  assert.equal(runs.length, MAX_ISSUE_AGENT_RUNS);
  assert.equal(runs[0].issueRef, `owner/repo#${MAX_ISSUE_AGENT_RUNS + 4}`);
  assert.equal(runs.at(-1)?.issueRef, "owner/repo#5");

  resetIssueAgentRunsForTests();
});

test("saved runs prune entries older than their retention window", () => {
  resetIssueAgentRunsForTests();

  saveIssueAgentRun(
    createIssueAgentRun({
      issueRef: "owner/repo#old",
      mode: "triage",
      settings: { retentionDays: 1 },
      now: () => new Date("2026-06-28T12:00:00.000Z"),
      idFactory: () => "old-run",
    })
  );
  saveIssueAgentRun(
    createIssueAgentRun({
      issueRef: "owner/repo#new",
      mode: "triage",
      settings: { retentionDays: 1 },
      now: () => new Date("2026-06-30T12:00:00.000Z"),
      idFactory: () => "new-run",
    })
  );

  assert.deepEqual(
    listIssueAgentRuns().map((run) => run.id),
    ["new-run"]
  );

  resetIssueAgentRunsForTests();
});
