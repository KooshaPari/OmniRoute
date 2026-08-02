#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

import { buildDispatchRequest, buildReconcilePayload, decodeBase64Json } from "./core.ts";
import { normalizeBotComment, normalizeCheckRun, normalizeReviewThread } from "./core.ts";
import { parseLabels, safeJsonParse, shouldSkipPullRequest } from "./core.ts";
import type { BotCommentInput, CheckRunInput, NormalizedFeedback } from "./core.ts";
import type { PullRequestPayload, ReviewThreadInput } from "./core.ts";

type Args = Record<string, string | boolean>;

interface GitHubPullRequest {
  number: number;
  title: string;
  html_url: string;
  draft?: boolean;
  user?: { login?: string };
  head: {
    ref: string;
    sha: string;
    repo?: { fork?: boolean; full_name?: string };
  };
  base: {
    ref: string;
    repo?: { full_name?: string };
  };
  labels?: Array<{ name: string }>;
  author_association?: string;
}

const command = process.argv[2];
const args = parseArgs(process.argv.slice(3));

try {
  if (command === "collect") {
    await collect(args);
  } else if (command === "dispatch") {
    await dispatch(args);
  } else {
    usage();
    process.exit(command ? 1 : 0);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

async function collect(args: Args): Promise<void> {
  const repository = stringArg(args, "repository") ?? stringArg(args, "repo") ?? env("PR_RECONCILE_REPOSITORY");
  if (!repository) throw new Error("collect requires --repository or PR_RECONCILE_REPOSITORY");

  const event = readEvent(stringArg(args, "event-path"));
  const prNumber = numberArg(args, "pr") ?? inferPullRequestNumber(event);
  if (!prNumber) throw new Error("could not infer pull request number");

  const pr = readPullRequest(repository, prNumber, event);
  const labels = parseLabels(pr.labels);
  const attemptCount = numberArg(args, "run-attempt") ?? Number(env("PR_RECONCILE_RUN_ATTEMPT") ?? 1);
  const maxAttempts = numberArg(args, "max-attempts") ?? 5;
  const skip = shouldSkipPullRequest({
    draft: Boolean(pr.draft),
    labels,
    isFork: Boolean(pr.head.repo?.fork || pr.head.repo?.full_name !== pr.base.repo?.full_name),
    authorAssociation: pr.author_association,
    attemptCount,
    maxAttempts,
  });

  const pullRequest: PullRequestPayload = {
    number: pr.number,
    title: pr.title,
    url: pr.html_url,
    headRef: pr.head.ref,
    headSha: pr.head.sha,
    baseRef: pr.base.ref,
    author: pr.user?.login ?? "unknown",
    labels,
    draft: Boolean(pr.draft),
    isFork: Boolean(pr.head.repo?.fork || pr.head.repo?.full_name !== pr.base.repo?.full_name),
    authorAssociation: pr.author_association,
  };

  const feedback = skip.skip
    ? []
    : dedupeFeedback([
        ...collectBotComments(repository, prNumber),
        ...collectReviewThreads(repository, prNumber),
        ...collectCheckRuns(repository, pullRequest.headSha),
      ]);

  const payload = buildReconcilePayload({
    repository,
    pullRequest,
    attempt: {
      count: attemptCount,
      max: maxAttempts,
    },
    files: skip.skip ? [] : collectFiles(repository, prNumber),
    feedback: skip.skip
      ? [
          {
            id: `skip:${skip.reason}`,
            kind: "bot_comment",
            source: "pr-reconcile",
            severity: "informational",
            summary: `Skipped reconciliation: ${skip.reason}`,
            body: `PR reconciliation was skipped before dispatch because: ${skip.reason}`,
          },
        ]
      : feedback,
  });

  writeJson(stringArg(args, "output"), payload);
}

async function dispatch(args: Args): Promise<void> {
  const payloadPath = stringArg(args, "payload");
  if (!payloadPath) throw new Error("dispatch requires --payload");
  const payload = safeJsonParse(fs.readFileSync(payloadPath, "utf8"));
  if (!payload) throw new Error(`invalid JSON payload: ${payloadPath}`);

  if (args["dry-run"]) {
    console.log(JSON.stringify({ dryRun: true, payloadBytes: JSON.stringify(payload).length }, null, 2));
    return;
  }

  const webhookUrl = stringArg(args, "webhook-url") ?? env("KILO_RECONCILE_WEBHOOK_URL");
  if (!webhookUrl) throw new Error("dispatch requires --webhook-url or KILO_RECONCILE_WEBHOOK_URL");
  const token = stringArg(args, "token") ?? env("KILO_RECONCILE_WEBHOOK_TOKEN");
  const request = buildDispatchRequest({ webhookUrl, token, payload });
  const response = await fetch(request.url, request.init);
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`dispatch failed: ${response.status} ${body.slice(0, 500)}`);
  }
  console.log(JSON.stringify({ dispatched: true, status: response.status }, null, 2));
}

