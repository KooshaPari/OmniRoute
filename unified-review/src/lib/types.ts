import { z } from "zod";

/** Severity levels mapped across all tools */
export const SeveritySchema = z.enum(["P0", "P1", "P2", "P3"]);
export type Severity = z.infer<typeof SeveritySchema>;

/** Finding categories */
export const CategorySchema = z.enum([
  "security",
  "performance",
  "maintainability",
  "style",
  "bug",
  "test",
  "documentation",
]);
export type Category = z.infer<typeof CategorySchema>;

/** All supported review tools */
export const ToolSchema = z.enum([
  "copilot",
  "coderabbit",
  "cursor",
  "forge",
  "kilocode",
  "codeql",
  "codeql-autofix",
]);
export type Tool = z.infer<typeof ToolSchema>;

/** PR events that trigger reviews */
export const ReviewEventSchema = z.enum([
  "opened",
  "synchronize",
  "reopened",
  "labeled",
  "review_requested",
  "manual",
]);
export type ReviewEvent = z.infer<typeof ReviewEventSchema>;

/** A single review finding, normalized across all tools */
export const UnifiedReviewFindingSchema = z.object({
  id: z.string(),
  tool: ToolSchema,
  severity: SeveritySchema,
  category: CategorySchema,
  file: z.string(),
  line_start: z.number().int().min(1),
  line_end: z.number().int().min(1),
  message: z.string(),
  suggestion: z.string().optional(),
  original_severity: z.string(),
  confidence: z.enum(["high", "medium", "low"]),
  commit_sha: z.string(),
});
export type UnifiedReviewFinding = z.infer<typeof UnifiedReviewFindingSchema>;

/** Aggregated review report */
export const UnifiedReviewReportSchema = z.object({
  pr_id: z.string(),
  commit_sha: z.string(),
  tool: ToolSchema,
  findings: z.array(UnifiedReviewFindingSchema),
  summary: z.object({
    total: z.number(),
    by_severity: z.record(z.number()),
    by_category: z.record(z.number()),
    new_findings: z.number(),
    resolved_findings: z.number(),
  }),
  generated_at: z.string(),
  review_url: z.string().optional(),
});
export type UnifiedReviewReport = z.infer<typeof UnifiedReviewReportSchema>;

/** Incoming review request */
export interface ReviewRequest {
  pr: {
    owner: string;
    repo: string;
    number: number;
    head_sha: string;
    base_sha: string;
  };
  event: ReviewEvent;
  preferred_tool?: Tool;
}

/** Response after triggering a review */
export interface ReviewResponse {
  review_id: string;
  tool: Tool;
  status: "queued" | "in_progress" | "completed" | "failed";
  check_run_id?: number;
  findings_count: number;
  url: string;
}

/** Adapter interface for each tool */
export interface ReviewToolAdapter {
  name: Tool;
  /** Trigger a review and return normalized findings */
  review(request: ReviewRequest): Promise<UnifiedReviewReport>;
  /** Check if the tool is available and has quota */
  health(): Promise<{ available: boolean; remaining_quota: number }>;
  /** Cancel an in-progress review */
  cancel?(review_id: string): Promise<void>;
}

/** Queue item for async processing */
export interface ReviewQueueItem {
  id: string;
  request: ReviewRequest;
  assigned_tool: Tool;
  status: "pending" | "processing" | "completed" | "failed";
  created_at: string;
  started_at?: string;
  completed_at?: string;
  error?: string;
  result?: UnifiedReviewReport;
}

/** Configuration for a single tool */
export const ToolConfigSchema = z.object({
  name: ToolSchema,
  weight: z.number().default(1.0),
  quota: z.object({
    reviews_per_day: z.number().default(10),
    reviews_per_hour: z.number().optional(),
    burst: z.number().optional(),
  }),
  enabled: z.boolean().default(true),
  adapter: z.enum(["native", "api", "webhook", "local"]).default("api"),
  config: z.record(z.unknown()).default({}),
});
export type ToolConfig = z.infer<typeof ToolConfigSchema>;

/** Full system configuration */
export const UnifiedReviewConfigSchema = z.object({
  reviewers: z.array(ToolConfigSchema),
  mandatory_checks: z.array(ToolSchema).default(["codeql"]),
  presentation: z.object({
    primary_surface: z.enum(["checks_api", "pr_review", "both"]).default("checks_api"),
    severity_labels: z.record(z.string()).default({
      P0: "Critical",
      P1: "Warning",
      P2: "Info",
      P3: "Suggestion",
    }),
  }),
  incremental: z.object({
    enabled: z.boolean().default(true),
    preserve_findings_on_unchanged_lines: z.boolean().default(true),
  }),
  queue: z.object({
    max_concurrent: z.number().default(3),
    retry_attempts: z.number().default(2),
    retry_delay_ms: z.number().default(5000),
  }),
});
export type UnifiedReviewConfig = z.infer<typeof UnifiedReviewConfigSchema>;
