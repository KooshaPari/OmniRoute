#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { Buffer } from "node:buffer";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

import { buildDispatchRequest, buildReconcilePayload, decodeBase64Json } from "./core.ts";
import { normalizeBotComment, normalizeCheckRun, normalizeReviewThread } from "./core.ts";
import { parseLabels, safeJsonParse, shouldSkipPullRequest } from "./core.ts";
import { getDispatchDecision, isDuplicateEvent } from "./core.ts";
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
  const repository =
    stringArg(args, "repository") ?? stringArg(args, "repo") ?? env("PR_RECONCILE_REPOSITORY");
  if (!repository) throw new Error("collect requires --repository or PR_RECONCILE_REPOSITORY");

  const event = readEvent(stringArg(args, "event-path"));
  const prNumber = numberArg(args, "pr") ?? inferPullRequestNumber(event);
  if (!prNumber) throw new Error("could not infer pull request number");

  const pr = readPullRequest(repository, prNumber, event);
  const labels = parseLabels(pr.labels);
  const attemptCount =
    numberArg(args, "run-attempt") ?? Number(env("PR_RECONCILE_RUN_ATTEMPT") ?? 1);
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
    eventId: inferEventId(args, event),
  });

  writeJson(stringArg(args, "output"), payload);
}

async function dispatch(args: Args): Promise<void> {
  const payloadPath = stringArg(args, "payload");
  if (!payloadPath) throw new Error("dispatch requires --payload");
  const payload = safeJsonParse(fs.readFileSync(payloadPath, "utf8"));
  if (!payload) throw new Error(`invalid JSON payload: ${payloadPath}`);

  const webhookUrl = stringArg(args, "webhook-url") ?? env("KILO_RECONCILE_WEBHOOK_URL");
  const preflight = getDispatchDecision({
    dryRun: Boolean(args["dry-run"]),
    webhookConfigured: Boolean(webhookUrl),
  });
  if (!preflight.dispatch) {
    console.log(
      JSON.stringify(
        {
          dispatched: false,
          dryRun: Boolean(args["dry-run"]),
          reason: preflight.reason,
          payloadBytes: Buffer.byteLength(JSON.stringify(payload), "utf8"),
        },
        null,
        2
      )
    );
    return;
  }

  const payloadValue = payload as {
    repository?: string;
    pullRequest?: { number?: number; headSha?: string };
    eventId?: string;
  };
  if (
    !payloadValue.repository ||
    !payloadValue.pullRequest?.number ||
    !payloadValue.pullRequest.headSha
  ) {
    console.log(
      JSON.stringify({ dispatched: false, reason: "invalid_payload_provenance" }, null, 2)
    );
    return;
  }
  const eventId = payloadValue.eventId;
  const duplicate = eventId ? isDuplicateEvent(eventId, readSeenEventIds()) : false;
  const currentHeadSha = readCurrentHeadSha(
    payloadValue.repository,
    payloadValue.pullRequest?.number
  );
  const decision = getDispatchDecision({
    duplicate,
    expectedHeadSha: payloadValue.pullRequest?.headSha,
    actualHeadSha: currentHeadSha,
  });
  if (!decision.dispatch) {
    console.log(JSON.stringify({ dispatched: false, reason: decision.reason }, null, 2));
    return;
  }

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
  const comments = ghJsonPages<{
    id: number;
    user?: { login?: string };
    body?: string;
    html_url?: string;
    created_at?: string;
  }>(["api", `repos/${repository}/issues/${prNumber}/comments`]);
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
  const nodes: unknown[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < 100; page += 1) {
    const args = [
      "api",
      "graphql",
      "-f",
      `owner=${owner}`,
      "-f",
      `name=${name}`,
      "-F",
      `number=${prNumber}`,
      "-f",
      "query=query($owner:String!,$name:String!,$number:Int!,$cursor:String){repository(owner:$owner,name:$name){pullRequest(number:$number){reviewThreads(first:100,after:$cursor){pageInfo{hasNextPage,endCursor}nodes{id,isResolved,isOutdated,path,line,comments(first:100){pageInfo{hasNextPage,endCursor}nodes{id,body,url,createdAt,author{login}}}}}}}}",
    ];
    if (cursor) args.push("-f", `cursor=${cursor}`);
    const data = ghJson<{
      repository?: {
        pullRequest?: {
          reviewThreads?: {
            nodes?: unknown[];
            pageInfo?: { hasNextPage?: boolean; endCursor?: string };
          };
        };
      };
    }>(args);
    const threads = data?.repository?.pullRequest?.reviewThreads;
    nodes.push(...(threads?.nodes ?? []));
    if (!threads?.pageInfo?.hasNextPage || !threads.pageInfo.endCursor) break;
    cursor = threads.pageInfo.endCursor;
  }
  return nodes
    .map((node) =>
      normalizeReviewThread(graphqlThreadToInputWithPaginatedComments(node, owner, name))
    )
    .filter((feedback): feedback is NormalizedFeedback => Boolean(feedback));
}

