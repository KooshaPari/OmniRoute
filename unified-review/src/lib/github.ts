import { Octokit } from "@octokit/rest";
import { createAppAuth } from "@octokit/auth-app";
import pino from "pino";

const logger = pino({ name: "unified-review:github" });

let _octokit: Octokit | null = null;

export function getOctokit(): Octokit {
  if (_octokit) return _octokit;

  const appId = process.env.GITHUB_APP_ID;
  const privateKey = process.env.GITHUB_PRIVATE_KEY?.replace(/\\n/g, "\n");
  const installationId = process.env.GITHUB_INSTALLATION_ID;
  const token = process.env.GITHUB_TOKEN;

  // Fallback to PAT if no App credentials
  if (token && !appId) {
    logger.info("Using personal access token auth");
    _octokit = new Octokit({ auth: token });
    return _octokit;
  }

  if (!appId || !privateKey) {
    // Dev mode — use unauthenticated client (will fail for PRIVATE repos)
    logger.warn("No GitHub credentials configured — using unauthenticated client");
    _octokit = new Octokit();
    return _octokit;
  }

  logger.info("Starting GitHub App auth");
  const auth = createAppAuth({ appId, privateKey });
  _octokit = new Octokit({
    authStrategy: createAppAuth,
    auth: installationId
      ? { appId, privateKey, installationId }
      : { appId, privateKey },
  });
  return _octokit;
}

// ─── Checks API ──────────────────────────────────────────────────

export type AnnotationLevel = "failure" | "warning" | "notice";

export interface CheckRunOutput {
  title: string;
  summary: string;
  text: string;
  annotations: Array<{
    path: string;
    start_line: number;
    end_line: number;
    annotation_level: AnnotationLevel;
    message: string;
    title?: string;
  }>;
}

export async function createCheckRun(
  owner: string,
  repo: string,
  headSha: string,
  name: string,
  conclusion: "success" | "failure" | "neutral" | "cancelled" | "timed_out" | "action_required",
  output: CheckRunOutput,
  detailsUrl?: string,
) {
  const client = getOctokit();
  const { data } = await client.rest.checks.create({
    owner,
    repo,
    name: `AI Code Review — ${name}`,
    head_sha: headSha,
    status: "completed",
    conclusion,
    output: {
      title: output.title.slice(0, 255),
      summary: output.summary.slice(0, 65535),
      text: output.text?.slice(0, 65535) || "",
      annotations: output.annotations.slice(0, 50),
    },
    details_url: detailsUrl,
  });
  logger.info({ check_run_id: data.id, name }, "Check run created");
  return data;
}

// ─── PR Reviews API ──────────────────────────────────────────────

export async function createPRReview(
  owner: string,
  repo: string,
  pullNumber: number,
  headSha: string,
  body: string,
  comments: Array<{ path: string; position: number; body: string }>,
) {
  const client = getOctokit();
  const { data } = await client.rest.pulls.createReview({
    owner,
    repo,
    pull_number: pullNumber,
    commit_id: headSha,
    body: body.slice(0, 65536),
    event: "COMMENT",
    comments: comments.slice(0, 25).map((c) => ({
      path: c.path,
      position: c.position,
      body: c.body.slice(0, 65535),
    })),
  });
  logger.info({ review_id: data.id, pullNumber }, "PR review created");
  return data;
}

// ─── Labels ──────────────────────────────────────────────────────

export async function addLabels(
  owner: string,
  repo: string,
  pullNumber: number,
  labels: string[],
) {
  const client = getOctokit();
  await client.rest.issues.addLabels({
    owner,
    repo,
    issue_number: pullNumber,
    labels,
  });
}

export async function removeLabel(
  owner: string,
  repo: string,
  pullNumber: number,
  label: string,
) {
  const client = getOctokit();
  try {
    await client.rest.issues.removeLabel({
      owner,
      repo,
      issue_number: pullNumber,
      name: label,
    });
  } catch (err: any) {
    if (err.status !== 404) throw err;
  }
}

export async function getLabels(
  owner: string,
  repo: string,
  pullNumber: number,
): Promise<string[]> {
  const client = getOctokit();
  const { data } = await client.rest.issues.listLabelsOnIssue({
    owner,
    repo,
    issue_number: pullNumber,
  });
  return data.map((l) => l.name);
}

// ─── Diffs ───────────────────────────────────────────────────────

export async function getDiff(
  owner: string,
  repo: string,
  base: string,
  head: string,
) {
  const client = getOctokit();
  const { data } = await client.rest.repos.compareCommits({
    owner,
    repo,
    base,
    head,
  });
  return data;
}

export async function getRawDiff(
  owner: string,
  repo: string,
  pullNumber: number,
): Promise<string> {
  const client = getOctokit();
  const { data } = await client.rest.pulls.get({
    owner,
    repo,
    pull_number: pullNumber,
    mediaType: { format: "diff" },
  });
  return data as unknown as string;
}

// ─── Repo content ─────────────────────────────────────────────────────────

/** Fetch a file from the repo's default branch — used for .unified-review.yaml lookup */
export async function getRepoFile(
  owner: string,
  repo: string,
  path: string,
  ref?: string,
): Promise<string | null> {
  try {
    const client = getOctokit();
    const { data } = await client.rest.repos.getContent({
      owner,
      repo,
      path,
      ref,
    });
    if (Array.isArray(data) || data.type !== "file") return null;
    if ("content" in data && data.encoding === "base64") {
      return Buffer.from(data.content, "base64").toString("utf-8");
    }
    return null;
  } catch (err: unknown) {
    // 404 is normal — file doesn't exist
    const status = (err as { status?: number })?.status;
    if (status !== 404) logger.warn({ err, owner, repo, path }, "getRepoFile error");
    return null;
  }
}

// ─── PR Metadata ─────────────────────────────────────────────────

export async function getPullRequest(
  owner: string,
  repo: string,
  pullNumber: number,
) {
  const client = getOctokit();
  return client.rest.pulls.get({ owner, repo, pull_number: pullNumber });
}

// ─── Webhook verification ────────────────────────────────────────

import { verify } from "@octokit/webhooks-methods";

export async function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string,
): Promise<boolean> {
  return verify(secret, payload, signature);
}
