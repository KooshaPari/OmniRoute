import { ReviewRequest, UnifiedReviewReport, UnifiedReviewFinding, Tool } from "../types";
import { BaseAdapter } from "./base";
import pino from "pino";

const logger = pino({ name: "unified-review:adapter:cloud" });

/** CodeRabbit adapter — uses CodeRabbit's public API (Beta) or webhook capture */
export class CodeRabbitAdapter extends BaseAdapter {
  name = "coderabbit" as Tool;
  private apiKey: string;
  private apiBase: string;

  constructor() {
    super();
    this.apiKey = process.env.CODERABBIT_API_KEY || "";
    this.apiBase = process.env.CODERABBIT_API_BASE || "https://api.coderabbit.ai/v1";
  }

  async review(request: ReviewRequest): Promise<UnifiedReviewReport> {
    const { owner, repo, number, head_sha } = request.pr;
    logger.info({ pr: `${owner}/${repo}#${number}` }, "Starting CodeRabbit review");

    if (!this.apiKey) {
      logger.warn("No CodeRabbit API key — using webhook capture mode");
      // Fallback: rely on CodeRabbit's own PR comment to be picked up by webhook handler
      return this.createEmptyReport(request, this.name);
    }

    try {
      // Trigger review via CodeRabbit API
      const triggerRes = await fetch(`${this.apiBase}/reviews`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          repository: { owner, name: repo },
          pull_request: { number },
          commit_sha: head_sha,
        }),
      });

      if (!triggerRes.ok) {
        throw new Error(`CodeRabbit API error: ${triggerRes.status}`);
      }

      // Poll for results
      const reviewId = (await triggerRes.json()).id;
      return this.pollForResults(owner, repo, number, reviewId, head_sha, request);
    } catch (err) {
      logger.error({ err }, "CodeRabbit review failed");
      return this.createEmptyReport(request, this.name);
    }
  }

  private async pollForResults(
    owner: string, repo: string, number: number,
    reviewId: string, headSha: string, request: ReviewRequest,
  ): Promise<UnifiedReviewReport> {
    const maxAttempts = 60; // 5 minutes at 5s intervals
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise((r) => setTimeout(r, 5000));
      const res = await fetch(`${this.apiBase}/reviews/${reviewId}`, {
        headers: { Authorization: `Bearer ${this.apiKey}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.status === "completed") {
          return this.parseCodeRabbitResponse(data, request);
        }
        if (data.status === "failed") {
          throw new Error(`CodeRabbit review failed: ${data.error}`);
        }
      }
    }
    throw new Error("CodeRabbit review timed out");
  }

  private parseCodeRabbitResponse(data: any, request: ReviewRequest): UnifiedReviewReport {
    const findings: UnifiedReviewFinding[] = (data.findings || []).map((f: any) => ({
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
      pr_id: `${request.pr.owner}:${request.pr.repo}:${request.pr.number}`,
      commit_sha: request.pr.head_sha,
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
  }

  async health(): Promise<{ available: boolean; remaining_quota: number }> {
    if (!this.apiKey) return { available: false, remaining_quota: 0 };
    try {
      const res = await fetch(`${this.apiBase}/usage`, {
        headers: { Authorization: `Bearer ${this.apiKey}` },
      });
      if (!res.ok) return { available: false, remaining_quota: 0 };
      const data = await res.json();
      return { available: true, remaining_quota: data.remaining || 0 };
    } catch {
      return { available: false, remaining_quota: 0 };
    }
  }
}

/** Cursor Review adapter */
export class CursorAdapter extends BaseAdapter {
  name = "cursor" as Tool;
  private apiKey: string;
  private apiBase: string;

  constructor() {
    super();
    this.apiKey = process.env.CURSOR_API_KEY || "";
    this.apiBase = process.env.CURSOR_API_BASE || "https://api.cursor.com/v0";
  }

  async review(request: ReviewRequest): Promise<UnifiedReviewReport> {
    const { owner, repo, number, head_sha } = request.pr;
    logger.info({ pr: `${owner}/${repo}#${number}` }, "Starting Cursor review");

    if (!this.apiKey) {
      return this.createEmptyReport(request, this.name);
    }

    try {
      const res = await fetch(`${this.apiBase}/reviews`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          repository: { owner, name: repo },
          pull_request: { number },
          commit_sha: head_sha,
        }),
      });
      if (!res.ok) throw new Error(`Cursor API error: ${res.status}`);
      const data = await res.json();
      return this.parseResponse(data, request);
    } catch (err) {
      logger.error({ err }, "Cursor review failed");
      return this.createEmptyReport(request, this.name);
    }
  }

  private parseResponse(data: any, request: ReviewRequest): UnifiedReviewReport {
    const findings: UnifiedReviewFinding[] = (data.findings || []).map((f: any) => ({
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
      pr_id: `${request.pr.owner}:${request.pr.repo}:${request.pr.number}`,
      commit_sha: request.pr.head_sha,
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
  }

  async health(): Promise<{ available: boolean; remaining_quota: number }> {
    if (!this.apiKey) return { available: false, remaining_quota: 0 };
    try {
      const res = await fetch(`${this.apiBase}/usage`, { headers: { Authorization: `Bearer ${this.apiKey}` } });
      if (!res.ok) return { available: false, remaining_quota: 0 };
      const data = await res.json();
      return { available: true, remaining_quota: data.tokens_remaining || 0 };
    } catch {
      return { available: false, remaining_quota: 0 };
    }
  }
}

/** KiloCode adapter — free/open-source padding tool */
export class KiloCodeAdapter extends BaseAdapter {
  name = "kilocode" as Tool;
  private apiKey: string;
  private apiBase: string;

  constructor() {
    super();
    this.apiKey = process.env.KILOCODE_API_KEY || "";
    this.apiBase = process.env.KILOCODE_API_BASE || "https://api.kilocode.dev/v1";
  }

  async review(request: ReviewRequest): Promise<UnifiedReviewReport> {
    const { owner, repo, number, head_sha, base_sha } = request.pr;
    logger.info({ pr: `${owner}/${repo}#${number}` }, "Starting KiloCode review");

    if (!this.apiKey) {
      logger.warn("No KiloCode API key — skipping");
      return this.createEmptyReport(request, this.name);
    }

    try {
      // Get diff
      const diffRes = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/compare/${base_sha}...${head_sha}`,
        { headers: { Accept: "application/vnd.github.v3.diff" } }
      );
      const diff = await diffRes.text();

      const res = await fetch(`${this.apiBase}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: "kilocode-code-review",
          messages: [
            {
              role: "system",
              content: "You are a code review assistant. Output findings as JSON: { findings: [{ severity, file, line, message, suggestion? }], summary: string }",
            },
            {
              role: "user",
              content: `Review this diff:\n${diff.slice(0, 30000)}`,
            },
          ],
          temperature: 0.2,
        }),
      });
      if (!res.ok) throw new Error(`KiloCode error ${res.status}`);
      const data = await res.json();
      const content = data.choices?.[0]?.message?.content;
      if (!content) return this.createEmptyReport(request, this.name);

      let parsed: { findings: any[]; summary?: string };
      try { parsed = JSON.parse(content); }
      catch {
        const m = content.match(/\{[\s\S]*\}/);
        if (!m) throw new Error("No JSON in KiloCode response");
        parsed = JSON.parse(m[0]);
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
      logger.error({ err }, "KiloCode review failed");
      return this.createEmptyReport(request, this.name);
    }
  }

  async health(): Promise<{ available: boolean; remaining_quota: number }> {
    if (!this.apiKey) return { available: false, remaining_quota: 0 };
    // KiloCode free tier is typically 50 requests/day
    return { available: true, remaining_quota: 50 };
  }
}