function readPullRequest(repository: string, prNumber: number, event: unknown): GitHubPullRequest {
  const fromEvent = eventPullRequest(event);
  if (fromEvent?.number === prNumber) return fromEvent;
  const api = ghJson<GitHubPullRequest>(["api", `repos/${repository}/pulls/${prNumber}`]);
  if (!api) throw new Error(`could not read PR #${prNumber}`);
  return api;
}

function collectBotComments(repository: string, prNumber: number): NormalizedFeedback[] {
  const comments = ghJson<Array<{ id: number; user?: { login?: string }; body?: string; html_url?: string; created_at?: string }>>([
    "api",
    `repos/${repository}/issues/${prNumber}/comments`,
    "--paginate",
  ]);
  return (comments ?? [])
    .map((comment) =>
      normalizeBotComment({
        id: `issue-comment:${comment.id}`,
        author: comment.user?.login ?? "unknown",
        body: comment.body ?? "",
        url: comment.html_url,
        createdAt: comment.created_at,
      })
    )
    .filter((feedback): feedback is NormalizedFeedback => Boolean(feedback));
}

function collectReviewThreads(repository: string, prNumber: number): NormalizedFeedback[] {
  const [owner, name] = repository.split("/");
  const data = ghJson<{ repository?: { pullRequest?: { reviewThreads?: { nodes?: unknown[] } } } }>([
    "api",
    "graphql",
    "-f",
    `owner=${owner}`,
    "-f",
    `name=${name}`,
    "-F",
    `number=${prNumber}`,
    "-f",
    "query=query($owner:String!,$name:String!,$number:Int!){repository(owner:$owner,name:$name){pullRequest(number:$number){reviewThreads(first:100){nodes{id,isResolved,isOutdated,path,line,comments(first:20){nodes{id,body,url,createdAt,author{login}}}}}}}}",
  ]);
  const nodes = data?.repository?.pullRequest?.reviewThreads?.nodes ?? [];
  return nodes
    .map((node) => normalizeReviewThread(graphqlThreadToInput(node)))
    .filter((feedback): feedback is NormalizedFeedback => Boolean(feedback));
}

function collectCheckRuns(repository: string, headSha: string): NormalizedFeedback[] {
  const data = ghJson<{ check_runs?: Array<{ name: string; conclusion?: string; status?: string; details_url?: string; output?: { text?: string; summary?: string } }> }>([
    "api",
    `repos/${repository}/commits/${headSha}/check-runs`,
    "-H",
    "Accept: application/vnd.github+json",
  ]);
  return (data?.check_runs ?? [])
    .map((run) =>
      normalizeCheckRun({
        name: run.name,
        conclusion: run.conclusion,
        status: run.status,
        detailsUrl: run.details_url,
        text: run.output?.text ?? run.output?.summary,
      } satisfies CheckRunInput)
    )
    .filter((feedback): feedback is NormalizedFeedback => Boolean(feedback));
}

