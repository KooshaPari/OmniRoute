import { execFileSync } from "node:child_process";

import {
  normalizeBotComment,
  normalizeCheckRun,
  normalizeReviewThread,
  safeJsonParse,
} from "./core.ts";
import type { BotCommentInput, CheckRunInput, NormalizedFeedback, ReviewThreadInput } from "./core.ts";

export interface GitHubPullRequest {
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

export function readPullRequest(
  repository: string,
  prNumber: number,
  event: unknown
): GitHubPullRequest {
  const fromEvent = eventPullRequest(event);
  if (fromEvent?.number === prNumber) return fromEvent;
  const api = ghJson<GitHubPullRequest>(["api", `repos/${repository}/pulls/${prNumber}`]);
  if (!api) throw new Error(`could not read PR #${prNumber}`);
  return api;
}

export function collectBotComments(repository: string, prNumber: number): NormalizedFeedback[] {
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

export function collectReviewThreads(repository: string, prNumber: number): NormalizedFeedback[] {
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
      normalizeReviewThread(graphqlThreadToInputWithPaginatedComments(node))
    )
    .filter((feedback): feedback is NormalizedFeedback => Boolean(feedback));
}

export function collectCheckRuns(repository: string, headSha: string): NormalizedFeedback[] {
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

export function collectFiles(repository: string, prNumber: number): string[] {
  const files = ghJsonPages<{ filename?: string }>([
    "api",
    `repos/${repository}/pulls/${prNumber}/files`,
  ]);
  return [...new Set((files ?? []).map((file) => file.filename).filter(Boolean) as string[])];
}

export function readCurrentHeadSha(
  repository?: string,
  pullRequestNumber?: number
): string | undefined {
  if (!repository || !pullRequestNumber) return undefined;
  return ghJson<GitHubPullRequest>(["api", `repos/${repository}/pulls/${pullRequestNumber}`])?.head
    .sha;
}

export function eventPullRequest(event: unknown): GitHubPullRequest | null {
  const value = event as {
    pull_request?: GitHubPullRequest;
    workflow_run?: { pull_requests?: GitHubPullRequest[] };
  };
  return value?.pull_request ?? value?.workflow_run?.pull_requests?.[0] ?? null;
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

function graphqlThreadToInputWithPaginatedComments(node: unknown): ReviewThreadInput {
  const input = graphqlThreadToInput(node);
  const value = node as {
    id?: string;
    comments?: { pageInfo?: { hasNextPage?: boolean; endCursor?: string } };
  };
  if (value.comments?.pageInfo?.hasNextPage && value.comments.pageInfo.endCursor && value.id) {
    input.comments.push(...collectReviewComments(value.id, value.comments.pageInfo.endCursor));
  }
  return input;
}

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
      "query=query($threadId:ID!,$cursor:String!){node(id:$threadId){... on PullRequestReviewThread{comments(first:100,after:$cursor){pageInfo{hasNextPage,endCursor}nodes{id,body,url,createdAt,author{login}}}}}}",
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
