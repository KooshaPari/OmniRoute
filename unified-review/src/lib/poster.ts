import { Octokit } from "@octokit/rest";
// @ts-ignore - ioredis lacks types in this project
import { Redis } from "ioredis";
import pino from "pino";
import { UnifiedReviewReport, ReviewRequest, UnifiedReviewFinding } from "./types";
import { getOctokit } from "./github";
import { getConclusion, mapAnnotations, formatMarkdownReport } from "./aggregator";

const logger = pino({ name: "unified-review:poster" });
const MAX_ANNOTATIONS = 50;

let _redis: Redis | null = null;
function getRedis(): Redis | null {
  if (_redis) return _redis;
  const url = process.env.REDIS_URL;
  if (!url) return null;
  try {
    _redis = new Redis(url, { maxRetriesPerRequest: 1, lazyConnect: true });
    _redis.connect().catch(() => {});
    return _redis;
  } catch { return null; }
}
const memLastCommit = new Map<string, string>();
function lastCommitKey(owner: string, repo: string, pr: number) { return `lastcommit:${owner}:${repo}:${pr}`; }

export async function getLastReviewedCommit(owner: string, repo: string, pr: number): Promise<string | null> {
  const k = lastCommitKey(owner, repo, pr);
  const redis = getRedis();
  if (redis?.status === "ready") { try { return await redis.get(k); } catch {} }
  return memLastCommit.get(k) || null;
}

export async function setLastReviewedCommit(owner: string, repo: string, pr: number, sha: string) {
  const k = lastCommitKey(owner, repo, pr);
  memLastCommit.set(k, sha);
  const redis = getRedis();
  if (redis?.status === "ready") { try { await redis.set(k, sha); } catch {} }
}

export async function getInstallationOctokit(_owner: string, _repo: string): Promise<Octokit> {
  // Returns the app's octokit; for installation-token specific, callers can pass a token.
  return getOctokit();
}

export async function postCheckRun(req: ReviewRequest, report: UnifiedReviewReport, tool: string): Promise<number | null> {
  try {
    const octokit = await getInstallationOctokit(req.pr.owner, req.pr.repo);
    const conclusion = getConclusion(report);
    const annotations = mapAnnotations(report).slice(0, MAX_ANNOTATIONS);
    const truncated = report.findings.length > MAX_ANNOTATIONS
      ? `\n\n*(${report.findings.length - MAX_ANNOTATIONS} additional findings not shown — see dashboard)*`
      : "";
    const markdown = formatMarkdownReport(report);
    const res = await octokit.rest.checks.create({
      owner: req.pr.owner,
      repo: req.pr.repo,
      name: `AI Code Review — ${tool}`,
      head_sha: req.pr.head_sha,
      status: "completed",
      conclusion,
      output: {
        title: `${report.summary.total} findings — ${report.summary.by_severity.P0 || 0} critical, ${report.summary.by_severity.P1 || 0} warnings`,
        summary: `Reviewed by ${tool}. ${report.summary.total} findings.`,
        text: markdown + truncated,
        annotations,
      },
    });
    return res.data.id;
  } catch (err) {
    logger.error({ err, pr: req.pr.number }, "postCheckRun failed");
    return null;
  }
}

export async function postPRReview(req: ReviewRequest, report: UnifiedReviewReport, tool: string): Promise<number | null> {
  try {
    const octokit = await getInstallationOctokit(req.pr.owner, req.pr.repo);
    const markdown = formatMarkdownReport(report);
    const comments = report.findings.slice(0, MAX_ANNOTATIONS).map((f) => ({
      path: f.file,
      line: f.line_start,
      body: `[${f.severity}] **${f.message}**${f.suggestion ? `\n\n\`\`\`suggestion\n${f.suggestion}\n\`\`\`` : ""}`,
    }));
    const res = await octokit.rest.pulls.createReview({
      owner: req.pr.owner,
      repo: req.pr.repo,
      pull_number: req.pr.number,
      commit_id: req.pr.head_sha,
      body: markdown,
      event: "COMMENT" as const,
      comments: comments as any,
    });
    return res.data.id;
  } catch (err) {
    logger.error({ err, pr: req.pr.number }, "postPRReview failed");
    return null;
  }
}

export async function postUnifiedReview(req: ReviewRequest, report: UnifiedReviewReport, tool: string) {
  const mode = process.env.POSTING_MODE || "checks_api";
  const checkRunId = await postCheckRun(req, report, tool);
  let reviewId: number | null = null;
  if (mode === "both" || mode === "pr_review") reviewId = await postPRReview(req, report, tool);
  return { check_run_id: checkRunId, review_id: reviewId };
}

/** Get changed lines between two commits for delta-based review */
export async function getIncrementalDiff(req: ReviewRequest, previousSha: string, currentSha: string) {
  try {
    const octokit = await getInstallationOctokit(req.pr.owner, req.pr.repo);
    const { data } = await octokit.rest.repos.compareCommits({
      owner: req.pr.owner, repo: req.pr.repo, base: previousSha, head: currentSha,
    });
    return data.files || [];
  } catch (err) {
    logger.error({ err, pr: req.pr.number }, "getIncrementalDiff failed");
    return [];
  }
}

export function extractChangedLines(diff: { filename?: string; patch?: string }[]): Map<string, Set<number>> {
  const out = new Map<string, Set<number>>();
  for (const f of diff) {
    if (!f.filename || !f.patch) continue;
    const lines = new Set<number>();
    let currentLine = 0;
    for (const raw of f.patch.split("\n")) {
      if (raw.startsWith("@@")) {
        const m = raw.match(/\+(\d+)/);
        if (m) currentLine = parseInt(m[1], 10) - 1;
      } else if (raw.startsWith("+") && !raw.startsWith("+++")) {
        currentLine++;
        lines.add(currentLine);
      } else if (!raw.startsWith("-")) {
        currentLine++;
      }
    }
    out.set(f.filename, lines);
  }
  return out;
}

/** Apply delta review: preserve findings on unchanged lines, add new findings, drop findings on changed lines */
export function applyDelta(previous: UnifiedReviewFinding[], current: UnifiedReviewFinding[], changed: Map<string, Set<number>>): UnifiedReviewFinding[] {
  const isOnChangedLine = (f: UnifiedReviewFinding) => {
    const lines = changed.get(f.file);
    if (!lines) return false;
    for (let l = f.line_start; l <= f.line_end; l++) if (lines.has(l)) return true;
    return false;
  };
  // Drop prior findings on changed lines (they'll be re-emitted by current if still valid)
  const preserved = previous.filter((f) => !isOnChangedLine(f));
  return deduplicateByKey([...preserved, ...current]);
}

function deduplicateByKey(findings: UnifiedReviewFinding[]): UnifiedReviewFinding[] {
  const seen = new Set<string>();
  const out: UnifiedReviewFinding[] = [];
  for (const f of findings) {
    const k = `${f.file}:${f.line_start}:${f.message.toLowerCase().replace(/[^a-z0-9 ]/g, "").trim()}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(f);
  }
  return out;
}