/** Copilot PR Review adapter — handles native Copilot's PR comments */
export class CopilotAdapter extends BaseAdapter {
  name = "copilot" as Tool;

  async review(request: ReviewRequest): Promise<UnifiedReviewReport> {
    const { owner, repo, number, head_sha } = request.pr;
    logger.info({ pr: `${owner}/${repo}#${number}` }, "Capturing Copilot native review");

    try {
      const token = process.env.GITHUB_TOKEN;
      if (!token) return this.createEmptyReport(request, this.name);

      // Fetch existing Copilot PR reviews
      const res = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/pulls/${number}/reviews?per_page=100`,
        { headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" } }
      );
      if (!res.ok) return this.createEmptyReport(request, this.name);
      const reviews = await res.json();

      // Filter to Copilot bot reviews on current commit
      const copilotReviews = reviews.filter(
        (r: any) =>
          (r.user?.login === "github-copilot[bot]" || r.user?.login?.includes("copilot")) &&
          r.commit_id === head_sha
      );

      const findings: UnifiedReviewFinding[] = [];
      for (const review of copilotReviews) {
        if (review.body) {
          findings.push({
            id: this.makeFindingId(`copilot-review-${review.id}`, 1, review.body.slice(0, 100)),
            tool: this.name,
            severity: this.mapSeverity("info", this.name),
            category: "maintainability",
            file: "(summary)",
            line_start: 1,
            line_end: 1,
            message: review.body.slice(0, 500),
            original_severity: "info",
            confidence: "high",
            commit_sha: head_sha,
          });
        }
      }

      // Fetch inline comments
      const commentsRes = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/pulls/${number}/comments?per_page=100`,
        { headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" } }
      );
      if (commentsRes.ok) {
        const comments = await commentsRes.json();
        for (const c of comments) {
          if (c.user?.login === "github-copilot[bot]" || c.user?.login?.includes("copilot")) {
            findings.push({
              id: this.makeFindingId(c.path, c.line || c.position || 1, c.body.slice(0, 100)),
              tool: this.name,
              severity: this.mapSeverity("info", this.name),
              category: "maintainability",
              file: c.path,
              line_start: c.line || c.position || 1,
              line_end: c.line || c.position || 1,
              message: c.body.slice(0, 500),
              original_severity: "info",
              confidence: "medium",
              commit_sha: head_sha,
            });
          }
        }
      }

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
      logger.error({ err }, "Copilot capture failed");
      return this.createEmptyReport(request, this.name);
    }
  }