function collectCheckRuns(repository: string, headSha: string): NormalizedFeedback[] {
  const runs = ghJsonObjectPages<{
    name: string;
    conclusion?: string;
    status?: string;
    details_url?: string;
    output?: { text?: string; summary?: string };
  }>("check_runs", [
    "api",
    `repos/${repository}/commits/${headSha}/check-runs`,
    "-H",
    "Accept: application/vnd.github+json",
  ]);
  return runs
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
  const files = ghJsonPages<{ filename?: string }>([
    "api",
    `repos/${repository}/pulls/${prNumber}/files`,
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
    comments?: {
      nodes?: Array<{
        id?: string;
        body?: string;
        url?: string;
        createdAt?: string;
        author?: { login?: string };
      }>;
    };
  };
  return {
    id: value.id ?? "review-thread:unknown",
    isResolved: value.isResolved,
    isOutdated: value.isOutdated,
    path: value.path,
    line: value.line,
    comments: (value.comments?.nodes ?? []).map((comment): BotCommentInput => ({
      id: comment.id ?? "review-comment:unknown",
      author: comment.author?.login ?? "unknown",
      body: comment.body ?? "",
      url: comment.url,
      createdAt: comment.createdAt,
    })),
  };
}

function graphqlThreadToInputWithPaginatedComments(
  node: unknown,
  owner: string,
  name: string
): ReviewThreadInput {
  const input = graphqlThreadToInput(node);
  const value = node as {
    id?: string;
    comments?: { pageInfo?: { hasNextPage?: boolean; endCursor?: string } };
  };
  if (value.comments?.pageInfo?.hasNextPage && value.comments.pageInfo.endCursor && value.id) {
    input.comments.push(...collectReviewComments(value.id, value.comments.pageInfo.endCursor));
  }
  return input;

  function collectReviewComments(threadId: string, initialCursor: string): BotCommentInput[] {
    const comments: BotCommentInput[] = [];
    let cursor: string | undefined = initialCursor;
    for (let page = 0; page < 100 && cursor; page += 1) {
      const data = ghJson<{
        node?: {
          comments?: {
            nodes?: Array<{
              id?: string;
              body?: string;
              url?: string;
              createdAt?: string;
              author?: { login?: string };
            }>;
            pageInfo?: { hasNextPage?: boolean; endCursor?: string };
          };
        };
      }>([
        "api",
        "graphql",
        "-f",
        `threadId=${threadId}`,
        "-f",
        `cursor=${cursor}`,
        "-f",
        `query=query($threadId:ID!,$cursor:String!){node(id:$threadId){... on PullRequestReviewThread{comments(first:100,after:$cursor){pageInfo{hasNextPage,endCursor}nodes{id,body,url,createdAt,author{login}}}}}}`,
      ]);
      const pageData = data?.node?.comments;
      comments.push(
        ...(pageData?.nodes ?? []).map((comment): BotCommentInput => ({
          id: comment.id ?? "review-comment:unknown",
          author: comment.author?.login ?? "unknown",
          body: comment.body ?? "",
          url: comment.url,
          createdAt: comment.createdAt,
        }))
      );
      cursor = pageData?.pageInfo?.hasNextPage ? pageData.pageInfo.endCursor : undefined;
    }
    return comments;
  }
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

/** Read every REST page while preserving a flat collection for the normalizers. */
function ghJsonPages<T>(args: string[]): T[] {
  const value = ghJson<unknown>([...args, "--paginate", "--slurp"]);
  if (!Array.isArray(value)) return [];
  if (value.every((page) => Array.isArray(page))) return value.flat() as T[];
  return value as T[];
}

function ghJsonObjectPages<T>(key: string, args: string[]): T[] {
  const value = ghJson<unknown>([...args, "--paginate", "--slurp"]);
  if (!Array.isArray(value)) return [];
  const pages = value.flat();
  return pages.flatMap((page) => {
    if (!page || typeof page !== "object") return [];
    const items = (page as Record<string, unknown>)[key];
    return Array.isArray(items) ? (items as T[]) : [];
  });
}

function readCurrentHeadSha(repository?: string, pullRequestNumber?: number): string | undefined {
  if (!repository || !pullRequestNumber) return undefined;
  return ghJson<GitHubPullRequest>(["api", `repos/${repository}/pulls/${pullRequestNumber}`])?.head
    .sha;
}

function readSeenEventIds(): readonly string[] {
  const encoded = env("PR_RECONCILE_SEEN_EVENT_IDS");
  if (!encoded) return [];
  const parsed = safeJsonParse<unknown>(encoded);
  if (Array.isArray(parsed))
    return parsed.filter((value): value is string => typeof value === "string");
  return encoded
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function readEvent(eventPath?: string): unknown {
  if (eventPath && fs.existsSync(eventPath)) {
    return safeJsonParse(fs.readFileSync(eventPath, "utf8"));
  }
  const encoded = env("PR_RECONCILE_EVENT_JSON_B64");
  return encoded ? decodeBase64Json(encoded) : null;
}

function eventPullRequest(event: unknown): GitHubPullRequest | null {
  const value = event as {
    pull_request?: GitHubPullRequest;
    workflow_run?: { pull_requests?: GitHubPullRequest[] };
  };
  return value?.pull_request ?? value?.workflow_run?.pull_requests?.[0] ?? null;
}

function inferPullRequestNumber(event: unknown): number | null {
  const value = event as {
    pull_request?: { number?: number };
    issue?: { number?: number; pull_request?: unknown };
    workflow_run?: { pull_requests?: Array<{ number?: number }> };
  };
  return (
    value?.pull_request?.number ??
    (value?.issue?.pull_request ? value.issue.number : undefined) ??
    value?.workflow_run?.pull_requests?.[0]?.number ??
    null
  );
}

function inferEventId(args: Args, event: unknown): string | undefined {
  const explicit = stringArg(args, "event-id") ?? env("PR_RECONCILE_EVENT_ID");
  if (explicit) return explicit;
  const value = event as {
    delivery_id?: string;
    workflow_run?: { id?: number };
  };
  return (
    value?.delivery_id ?? (value?.workflow_run?.id ? String(value.workflow_run.id) : undefined)
  );
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
