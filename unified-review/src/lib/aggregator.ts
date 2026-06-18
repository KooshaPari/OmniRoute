import { UnifiedReviewFinding, UnifiedReviewReport, Severity, Category } from "./types";

const SEVERITY_LABELS: Record<Severity, { emoji: string; label: string }> = {
  P0: { emoji: "🔴", label: "Critical" },
  P1: { emoji: "🟠", label: "Warning" },
  P2: { emoji: "🟡", label: "Info" },
  P3: { emoji: "🟢", label: "Suggestion" },
};

export function normalizeSeverity(original: string): Severity {
  const lower = original.toLowerCase();
  if (["critical", "blocker", "severe", "high"].some((s) => lower.includes(s))) return "P0";
  if (["warning", "major", "medium", "important"].some((s) => lower.includes(s))) return "P1";
  if (["info", "minor", "note"].some((s) => lower.includes(s))) return "P2";
  return "P3";
}

export function normalizeCategory(original: string): Category {
  const lower = original.toLowerCase();
  if (lower.includes("security")) return "security";
  if (lower.includes("performance")) return "performance";
  if (lower.includes("maintainability") || lower.includes("code smell") || lower.includes("complexity")) return "maintainability";
  if (lower.includes("style") || lower.includes("format")) return "style";
  if (lower.includes("bug") || lower.includes("defect")) return "bug";
  if (lower.includes("test") || lower.includes("coverage")) return "test";
  if (lower.includes("doc")) return "documentation";
  return "maintainability";
}

export function deduplicateFindings(findings: UnifiedReviewFinding[]): UnifiedReviewFinding[] {
  const seen = new Set<string>();
  const result: UnifiedReviewFinding[] = [];
  for (const f of findings) {
    const key = `${f.file}:${f.line_start}:${normalizeMessage(f.message)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(f);
  }
  return result;
}

function normalizeMessage(m: string): string {
  return m.toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();
}

export function aggregateReports(reports: UnifiedReviewReport[]): UnifiedReviewReport {
  const all = reports.flatMap((r) => r.findings);
  const deduped = deduplicateFindings(all);
  const bySev: Record<string, number> = {};
  const byCat: Record<string, number> = {};
  for (const f of deduped) {
    bySev[f.severity] = (bySev[f.severity] || 0) + 1;
    byCat[f.category] = (byCat[f.category] || 0) + 1;
  }
  return {
    pr_id: reports[0]?.pr_id || "unknown",
    commit_sha: reports[0]?.commit_sha || "unknown",
    tool: "unified" as any,
    findings: deduped,
    summary: {
      total: deduped.length,
      by_severity: bySev,
      by_category: byCat,
      new_findings: deduped.length,
      resolved_findings: 0,
    },
    generated_at: new Date().toISOString(),
  };
}

export function getConclusion(report: UnifiedReviewReport): "success" | "failure" | "neutral" {
  const p0 = report.summary.by_severity.P0 || 0;
  const p1 = report.summary.by_severity.P1 || 0;
  if (p0 > 0 || p1 > 0) return "failure";
  if ((report.summary.by_severity.P2 || 0) > 0 || (report.summary.by_severity.P3 || 0) > 0) return "neutral";
  return "success";
}

export function mapAnnotations(report: UnifiedReviewReport) {
  return report.findings.map((f) => ({
    path: f.file,
    start_line: f.line_start,
    end_line: f.line_end,
    annotation_level: (
      f.severity === "P0" ? "failure" : f.severity === "P1" ? "warning" : "notice"
    ) as "failure" | "warning" | "notice",
    message: f.message,
    title: `${f.severity} ${f.category}`,
  }));
}

export function formatMarkdownReport(report: UnifiedReviewReport): string {
  const lines: string[] = [];
  const tool = report.tool === ("unified" as any) ? "Unified (multi-tool)" : report.tool;
  lines.push(`## 🔍 AI Code Review — ${tool}`);
  lines.push("");
  lines.push(`**Commit:** \`${report.commit_sha}\``);
  lines.push("");

  // Summary table
  lines.push("| Severity | Count |");
  lines.push("|----------|-------|");
  const severities: Severity[] = ["P0", "P1", "P2", "P3"];
  for (const sev of severities) {
    const c = report.summary.by_severity[sev] || 0;
    if (c > 0) lines.push(`| ${SEVERITY_LABELS[sev].emoji} ${SEVERITY_LABELS[sev].label} | ${c} |`);
  }
  lines.push("");

  // Group findings
  const bySev = new Map<Severity, UnifiedReviewFinding[]>();
  for (const f of report.findings) {
    const arr = bySev.get(f.severity) || [];
    arr.push(f);
    bySev.set(f.severity, arr);
  }

  for (const sev of severities) {
    const findings = bySev.get(sev) || [];
    if (findings.length === 0) continue;
    lines.push(`### ${SEVERITY_LABELS[sev].emoji} ${SEVERITY_LABELS[sev].label} (${findings.length})`);
    lines.push("");
    for (const f of findings) {
      lines.push(`**\`${f.file}:${f.line_start}\`** — [${f.severity}] **${f.message}**`);
      if (f.suggestion) {
        lines.push("> 💡 " + f.suggestion.split("\n").join("\n> "));
      }
      lines.push("");
    }
  }

  lines.push("---");
  lines.push(`*${report.summary.total} findings via ${tool}*`);

  return lines.join("\n");
}
