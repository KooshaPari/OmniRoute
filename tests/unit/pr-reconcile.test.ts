import test from "node:test";
import assert from "node:assert/strict";

const core = await import("../../scripts/pr-reconcile/core.ts");

test("shouldSkipPullRequest blocks drafts, no-autofix, and untrusted forks without opt-in", () => {
  assert.equal(
    core.shouldSkipPullRequest({
      draft: true,
      labels: [],
      isFork: false,
      authorAssociation: "MEMBER",
    }).skip,
    true
  );

  assert.equal(
    core.shouldSkipPullRequest({
      draft: false,
      labels: ["no-autofix"],
      isFork: false,
      authorAssociation: "MEMBER",
    }).skip,
    true
  );

  assert.equal(
    core.shouldSkipPullRequest({
      draft: false,
      labels: [],
      isFork: true,
      authorAssociation: "CONTRIBUTOR",
    }).skip,
    true
  );
});

test("shouldSkipPullRequest permits trusted branches and fork PRs with autofix-ok", () => {
  assert.equal(
    core.shouldSkipPullRequest({
      draft: false,
      labels: [],
      isFork: false,
      authorAssociation: "MEMBER",
    }).skip,
    false
  );

  assert.equal(
    core.shouldSkipPullRequest({
      draft: false,
      labels: ["autofix-ok"],
      isFork: true,
      authorAssociation: "CONTRIBUTOR",
    }).skip,
    false
  );
});

test("shouldSkipPullRequest allows autofix-ok override for untrusted authors", () => {
  const decision = core.shouldSkipPullRequest({
    draft: false,
    labels: ["autofix-ok"],
    isFork: false,
    authorAssociation: "CONTRIBUTOR",
  });

  assert.equal(decision.skip, false);
});

test("shouldSkipPullRequest blocks exhausted reconciliation attempts", () => {
  const decision = core.shouldSkipPullRequest({
    draft: false,
    labels: ["autofix-ok"],
    isFork: false,
    authorAssociation: "MEMBER",
    attemptCount: 5,
    maxAttempts: 5,
  });

  assert.equal(decision.skip, true);
  assert.equal(decision.reason, "attempt_limit_exhausted");
});

test("normalizeBotComment classifies bot summaries as actionable feedback", () => {
  const feedback = core.normalizeBotComment({
    id: "comment-1",
    author: "coderabbitai[bot]",
    body: "Please add tests for the missing branch and fix this race condition.",
    url: "https://github.test/comment/1",
    createdAt: "2026-07-04T00:00:00Z",
  });

  assert.equal(feedback?.source, "coderabbitai[bot]");
  assert.equal(feedback?.kind, "bot_comment");
  assert.equal(feedback?.severity, "actionable");
  assert.match(feedback?.summary ?? "", /add tests/i);
});

test("normalizeBotComment keeps non-actionable bot comments informational", () => {
  const feedback = core.normalizeBotComment({
    id: "comment-2",
    author: "coderabbitai[bot]",
    body: "Summary: this PR updates routing metadata.",
  });

  assert.equal(feedback?.severity, "informational");
});

test("normalizeReviewThread ignores resolved threads and keeps unresolved anchors", () => {
  assert.equal(
    core.normalizeReviewThread({
      id: "thread-1",
      isResolved: true,
      comments: [{ id: "review-1", author: "bot", body: "Please fix this." }],
    }),
    null
  );

  const feedback = core.normalizeReviewThread({
    id: "thread-2",
    path: "src/a.ts",
    line: 42,
    comments: [{ id: "review-2", author: "bot", body: "Please fix this." }],
  });

  assert.equal(feedback?.kind, "review_thread");
  assert.equal(feedback?.path, "src/a.ts");
  assert.equal(feedback?.line, 42);
});

test("normalizeCheckRun keeps failing check identity, url, and trimmed logs", () => {
  const feedback = core.normalizeCheckRun({
    name: "unit",
    conclusion: "failure",
    status: "completed",
    detailsUrl: "https://github.test/run/1",
    text: `${"x".repeat(3000)}\nAssertionError: expected true`,
  });

  assert.equal(feedback?.kind, "ci_failure");
  assert.equal(feedback?.source, "unit");
  assert.equal(feedback?.url, "https://github.test/run/1");
  assert.ok((feedback?.body ?? "").includes("AssertionError"));
  assert.ok((feedback?.body ?? "").length <= core.MAX_FEEDBACK_BODY_CHARS);
});

test("normalizeCheckRun treats cancelled and timed out checks as actionable", () => {
  assert.equal(
    core.normalizeCheckRun({ name: "integration", conclusion: "timed_out" })?.severity,
    "actionable"
  );
  assert.equal(
    core.normalizeCheckRun({ name: "lint", conclusion: "cancelled" })?.severity,
    "actionable"
  );
  assert.equal(core.normalizeCheckRun({ name: "unit", conclusion: "success" }), null);
});

test("json helpers return null for malformed input", () => {
  assert.equal(core.safeJsonParse("{"), null);
  assert.equal(core.decodeBase64Json("not-base64-json"), null);
});

test("buildReconcilePayload enforces payload budget and attempt metadata", () => {
  const payload = core.buildReconcilePayload({
    repository: "org/repo",
    pullRequest: {
      number: 12,
      title: "Fix router",
      url: "https://github.test/org/repo/pull/12",
      headRef: "feature",
      headSha: "abc123",
      baseRef: "main",
      author: "dev",
      labels: ["autofix-ok"],
      draft: false,
      isFork: false,
      authorAssociation: "MEMBER",
    },
    attempt: { count: 3, max: 5 },
    files: ["src/a.ts"],
    feedback: [
      {
        id: "large",
        kind: "bot_comment",
        source: "codex",
        severity: "actionable",
        summary: "large feedback",
        body: "z".repeat(core.MAX_PAYLOAD_CHARS),
      },
    ],
  });

  const encoded = JSON.stringify(payload);
  assert.equal(payload.version, 1);
  assert.equal(payload.attempt.count, 3);
  assert.ok(encoded.length <= core.MAX_PAYLOAD_CHARS);
  assert.match(payload.feedback[0]?.body ?? "", /\[truncated/);
});

test("buildDispatchRequest uses json payload and bearer token when provided", () => {
  const request = core.buildDispatchRequest({
    webhookUrl: "https://kilo.test/hooks/reconcile",
    token: "secret-token",
    payload: { version: 1, repository: "org/repo" },
  });

  assert.equal(request.url, "https://kilo.test/hooks/reconcile");
  assert.equal(request.init.method, "POST");
  assert.equal(request.init.headers["content-type"], "application/json");
  assert.equal(request.init.headers.authorization, "Bearer secret-token");
  assert.equal(JSON.parse(String(request.init.body)).repository, "org/repo");
});