function collectFiles(repository: string, prNumber: number): string[] {
  const files = ghJson<Array<{ filename?: string }>>([
    "api",
    `repos/${repository}/pulls/${prNumber}/files`,
    "--paginate",
  ]);
  return [...new Set((files ?? []).map((file) => file.filename).filter(Boolean) as string[])];
}

function graphqlThreadToInput(node: unknown): ReviewThreadInput {
  const value = node as {
    id?: string;
    isResolved?: boolean;
    isOutdated?: boolean;
    path?: string;
    line?: number;
    comments?: { nodes?: Array<{ id?: string; body?: string; url?: string; createdAt?: string; author?: { login?: string } }> };
  };
  return {
    id: value.id ?? "review-thread:unknown",
    isResolved: value.isResolved,
    isOutdated: value.isOutdated,
    path: value.path,
    line: value.line,
    comments: (value.comments?.nodes ?? []).map(
      (comment): BotCommentInput => ({
        id: comment.id ?? "review-comment:unknown",
        author: comment.author?.login ?? "unknown",
        body: comment.body ?? "",
        url: comment.url,
        createdAt: comment.createdAt,
      })
    ),
  };
}

function dedupeFeedback(feedback: NormalizedFeedback[]): NormalizedFeedback[] {
  const seen = new Set<string>();
  return feedback.filter((item) => {
    const key = `${item.kind}:${item.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function ghJson<T>(args: string[]): T | null {
  try {
    const stdout = execFileSync("gh", args, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      env: process.env,
      maxBuffer: 20 * 1024 * 1024,
    });
    return safeJsonParse<T>(stdout);
  } catch {
    return null;
  }
}

function readEvent(eventPath?: string): unknown {
  if (eventPath && fs.existsSync(eventPath)) {
    return safeJsonParse(fs.readFileSync(eventPath, "utf8"));
  }
  const encoded = env("PR_RECONCILE_EVENT_JSON_B64");
  return encoded ? decodeBase64Json(encoded) : null;
}

function eventPullRequest(event: unknown): GitHubPullRequest | null {
  const value = event as { pull_request?: GitHubPullRequest; workflow_run?: { pull_requests?: GitHubPullRequest[] } };
  return value?.pull_request ?? value?.workflow_run?.pull_requests?.[0] ?? null;
}

function inferPullRequestNumber(event: unknown): number | null {
  const value = event as {
    pull_request?: { number?: number };
    issue?: { number?: number; pull_request?: unknown };
    workflow_run?: { pull_requests?: Array<{ number?: number }> };
  };
  return value?.pull_request?.number ??
    (value?.issue?.pull_request ? value.issue.number : undefined) ??
    value?.workflow_run?.pull_requests?.[0]?.number ??
    null;
}

function writeJson(output: string | undefined, value: unknown): void {
  const json = `${JSON.stringify(value, null, 2)}\n`;
  if (output) {
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, json);
  } else {
    process.stdout.write(json);
  }
}

function parseArgs(argv: string[]): Args {
  const parsed: Args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) {
      parsed[key] = true;
    } else {
      parsed[key] = next;
      i += 1;
    }
  }
  return parsed;
}

function stringArg(args: Args, key: string): string | undefined {
  const value = args[key];
  return typeof value === "string" ? value : undefined;
}

function numberArg(args: Args, key: string): number | undefined {
  const value = stringArg(args, key);
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function env(key: string): string | undefined {
  const value = process.env[key];
  return value && value.length > 0 ? value : undefined;
}

function usage(): void {
  console.log(
    "Usage: node --import tsx scripts/pr-reconcile/cli.ts collect --repository owner/repo --pr 123 --output payload.json\n" +
      "       node --import tsx scripts/pr-reconcile/cli.ts dispatch --payload payload.json --webhook-url https://..."
  );
}
