import { ReviewRequest, UnifiedReviewReport, UnifiedReviewFinding, Tool } from "../types";
import { BaseAdapter } from "./base";
import pino from "pino";

const logger = pino({ name: "unified-review:adapter:forge" });

/** Forge Code via OmniRoute adapter */
export class ForgeAdapter extends BaseAdapter {
  name = "forge" as Tool;

  private omniRouteEndpoint: string;

  constructor(endpoint?: string) {
    super();
    this.omniRouteEndpoint = endpoint || process.env.OMNIROUTE_ENDPOINT || "http://localhost:20128/v1/chat/completions";
  }

  async review(request: ReviewRequest): Promise<UnifiedReviewReport> {
    const { owner, repo, number, head_sha, base_sha } = request.pr;

    logger.info({ pr: `${owner}/${repo}#${number}`, head_sha }, "Starting Forge review");

    try {
      // Fetch the diff
      const diffResponse = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/compare/${base_sha}...${head_sha}`,
        { headers: { Accept: "application/vnd.github.v3.diff" } }
      );
      const diffText = await diffResponse.text();

      if (!diffText || diffText.length < 10) {
        return this.createEmptyReport(request, this.name);
      }

      // Call OmniRoute with Forge as the provider
      const response = await fetch(this.omniRouteEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Provider": "forge",
        },
        body: JSON.stringify({
          model: "forge-code-review",
          messages: [
            {
              role: "system",
              content: `You are a code review assistant. Review the PR diff and output findings as JSON.
For each issue, provide:
- severity: "critical" | "warning" | "info" | "suggestion"
- file: relative path
- line: line number (if applicable)
- message: concise description
- suggestion: optional code fix

Output format:
{
  "findings": [...],
  "summary": "...",
  "stats": { "critical": 0, "warning": 0, "info": 0, "suggestion": 0 }
}`,
            },
            {
              role: "user",
              content: `Review this PR diff:\n\`\`\`diff\n${diffText.slice(0, 50000)}\n\`\`\``,
            },
          ],
          pr_context: { owner, repo, pull_number: number, head_sha, base_sha, diff: diffText },
          temperature: 0.2,
          max_tokens: 4000,
        }),
      });

      if (!response.ok) {
        const err = await response.text();
        throw new Error(`OmniRoute error ${response.status}: ${err}`);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;

      if (!content) {
        return this.createEmptyReport(request, this.name);
      }

      // Parse JSON from response
      let parsed: { findings: any[]; summary?: string; stats?: any };
      try {
        parsed = JSON.parse(content);
      } catch {
        // Try to extract JSON from markdown
        const match = content.match(/\{[\s\S]*\}/);
        if (match) {
          parsed = JSON.parse(match[0]);
        } else {
          throw new Error("Could not parse JSON from Forge response");
        }
      }

      const findings: UnifiedReviewFinding[] = (parsed.findings || []).map((f: any) => ({
        id: this.makeFindingId(f.file, f.line || 1, f.message),
        tool: this.name,
        severity: this.mapSeverity(f.severity, this.name),
        category: this.mapCategory(f.category || "maintainability"),
        file: f.file,
        line_start: f.line || 1,
        line_end: f.line_end || f.line || 1,
        message: f.message,
        suggestion: f.suggestion,
        original_severity: f.severity,
        confidence: f.confidence || "medium",
        commit_sha: request.pr.head_sha,
      }));

      return {
        pr_id: `${owner}:${repo}:${number}`,
        commit_sha: head_sha,
        tool: this.name,
        findings,
        summary: {
          total: findings.length,
          by_severity: findings.reduce((acc: Record<string, number>, f) => { acc[f.severity] = (acc[f.severity] || 0) + 1; return acc; }, {} as Record<string, number>),
          by_category: findings.reduce((acc: Record<string, number>, f) => { acc[f.category] = (acc[f.category] || 0) + 1; return acc; }, {} as Record<string, number>),
          new_findings: findings.length,
          resolved_findings: 0,
        },
        generated_at: new Date().toISOString(),
      };
    } catch (err) {
      logger.error({ err, pr: `${owner}/${repo}#${number}` }, "Forge review failed");
      return this.createEmptyReport(request, this.name);
    }
  }

  async health(): Promise<{ available: boolean; remaining_quota: number }> {
    try {
      const res = await fetch(this.omniRouteEndpoint.replace("/v1/chat/completions", "/health"), { method: "GET" });
      return { available: res.ok, remaining_quota: res.ok ? 1000 : 0 };
    } catch {
      return { available: false, remaining_quota: 0 };
    }
  }
}
