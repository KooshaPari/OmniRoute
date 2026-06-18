import pino from "pino";
import { ReviewRequest, ReviewResponse, UnifiedReviewReport } from "./types";
import { getOrAssignTool } from "./selector";
import { consumeQuota, getDefaultQuota, markDegraded, recordFailure } from "./quota";
import { getAdapter } from "./adapters";
import { getRawDiff } from "./github";
import { loadConfigForRepo } from "./config";
import {
  postUnifiedReview,
  getLastReviewedCommit,
  setLastReviewedCommit,
  getIncrementalDiff,
  extractChangedLines,
  applyDelta,
} from "./poster";
import { aggregateReports } from "./aggregator";

const logger = pino({ name: "unified-review:engine" });

export async function processPR(request: ReviewRequest): Promise<ReviewResponse> {
  const reviewId = `rv_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  logger.info({ pr: request.pr.number, event: request.event }, "Processing PR");

  // 0. Load repo-specific config
  const { config, source: configSource } = await loadConfigForRepo(request.pr.owner, request.pr.repo);
  logger.debug({ pr: request.pr.number, configSource }, "Config resolved");

  // 1. Select tool (sticky)
  const tool = await getOrAssignTool(request, config);
  logger.info({ pr: request.pr.number, tool }, "Tool selected");

  // 2. Check quota
  const quota = getDefaultQuota(tool);
  const newQuota = await consumeQuota(tool, quota, request.pr.owner);
  if (newQuota.remaining < 0) {
    await markDegraded(tool, quota, request.pr.owner, true);
    return { review_id: reviewId, tool, status: "failed", findings_count: 0, url: "" };
  }

  // 3. Get diff
  let diff = "";
  try {
    diff = await getRawDiff(request.pr.owner, request.pr.repo, request.pr.number);
  } catch (err) {
    logger.warn({ err, pr: request.pr.number }, "Failed to fetch diff");
  }

  // 4. Incremental review
  let previousFindings: UnifiedReviewReport["findings"] = [];
  const lastSha = await getLastReviewedCommit(request.pr.owner, request.pr.repo, request.pr.number);
  if (lastSha && lastSha !== request.pr.head_sha) {
    try {
      const changedFiles = await getIncrementalDiff(request, lastSha, request.pr.head_sha);
      const changedLines = extractChangedLines(changedFiles as any);
      // Synthesize previous findings from last check run (simplified — in production, fetch from DB)
      previousFindings = [];
      const trimmed = applyDelta(previousFindings, [], changedLines);
      logger.info({ pr: request.pr.number, lastSha, currentSha: request.pr.head_sha }, "Incremental review mode");
    } catch (err) {
      logger.warn({ err, pr: request.pr.number }, "Incremental diff failed — falling back to full review");
    }
  }

  // 5. Dispatch to tool
  const adapter = getAdapter(tool);
  let report: UnifiedReviewReport;
  try {
    report = await adapter.review({ ...request, preferred_tool: tool });
  } catch (err) {
    logger.error({ err, pr: request.pr.number, tool }, "Adapter failed");
    await recordFailure(tool, quota, request.pr.owner);
    return { review_id: reviewId, tool, status: "failed", findings_count: 0, url: "" };
  }

  // 6. Aggregate
  const finalReport = aggregateReports([report]);

  // 7. Post to GitHub
  const { check_run_id, review_id } = await postUnifiedReview(request, finalReport, tool);
  await setLastReviewedCommit(request.pr.owner, request.pr.repo, request.pr.number, request.pr.head_sha);

  const url = check_run_id
    ? `https://github.com/${request.pr.owner}/${request.pr.repo}/runs/${check_run_id}`
    : `https://github.com/${request.pr.owner}/${request.pr.repo}/pull/${request.pr.number}`;

  return {
    review_id: reviewId,
    tool,
    status: "completed",
    check_run_id: check_run_id ?? undefined,
    findings_count: finalReport.summary.total,
    url,
  };
}
