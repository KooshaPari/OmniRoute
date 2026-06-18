import { ReviewToolAdapter, ReviewRequest, UnifiedReviewReport, UnifiedReviewFinding, Tool, Severity, Category } from "../types";
import { loadConfig } from "../config";

/** Base class — all adapters should extend this */
export abstract class BaseAdapter implements ReviewToolAdapter {
  abstract name: Tool;

  abstract review(request: ReviewRequest): Promise<UnifiedReviewReport>;
  abstract health(): Promise<{ available: boolean; remaining_quota: number }>;

  async cancel?(_review_id: string): Promise<void> {
    // noop by default
  }

  protected createEmptyReport(request: ReviewRequest, tool: Tool): UnifiedReviewReport {
    return {
      pr_id: `${request.pr.owner}:${request.pr.repo}:${request.pr.number}`,
      commit_sha: request.pr.head_sha,
      tool,
      findings: [],
      summary: { total: 0, by_severity: {}, by_category: {}, new_findings: 0, resolved_findings: 0 },
      generated_at: new Date().toISOString(),
    };
  }

  /** Map tool-specific severity to P0–P3 */
  protected mapSeverity(original: string, tool: Tool): Severity {
    const lower = original.toLowerCase();
    if (["critical", "blocker", "error", "high", "severe"].some((s) => lower.includes(s))) return "P0";
    if (["warning", "major", "medium", "important"].some((s) => lower.includes(s))) return "P1";
    if (["info", "minor", "low", "note"].some((s) => lower.includes(s))) return "P2";
    return "P3";
  }

  /** Map tool-specific category to standard */
  protected mapCategory(original: string): Category {
    const lower = original.toLowerCase();
    if (lower.includes("security")) return "security";
    if (lower.includes("performance")) return "performance";
    if (lower.includes("maintainability") || lower.includes("code smell")) return "maintainability";
    if (lower.includes("style") || lower.includes("format")) return "style";
    if (lower.includes("bug") || lower.includes("error")) return "bug";
    if (lower.includes("test")) return "test";
    if (lower.includes("doc")) return "documentation";
    return "maintainability";
  }

  /** Generate unique finding ID for dedup */
  protected makeFindingId(file: string, line: number, message: string): string {
    const str = `${file}:${line}:${message}`;
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash |= 0;
    }
    return `${this.name}-${Math.abs(hash).toString(36)}`;
  }
}