  async health(): Promise<{ available: boolean; remaining_quota: number }> {
    return { available: true, remaining_quota: 300 }; // Copilot is native
  }
}

/** CodeQL adapter — wraps GitHub Advanced Security alerts */
export class CodeQLAdapter extends BaseAdapter {
  name = "codeql" as Tool;

  async review(request: ReviewRequest): Promise<UnifiedReviewReport> {
    // CodeQL alerts come as a check run; we just capture existing alerts
    const { owner, repo, number, head_sha } = request.pr;
    const token = process.env.GITHUB_TOKEN;
    if (!token) return this.createEmptyReport(request, this.name);

    try {
      const res = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/code-scanning/alerts?ref=${head_sha}&per_page=100`,
        { headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" } }
      );
      if (!res.ok) return this.createEmptyReport(request, this.name);
      const alerts = await res.json();

      const findings = alerts
        .filter((a: any) => a.most_recent_instance?.location?.path)
        .map((a: any) => ({
          id: this.makeFindingId(a.most_recent_instance.location.path, a.most_recent_instance.location.start_line || 1, a.rule?.description || a.rule?.id || ""),
          tool: this.name as Tool,
          severity: this.mapSeverity(a.rule?.security_severity_level || a.rule?.severity || "warning", this.name),
          category: "security" as const,
          file: a.most_recent_instance.location.path,
          line_start: a.most_recent_instance.location.start_line || 1,
          line_end: a.most_recent_instance.location.end_line || a.most_recent_instance.location.start_line || 1,
          message: a.rule?.description || a.rule?.id || "CodeQL alert",
          suggestion: a.rule?.help,
          original_severity: a.rule?.security_severity_level || a.rule?.severity || "warning",
          confidence: "high" as const,
          commit_sha: head_sha,
        }));

      return {
        pr_id: `${owner}:${repo}:${number}`,
        commit_sha: head_sha,
        tool: this.name,
        findings,
        summary: {
          total: findings.length,
          by_severity: findings.reduce((acc: Record<string, number>, f: { severity: string }) => { acc[f.severity] = (acc[f.severity] || 0) + 1; return acc; }, {} as Record<string, number>),
          by_category: findings.reduce((acc: Record<string, number>, f: { category: string }) => { acc[f.category] = (acc[f.category] || 0) + 1; return acc; }, {} as Record<string, number>),
          new_findings: findings.length,
          resolved_findings: 0,
        },
        generated_at: new Date().toISOString(),
      };
    } catch (err) {
      logger.error({ err }, "CodeQL capture failed");
      return this.createEmptyReport(request, this.name);
    }
  }

  async health(): Promise<{ available: boolean; remaining_quota: number }> {
    return { available: true, remaining_quota: 9999 }; // GAS is native
  }
}
